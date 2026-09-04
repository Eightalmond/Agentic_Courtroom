import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { allArgumentCitationLists, citationValidity, actionEfficiency, completionRate, endToEndSuccess, recallAtK, reciprocalRank, requiredSectionCoverage, safeRatio, verdictExactMatch } from "./metrics/core";
import { correctnessCounts } from "./metrics/core";
import { createReliabilityCounter, finalizeReliability, recordProviderFailure } from "./metrics/reliability";
import { deterministicEvidenceConsistency, evidenceDeduplicationIntegrity, evidenceSourceIntegrity, normalizeEvidenceForComparison, requiredEvidenceRepresentation, seenUnseenEvidenceCorrectness } from "./metrics/evidence";
import { benchmarkManifest, deterministicDecisionFixtures, validateBenchmarkManifest } from "./fixtures/benchmark";
import { courtroomBenchmarkFixtures } from "./fixtures/courtroom";
import { buildFixtureEvidence, buildFixtureRun } from "./fixtures/customer";
import { assertLiveSafety, parseCliArgs } from "./benchmark";
import { runDeterministicEvaluation } from "./runners/deterministic";
import { renderEvaluationReport, writeEvaluationArtifacts } from "./reporters/report";
import { validateEvaluationResult } from "./schema";
import { BENCHMARK_VERSION, EVALUATION_VERSION, MAX_LIVE_TRIALS, type CustomerCaseResult, type EvaluationResult } from "./types";

function customerResult(overrides: Partial<CustomerCaseResult> = {}): CustomerCaseResult {
  return {
    runId: "run-eval-test",
    benchmarkId: "flowpilot-test",
    taskId: "trial-cancellation",
    personaId: "careful-researcher",
    provider: "fixture",
    model: "fixture",
    maxActions: 10,
    successfulCustomerActions: 5,
    modelRequestAttempts: 5,
    providerFailures: 0,
    searches: 1,
    pagesOpened: 1,
    sectionsInspected: 2,
    repeatedSearches: 0,
    repeatedPageOpenings: 0,
    repeatedSectionInspections: 0,
    redundantActionRate: 0,
    finalAnswer: "Supported answer",
    finalConfidence: "high",
    gaveUp: false,
    budgetExhausted: false,
    invalidToolDecisions: 0,
    completionStatus: "answer",
    correctness: "fully-supported",
    requiredEvidenceCoverage: 1,
    groundingFailure: false,
    actions: [],
    ...overrides,
  };
}

function fixedResult(): EvaluationResult {
  const deterministicMetrics = runDeterministicEvaluation();
  return validateEvaluationResult({
    evaluationVersion: EVALUATION_VERSION,
    timestamp: "2026-01-01T00:00:00.000Z",
    gitCommitSha: null,
    mode: "deterministic",
    provider: "fixture",
    model: "none",
    benchmarkVersion: BENCHMARK_VERSION,
    taskCount: benchmarkManifest.cases.length,
    trialsPerTask: 1,
    deterministicMetrics,
    liveModelMetrics: null,
    aggregateMetrics: { retrievalRecallAt3: deterministicMetrics.retrieval.recallAt3 },
    limitations: ["Controlled benchmark."],
  });
}

describe("retrieval metrics", () => {
  it("calculates Recall@K without double-counting duplicate results", () => {
    expect(recallAtK(["a", "a", "b", "c"], ["a", "b"], 1)).toBe(0.5);
    expect(recallAtK(["a", "a", "b", "c"], ["a", "b"], 3)).toBe(1);
  });

  it("calculates reciprocal rank from the first relevant result", () => {
    expect(reciprocalRank(["x", "target", "other"], ["target"])).toBe(0.5);
    expect(reciprocalRank(["x"], ["target"])).toBe(0);
  });

  it("calculates required-section coverage at a bounded cutoff", () => {
    expect(requiredSectionCoverage(["a", "b", "c"], ["a", "c"], 2)).toBe(0.5);
  });
});

describe("customer and reliability metrics", () => {
  it("calculates completion and correctness aggregates", () => {
    const cases = [customerResult(), customerResult({ completionStatus: "gave_up", correctness: "not-assessable" })];
    expect(completionRate(cases)).toBe(0.5);
    expect(correctnessCounts(cases)).toEqual({
      "fully-supported": 1,
      unsupported: 0,
      contradicted: 0,
      "not-assessable": 1,
    });
  });

  it("only treats correct successful answers as efficient", () => {
    const cases = [
      customerResult({ successfulCustomerActions: 5, maxActions: 10 }),
      customerResult({ successfulCustomerActions: 1, maxActions: 10, correctness: "contradicted" }),
    ];
    expect(actionEfficiency(cases)).toBe(0.5);
  });

  it("separates provider failure classes", () => {
    const counter = createReliabilityCounter();
    counter.attemptedProviderCalls = 4;
    counter.successfulProviderCalls = 1;
    recordProviderFailure(counter, { code: "GROQ_RATE_LIMITED" });
    recordProviderFailure(counter, { code: "PROVIDER_TIMEOUT" });
    recordProviderFailure(counter, { code: "COURTROOM_INVALID_CITATION" });
    expect(finalizeReliability(counter)).toMatchObject({
      rateLimitFailures: 1,
      timeoutFailures: 1,
      invalidCitationFailures: 1,
      providerFailureRate: 0.75,
    });
  });

  it("keeps provider attempts distinct from successful customer actions", () => {
    const result = customerResult({ modelRequestAttempts: 4, successfulCustomerActions: 2, providerFailures: 2 });
    expect(result.modelRequestAttempts).toBe(4);
    expect(result.successfulCustomerActions).toBe(2);
  });

  it("handles empty denominators safely", () => {
    expect(safeRatio(1, 0)).toBe(0);
    expect(completionRate([])).toBe(0);
    expect(actionEfficiency([])).toBe(0);
  });
});

describe("evidence and citation metrics", () => {
  const benchmarkCase = benchmarkManifest.cases[0];
  const run = buildFixtureRun({
    runId: "run-eval-evidence-test",
    taskId: benchmarkCase.taskId,
    personaId: benchmarkCase.defaultPersonaId,
    maxActions: benchmarkCase.maxActions,
    decisions: deterministicDecisionFixtures["trial-cancellation"],
  });
  const bundle = buildFixtureEvidence(run);

  it("resolves every collected item to trusted product content", () => {
    expect(evidenceSourceIntegrity(bundle)).toBe(1);
    expect(requiredEvidenceRepresentation(bundle, benchmarkCase.requiredSourceSectionIds)).toBe(1);
  });

  it("verifies seen and unseen labels against journey observations", () => {
    expect(seenUnseenEvidenceCorrectness(bundle, run.actions)).toBe(1);
    expect(evidenceDeduplicationIntegrity(bundle)).toBe(1);
  });

  it("normalizes variable bundle identity for deterministic comparison", () => {
    const secondRun = buildFixtureRun({
      runId: "run-eval-evidence-test-two",
      taskId: benchmarkCase.taskId,
      personaId: benchmarkCase.defaultPersonaId,
      maxActions: benchmarkCase.maxActions,
      decisions: deterministicDecisionFixtures["trial-cancellation"],
    });
    const secondBundle = buildFixtureEvidence(secondRun);
    expect(deterministicEvidenceConsistency(bundle, secondBundle)).toBe(1);
    expect(normalizeEvidenceForComparison(bundle).runId).toBe("<run>");
  });

  it("calculates citation validity against immutable evidence IDs", () => {
    const fixture = courtroomBenchmarkFixtures[0];
    expect(citationValidity(allArgumentCitationLists(fixture.prosecutorArgument), fixture.evidenceBundle)).toBe(1);
    expect(citationValidity([["fabricated-evidence"]], fixture.evidenceBundle)).toBe(0);
  });
});

describe("judge and end-to-end rules", () => {
  it("requires an exact verdict match", () => {
    expect(verdictExactMatch("pass", "pass")).toBe(true);
    expect(verdictExactMatch("pass_with_friction", "pass")).toBe(false);
  });

  it("applies all end-to-end completion conditions and stricter grounding", () => {
    const base = {
      customerAnswered: true,
      correctness: "fully-supported" as const,
      evidenceBuilt: true,
      prosecutorSucceeded: true,
      defenseSucceeded: true,
      advocateCitationsValid: true,
      judgeSucceeded: true,
      judgeCitationsValid: true,
    };
    expect(endToEndSuccess(base)).toEqual({ completed: true, grounded: true });
    expect(endToEndSuccess({ ...base, judgeCitationsValid: false })).toEqual({ completed: false, grounded: false });
    expect(endToEndSuccess({ ...base, correctness: "unsupported" })).toEqual({ completed: true, grounded: false });
  });
});

describe("benchmark, CLI safety, and reports", () => {
  it("validates six unique tasks and ten human fixtures spanning all verdicts", () => {
    expect(validateBenchmarkManifest().cases).toHaveLength(6);
    expect(courtroomBenchmarkFixtures).toHaveLength(10);
    expect(new Set(courtroomBenchmarkFixtures.map((fixture) => fixture.expectedVerdict))).toEqual(new Set([
      "pass",
      "pass_with_friction",
      "misleading",
      "blocked",
      "insufficient_evidence",
    ]));
  });

  it("rejects an empty benchmark", () => {
    expect(() => validateBenchmarkManifest({ version: BENCHMARK_VERSION, productId: "flowpilot", cases: [] })).toThrow();
  });

  it("never enables live mode without explicit confirmation and selection", () => {
    expect(() => assertLiveSafety(parseCliArgs(["--mode", "live", "--all"]))).toThrow(/confirm-live/);
    expect(() => assertLiveSafety(parseCliArgs(["--mode", "live", "--confirm-live"]))).toThrow(/--task.*--all/);
    expect(() => assertLiveSafety(parseCliArgs(["--mode", "live", "--all", "--confirm-live"]))).not.toThrow();
  });

  it("enforces the live trial hard cap", () => {
    expect(() => parseCliArgs(["--trials", String(MAX_LIVE_TRIALS + 1)])).toThrow();
    expect(parseCliArgs(["--trials", String(MAX_LIVE_TRIALS)]).trials).toBe(MAX_LIVE_TRIALS);
  });

  it("renders deterministic report text", () => {
    const result = fixedResult();
    const first = renderEvaluationReport(result);
    const second = renderEvaluationReport(result);
    expect(first).toBe(second);
    expect(first).toContain("# Trial by User Evaluation Report");
    expect(first).toContain("Retrieval Recall@3");
  });

  it("writes valid machine-readable and human-readable reports", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "trial-by-user-eval-"));
    try {
      const result = fixedResult();
      const report = renderEvaluationReport(result);
      const paths = await writeEvaluationArtifacts({ result, report, rootDirectory: temporaryRoot });
      expect(JSON.parse(await readFile(paths.jsonPath, "utf8"))).toMatchObject({ evaluationVersion: EVALUATION_VERSION });
      expect(await readFile(paths.markdownPath, "utf8")).toBe(report);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
