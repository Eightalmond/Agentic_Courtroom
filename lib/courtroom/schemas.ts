import { z } from "zod";

import { EvidenceBundleSchema } from "@/lib/evidence/schemas";

import { COURTROOM_ROLES, VERDICT_DIRECTIONS } from "./types";

const identifier = z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/);
const errorCode = z.string().min(1).max(100).regex(/^[A-Z0-9_]+$/);
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const uniqueEvidenceIds = z.array(identifier).min(1).max(6).superRefine((ids, context) => {
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
    role: CourtroomRoleSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (record.role !== record.argument.role) {
      context.addIssue({ code: "custom", path: ["role"], message: "Record and argument roles must match." });
    }
  });

export const CourtroomStateSchema = z
  .object({
    prosecutor: CourtroomArgumentRecordSchema.nullable(),
    defense: CourtroomArgumentRecordSchema.nullable(),
  })
  .strict();

export const CourtroomArgumentRequestSchema = z
  .object({
    runId: identifier.regex(/^run-[a-z0-9-]+$/),
    role: CourtroomRoleSchema,
    evidenceBundle: EvidenceBundleSchema,
  })
  .strict();

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
