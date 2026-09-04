import type { CourtroomArgument, JudgeVerdict, VerdictDirection } from "@/lib/courtroom/types";
import type { EvidenceBundle, MechanicalFactCheckResult } from "@/lib/evidence/types";
import type { LlmProviderName } from "@/lib/simulation/environment";
import type { SimulationActionEntry } from "@/lib/simulation/types";
import type { TaskDifficulty } from "@/lib/test-runs/types";

export const EVALUATION_VERSION = "1.0.0" as const;
export const BENCHMARK_VERSION = "flowpilot-v1" as const;
export const MAX_LIVE_TRIALS = 5;

export type AnswerCorrectness = "fully-supported" | "unsupported" | "contradicted" | "not-assessable";

export type BenchmarkCase = Readonly<{
  benchmarkId: string;
  taskId: string;
  question: string;
  category: string;
  difficulty: TaskDifficulty;
  defaultPersonaId: string;
  maxActions: number;
  expectedCriticalFacts: readonly Readonly<{
    id: string;
    conceptGroups: readonly (readonly string[])[];
    sourceSectionIds: readonly string[];
  }>[];
  forbiddenClaims: readonly string[];
  requiredSourceSectionIds: readonly string[];
  qualificationSectionIds: readonly string[];
  expectedRetrievalTargets: readonly string[];
  expectedAnswerConcepts: readonly (readonly string[])[];
  acceptableAnswerVariants: readonly string[];
}>;

export type RetrievalCaseResult = Readonly<{
  benchmarkId: string;
  taskId: string;
  query: string;
  expectedSectionIds: readonly string[];
  topResults: readonly Readonly<{ sectionId: string; rank: number; score: number; source: string }>[];
  firstRelevantRank: number | null;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  requiredSectionCoverageAt5: number;
  passed: boolean;
}>;

export type RetrievalEvaluation = Readonly<{
  caseCount: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  meanReciprocalRank: number;
  requiredSectionCoverageAt5: number;
  cases: readonly RetrievalCaseResult[];
}>;

export type CustomerCaseResult = Readonly<{
  runId: string;
  benchmarkId: string;
  taskId: string;
  personaId: string;
  provider: "fixture" | LlmProviderName;
  model: string;
  maxActions: number;
  successfulCustomerActions: number;
  modelRequestAttempts: number;
  providerFailures: number;
  searches: number;
  pagesOpened: number;
  sectionsInspected: number;
  repeatedSearches: number;
  repeatedPageOpenings: number;
  repeatedSectionInspections: number;
  redundantActionRate: number;
  finalAnswer: string | null;
  finalConfidence: "low" | "medium" | "high" | null;
  gaveUp: boolean;
  budgetExhausted: boolean;
  invalidToolDecisions: number;
  completionStatus: string;
  correctness: AnswerCorrectness;
  requiredEvidenceCoverage: number;
  groundingFailure: boolean;
  actions: readonly SimulationActionEntry[];
}>;

export type CustomerEvaluation = Readonly<{
  runCount: number;
  completionRate: number;
  correctness: Readonly<Record<AnswerCorrectness, number>>;
  fullySupportedRate: number;
  groundingFailureRate: number;
  actionEfficiency: number;
  medianSuccessfulActions: number;
  redundantActionRate: number;
  requiredEvidenceCoverage: number;
  cases: readonly CustomerCaseResult[];
}>;

export type EvidenceCaseResult = Readonly<{
  runId: string;
  taskId: string;
  sourceIntegrity: number;
  requiredRepresentationCoverage: number;
  seenUnseenCorrectness: number;
  deduplicationIntegrity: number;
  deterministicConsistency: number;
}>;

export type EvidenceEvaluation = Readonly<{
  caseCount: number;
  sourceIntegrity: number;
  requiredRepresentationCoverage: number;
  seenUnseenCorrectness: number;
  deduplicationIntegrity: number;
  deterministicConsistency: number;
  cases: readonly EvidenceCaseResult[];
}>;

export type CourtroomCaseResult = Readonly<{
  fixtureId: string;
  citationValidity: number;
  claimCitationCoverage: number;
  seenUnseenIntegrity: number;
  sharedEvidenceIntegrity: number;
}>;

export type CourtroomEvaluation = Readonly<{
  caseCount: number;
  citationValidity: number;
  claimCitationCoverage: number;
  seenUnseenIntegrity: number;
  sharedEvidenceIntegrity: number;
  structuredOutputSuccessRate: number | null;
  cases: readonly CourtroomCaseResult[];
}>;

export type ReliabilityMetrics = Readonly<{
  attemptedProviderCalls: number;
  successfulProviderCalls: number;
  rateLimitFailures: number;
  timeoutFailures: number;
  authenticationOrConfigErrors: number;
  structuredOutputFailures: number;
  invalidCitationFailures: number;
  otherProviderFailures: number;
  providerFailureRate: number;
}>;

export type EndToEndCaseResult = Readonly<{
  runId: string;
  taskId: string;
  completed: boolean;
  grounded: boolean;
  llmCalls: number;
  successfulCustomerActions: number;
  failures: readonly string[];
}>;

export type EndToEndEvaluation = Readonly<{
  runCount: number;
  pipelineCompletionRate: number;
  groundedPipelineSuccessRate: number;
  providerFailureRate: number;
  averageLlmCallsPerCompletedRun: number;
  averageSuccessfulCustomerActionsPerCompletedRun: number;
  cases: readonly EndToEndCaseResult[];
}>;

export type JudgeCaseResult = Readonly<{
  fixtureId: string;
  taskId: string;
  expectedVerdict: VerdictDirection;
  actualVerdict: VerdictDirection | null;
  exactMatch: boolean;
  citationValidity: number;
  recommendationGrounding: number;
  confidence: "low" | "medium" | "high" | null;
  errorCode: string | null;
}>;

export type JudgeEvaluation = Readonly<{
  caseCount: number;
  attempted: number;
  structuredOutputSuccessRate: number;
  exactVerdictAccuracy: number;
  citationValidity: number;
  recommendationGrounding: number;
  averageConfidenceCorrect: number | null;
  averageConfidenceIncorrect: number | null;
  cases: readonly JudgeCaseResult[];
}>;

export type PersonaResult = Readonly<{
  personaId: string;
  runCount: number;
  completionRate: number;
  fullySupportedRate: number;
  averageActions: number;
  giveUpRate: number;
  requiredEvidenceCoverage: number;
}>;

export type LiveEvaluation = Readonly<{
  customer: CustomerEvaluation;
  evidence: EvidenceEvaluation;
  courtroom: CourtroomEvaluation;
  judge: JudgeEvaluation;
  endToEnd: EndToEndEvaluation;
  personas: readonly PersonaResult[];
  reliability: ReliabilityMetrics;
}>;

export type EvaluationResult = Readonly<{
  evaluationVersion: typeof EVALUATION_VERSION;
  timestamp: string;
  gitCommitSha: string | null;
  mode: "deterministic" | "live";
  provider: "fixture" | LlmProviderName;
  model: string;
  benchmarkVersion: typeof BENCHMARK_VERSION;
  taskCount: number;
  trialsPerTask: number;
  deterministicMetrics: Readonly<{
    retrieval: RetrievalEvaluation;
    customer: CustomerEvaluation;
    evidence: EvidenceEvaluation;
    courtroom: CourtroomEvaluation;
  }>;
  liveModelMetrics: LiveEvaluation | null;
  aggregateMetrics: Readonly<Record<string, number | null>>;
  limitations: readonly string[];
}>;

export type CourtroomBenchmarkFixture = Readonly<{
  fixtureId: string;
  title: string;
  taskId: string;
  scenario: string;
  journeySummary: string;
  evidenceBundle: EvidenceBundle;
  prosecutorArgument: CourtroomArgument;
  defenseArgument: CourtroomArgument;
  expectedVerdict: VerdictDirection;
  humanRationale: string;
  acceptableConfidence: readonly ("low" | "medium" | "high")[];
}>;

export type EvaluationArtifacts = Readonly<{
  result: EvaluationResult;
  report: string;
  reviewRows?: readonly HumanReviewRow[];
}>;

export type HumanReviewRow = Readonly<{
  runId: string;
  task: string;
  persona: string;
  customerAnswer: string | null;
  customerJourney: readonly SimulationActionEntry[];
  verdict: JudgeVerdict["verdict"] | null;
  recommendation: string | null;
  humanRating: Readonly<{
    answerCorrect: null;
    journeyRealistic: null;
    prosecutorQuality: null;
    defenseQuality: null;
    judgeQuality: null;
    notes: "";
  }>;
}>;

export function correctnessFromFactChecks(results: readonly MechanicalFactCheckResult[]): AnswerCorrectness {
  if (results.length === 0 || results.every((result) => result === "not-assessable")) return "not-assessable";
  if (results.some((result) => result === "contradicted")) return "contradicted";
  if (results.every((result) => result === "supported")) return "fully-supported";
  return "unsupported";
}
