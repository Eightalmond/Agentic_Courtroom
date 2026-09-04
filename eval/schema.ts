import { z } from "zod";

import { BENCHMARK_VERSION, EVALUATION_VERSION, type EvaluationResult } from "./types";

const ratio = z.number().finite().min(0).max(1);
const nonnegative = z.number().finite().nonnegative();
const recordCases = z.array(z.record(z.string(), z.unknown()));

const retrievalSchema = z.object({
  caseCount: nonnegative,
  recallAt1: ratio,
  recallAt3: ratio,
  recallAt5: ratio,
  meanReciprocalRank: ratio,
  requiredSectionCoverageAt5: ratio,
  cases: recordCases,
}).strict();

const customerSchema = z.object({
  runCount: nonnegative,
  completionRate: ratio,
  correctness: z.object({
    "fully-supported": nonnegative,
    unsupported: nonnegative,
    contradicted: nonnegative,
    "not-assessable": nonnegative,
  }).strict(),
  fullySupportedRate: ratio,
  groundingFailureRate: ratio,
  actionEfficiency: ratio,
  medianSuccessfulActions: nonnegative,
  redundantActionRate: ratio,
  requiredEvidenceCoverage: ratio,
  cases: recordCases,
}).strict();

const evidenceSchema = z.object({
  caseCount: nonnegative,
  sourceIntegrity: ratio,
  requiredRepresentationCoverage: ratio,
  seenUnseenCorrectness: ratio,
  deduplicationIntegrity: ratio,
  deterministicConsistency: ratio,
  cases: recordCases,
}).strict();

const courtroomSchema = z.object({
  caseCount: nonnegative,
  citationValidity: ratio,
  claimCitationCoverage: ratio,
  seenUnseenIntegrity: ratio,
  sharedEvidenceIntegrity: ratio,
  structuredOutputSuccessRate: ratio.nullable(),
  cases: recordCases,
}).strict();

const reliabilitySchema = z.object({
  attemptedProviderCalls: nonnegative,
  successfulProviderCalls: nonnegative,
  rateLimitFailures: nonnegative,
  timeoutFailures: nonnegative,
  authenticationOrConfigErrors: nonnegative,
  structuredOutputFailures: nonnegative,
  invalidCitationFailures: nonnegative,
  otherProviderFailures: nonnegative,
  providerFailureRate: ratio,
}).strict();

const judgeSchema = z.object({
  caseCount: nonnegative,
  attempted: nonnegative,
  structuredOutputSuccessRate: ratio,
  exactVerdictAccuracy: ratio,
  citationValidity: ratio,
  recommendationGrounding: ratio,
  averageConfidenceCorrect: z.number().min(1).max(3).nullable(),
  averageConfidenceIncorrect: z.number().min(1).max(3).nullable(),
  cases: recordCases,
}).strict();

const endToEndSchema = z.object({
  runCount: nonnegative,
  pipelineCompletionRate: ratio,
  groundedPipelineSuccessRate: ratio,
  providerFailureRate: ratio,
  averageLlmCallsPerCompletedRun: nonnegative,
  averageSuccessfulCustomerActionsPerCompletedRun: nonnegative,
  cases: recordCases,
}).strict();

export const EvaluationResultSchema = z.object({
  evaluationVersion: z.literal(EVALUATION_VERSION),
  timestamp: z.string().datetime(),
  gitCommitSha: z.string().regex(/^[a-f0-9]{7,64}$/).nullable(),
  mode: z.enum(["deterministic", "live"]),
  provider: z.enum(["fixture", "groq", "openai"]),
  model: z.string().min(1),
  benchmarkVersion: z.literal(BENCHMARK_VERSION),
  taskCount: nonnegative,
  trialsPerTask: z.number().int().positive(),
  deterministicMetrics: z.object({
    retrieval: retrievalSchema,
    customer: customerSchema,
    evidence: evidenceSchema,
    courtroom: courtroomSchema,
  }).strict(),
  liveModelMetrics: z.object({
    customer: customerSchema,
    evidence: evidenceSchema,
    courtroom: courtroomSchema,
    judge: judgeSchema,
    endToEnd: endToEndSchema,
    personas: recordCases,
    reliability: reliabilitySchema,
  }).strict().nullable(),
  aggregateMetrics: z.record(z.string(), z.number().finite().nullable()),
  limitations: z.array(z.string().min(1)).min(1),
}).strict();

export function validateEvaluationResult(value: unknown) {
  return EvaluationResultSchema.parse(value) as unknown as EvaluationResult;
}
