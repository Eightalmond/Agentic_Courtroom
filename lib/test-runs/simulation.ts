import type {
  CompactHistoryEntry,
  SimulationObservation,
  SimulationState,
  SimulationStepRequest,
  SimulationStepResponse,
} from "@/lib/simulation/types";
import type { EvidenceBundle, EvidenceCollectionRequest } from "@/lib/evidence/types";
import { fingerprintCourtroomArgument, fingerprintEvidenceBundle } from "@/lib/courtroom/fingerprints";
import {
  EMPTY_COURTROOM_STATE,
  type CourtroomArgumentRecord,
  type CourtroomRole,
  type JudgeVerdictRecord,
} from "@/lib/courtroom/types";

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
  return { ...run, evidenceBundle, courtroom: EMPTY_COURTROOM_STATE };
}

export function discardEvidenceBundle(run: TestRun): TestRun {
  return { ...run, evidenceBundle: null, courtroom: EMPTY_COURTROOM_STATE };
}

export function toCourtroomArgumentRequest(run: TestRun, role: CourtroomRole) {
  if (!run.evidenceBundle) {
    throw new Error("Prepare evidence before running a courtroom advocate.");
  }
  return { runId: run.id, role, evidenceBundle: run.evidenceBundle };
}

export function applyCourtroomArgument(run: TestRun, record: CourtroomArgumentRecord): TestRun {
  if (
    !run.evidenceBundle ||
    record.role !== record.argument.role ||
    record.evidenceBundleId !== run.evidenceBundle.bundleId ||
    record.evidenceBundleVersion !== run.evidenceBundle.version ||
    record.evidenceBundleFingerprint !== fingerprintEvidenceBundle(run.evidenceBundle)
  ) {
    throw new Error("The courtroom argument does not belong to this evidence bundle.");
  }
  return { ...run, courtroom: { ...run.courtroom, [record.role]: record, judge: null } };
}

export function toJudgeVerdictRequest(run: TestRun) {
  if (!run.evidenceBundle) throw new Error("Prepare evidence before running the judge.");
  if (!run.courtroom.prosecutor || !run.courtroom.defense) {
    throw new Error("Generate both courtroom arguments before running the judge.");
  }
  return {
    runId: run.id,
    maxActions: run.maxActions,
    evidenceBundle: run.evidenceBundle,
    prosecutor: run.courtroom.prosecutor,
    defense: run.courtroom.defense,
  };
}

export function applyJudgeVerdict(run: TestRun, record: JudgeVerdictRecord): TestRun {
  const bundle = run.evidenceBundle;
  const prosecutor = run.courtroom.prosecutor;
  const defense = run.courtroom.defense;
  if (
    !bundle || !prosecutor || !defense ||
    record.evidenceBundleId !== bundle.bundleId ||
    record.evidenceBundleVersion !== bundle.version ||
    record.evidenceBundleFingerprint !== fingerprintEvidenceBundle(bundle) ||
    record.prosecutorArgumentFingerprint !== fingerprintCourtroomArgument(prosecutor) ||
    record.defenseArgumentFingerprint !== fingerprintCourtroomArgument(defense)
  ) {
    throw new Error("The judge verdict does not belong to the current evidence and arguments.");
  }
  return { ...run, courtroom: { ...run.courtroom, judge: record } };
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
    courtroom: EMPTY_COURTROOM_STATE,
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
