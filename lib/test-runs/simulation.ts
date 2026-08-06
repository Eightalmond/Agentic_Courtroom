import type {
  CompactHistoryEntry,
  SimulationObservation,
  SimulationState,
  SimulationStepRequest,
  SimulationStepResponse,
} from "@/lib/simulation/types";
import type { EvidenceBundle, EvidenceCollectionRequest } from "@/lib/evidence/types";

import type { TestRun } from "./types";

function summarizeObservation(observation: SimulationObservation) {
  switch (observation.kind) {
    case "search":
      return observation.results.length
        ? `Found ${observation.results.length}: ${observation.results.map((result) => `${result.pageTitle} / ${result.sectionTitle}: ${result.excerpt}`).join(" | ")}`
        : `No results for ${observation.query}.`;
    case "page":
      return `${observation.pageTitle}: ${observation.summary}. Sections: ${observation.sections.map((section) => `${section.title} [${section.id}]`).join(" | ")}. ${observation.callouts.join(" ")}`;
    case "section":
      return `${observation.pageTitle} / ${observation.sectionTitle}: ${observation.content}. ${observation.callouts.join(" ")}`;
    case "answer":
      return `Answered with ${observation.confidence} confidence: ${observation.answer}`;
    case "give_up":
      return `Gave up: ${observation.reason}`;
    case "tool_error":
      return `${observation.code}: ${observation.message}`;
  }
}

export function compactRunHistory(run: TestRun): CompactHistoryEntry[] {
  return run.actions.map((action) => ({
    number: action.number,
    type: action.type,
    explanation: action.explanation,
    observation: summarizeObservation(action.observation).slice(0, 900),
    success: action.success,
  }));
}

export function toSimulationStepRequest(run: TestRun): SimulationStepRequest {
  if (run.evidenceBundle) {
    throw new Error("Reset the simulation before taking another action after evidence collection.");
  }
  return {
    runId: run.id,
    taskId: run.taskId,
    personaId: run.personaId,
    maxActions: run.maxActions,
    status: run.status,
    currentActionCount: run.currentActionCount,
    modelCallCount: run.modelCallCount,
    startedAt: run.startedAt,
    history: compactRunHistory(run),
    currentPageSlug: run.currentPageSlug,
    currentSectionId: run.currentSectionId,
    latestSearchResults: run.latestSearchResults,
  };
}

export function toEvidenceCollectionRequest(run: TestRun): EvidenceCollectionRequest {
  return {
    id: run.id,
    taskId: run.taskId,
    personaId: run.personaId,
    maxActions: run.maxActions,
    createdAt: run.createdAt,
    productId: run.productId,
    status: run.status,
    currentActionCount: run.currentActionCount,
    modelCallCount: run.modelCallCount,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    actions: run.actions,
    currentPageSlug: run.currentPageSlug,
    currentSectionId: run.currentSectionId,
    latestSearchResults: run.latestSearchResults,
    finalAnswer: run.finalAnswer,
    finalConfidence: run.finalConfidence,
    giveUpReason: run.giveUpReason,
    completionReason: run.completionReason,
    lastError: run.lastError,
  };
}

export function applyEvidenceBundle(run: TestRun, evidenceBundle: EvidenceBundle): TestRun {
  if (run.status !== "completed" || evidenceBundle.runId !== run.id) {
    throw new Error("Evidence can only be attached to its completed customer run.");
  }
  return { ...run, evidenceBundle };
}

export function discardEvidenceBundle(run: TestRun): TestRun {
  return { ...run, evidenceBundle: null };
}

export function applySimulationStep(run: TestRun, response: SimulationStepResponse): TestRun {
  return {
    ...run,
    ...response.simulation,
    actions: [...run.actions, response.action],
  };
}

export function applySimulationFailure(run: TestRun, state: SimulationState, error: SimulationState["lastError"]): TestRun {
  return { ...run, ...state, lastError: error };
}

export function resetSimulationRun(run: TestRun, now = new Date().toISOString()): TestRun {
  return {
    ...run,
    status: "ready",
    currentActionCount: 0,
    modelCallCount: 0,
    startedAt: null,
    updatedAt: now,
    completedAt: null,
    actions: [],
    evidenceBundle: null,
    currentPageSlug: null,
    currentSectionId: null,
    latestSearchResults: [],
    finalAnswer: null,
    finalConfidence: null,
    giveUpReason: null,
    completionReason: null,
    lastError: null,
  };
}
