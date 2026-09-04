import { searchProductKnowledge } from "@/lib/retrieval";

import {
  aggregateCourtroom,
  aggregateCustomers,
  aggregateEvidence,
  aggregateRetrieval,
  courtroomCaseMetrics,
} from "../metrics/aggregates";
import { actionBehavior, recallAtK, requiredSectionCoverage } from "../metrics/core";
import {
  deterministicEvidenceConsistency,
  evidenceDeduplicationIntegrity,
  evidenceSourceIntegrity,
  requiredEvidenceRepresentation,
  seenUnseenEvidenceCorrectness,
} from "../metrics/evidence";
import { benchmarkManifest, deterministicDecisionFixtures, validateBenchmarkManifest } from "../fixtures/benchmark";
import { courtroomBenchmarkFixtures } from "../fixtures/courtroom";
import { buildFixtureEvidence, buildFixtureRun } from "../fixtures/customer";
import {
  correctnessFromFactChecks,
  type BenchmarkCase,
  type CourtroomEvaluation,
  type CustomerCaseResult,
  type CustomerEvaluation,
  type EvidenceCaseResult,
  type EvidenceEvaluation,
  type RetrievalEvaluation,
} from "../types";

export type DeterministicRunOutput = Readonly<{
  retrieval: RetrievalEvaluation;
  customer: CustomerEvaluation;
  evidence: EvidenceEvaluation;
  courtroom: CourtroomEvaluation;
}>;

function evaluateRetrieval(cases: readonly BenchmarkCase[]) {
  return aggregateRetrieval(cases.map((benchmarkCase) => {
    const results = searchProductKnowledge(benchmarkCase.question, { limit: 5 });
    const retrievedIds = results.map((result) => result.sectionId);
    const firstRelevant = results.find((result) => benchmarkCase.expectedRetrievalTargets.includes(result.sectionId));
    return {
      benchmarkId: benchmarkCase.benchmarkId,
      taskId: benchmarkCase.taskId,
      query: benchmarkCase.question,
      expectedSectionIds: benchmarkCase.expectedRetrievalTargets,
      topResults: results.map((result) => ({
        sectionId: result.sectionId,
        rank: result.rank,
        score: result.totalScore,
        source: `${result.pageTitle} / ${result.sectionTitle}`,
      })),
      firstRelevantRank: firstRelevant?.rank ?? null,
      recallAt1: recallAtK(retrievedIds, benchmarkCase.expectedRetrievalTargets, 1),
      recallAt3: recallAtK(retrievedIds, benchmarkCase.expectedRetrievalTargets, 3),
      recallAt5: recallAtK(retrievedIds, benchmarkCase.expectedRetrievalTargets, 5),
      requiredSectionCoverageAt5: requiredSectionCoverage(retrievedIds, benchmarkCase.requiredSourceSectionIds, 5),
      passed: benchmarkCase.requiredSourceSectionIds.every((id) => retrievedIds.includes(id)),
    };
  }));
}

function evaluateCustomerAndEvidence(cases: readonly BenchmarkCase[]) {
  const customerCases: CustomerCaseResult[] = [];
  const evidenceCases: EvidenceCaseResult[] = [];
  const decisionsByTask: Readonly<Record<string, readonly import("@/lib/simulation/types").CustomerDecision[]>> = deterministicDecisionFixtures;

  cases.forEach((benchmarkCase) => {
    const decisions = decisionsByTask[benchmarkCase.taskId];
    if (!decisions) throw new Error(`Missing deterministic decisions for ${benchmarkCase.taskId}.`);
    const run = buildFixtureRun({
      runId: `run-eval-${benchmarkCase.taskId}-a`,
      taskId: benchmarkCase.taskId,
      personaId: benchmarkCase.defaultPersonaId,
      maxActions: benchmarkCase.maxActions,
      decisions,
    });
    const repeatedRun = buildFixtureRun({
      runId: `run-eval-${benchmarkCase.taskId}-b`,
      taskId: benchmarkCase.taskId,
      personaId: benchmarkCase.defaultPersonaId,
      maxActions: benchmarkCase.maxActions,
      decisions,
    });
    const bundle = buildFixtureEvidence(run);
    const repeatedBundle = buildFixtureEvidence(repeatedRun);
    const correctness = correctnessFromFactChecks(bundle.factChecks.map((check) => check.result));
    const behavior = actionBehavior(run.actions);
    const requiredEvidenceCoverage = bundle.coverage.requiredEvidenceTotal
      ? bundle.coverage.requiredEvidenceSeen / bundle.coverage.requiredEvidenceTotal
      : 0;
    customerCases.push({
      runId: run.id,
      benchmarkId: benchmarkCase.benchmarkId,
      taskId: run.taskId,
      personaId: run.personaId,
      provider: "fixture",
      model: "pre-recorded-decisions-v1",
      maxActions: run.maxActions,
      successfulCustomerActions: run.currentActionCount,
      modelRequestAttempts: run.modelCallCount,
      providerFailures: 0,
      ...behavior,
      finalAnswer: run.finalAnswer,
      finalConfidence: run.finalConfidence,
      gaveUp: run.completionReason === "gave_up",
      budgetExhausted: run.completionReason === "budget_exhausted",
      invalidToolDecisions: 0,
      completionStatus: run.completionReason ?? run.status,
      correctness,
      requiredEvidenceCoverage,
      groundingFailure: correctness === "unsupported" || correctness === "contradicted",
      actions: run.actions,
    });
    evidenceCases.push({
      runId: run.id,
      taskId: run.taskId,
      sourceIntegrity: evidenceSourceIntegrity(bundle),
      requiredRepresentationCoverage: requiredEvidenceRepresentation(bundle, benchmarkCase.requiredSourceSectionIds),
      seenUnseenCorrectness: seenUnseenEvidenceCorrectness(bundle, run.actions),
      deduplicationIntegrity: evidenceDeduplicationIntegrity(bundle),
      deterministicConsistency: deterministicEvidenceConsistency(bundle, repeatedBundle),
    });
  });

  return { customer: aggregateCustomers(customerCases), evidence: aggregateEvidence(evidenceCases) };
}

function evaluateFixedCourtroom() {
  const cases = courtroomBenchmarkFixtures.map((fixture) => courtroomCaseMetrics(
    fixture.fixtureId,
    fixture.evidenceBundle,
    fixture.prosecutorArgument,
    fixture.defenseArgument,
    1,
  ));
  return aggregateCourtroom(cases);
}

export function runDeterministicEvaluation(): DeterministicRunOutput {
  const manifest = validateBenchmarkManifest();
  const fixtureMetrics = evaluateCustomerAndEvidence(manifest.cases);
  return {
    retrieval: evaluateRetrieval(manifest.cases),
    ...fixtureMetrics,
    courtroom: evaluateFixedCourtroom(),
  };
}

export { benchmarkManifest };
