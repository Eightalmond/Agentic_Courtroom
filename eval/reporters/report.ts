import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EvaluationResult, HumanReviewRow } from "../types";

function percent(value: number | null) {
  return value === null ? "Not run" : `${(value * 100).toFixed(1)}%`;
}

function number(value: number | null) {
  return value === null ? "Not run" : value.toFixed(2);
}

function row(name: string, value: string) {
  return `| ${name} | ${value} |`;
}

export function renderEvaluationReport(result: EvaluationResult) {
  const deterministic = result.deterministicMetrics;
  const live = result.liveModelMetrics;
  const lines = [
    "# Trial by User Evaluation Report",
    "",
    "## Evaluation setup",
    "",
    `- Evaluation version: ${result.evaluationVersion}`,
    `- Benchmark: ${result.benchmarkVersion}`,
    `- Mode: ${result.mode}`,
    `- Provider/model: ${result.provider} / ${result.model}`,
    `- Tasks: ${result.taskCount}`,
    `- Trials per task: ${result.trialsPerTask}`,
    `- Timestamp: ${result.timestamp}`,
    `- Git commit: ${result.gitCommitSha ?? "unavailable"}`,
    "",
    "## Executive summary",
    "",
    "| Metric | Result |",
    "| --- | ---: |",
    row("Retrieval Recall@3", percent(deterministic.retrieval.recallAt3)),
    row("Retrieval MRR", number(deterministic.retrieval.meanReciprocalRank)),
    row("Fixture customer completion", percent(deterministic.customer.completionRate)),
    row("Fixture answer fully supported", percent(deterministic.customer.fullySupportedRate)),
    row("Fixture required evidence seen", percent(deterministic.customer.requiredEvidenceCoverage)),
    row("Evidence source integrity", percent(deterministic.evidence.sourceIntegrity)),
    row("Fixed-argument citation validity", percent(deterministic.courtroom.citationValidity)),
  ];
  if (live) {
    lines.push(
      row("Live customer completion", percent(live.customer.completionRate)),
      row("Live judge verdict accuracy", percent(live.judge.exactVerdictAccuracy)),
      row("End-to-end completion", percent(live.endToEnd.pipelineCompletionRate)),
      row("Grounded end-to-end success", percent(live.endToEnd.groundedPipelineSuccessRate)),
      row("Provider failure rate", percent(live.reliability.providerFailureRate)),
    );
  }

  lines.push(
    "",
    "## Retrieval",
    "",
    `Recall@1 ${percent(deterministic.retrieval.recallAt1)}, Recall@3 ${percent(deterministic.retrieval.recallAt3)}, Recall@5 ${percent(deterministic.retrieval.recallAt5)}, and MRR ${number(deterministic.retrieval.meanReciprocalRank)}. Required-section coverage in the top five is ${percent(deterministic.retrieval.requiredSectionCoverageAt5)}.`,
    "",
    "| Task | First relevant rank | Coverage@5 | Pass |",
    "| --- | ---: | ---: | --- |",
    ...deterministic.retrieval.cases.map((item) => `| ${item.taskId} | ${item.firstRelevantRank ?? "—"} | ${percent(item.requiredSectionCoverageAt5)} | ${item.passed ? "Yes" : "No"} |`),
    "",
    "## Synthetic customer",
    "",
    `The deterministic decision fixtures completed ${percent(deterministic.customer.completionRate)} of runs; ${percent(deterministic.customer.fullySupportedRate)} were fully supported. Correct successful runs used ${percent(deterministic.customer.actionEfficiency)} of their action budget on average, with a median of ${deterministic.customer.medianSuccessfulActions.toFixed(1)} actions.`,
    "",
    "## Evidence",
    "",
    `Source integrity ${percent(deterministic.evidence.sourceIntegrity)}; required representation ${percent(deterministic.evidence.requiredRepresentationCoverage)}; seen/unseen correctness ${percent(deterministic.evidence.seenUnseenCorrectness)}; deduplication ${percent(deterministic.evidence.deduplicationIntegrity)}; deterministic consistency ${percent(deterministic.evidence.deterministicConsistency)}.`,
    "",
    "## Courtroom",
    "",
    `Across ${deterministic.courtroom.caseCount} human-authored fixed cases, citation validity is ${percent(deterministic.courtroom.citationValidity)}, claim citation coverage is ${percent(deterministic.courtroom.claimCitationCoverage)}, seen/unseen integrity is ${percent(deterministic.courtroom.seenUnseenIntegrity)}, and shared-evidence integrity is ${percent(deterministic.courtroom.sharedEvidenceIntegrity)}. These deterministic checks measure grounding, not rhetorical quality.`,
  );

  if (live) {
    lines.push(
      "",
      "## Live model evaluation",
      "",
      `Customer completion ${percent(live.customer.completionRate)}, fully supported answers ${percent(live.customer.fullySupportedRate)}, grounding failures ${percent(live.customer.groundingFailureRate)}, required evidence seen ${percent(live.customer.requiredEvidenceCoverage)}, and redundant actions ${percent(live.customer.redundantActionRate)}.`,
      "",
      `Advocate structured-output success ${percent(live.courtroom.structuredOutputSuccessRate)}, citation validity ${percent(live.courtroom.citationValidity)}, and shared-evidence integrity ${percent(live.courtroom.sharedEvidenceIntegrity)}.`,
      "",
      "## Judge",
      "",
      `Exact verdict accuracy among valid outputs is ${percent(live.judge.exactVerdictAccuracy)} across ${live.judge.attempted} fixed fixture attempts. Structured-output success ${percent(live.judge.structuredOutputSuccessRate)}, citation validity ${percent(live.judge.citationValidity)}, and recommendation grounding ${percent(live.judge.recommendationGrounding)}. Average confidence uses the descriptive scale low=1, medium=2, high=3: correct ${live.judge.averageConfidenceCorrect ?? "n/a"}, incorrect ${live.judge.averageConfidenceIncorrect ?? "n/a"}.`,
      "",
      "## Persona behavior (descriptive)",
      "",
      "| Persona | Runs | Completion | Fully supported | Avg. actions | Give-up | Required evidence |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...live.personas.map((item) => `| ${item.personaId} | ${item.runCount} | ${percent(item.completionRate)} | ${percent(item.fullySupportedRate)} | ${item.averageActions.toFixed(2)} | ${percent(item.giveUpRate)} | ${percent(item.requiredEvidenceCoverage)} |`),
      "",
      "## End-to-end",
      "",
      `Pipeline completion ${percent(live.endToEnd.pipelineCompletionRate)}; stricter grounded success ${percent(live.endToEnd.groundedPipelineSuccessRate)}; average provider calls per completed run ${live.endToEnd.averageLlmCallsPerCompletedRun.toFixed(2)}; average successful customer actions per completed run ${live.endToEnd.averageSuccessfulCustomerActionsPerCompletedRun.toFixed(2)}.`,
      "",
      "## Reliability",
      "",
      "| Signal | Count |",
      "| --- | ---: |",
      row("Attempted provider calls", String(live.reliability.attemptedProviderCalls)),
      row("Successful provider calls", String(live.reliability.successfulProviderCalls)),
      row("Rate-limit failures", String(live.reliability.rateLimitFailures)),
      row("Timeout failures", String(live.reliability.timeoutFailures)),
      row("Authentication/config errors", String(live.reliability.authenticationOrConfigErrors)),
      row("Structured-output failures", String(live.reliability.structuredOutputFailures)),
      row("Invalid-citation failures", String(live.reliability.invalidCitationFailures)),
      row("Other provider failures", String(live.reliability.otherProviderFailures)),
    );
  }

  const failures = [
    ...deterministic.retrieval.cases.filter((item) => !item.passed).map((item) => `Retrieval miss: ${item.taskId} covered ${percent(item.requiredSectionCoverageAt5)} of required sources in the top five.`),
    ...(live?.endToEnd.cases.filter((item) => !item.completed).map((item) => `Pipeline failure: ${item.taskId} (${item.runId}): ${item.failures.join(", ") || "unknown"}.`) ?? []),
    ...(live?.judge.cases.filter((item) => !item.exactMatch).map((item) => `Judge disagreement: ${item.fixtureId}, expected ${item.expectedVerdict}, received ${item.actualVerdict ?? item.errorCode ?? "no verdict"}.`) ?? []),
  ];
  lines.push(
    "",
    "## Failure analysis",
    "",
    ...(failures.length ? failures.map((failure) => `- ${failure}`) : ["- No failures were detected in the layers that ran."]),
    "",
    "## Limitations",
    "",
    ...result.limitations.map((limitation) => `- ${limitation}`),
    "",
  );
  return lines.join("\n");
}

function validateOutputTag(value: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(value)) {
    throw new Error("Output tags must use 1-50 lowercase letters, numbers, or hyphens.");
  }
  return value;
}

export async function writeEvaluationArtifacts(input: {
  result: EvaluationResult;
  report: string;
  reviewRows?: readonly HumanReviewRow[];
  outputTag?: string;
  rootDirectory?: string;
}) {
  const directory = path.join(input.rootDirectory ?? process.cwd(), "reports", "evaluation");
  await mkdir(directory, { recursive: true });
  const baseName = input.outputTag ? validateOutputTag(input.outputTag) : "latest";
  const jsonPath = path.join(directory, `${baseName}.json`);
  const markdownPath = path.join(directory, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(input.result, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, input.report, "utf8");
  let reviewPath: string | null = null;
  if (input.reviewRows) {
    reviewPath = path.join(directory, input.outputTag ? `review-${baseName}.json` : "review.json");
    await writeFile(reviewPath, `${JSON.stringify(input.reviewRows, null, 2)}\n`, "utf8");
  }
  return { jsonPath, markdownPath, reviewPath };
}
