import { flowPilotProduct, getProductPage } from "@/lib/product";
import { getSectionById, productSearchIndex, searchProductKnowledge } from "@/lib/retrieval";

import { SimulationError } from "./errors";
import type {
  CustomerDecision,
  SearchResultSnapshot,
  SimulationActionEntry,
  SimulationState,
  SimulationStepRequest,
  SimulationStepResponse,
} from "./types";

type ExecuteOptions = {
  now?: string;
  actionId?: string;
};

function snapshotResults(query: string): SearchResultSnapshot[] {
  return searchProductKnowledge(query, { limit: 3 }).map((result) => ({
    sectionId: result.sectionId,
    pageSlug: result.pageSlug,
    pageTitle: result.pageTitle,
    sectionTitle: result.sectionTitle,
    excerpt: result.excerpt,
  }));
}

function createBaseState(request: SimulationStepRequest, now: string): SimulationState {
  return {
    status: "running",
    currentActionCount: request.currentActionCount + 1,
    modelCallCount: request.modelCallCount + 1,
    startedAt: request.startedAt ?? now,
    updatedAt: now,
    completedAt: null,
    currentPageSlug: request.currentPageSlug,
    currentSectionId: request.currentSectionId,
    latestSearchResults: request.latestSearchResults,
    finalAnswer: null,
    finalConfidence: null,
    giveUpReason: null,
    completionReason: null,
    lastError: null,
  };
}

function actionInput(decision: CustomerDecision): Readonly<Record<string, string>> {
  switch (decision.action) {
    case "SEARCH":
      return { query: decision.query };
    case "OPEN_PAGE":
      return { pageSlug: decision.pageSlug };
    case "INSPECT_SECTION":
      return { sectionId: decision.sectionId };
    case "ANSWER":
      return { answer: decision.answer, confidence: decision.confidence };
    case "GIVE_UP":
      return { reason: decision.reason };
  }
}

export function executeCustomerAction(
  decision: CustomerDecision,
  request: SimulationStepRequest,
  options: ExecuteOptions = {},
): SimulationStepResponse {
  const now = options.now ?? new Date().toISOString();
  const state = createBaseState(request, now);
  const baseEntry = {
    id: options.actionId ?? `action-${request.runId}-${request.currentActionCount + 1}`,
    number: request.currentActionCount + 1,
    type: decision.action,
    explanation: decision.explanation,
    timestamp: now,
    input: actionInput(decision),
  } as const;
  let action: SimulationActionEntry;

  switch (decision.action) {
    case "SEARCH": {
      const results = snapshotResults(decision.query);
      state.latestSearchResults = results;
      action = {
        ...baseEntry,
        observation: { kind: "search", query: decision.query, results },
        success: true,
      };
      break;
    }
    case "OPEN_PAGE": {
      const page = getProductPage(decision.pageSlug);
      if (!page) {
        throw new SimulationError(
          "INVALID_TOOL_ACTION",
          "The model selected an unavailable product page. No customer action was consumed. Try this step again.",
          502,
          true,
          true,
        );
      }
      const sections = productSearchIndex
        .filter((record) => record.pageSlug === page.slug)
        .map((record) => ({ id: record.sectionId, title: record.sectionTitle }));
      action = {
        ...baseEntry,
        observation: {
          kind: "page",
          pageSlug: page.slug,
          pageTitle: page.title,
          summary: page.summary,
          sections,
          callouts: (page.callouts ?? []).map((callout) => `${callout.title}: ${callout.content}`),
          relatedPages: page.relatedSlugs.flatMap((slug) => {
            const related = getProductPage(slug);
            return related ? [{ slug: related.slug, title: related.title }] : [];
          }),
        },
        success: true,
      };
      state.currentPageSlug = page.slug;
      state.currentSectionId = null;
      break;
    }
    case "INSPECT_SECTION": {
      const section = getSectionById(decision.sectionId);
      if (!section) {
        throw new SimulationError(
          "INVALID_TOOL_ACTION",
          "The model selected an unavailable product section. No customer action was consumed. Try this step again.",
          502,
          true,
          true,
        );
      }
      const page = getProductPage(section.pageSlug)!;
      action = {
        ...baseEntry,
        observation: {
          kind: "section",
          sectionId: section.sectionId,
          pageSlug: section.pageSlug,
          pageTitle: section.pageTitle,
          sectionTitle: section.sectionTitle,
          content: section.sectionBody,
          callouts: (page.callouts ?? []).map((callout) => `${callout.title}: ${callout.content}`),
        },
        success: true,
      };
      state.currentPageSlug = section.pageSlug;
      state.currentSectionId = section.sectionId;
      break;
    }
    case "ANSWER":
      action = {
        ...baseEntry,
        observation: { kind: "answer", answer: decision.answer, confidence: decision.confidence },
        success: true,
      };
      state.status = "completed";
      state.completedAt = now;
      state.finalAnswer = decision.answer;
      state.finalConfidence = decision.confidence;
      state.completionReason = "answer";
      break;
    case "GIVE_UP":
      action = {
        ...baseEntry,
        observation: { kind: "give_up", reason: decision.reason },
        success: true,
      };
      state.status = "completed";
      state.completedAt = now;
      state.giveUpReason = decision.reason;
      state.completionReason = "gave_up";
      break;
  }

  if (state.status === "running" && state.currentActionCount >= request.maxActions) {
    state.status = "completed";
    state.completedAt = now;
    state.completionReason = "budget_exhausted";
  }

  return { action, simulation: state };
}

export function getProductFixtureName() {
  return flowPilotProduct.name;
}
