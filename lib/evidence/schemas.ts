import { z } from "zod";

import { flowPilotProduct } from "@/lib/product";
import { MAX_ACTIONS, MIN_ACTIONS } from "@/lib/test-runs/types";
import {
  SafeSimulationErrorSchema,
  SearchResultSnapshotSchema,
  SimulationActionEntrySchema,
} from "@/lib/simulation/schemas";

import { EVIDENCE_BUNDLE_VERSION, MAX_CONTEXT_EVIDENCE } from "./types";

const identifier = z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/);
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const EvidenceItemSchema = z
  .object({
    evidenceId: identifier,
    category: z.enum(["journey", "supporting", "contradicting", "context", "missing"]),
    sourceType: z.enum([
      "search-result",
      "opened-page",
      "inspected-section",
      "page-callout",
      "context-section",
      "missing-section",
    ]),
    productId: z.literal(flowPilotProduct.id),
    pageSlug: identifier,
    pageTitle: boundedText(120),
    sectionId: identifier.nullable(),
    sectionTitle: boundedText(160).nullable(),
    exactSourceText: boundedText(4_000),
    excerpt: boundedText(500),
    sourceLocation: boundedText(240),
    customerSaw: z.boolean(),
    firstExposedByAction: z.number().int().min(1).max(MAX_ACTIONS).nullable(),
    exposureActionNumbers: z.array(z.number().int().min(1).max(MAX_ACTIONS)).max(MAX_ACTIONS),
    relevanceReason: boundedText(500),
    relatedFactCheckIds: z.array(identifier).max(12),
    collectionMethod: z.enum(["journey-observation", "task-evaluation-spec", "deterministic-retrieval"]),
    orderingIndex: z.number().int().min(0).max(100),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.customerSaw !== (item.firstExposedByAction !== null)) {
      context.addIssue({ code: "custom", path: ["firstExposedByAction"], message: "Exposure metadata is inconsistent." });
    }
    if (!item.customerSaw && item.exposureActionNumbers.length > 0) {
      context.addIssue({ code: "custom", path: ["exposureActionNumbers"], message: "Unseen evidence cannot have exposures." });
    }
    if (item.category === "missing" && item.customerSaw) {
      context.addIssue({ code: "custom", path: ["customerSaw"], message: "Missing evidence cannot be customer-seen." });
    }
    if (item.customerSaw && item.exposureActionNumbers[0] !== item.firstExposedByAction) {
      context.addIssue({ code: "custom", path: ["exposureActionNumbers"], message: "The first exposure must be preserved." });
    }
    if (new Set(item.exposureActionNumbers).size !== item.exposureActionNumbers.length) {
      context.addIssue({ code: "custom", path: ["exposureActionNumbers"], message: "Exposure actions must be unique." });
    }
  });

export const MechanicalFactCheckSchema = z
  .object({
    id: identifier,
    name: boundedText(160),
    result: z.enum(["supported", "unsupported", "contradicted", "not-assessable"]),
    sourceSectionIds: z.array(identifier).min(1).max(8),
    explanation: boundedText(500),
    limitation: boundedText(500),
  })
  .strict();

export const EvidenceCoverageSchema = z
  .object({
    journey: z.number().int().nonnegative(),
    supporting: z.number().int().nonnegative(),
    contradicting: z.number().int().nonnegative(),
    context: z.number().int().min(0).max(MAX_CONTEXT_EVIDENCE),
    missing: z.number().int().nonnegative(),
    requiredEvidenceTotal: z.number().int().nonnegative(),
    requiredEvidenceSeen: z.number().int().nonnegative(),
    requiredEvidenceMissing: z.number().int().nonnegative(),
  })
  .strict();

export const EvidenceIntegritySchema = z
  .object({
    actionsProcessed: z.number().int().min(1).max(MAX_ACTIONS),
    successfulToolObservations: z.number().int().min(0).max(MAX_ACTIONS),
    failedToolActions: z.number().int().min(0).max(MAX_ACTIONS),
    simulationCompletedNormally: z.boolean(),
    actionBudgetExhausted: z.boolean(),
    finalAnswerExists: z.boolean(),
    requiredEvidenceSeen: z.boolean(),
    journeyEvidenceCount: z.number().int().nonnegative(),
    contextualEvidenceCount: z.number().int().min(0).max(MAX_CONTEXT_EVIDENCE),
    missingEvidenceCount: z.number().int().nonnegative(),
  })
  .strict();

export const EvidenceBundleSchema = z
  .object({
    version: z.literal(EVIDENCE_BUNDLE_VERSION),
    bundleId: identifier,
    runId: identifier,
    productId: z.literal(flowPilotProduct.id),
    taskId: identifier,
    personaId: identifier,
    createdAt: z.string().datetime(),
    customerOutcome: z.enum(["answered", "gave-up", "budget-exhausted"]),
    customerFinalAnswer: boundedText(800).nullable(),
    customerConfidence: z.enum(["low", "medium", "high"]).nullable(),
    giveUpReason: boundedText(500).nullable(),
    completionReason: z.enum(["answer", "gave_up", "budget_exhausted"]),
    journeySummary: boundedText(800),
    evidenceItems: z.array(EvidenceItemSchema).max(80),
    factChecks: z.array(MechanicalFactCheckSchema).max(12),
    coverage: EvidenceCoverageSchema,
    missingRequiredEvidence: z.array(identifier).max(20),
    pagesVisited: z.array(identifier).max(20),
    sectionsInspected: z.array(identifier).max(20),
    searchQueries: z.array(boundedText(160)).max(MAX_ACTIONS),
    integrity: EvidenceIntegritySchema,
  })
  .strict()
  .superRefine((bundle, context) => {
    const categoryCount = (category: (typeof bundle.evidenceItems)[number]["category"]) =>
      bundle.evidenceItems.filter((item) => item.category === category).length;
    const customerSeenCount = bundle.evidenceItems.filter((item) => item.customerSaw).length;
    const expectedOutcome = bundle.completionReason === "answer"
      ? "answered"
      : bundle.completionReason === "gave_up"
        ? "gave-up"
        : "budget-exhausted";

    if (bundle.customerOutcome !== expectedOutcome) {
      context.addIssue({ code: "custom", path: ["customerOutcome"], message: "Customer outcome is inconsistent." });
    }
    if (bundle.evidenceItems.some((item, index) => item.orderingIndex !== index)) {
      context.addIssue({ code: "custom", path: ["evidenceItems"], message: "Evidence ordering is inconsistent." });
    }
    if (new Set(bundle.evidenceItems.map((item) => item.evidenceId)).size !== bundle.evidenceItems.length) {
      context.addIssue({ code: "custom", path: ["evidenceItems"], message: "Evidence IDs must be unique." });
    }
    if (
      bundle.coverage.journey !== categoryCount("journey") ||
      bundle.coverage.supporting !== categoryCount("supporting") ||
      bundle.coverage.contradicting !== categoryCount("contradicting") ||
      bundle.coverage.context !== categoryCount("context") ||
      bundle.coverage.missing !== categoryCount("missing")
    ) {
      context.addIssue({ code: "custom", path: ["coverage"], message: "Evidence category counts are inconsistent." });
    }
    if (bundle.coverage.requiredEvidenceSeen + bundle.coverage.requiredEvidenceMissing !== bundle.coverage.requiredEvidenceTotal) {
      context.addIssue({ code: "custom", path: ["coverage"], message: "Required evidence coverage is inconsistent." });
    }
    if (
      bundle.integrity.journeyEvidenceCount !== customerSeenCount ||
      bundle.integrity.contextualEvidenceCount !== categoryCount("context") ||
      bundle.integrity.missingEvidenceCount !== categoryCount("missing")
    ) {
      context.addIssue({ code: "custom", path: ["integrity"], message: "Evidence integrity counts are inconsistent." });
    }
  });

export const EvidenceCollectionRequestSchema = z
  .object({
    id: identifier.regex(/^run-[a-z0-9-]+$/),
    taskId: identifier,
    personaId: identifier,
    maxActions: z.number().int().min(MIN_ACTIONS).max(MAX_ACTIONS),
    createdAt: z.string().datetime(),
    productId: z.literal(flowPilotProduct.id),
    status: z.enum(["ready", "running", "completed", "failed"]),
    currentActionCount: z.number().int().min(0).max(MAX_ACTIONS),
    modelCallCount: z.number().int().min(0).max(MAX_ACTIONS),
    startedAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    actions: z.array(SimulationActionEntrySchema).max(MAX_ACTIONS),
    currentPageSlug: identifier.nullable(),
    currentSectionId: identifier.nullable(),
    latestSearchResults: z.array(SearchResultSnapshotSchema).max(3),
    finalAnswer: boundedText(800).nullable(),
    finalConfidence: z.enum(["low", "medium", "high"]).nullable(),
    giveUpReason: boundedText(500).nullable(),
    completionReason: z.enum(["answer", "gave_up", "budget_exhausted"]).nullable(),
    lastError: SafeSimulationErrorSchema.nullable(),
    evidenceBundle: EvidenceBundleSchema.nullable().optional(),
    courtroom: z.unknown().optional(),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.actions.length !== run.currentActionCount) {
      context.addIssue({ code: "custom", path: ["actions"], message: "Action history length is inconsistent." });
    }
    if (run.currentActionCount > run.modelCallCount || run.modelCallCount > run.maxActions) {
      context.addIssue({ code: "custom", path: ["modelCallCount"], message: "Model-call count is inconsistent." });
    }
    run.actions.forEach((action, index) => {
      if (action.number !== index + 1) {
        context.addIssue({ code: "custom", path: ["actions", index, "number"], message: "Actions must be sequential." });
      }
    });
  });

export const SafeEvidenceErrorSchema = z
  .object({ code: identifier, message: boundedText(300), retryable: z.boolean() })
  .strict();
