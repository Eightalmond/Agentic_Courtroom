import { z } from "zod";

import { EvidenceBundleSchema } from "@/lib/evidence/schemas";
import { MAX_ACTIONS, MIN_ACTIONS } from "@/lib/test-runs/types";

import { COURTROOM_ROLES, VERDICT_DIRECTIONS } from "./types";

const identifier = z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/);
const errorCode = z.string().min(1).max(100).regex(/^[A-Z0-9_]+$/);
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const uniqueEvidenceIds = z.array(identifier).min(1).max(6).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Evidence citations must be unique." });
  }
});
const optionalUniqueEvidenceIds = z.array(identifier).max(6).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Evidence citations must be unique." });
  }
});

export const CourtroomRoleSchema = z.enum(COURTROOM_ROLES);
export const VerdictDirectionSchema = z.enum(VERDICT_DIRECTIONS);

export const CourtroomClaimSchema = z
  .object({
    id: identifier,
    claim: boundedText(500),
    evidenceIds: uniqueEvidenceIds,
    strength: z.enum(["weak", "moderate", "strong"]),
  })
  .strict();

export const CitedCourtroomPointSchema = z
  .object({
    claim: boundedText(500),
    evidenceIds: uniqueEvidenceIds,
  })
  .strict();

export const CourtroomArgumentSchema = z
  .object({
    role: CourtroomRoleSchema,
    thesis: boundedText(700),
    keyClaims: z.array(CourtroomClaimSchema).min(1).max(5),
    strongestPoint: CitedCourtroomPointSchema,
    acknowledges: z.array(CitedCourtroomPointSchema).max(3),
    requestedVerdictDirection: VerdictDirectionSchema,
    closingStatement: boundedText(700),
  })
  .strict()
  .superRefine((argument, context) => {
    if (new Set(argument.keyClaims.map((claim) => claim.id)).size !== argument.keyClaims.length) {
      context.addIssue({ code: "custom", path: ["keyClaims"], message: "Claim IDs must be unique." });
    }
  });

const CourtroomWireClaimSchema = z
  .object({
    claim: boundedText(500),
    evidenceIds: uniqueEvidenceIds,
    strength: z.enum(["weak", "moderate", "strong"]),
  })
  .strict();

const CourtroomWireAcknowledgementSchema = z
  .object({
    point: boundedText(500),
    evidenceIds: uniqueEvidenceIds,
  })
  .strict();

export const CourtroomArgumentWireSchema = z
  .object({
    role: CourtroomRoleSchema,
    thesis: boundedText(700),
    keyClaims: z.array(CourtroomWireClaimSchema).min(1).max(5),
    strongestPointClaim: boundedText(500),
    strongestPointEvidenceIds: uniqueEvidenceIds,
    acknowledgements: z.array(CourtroomWireAcknowledgementSchema).max(3),
    requestedVerdictDirection: VerdictDirectionSchema,
    closingStatement: boundedText(700),
  })
  .strict();

export function parseCourtroomArgumentWire(value: unknown) {
  const wire = CourtroomArgumentWireSchema.parse(value);
  return CourtroomArgumentSchema.parse({
    role: wire.role,
    thesis: wire.thesis,
    keyClaims: wire.keyClaims.map((claim, index) => ({
      id: `claim-${index + 1}`,
      ...claim,
    })),
    strongestPoint: {
      claim: wire.strongestPointClaim,
      evidenceIds: wire.strongestPointEvidenceIds,
    },
    acknowledges: wire.acknowledgements.map((acknowledgement) => ({
      claim: acknowledgement.point,
      evidenceIds: acknowledgement.evidenceIds,
    })),
    requestedVerdictDirection: wire.requestedVerdictDirection,
    closingStatement: wire.closingStatement,
  });
}

export const CourtroomArgumentRecordSchema = z
  .object({
    argument: CourtroomArgumentSchema,
    createdAt: z.string().datetime(),
    provider: z.enum(["groq", "openai"]),
    evidenceBundleId: identifier,
    evidenceBundleVersion: z.number().int().positive(),
    evidenceBundleFingerprint: identifier.nullable().optional().default(null),
    role: CourtroomRoleSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (record.role !== record.argument.role) {
      context.addIssue({ code: "custom", path: ["role"], message: "Record and argument roles must match." });
    }
  });

export const JudgeFindingSchema = z.object({
  title: boundedText(160),
  finding: boundedText(600),
  evidenceIds: uniqueEvidenceIds,
  weight: z.enum(["minor", "moderate", "major"]),
}).strict();

const SideAssessmentSchema = z.object({
  strongestSupportedPoint: boundedText(500),
  evidenceIds: uniqueEvidenceIds,
  overreachOrWeakness: boundedText(500),
}).strict();

const CustomerOutcomeAssessmentSchema = z.object({
  answerStatus: z.enum(["supported", "partially_supported", "contradicted", "not_assessable"]),
  explanation: boundedText(600),
  evidenceIds: uniqueEvidenceIds,
}).strict();

const PrimaryFrictionSchema = z.object({
  title: boundedText(160),
  explanation: boundedText(600),
  evidenceIds: uniqueEvidenceIds,
}).strict();

const RecommendationSchema = z.object({
  title: boundedText(160),
  action: boundedText(500),
  rationale: boundedText(600),
  evidenceIds: uniqueEvidenceIds,
}).strict();

export const JudgeVerdictSchema = z.object({
  verdict: VerdictDirectionSchema,
  summary: boundedText(800),
  findings: z.array(JudgeFindingSchema).min(1).max(5),
  prosecutorAssessment: SideAssessmentSchema,
  defenseAssessment: SideAssessmentSchema,
  customerOutcomeAssessment: CustomerOutcomeAssessmentSchema,
  primaryFriction: PrimaryFrictionSchema.nullable(),
  recommendation: RecommendationSchema,
  confidence: z.enum(["low", "medium", "high"]),
}).strict();

const JudgeWireSideAssessmentSchema = z.object({
  strongestSupportedPoint: boundedText(500),
  evidenceIds: uniqueEvidenceIds,
  overreachOrWeakness: boundedText(500),
}).strict();

export const JudgeVerdictWireSchema = z.object({
  verdict: VerdictDirectionSchema,
  summary: boundedText(800),
  findings: z.array(JudgeFindingSchema).min(1).max(5),
  prosecutorAssessment: JudgeWireSideAssessmentSchema,
  defenseAssessment: JudgeWireSideAssessmentSchema,
  customerAnswerStatus: z.enum(["supported", "partially_supported", "contradicted", "not_assessable"]),
  customerOutcomeExplanation: boundedText(600),
  customerOutcomeEvidenceIds: uniqueEvidenceIds,
  primaryFrictionPresent: z.boolean(),
  primaryFrictionTitle: boundedText(160),
  primaryFrictionExplanation: boundedText(600),
  primaryFrictionEvidenceIds: optionalUniqueEvidenceIds,
  recommendationTitle: boundedText(160),
  recommendationAction: boundedText(500),
  recommendationRationale: boundedText(600),
  recommendationEvidenceIds: uniqueEvidenceIds,
  confidence: z.enum(["low", "medium", "high"]),
}).strict().superRefine((wire, context) => {
  if (wire.primaryFrictionPresent && wire.primaryFrictionEvidenceIds.length === 0) {
    context.addIssue({ code: "custom", path: ["primaryFrictionEvidenceIds"], message: "Primary friction requires evidence." });
  }
  if (!wire.primaryFrictionPresent && wire.primaryFrictionEvidenceIds.length > 0) {
    context.addIssue({ code: "custom", path: ["primaryFrictionEvidenceIds"], message: "Absent primary friction cannot cite evidence." });
  }
});

export function parseJudgeVerdictWire(value: unknown) {
  const wire = JudgeVerdictWireSchema.parse(value);
  return JudgeVerdictSchema.parse({
    verdict: wire.verdict,
    summary: wire.summary,
    findings: wire.findings,
    prosecutorAssessment: wire.prosecutorAssessment,
    defenseAssessment: wire.defenseAssessment,
    customerOutcomeAssessment: {
      answerStatus: wire.customerAnswerStatus,
      explanation: wire.customerOutcomeExplanation,
      evidenceIds: wire.customerOutcomeEvidenceIds,
    },
    primaryFriction: wire.primaryFrictionPresent ? {
      title: wire.primaryFrictionTitle,
      explanation: wire.primaryFrictionExplanation,
      evidenceIds: wire.primaryFrictionEvidenceIds,
    } : null,
    recommendation: {
      title: wire.recommendationTitle,
      action: wire.recommendationAction,
      rationale: wire.recommendationRationale,
      evidenceIds: wire.recommendationEvidenceIds,
    },
    confidence: wire.confidence,
  });
}

export const JudgeVerdictRecordSchema = z.object({
  verdict: JudgeVerdictSchema,
  createdAt: z.string().datetime(),
  provider: z.enum(["groq", "openai"]),
  evidenceBundleId: identifier,
  evidenceBundleVersion: z.number().int().positive(),
  evidenceBundleFingerprint: identifier,
  prosecutorArgumentFingerprint: identifier,
  defenseArgumentFingerprint: identifier,
}).strict();

export const CourtroomStateSchema = z
  .object({
    prosecutor: CourtroomArgumentRecordSchema.nullable(),
    defense: CourtroomArgumentRecordSchema.nullable(),
    judge: JudgeVerdictRecordSchema.nullable().optional().default(null),
  })
  .strict();

export const CourtroomArgumentRequestSchema = z
  .object({
    runId: identifier.regex(/^run-[a-z0-9-]+$/),
    role: CourtroomRoleSchema,
    evidenceBundle: EvidenceBundleSchema,
  })
  .strict();

export const JudgeVerdictRequestSchema = z.object({
  runId: identifier.regex(/^run-[a-z0-9-]+$/),
  maxActions: z.number().int().min(MIN_ACTIONS).max(MAX_ACTIONS),
  evidenceBundle: EvidenceBundleSchema,
  prosecutor: CourtroomArgumentRecordSchema,
  defense: CourtroomArgumentRecordSchema,
}).strict();

export const SafeCourtroomErrorSchema = z
  .object({
    code: errorCode,
    message: boundedText(300),
    retryable: z.boolean(),
  })
  .strict();

const evidenceIdsSchema = {
  type: "array",
  items: { type: "string" },
} as const;

export const COURTROOM_ARGUMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "role",
    "thesis",
    "keyClaims",
    "strongestPointClaim",
    "strongestPointEvidenceIds",
    "acknowledgements",
    "requestedVerdictDirection",
    "closingStatement",
  ],
  properties: {
    role: { type: "string", enum: [...COURTROOM_ROLES] },
    thesis: { type: "string" },
    keyClaims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "evidenceIds", "strength"],
        properties: {
          claim: { type: "string" },
          evidenceIds: evidenceIdsSchema,
          strength: { type: "string", enum: ["weak", "moderate", "strong"] },
        },
      },
    },
    strongestPointClaim: { type: "string" },
    strongestPointEvidenceIds: evidenceIdsSchema,
    acknowledgements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["point", "evidenceIds"],
        properties: {
          point: { type: "string" },
          evidenceIds: evidenceIdsSchema,
        },
      },
    },
    requestedVerdictDirection: { type: "string", enum: [...VERDICT_DIRECTIONS] },
    closingStatement: { type: "string" },
  },
} as const;

const judgeFindingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "finding", "evidenceIds", "weight"],
  properties: {
    title: { type: "string" },
    finding: { type: "string" },
    evidenceIds: evidenceIdsSchema,
    weight: { type: "string", enum: ["minor", "moderate", "major"] },
  },
} as const;

const sideAssessmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["strongestSupportedPoint", "evidenceIds", "overreachOrWeakness"],
  properties: {
    strongestSupportedPoint: { type: "string" },
    evidenceIds: evidenceIdsSchema,
    overreachOrWeakness: { type: "string" },
  },
} as const;

export const JUDGE_VERDICT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "verdict", "summary", "findings", "prosecutorAssessment", "defenseAssessment",
    "customerAnswerStatus", "customerOutcomeExplanation", "customerOutcomeEvidenceIds",
    "primaryFrictionPresent", "primaryFrictionTitle", "primaryFrictionExplanation",
    "primaryFrictionEvidenceIds", "recommendationTitle", "recommendationAction",
    "recommendationRationale", "recommendationEvidenceIds", "confidence",
  ],
  properties: {
    verdict: { type: "string", enum: [...VERDICT_DIRECTIONS] },
    summary: { type: "string" },
    findings: { type: "array", items: judgeFindingJsonSchema },
    prosecutorAssessment: sideAssessmentJsonSchema,
    defenseAssessment: sideAssessmentJsonSchema,
    customerAnswerStatus: { type: "string", enum: ["supported", "partially_supported", "contradicted", "not_assessable"] },
    customerOutcomeExplanation: { type: "string" },
    customerOutcomeEvidenceIds: evidenceIdsSchema,
    primaryFrictionPresent: { type: "boolean" },
    primaryFrictionTitle: { type: "string" },
    primaryFrictionExplanation: { type: "string" },
    primaryFrictionEvidenceIds: evidenceIdsSchema,
    recommendationTitle: { type: "string" },
    recommendationAction: { type: "string" },
    recommendationRationale: { type: "string" },
    recommendationEvidenceIds: evidenceIdsSchema,
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} as const;
