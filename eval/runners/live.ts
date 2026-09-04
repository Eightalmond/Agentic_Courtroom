import {
  fingerprintEvidenceBundle,
} from "@/lib/courtroom/fingerprints";
import { generateCourtroomArgument, generateJudgeVerdict } from "@/lib/courtroom/service";
import type { CourtroomArgumentRecord, JudgeVerdictRecord } from "@/lib/courtroom/types";
import { collectEvidenceBundle } from "@/lib/evidence/collector";
import type { EvidenceBundle } from "@/lib/evidence/types";
import { createSimulationProvider } from "@/lib/simulation/providers/factory";
import type { StructuredGenerationProvider } from "@/lib/simulation/provider";
import { runSimulationStep } from "@/lib/simulation/step";
import type { SimulationState } from "@/lib/simulation/types";
import {
  applySimulationFailure,
  applySimulationStep,
  createReadyRun,
  toEvidenceCollectionRequest,
  toSimulationStepRequest,
  type TestRun,
} from "@/lib/test-runs";

import {
  aggregateCourtroom,
  aggregateCustomers,
  aggregateEvidence,
  aggregateJudge,
  courtroomCaseMetrics,
} from "../metrics/aggregates";
import {
  actionBehavior,
  aggregateEndToEnd,
  aggregatePersonas,
  allArgumentCitationLists,
  allJudgeCitationLists,
  citationValidity,
  endToEndSuccess,
} from "../metrics/core";
import {
  deterministicEvidenceConsistency,
  evidenceDeduplicationIntegrity,
  evidenceSourceIntegrity,
  requiredEvidenceRepresentation,
  seenUnseenEvidenceCorrectness,
} from "../metrics/evidence";
import {
  createReliabilityCounter,
  finalizeReliability,
  recordProviderFailure,
  type MutableReliability,
} from "../metrics/reliability";
import { courtroomBenchmarkFixtures } from "../fixtures/courtroom";
import { FIXED_TIME } from "../fixtures/customer";
import {
  correctnessFromFactChecks,
  type BenchmarkCase,
  type CourtroomCaseResult,
  type CustomerCaseResult,
  type EndToEndCaseResult,
  type EvidenceCaseResult,
  type HumanReviewRow,
  type JudgeCaseResult,
  type LiveEvaluation,
} from "../types";

export type LiveRunOutput = Readonly<{
  metrics: LiveEvaluation;
  reviewRows: readonly HumanReviewRow[];
}>;

function instrumentProvider(base: StructuredGenerationProvider, reliability: MutableReliability): StructuredGenerationProvider {
  return {
    provider: base.provider,
    async decide(input) {
      reliability.attemptedProviderCalls += 1;
      return base.decide(input);
    },
    async generateStructured(input) {
      reliability.attemptedProviderCalls += 1;
      return base.generateStructured(input);
    },
  };
}

function markGenerationFailure(reliability: MutableReliability, error: unknown) {
  const code = recordProviderFailure(reliability, error);
  if (code === "INVALID_TOOL_ACTION" || code.includes("INVALID_CITATION")) {
    reliability.successfulProviderCalls += 1;
  }
  return code;
}

function buildArgumentRecord(
  fixture: (typeof courtroomBenchmarkFixtures)[number],
  role: "prosecutor" | "defense",
  provider: StructuredGenerationProvider["provider"],
): CourtroomArgumentRecord {
  const argument = role === "prosecutor" ? fixture.prosecutorArgument : fixture.defenseArgument;
  return {
    argument,
    createdAt: FIXED_TIME,
    provider,
    evidenceBundleId: fixture.evidenceBundle.bundleId,
    evidenceBundleVersion: fixture.evidenceBundle.version,
    evidenceBundleFingerprint: fingerprintEvidenceBundle(fixture.evidenceBundle),
    role,
  };
}

function evidenceMetricsFor(
  bundle: EvidenceBundle,
  repeatedBundle: EvidenceBundle,
  benchmarkCase: BenchmarkCase,
  run: TestRun,
): EvidenceCaseResult {
  return {
    runId: run.id,
    taskId: run.taskId,
    sourceIntegrity: evidenceSourceIntegrity(bundle),
    requiredRepresentationCoverage: requiredEvidenceRepresentation(bundle, benchmarkCase.requiredSourceSectionIds),
    seenUnseenCorrectness: seenUnseenEvidenceCorrectness(bundle, run.actions),
    deduplicationIntegrity: evidenceDeduplicationIntegrity(bundle),
    deterministicConsistency: deterministicEvidenceConsistency(bundle, repeatedBundle),
  };
}

async function runLiveCase(
  benchmarkCase: BenchmarkCase,
  trial: number,
  model: string,
  provider: StructuredGenerationProvider,
  reliability: MutableReliability,
) {
  const startedCalls = reliability.attemptedProviderCalls;
  const startedFailures = reliability.attemptedProviderCalls - reliability.successfulProviderCalls;
  const now = new Date().toISOString();
  let run = createReadyRun(
    {
      taskId: benchmarkCase.taskId,
      personaId: benchmarkCase.defaultPersonaId,
      maxActions: benchmarkCase.maxActions,
    },
    { id: `run-eval-live-${benchmarkCase.taskId}-${trial}-${Date.now()}`, createdAt: now },
  );
  let invalidToolDecisions = 0;
  let customerErrorCode: string | null = null;

  while (run.status !== "completed" && run.currentActionCount < run.maxActions) {
    try {
      const response = await runSimulationStep(toSimulationStepRequest(run), provider);
      reliability.successfulProviderCalls += 1;
      run = applySimulationStep(run, response);
    } catch (error) {
      const code = markGenerationFailure(reliability, error);
      customerErrorCode = code;
      if (code === "INVALID_TOOL_ACTION") invalidToolDecisions += 1;
      const state = typeof error === "object" && error !== null && "simulation" in error
        ? error.simulation as SimulationState
        : null;
      if (state) run = applySimulationFailure(run, state, state.lastError);
      break;
    }
  }

  let bundle: EvidenceBundle | null = null;
  let repeatedBundle: EvidenceBundle | null = null;
  let evidenceError: string | null = null;
  if (run.status === "completed") {
    try {
      const request = toEvidenceCollectionRequest(run);
      bundle = collectEvidenceBundle(request, { now: FIXED_TIME });
      repeatedBundle = collectEvidenceBundle(request, { now: "2026-01-02T00:00:00.000Z" });
    } catch (error) {
      evidenceError = error instanceof Error ? error.message : "Evidence collection failed.";
    }
  }

  const correctness = correctnessFromFactChecks(bundle?.factChecks.map((check) => check.result) ?? []);
  const behavior = actionBehavior(run.actions);
  const requiredEvidenceCoverage = bundle?.coverage.requiredEvidenceTotal
    ? bundle.coverage.requiredEvidenceSeen / bundle.coverage.requiredEvidenceTotal
    : 0;
  const customerCase: CustomerCaseResult = {
    runId: run.id,
    benchmarkId: benchmarkCase.benchmarkId,
    taskId: run.taskId,
    personaId: run.personaId,
    provider: provider.provider,
    model,
    maxActions: run.maxActions,
    successfulCustomerActions: run.currentActionCount,
    modelRequestAttempts: run.modelCallCount,
    providerFailures: (reliability.attemptedProviderCalls - reliability.successfulProviderCalls) - startedFailures,
    ...behavior,
    finalAnswer: run.finalAnswer,
    finalConfidence: run.finalConfidence,
    gaveUp: run.completionReason === "gave_up",
    budgetExhausted: run.completionReason === "budget_exhausted",
    invalidToolDecisions,
    completionStatus: run.completionReason ?? run.status,
    correctness,
    requiredEvidenceCoverage,
    groundingFailure: invalidToolDecisions > 0 || correctness === "unsupported" || correctness === "contradicted",
    actions: run.actions,
  };

  let prosecutor: CourtroomArgumentRecord | null = null;
  let defense: CourtroomArgumentRecord | null = null;
  let advocateAttempts = 0;
  let advocateSuccesses = 0;
  const courtroomErrors: string[] = [];
  if (bundle) {
    for (const role of ["prosecutor", "defense"] as const) {
      advocateAttempts += 1;
      try {
        const record = await generateCourtroomArgument(
          { runId: run.id, role, evidenceBundle: bundle },
          { createProvider: () => provider, now: () => FIXED_TIME },
        );
        reliability.successfulProviderCalls += 1;
        advocateSuccesses += 1;
        if (role === "prosecutor") prosecutor = record;
        else defense = record;
      } catch (error) {
        courtroomErrors.push(`${role}:${markGenerationFailure(reliability, error)}`);
      }
    }
  }

  let courtroomCase: CourtroomCaseResult | null = null;
  if (bundle && prosecutor && defense) {
    const sameEvidence = prosecutor.evidenceBundleId === defense.evidenceBundleId
      && prosecutor.evidenceBundleVersion === defense.evidenceBundleVersion
      && prosecutor.evidenceBundleFingerprint === defense.evidenceBundleFingerprint
      && prosecutor.evidenceBundleFingerprint === fingerprintEvidenceBundle(bundle);
    courtroomCase = courtroomCaseMetrics(
      run.id,
      bundle,
      prosecutor.argument,
      defense.argument,
      sameEvidence ? 1 : 0,
    );
  }

  let judge: JudgeVerdictRecord | null = null;
  let judgeError: string | null = null;
  if (bundle && prosecutor && defense) {
    try {
      judge = await generateJudgeVerdict(
        { runId: run.id, maxActions: run.maxActions, evidenceBundle: bundle, prosecutor, defense },
        { createProvider: () => provider, now: () => FIXED_TIME },
      );
      reliability.successfulProviderCalls += 1;
    } catch (error) {
      judgeError = markGenerationFailure(reliability, error);
    }
  }

  const advocateCitationsValid = Boolean(
    bundle && prosecutor && defense
    && citationValidity(allArgumentCitationLists(prosecutor.argument), bundle) === 1
    && citationValidity(allArgumentCitationLists(defense.argument), bundle) === 1,
  );
  const judgeCitationsValid = Boolean(
    bundle && judge && citationValidity(allJudgeCitationLists(judge.verdict), bundle) === 1,
  );
  const outcome = endToEndSuccess({
    customerAnswered: run.completionReason === "answer",
    correctness,
    evidenceBuilt: Boolean(bundle),
    prosecutorSucceeded: Boolean(prosecutor),
    defenseSucceeded: Boolean(defense),
    advocateCitationsValid,
    judgeSucceeded: Boolean(judge),
    judgeCitationsValid,
  });
  const failures = [
    ...(customerErrorCode ? [`customer:${customerErrorCode}`] : []),
    ...(evidenceError ? [`evidence:${evidenceError}`] : []),
    ...courtroomErrors,
    ...(judgeError ? [`judge:${judgeError}`] : []),
    ...(run.completionReason !== "answer" ? [`customer:${run.completionReason ?? run.status}`] : []),
    ...(correctness !== "fully-supported" ? [`answer:${correctness}`] : []),
  ];
  const endToEndCase: EndToEndCaseResult = {
    runId: run.id,
    taskId: run.taskId,
    ...outcome,
    llmCalls: reliability.attemptedProviderCalls - startedCalls,
    successfulCustomerActions: run.currentActionCount,
    failures,
  };
  const evidenceCase = bundle && repeatedBundle
    ? evidenceMetricsFor(bundle, repeatedBundle, benchmarkCase, run)
    : null;
  const reviewRow: HumanReviewRow = {
    runId: run.id,
    task: benchmarkCase.question,
    persona: benchmarkCase.defaultPersonaId,
    customerAnswer: run.finalAnswer,
    customerJourney: run.actions,
    verdict: judge?.verdict.verdict ?? null,
    recommendation: judge?.verdict.recommendation.action ?? null,
    humanRating: {
      answerCorrect: null,
      journeyRealistic: null,
      prosecutorQuality: null,
      defenseQuality: null,
      judgeQuality: null,
      notes: "",
    },
  };
  return {
    customerCase,
    evidenceCase,
    courtroomCase,
    endToEndCase,
    reviewRow,
    advocateAttempts,
    advocateSuccesses,
  };
}

async function evaluateJudgeFixtures(
  fixtures: readonly (typeof courtroomBenchmarkFixtures)[number][],
  provider: StructuredGenerationProvider,
  reliability: MutableReliability,
) {
  const results: JudgeCaseResult[] = [];
  for (const fixture of fixtures) {
    const prosecutor = buildArgumentRecord(fixture, "prosecutor", provider.provider);
    const defense = buildArgumentRecord(fixture, "defense", provider.provider);
    try {
      const record = await generateJudgeVerdict({
        runId: fixture.evidenceBundle.runId,
        maxActions: fixture.evidenceBundle.completionReason === "budget_exhausted"
          ? fixture.evidenceBundle.integrity.actionsProcessed
          : Math.max(3, fixture.evidenceBundle.integrity.actionsProcessed),
        evidenceBundle: fixture.evidenceBundle,
        prosecutor,
        defense,
      }, { createProvider: () => provider, now: () => FIXED_TIME });
      reliability.successfulProviderCalls += 1;
      results.push({
        fixtureId: fixture.fixtureId,
        taskId: fixture.taskId,
        expectedVerdict: fixture.expectedVerdict,
        actualVerdict: record.verdict.verdict,
        exactMatch: record.verdict.verdict === fixture.expectedVerdict,
        citationValidity: citationValidity(allJudgeCitationLists(record.verdict), fixture.evidenceBundle),
        recommendationGrounding: citationValidity([record.verdict.recommendation.evidenceIds], fixture.evidenceBundle),
        confidence: record.verdict.confidence,
        errorCode: null,
      });
    } catch (error) {
      results.push({
        fixtureId: fixture.fixtureId,
        taskId: fixture.taskId,
        expectedVerdict: fixture.expectedVerdict,
        actualVerdict: null,
        exactMatch: false,
        citationValidity: 0,
        recommendationGrounding: 0,
        confidence: null,
        errorCode: markGenerationFailure(reliability, error),
      });
    }
  }
  return aggregateJudge(results);
}

export async function runLiveEvaluation(input: {
  cases: readonly BenchmarkCase[];
  trials: number;
  model: string;
  baseProvider?: StructuredGenerationProvider;
}): Promise<LiveRunOutput> {
  const reliabilityCounter = createReliabilityCounter();
  const provider = instrumentProvider(input.baseProvider ?? createSimulationProvider(), reliabilityCounter);
  const customerCases: CustomerCaseResult[] = [];
  const evidenceCases: EvidenceCaseResult[] = [];
  const courtroomCases: CourtroomCaseResult[] = [];
  const endToEndCases: EndToEndCaseResult[] = [];
  const reviewRows: HumanReviewRow[] = [];
  let advocateAttempts = 0;
  let advocateSuccesses = 0;

  for (const benchmarkCase of input.cases) {
    for (let trial = 1; trial <= input.trials; trial += 1) {
      const result = await runLiveCase(benchmarkCase, trial, input.model, provider, reliabilityCounter);
      customerCases.push(result.customerCase);
      if (result.evidenceCase) evidenceCases.push(result.evidenceCase);
      if (result.courtroomCase) courtroomCases.push(result.courtroomCase);
      endToEndCases.push(result.endToEndCase);
      reviewRows.push(result.reviewRow);
      advocateAttempts += result.advocateAttempts;
      advocateSuccesses += result.advocateSuccesses;
    }
  }

  const selectedTaskIds = new Set(input.cases.map((item) => item.taskId));
  const selectedJudgeFixtures = courtroomBenchmarkFixtures.filter((fixture) => selectedTaskIds.has(fixture.taskId));
  const judge = await evaluateJudgeFixtures(selectedJudgeFixtures, provider, reliabilityCounter);
  const reliability = finalizeReliability(reliabilityCounter);
  return {
    metrics: {
      customer: aggregateCustomers(customerCases),
      evidence: aggregateEvidence(evidenceCases),
      courtroom: aggregateCourtroom(
        courtroomCases,
        advocateAttempts,
        advocateSuccesses,
      ),
      judge,
      endToEnd: aggregateEndToEnd(endToEndCases, reliability),
      personas: aggregatePersonas(customerCases),
      reliability,
    },
    reviewRows,
  };
}

export function estimateMaximumProviderCalls(cases: readonly BenchmarkCase[], trials: number) {
  const endToEndCalls = cases.reduce((sum, benchmarkCase) => sum + ((benchmarkCase.maxActions + 3) * trials), 0);
  const selectedIds = new Set(cases.map((item) => item.taskId));
  const judgeFixtureCalls = courtroomBenchmarkFixtures.filter((fixture) => selectedIds.has(fixture.taskId)).length;
  return endToEndCalls + judgeFixtureCalls;
}
