import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import nextEnvironment from "@next/env";

import { readSimulationProviderConfiguration } from "@/lib/simulation/environment";
import { createSimulationProvider } from "@/lib/simulation/providers/factory";

import { benchmarkManifest, validateBenchmarkManifest } from "./fixtures/benchmark";
import { estimateMaximumProviderCalls, runLiveEvaluation } from "./runners/live";
import { runDeterministicEvaluation } from "./runners/deterministic";
import { renderEvaluationReport, writeEvaluationArtifacts } from "./reporters/report";
import { validateEvaluationResult } from "./schema";
import {
  BENCHMARK_VERSION,
  EVALUATION_VERSION,
  MAX_LIVE_TRIALS,
  type BenchmarkCase,
  type EvaluationResult,
} from "./types";

const { loadEnvConfig } = nextEnvironment;

export type EvaluationCliOptions = Readonly<{
  mode: "deterministic" | "live";
  taskId: string | null;
  all: boolean;
  trials: number;
  confirmLive: boolean;
  outputTag: string | null;
  help: boolean;
}>;

const HELP = `Trial by User evaluation

Usage:
  npm run eval
  npm run eval:deterministic
  npm run eval:live -- --task <task-id> --trials 1 --confirm-live
  npm run eval:live -- --all --trials 3 --confirm-live

Options:
  --task <task-id>       Run one FlowPilot task (live mode).
  --all                  Run all benchmark tasks (live mode).
  --trials <1-${MAX_LIVE_TRIALS}>         Trials per selected task; default 1.
  --confirm-live         Required acknowledgement before provider calls.
  --output-tag <tag>     Preserve outputs under a lowercase tag.
  --help                 Show this help.

Deterministic evaluation is the default and never calls a provider. Live runs
are sequential, do not retry, do not fall back, and also judge fixed fixtures
matching the selected task set.`;

export function parseCliArgs(args: readonly string[]): EvaluationCliOptions {
  let mode: EvaluationCliOptions["mode"] = "deterministic";
  let taskId: string | null = null;
  let all = false;
  let trials = 1;
  let confirmLive = false;
  let outputTag: string | null = null;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--mode") {
      const value = args[++index];
      if (value !== "deterministic" && value !== "live") throw new Error("--mode must be deterministic or live.");
      mode = value;
    } else if (argument === "--task") {
      taskId = args[++index] ?? null;
      if (!taskId) throw new Error("--task requires a task ID.");
    } else if (argument === "--all") {
      all = true;
    } else if (argument === "--trials") {
      const value = Number(args[++index]);
      if (!Number.isInteger(value) || value < 1 || value > MAX_LIVE_TRIALS) {
        throw new Error(`--trials must be an integer from 1 to ${MAX_LIVE_TRIALS}.`);
      }
      trials = value;
    } else if (argument === "--confirm-live") {
      confirmLive = true;
    } else if (argument === "--output-tag") {
      outputTag = args[++index] ?? null;
      if (!outputTag) throw new Error("--output-tag requires a value.");
    } else if (argument === "--help" || argument === "-h") {
      help = true;
    } else {
      throw new Error(`Unknown evaluation option: ${argument}`);
    }
  }
  return { mode, taskId, all, trials, confirmLive, outputTag, help };
}

export function assertLiveSafety(options: EvaluationCliOptions) {
  if (options.mode !== "live") return;
  if (!options.confirmLive) {
    throw new Error("Live evaluation requires --confirm-live. No provider calls were made.");
  }
  if (options.taskId && options.all) throw new Error("Choose either --task or --all, not both.");
  if (!options.taskId && !options.all) {
    throw new Error("Live evaluation requires an explicit --task <id> or --all selection.");
  }
}

function selectCases(options: EvaluationCliOptions): readonly BenchmarkCase[] {
  if (options.mode === "deterministic" || options.all) return benchmarkManifest.cases;
  const selected = benchmarkManifest.cases.find((item) => item.taskId === options.taskId);
  if (!selected) {
    throw new Error(`Unknown task '${options.taskId}'. Available tasks: ${benchmarkManifest.cases.map((item) => item.taskId).join(", ")}.`);
  }
  return [selected];
}

function gitCommitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const LIMITATIONS = [
  "The benchmark is small, controlled, and uses the fictional FlowPilot product.",
  "Mechanical answer grading is bounded to trusted phrase and negation rules; it is not full semantic grading.",
  "Live model behavior is nondeterministic, so repeated trials may differ.",
  "Free-tier provider limits and transient provider failures may affect live runs.",
  "These metrics do not prove real-world product usability or replace research with real customers.",
] as const;

function aggregateMetrics(result: Pick<EvaluationResult, "deterministicMetrics" | "liveModelMetrics">) {
  const deterministic = result.deterministicMetrics;
  const live = result.liveModelMetrics;
  return {
    retrievalRecallAt3: deterministic.retrieval.recallAt3,
    retrievalMrr: deterministic.retrieval.meanReciprocalRank,
    deterministicCustomerCompletion: deterministic.customer.completionRate,
    deterministicEvidenceIntegrity: deterministic.evidence.sourceIntegrity,
    deterministicCitationValidity: deterministic.courtroom.citationValidity,
    liveCustomerCompletion: live?.customer.completionRate ?? null,
    liveJudgeVerdictAccuracy: live?.judge.exactVerdictAccuracy ?? null,
    livePipelineCompletion: live?.endToEnd.pipelineCompletionRate ?? null,
    liveGroundedPipelineSuccess: live?.endToEnd.groundedPipelineSuccessRate ?? null,
    providerFailureRate: live?.reliability.providerFailureRate ?? null,
  };
}

export async function runEvaluation(options: EvaluationCliOptions) {
  validateBenchmarkManifest();
  assertLiveSafety(options);
  const selectedCases = selectCases(options);
  const deterministicMetrics = runDeterministicEvaluation();
  let liveModelMetrics: EvaluationResult["liveModelMetrics"] = null;
  let reviewRows;
  let provider: EvaluationResult["provider"] = "fixture";
  let model = "none";

  if (options.mode === "live") {
    const maximumCalls = estimateMaximumProviderCalls(selectedCases, options.trials);
    console.log(`Live evaluation confirmed. Estimated maximum provider calls: ${maximumCalls}. Calls will run sequentially without retries or fallback.`);
    loadEnvConfig(process.cwd());
    const configuration = readSimulationProviderConfiguration(process.env);
    provider = configuration.provider;
    model = configuration.model;
    const live = await runLiveEvaluation({
      cases: selectedCases,
      trials: options.trials,
      model,
      baseProvider: createSimulationProvider(process.env),
    });
    liveModelMetrics = live.metrics;
    reviewRows = live.reviewRows;
  }

  const candidate = {
    evaluationVersion: EVALUATION_VERSION,
    timestamp: new Date().toISOString(),
    gitCommitSha: gitCommitSha(),
    mode: options.mode,
    provider,
    model,
    benchmarkVersion: BENCHMARK_VERSION,
    taskCount: selectedCases.length,
    trialsPerTask: options.mode === "live" ? options.trials : 1,
    deterministicMetrics,
    liveModelMetrics,
    aggregateMetrics: {},
    limitations: LIMITATIONS,
  } satisfies EvaluationResult;
  const result = validateEvaluationResult({
    ...candidate,
    aggregateMetrics: aggregateMetrics(candidate),
  });
  const report = renderEvaluationReport(result);
  const paths = await writeEvaluationArtifacts({
    result,
    report,
    reviewRows,
    outputTag: options.outputTag ?? undefined,
  });
  return { result, paths };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  const { result, paths } = await runEvaluation(options);
  console.log(`Evaluation complete: ${result.mode}.`);
  console.log(`JSON: ${path.relative(process.cwd(), paths.jsonPath)}`);
  console.log(`Markdown: ${path.relative(process.cwd(), paths.markdownPath)}`);
  if (paths.reviewPath) console.log(`Human review: ${path.relative(process.cwd(), paths.reviewPath)}`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Evaluation failed.");
    process.exitCode = 1;
  });
}
