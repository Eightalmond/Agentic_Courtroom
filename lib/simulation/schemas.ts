import { z } from "zod";

import { MAX_ACTIONS, MIN_ACTIONS } from "@/lib/test-runs/types";

import { MAX_PROVIDER_REQUEST_ATTEMPTS } from "./types";

const NO_MARKUP_OR_PRIVATE_REASONING = /<[^>]*>|chain[- ]of[- ]thought|step[- ]by[- ]step reasoning|\banalysis\s*:/i;

function publicText(maximum: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !NO_MARKUP_OR_PRIVATE_REASONING.test(value), {
      message: "Use concise plain text without markup or private reasoning.",
    });
}

const explanation = publicText(240);
const pageSlug = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
const sectionId = z.string().trim().min(1).max(180).regex(/^[a-z0-9-]+$/);

export const CustomerDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SEARCH"), explanation, query: publicText(160) }).strict(),
  z.object({ action: z.literal("OPEN_PAGE"), explanation, pageSlug }).strict(),
  z.object({ action: z.literal("INSPECT_SECTION"), explanation, sectionId }).strict(),
  z
    .object({
      action: z.literal("ANSWER"),
      explanation,
      answer: publicText(800),
      confidence: z.enum(["low", "medium", "high"]),
    })
    .strict(),
  z.object({ action: z.literal("GIVE_UP"), explanation, reason: publicText(500) }).strict(),
]);

// Structured Outputs requires a root object. Every field is present and nullable
// on the wire; parseCustomerDecision then enforces the exact action shape.
export const CustomerDecisionWireSchema = z
  .object({
    action: z.enum(["SEARCH", "OPEN_PAGE", "INSPECT_SECTION", "ANSWER", "GIVE_UP"]),
    explanation,
    query: publicText(160).nullable(),
    pageSlug: pageSlug.nullable(),
    sectionId: sectionId.nullable(),
    answer: publicText(800).nullable(),
    confidence: z.enum(["low", "medium", "high"]).nullable(),
    reason: publicText(500).nullable(),
  })
  .strict();

// Groq's strict Structured Outputs mode accepts an explicit JSON Schema.
// Zod remains the runtime authority and applies the tighter content rules below.
export const CUSTOMER_DECISION_JSON_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["SEARCH", "OPEN_PAGE", "INSPECT_SECTION", "ANSWER", "GIVE_UP"] },
    explanation: { type: "string" },
    query: { type: ["string", "null"] },
    pageSlug: { type: ["string", "null"] },
    sectionId: { type: ["string", "null"] },
    answer: { type: ["string", "null"] },
    confidence: {
      anyOf: [{ type: "string", enum: ["low", "medium", "high"] }, { type: "null" }],
    },
    reason: { type: ["string", "null"] },
  },
  required: ["action", "explanation", "query", "pageSlug", "sectionId", "answer", "confidence", "reason"],
  additionalProperties: false,
} as const;

export function parseCustomerDecision(value: unknown) {
  const wire = CustomerDecisionWireSchema.parse(value);

  switch (wire.action) {
    case "SEARCH":
      return CustomerDecisionSchema.parse({ action: wire.action, explanation: wire.explanation, query: wire.query });
    case "OPEN_PAGE":
      return CustomerDecisionSchema.parse({ action: wire.action, explanation: wire.explanation, pageSlug: wire.pageSlug });
    case "INSPECT_SECTION":
      return CustomerDecisionSchema.parse({ action: wire.action, explanation: wire.explanation, sectionId: wire.sectionId });
    case "ANSWER":
      return CustomerDecisionSchema.parse({
        action: wire.action,
        explanation: wire.explanation,
        answer: wire.answer,
        confidence: wire.confidence,
      });
    case "GIVE_UP":
      return CustomerDecisionSchema.parse({ action: wire.action, explanation: wire.explanation, reason: wire.reason });
  }
}

export const SearchResultSnapshotSchema = z
  .object({
    sectionId,
    pageSlug,
    pageTitle: publicText(120),
    sectionTitle: publicText(160),
    excerpt: publicText(500),
  })
  .strict();

const CompactHistoryEntrySchema = z
  .object({
    number: z.number().int().min(1).max(MAX_ACTIONS),
    type: z.enum(["SEARCH", "OPEN_PAGE", "INSPECT_SECTION", "ANSWER", "GIVE_UP"]),
    explanation,
    observation: publicText(900),
    success: z.boolean(),
  })
  .strict();

export const SimulationStepRequestSchema = z
  .object({
    runId: z.string().trim().min(1).max(120).regex(/^run-[a-z0-9-]+$/),
    taskId: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/),
    personaId: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
    maxActions: z.number().int().min(MIN_ACTIONS).max(MAX_ACTIONS),
    status: z.enum(["ready", "running", "completed", "failed"]),
    currentActionCount: z.number().int().min(0).max(MAX_ACTIONS),
    modelCallCount: z.number().int().min(0).max(MAX_PROVIDER_REQUEST_ATTEMPTS),
    startedAt: z.string().datetime().nullable(),
    history: z.array(CompactHistoryEntrySchema).max(MAX_ACTIONS),
    currentPageSlug: pageSlug.nullable(),
    currentSectionId: sectionId.nullable(),
    latestSearchResults: z.array(SearchResultSnapshotSchema).max(3),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.history.length !== value.currentActionCount) {
      context.addIssue({ code: "custom", path: ["history"], message: "History length must match the action count." });
    }
    if (value.currentActionCount > value.modelCallCount) {
      context.addIssue({ code: "custom", path: ["modelCallCount"], message: "Model-call count is inconsistent." });
    }
    value.history.forEach((entry, index) => {
      if (entry.number !== index + 1) {
        context.addIssue({ code: "custom", path: ["history", index, "number"], message: "Action numbers must be sequential." });
      }
    });
  });

export const SafeSimulationErrorSchema = z
  .object({
    code: z.string().min(1).max(80),
    message: publicText(300),
    retryable: z.boolean(),
    retryAfterSeconds: z.number().int().min(1).max(86_400).optional(),
  })
  .strict();

export const SimulationObservationSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("search"), query: publicText(160), results: z.array(SearchResultSnapshotSchema).max(3) })
    .strict(),
  z
    .object({
      kind: z.literal("page"),
      pageSlug,
      pageTitle: publicText(120),
      summary: publicText(500),
      sections: z.array(z.object({ id: sectionId, title: publicText(160) }).strict()).max(12),
      callouts: z.array(publicText(600)).max(6),
      relatedPages: z.array(z.object({ slug: pageSlug, title: publicText(120) }).strict()).max(8),
    })
    .strict(),
  z
    .object({
      kind: z.literal("section"),
      sectionId,
      pageSlug,
      pageTitle: publicText(120),
      sectionTitle: publicText(160),
      content: publicText(2_400),
      callouts: z.array(publicText(600)).max(6),
    })
    .strict(),
  z.object({ kind: z.literal("answer"), answer: publicText(800), confidence: z.enum(["low", "medium", "high"]) }).strict(),
  z.object({ kind: z.literal("give_up"), reason: publicText(500) }).strict(),
  z
    .object({
      kind: z.literal("tool_error"),
      code: z.enum(["UNKNOWN_PAGE", "UNKNOWN_SECTION"]),
      message: publicText(300),
    })
    .strict(),
]);

export const SimulationActionEntrySchema = z
  .object({
    id: z.string().min(1).max(180).regex(/^[a-z0-9-]+$/),
    number: z.number().int().min(1).max(MAX_ACTIONS),
    type: z.enum(["SEARCH", "OPEN_PAGE", "INSPECT_SECTION", "ANSWER", "GIVE_UP"]),
    explanation,
    timestamp: z.string().datetime(),
    input: z.record(z.string(), publicText(800)),
    observation: SimulationObservationSchema,
    success: z.boolean(),
    error: z.object({ code: z.string().min(1).max(80), message: publicText(300) }).strict().optional(),
  })
  .strict();

export const SimulationStateSchema = z
  .object({
    status: z.enum(["ready", "running", "completed", "failed"]),
    currentActionCount: z.number().int().min(0).max(MAX_ACTIONS),
    modelCallCount: z.number().int().min(0).max(MAX_PROVIDER_REQUEST_ATTEMPTS),
    startedAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    currentPageSlug: pageSlug.nullable(),
    currentSectionId: sectionId.nullable(),
    latestSearchResults: z.array(SearchResultSnapshotSchema).max(3),
    finalAnswer: publicText(800).nullable(),
    finalConfidence: z.enum(["low", "medium", "high"]).nullable(),
    giveUpReason: publicText(500).nullable(),
    completionReason: z.enum(["answer", "gave_up", "budget_exhausted"]).nullable(),
    lastError: SafeSimulationErrorSchema.nullable(),
  })
  .strict();

export const SimulationStepResponseSchema = z
  .object({ action: SimulationActionEntrySchema, simulation: SimulationStateSchema })
  .strict()
  .superRefine((value, context) => {
    if (!value.action.success || value.action.error) {
      context.addIssue({ code: "custom", path: ["action"], message: "Only successful customer actions may be returned." });
    }
    if (value.action.number !== value.simulation.currentActionCount) {
      context.addIssue({ code: "custom", path: ["action", "number"], message: "The action number must match the successful-action count." });
    }
  });

export { publicText };
