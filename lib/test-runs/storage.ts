"use client";

import { flowPilotProduct } from "@/lib/product";
import { EvidenceBundleSchema } from "@/lib/evidence/schemas";
import { CourtroomStateSchema } from "@/lib/courtroom/schemas";
import { EMPTY_COURTROOM_STATE } from "@/lib/courtroom/types";
import { fingerprintCourtroomArgument, fingerprintEvidenceBundle } from "@/lib/courtroom/fingerprints";
import { SimulationActionEntrySchema, SimulationStateSchema } from "@/lib/simulation/schemas";

import { getCustomerPersona, getCustomerTask } from "./data";
import { MAX_ACTIONS, MIN_ACTIONS, RUN_STATUSES, type RunStatus, type TestRun } from "./types";

export const RUN_STORAGE_KEY = "trial-by-user:runs:v6";
export const PHASE_NINE_RUN_STORAGE_KEY = "trial-by-user:runs:v5";
export const PHASE_SEVEN_RUN_STORAGE_KEY = "trial-by-user:runs:v4";
export const PHASE_SIX_RUN_STORAGE_KEY = "trial-by-user:runs:v3";
export const PHASE_FIVE_RUN_STORAGE_KEY = "trial-by-user:runs:v2";
export const LEGACY_RUN_STORAGE_KEY = "trial-by-user:runs:v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === "string" && RUN_STATUSES.includes(value as RunStatus);
}

export function parseStoredRun(value: unknown): TestRun | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { id, taskId, personaId, maxActions, createdAt, productId } = value;
  const status = value.status === "configured" ? "ready" : value.status;
  const validId = typeof id === "string" && /^run-[a-z0-9-]+$/.test(id);
  const validTask = typeof taskId === "string" && Boolean(getCustomerTask(taskId));
  const validPersona = typeof personaId === "string" && Boolean(getCustomerPersona(personaId));
  const validMaximum =
    typeof maxActions === "number" &&
    Number.isInteger(maxActions) &&
    maxActions >= MIN_ACTIONS &&
    maxActions <= MAX_ACTIONS;
  const validCreatedAt = typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt));

  if (!validId || !validTask || !validPersona || !validMaximum || !validCreatedAt || !isRunStatus(status) || productId !== flowPilotProduct.id) {
    return undefined;
  }

  const parsedActions = SimulationActionEntrySchema.array().max(MAX_ACTIONS).safeParse(value.actions ?? []);
  if (!parsedActions.success) {
    return undefined;
  }

  const hasPreparedEvidence = value.evidenceBundle !== null && value.evidenceBundle !== undefined;
  const shouldNormalizeFailedActions = !hasPreparedEvidence && parsedActions.data.some((action) => !action.success);
  const actions = shouldNormalizeFailedActions
    ? parsedActions.data
        .filter((action) => action.success)
        .map((action, index) => ({ ...action, id: `action-${id}-${index + 1}`, number: index + 1 }))
    : parsedActions.data;
  const storedActionCount = typeof value.currentActionCount === "number" ? value.currentActionCount : actions.length;
  const currentActionCount = shouldNormalizeFailedActions
    ? actions.length
    : storedActionCount;
  const shouldReopenIncorrectExhaustion =
    !hasPreparedEvidence &&
    status === "completed" &&
    value.completionReason === "budget_exhausted" &&
    currentActionCount < maxActions;
  const normalizedStatus = shouldReopenIncorrectExhaustion ? "failed" : status;
  const normalizedLastError = shouldReopenIncorrectExhaustion && !value.lastError
    ? {
        code: "LEGACY_ATTEMPT_NOT_ACTION",
        message: "A previous failed attempt did not consume the customer-action budget. Retry the step.",
        retryable: true,
      }
    : value.lastError ?? null;
  const stateResult = SimulationStateSchema.safeParse({
    status: normalizedStatus,
    currentActionCount,
    modelCallCount: value.modelCallCount ?? currentActionCount,
    startedAt: value.startedAt ?? null,
    updatedAt: value.updatedAt ?? createdAt,
    completedAt: shouldReopenIncorrectExhaustion ? null : value.completedAt ?? null,
    currentPageSlug: value.currentPageSlug ?? null,
    currentSectionId: value.currentSectionId ?? null,
    latestSearchResults: value.latestSearchResults ?? [],
    finalAnswer: value.finalAnswer ?? null,
    finalConfidence: value.finalConfidence ?? null,
    giveUpReason: value.giveUpReason ?? null,
    completionReason: shouldReopenIncorrectExhaustion ? null : value.completionReason ?? null,
    lastError: normalizedLastError,
  });
  const evidenceResult = EvidenceBundleSchema.nullable().safeParse(value.evidenceBundle ?? null);
  const courtroomResult = CourtroomStateSchema.safeParse(value.courtroom ?? EMPTY_COURTROOM_STATE);

  if (
    !stateResult.success ||
    stateResult.data.currentActionCount !== actions.length ||
    !evidenceResult.success ||
    !courtroomResult.success ||
    (evidenceResult.data !== null &&
      (status !== "completed" ||
        evidenceResult.data.runId !== id ||
        evidenceResult.data.taskId !== taskId ||
        evidenceResult.data.personaId !== personaId ||
        evidenceResult.data.productId !== productId))
  ) {
    return undefined;
  }

  const bundleFingerprint = evidenceResult.data ? fingerprintEvidenceBundle(evidenceResult.data) : null;
  const argumentMatchesEvidence = (role: "prosecutor" | "defense") => {
    const record = courtroomResult.data[role];
    return record === null || (
      evidenceResult.data !== null &&
      record.role === role &&
      record.evidenceBundleId === evidenceResult.data.bundleId &&
      record.evidenceBundleVersion === evidenceResult.data.version &&
      (record.evidenceBundleFingerprint === null || record.evidenceBundleFingerprint === bundleFingerprint)
    );
  };
  const judge = courtroomResult.data.judge;
  const judgeMatchesEvidence = judge === null || (
    evidenceResult.data !== null &&
    courtroomResult.data.prosecutor !== null &&
    courtroomResult.data.defense !== null &&
    judge.evidenceBundleId === evidenceResult.data.bundleId &&
    judge.evidenceBundleVersion === evidenceResult.data.version &&
    judge.evidenceBundleFingerprint === bundleFingerprint &&
    judge.prosecutorArgumentFingerprint === fingerprintCourtroomArgument(courtroomResult.data.prosecutor) &&
    judge.defenseArgumentFingerprint === fingerprintCourtroomArgument(courtroomResult.data.defense)
  );
  const courtroomMatchesEvidence = argumentMatchesEvidence("prosecutor") && argumentMatchesEvidence("defense") && judgeMatchesEvidence;
  if (!courtroomMatchesEvidence) return undefined;

  return {
    id,
    taskId,
    personaId,
    maxActions,
    createdAt,
    productId,
    actions,
    evidenceBundle: evidenceResult.data,
    courtroom: courtroomResult.data,
    ...stateResult.data,
  };
}

function resolveStorage(storage?: StorageLike) {
  if (storage) {
    return storage;
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readRunsAtKey(target: StorageLike, key: string) {
  try {
    const rawValue = target.getItem(key);
    if (!rawValue) {
      return [];
    }
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(parseStoredRun).filter((run): run is TestRun => Boolean(run));
  } catch {
    return [];
  }
}

export function listLocalRuns(storage?: StorageLike): TestRun[] {
  const target = resolveStorage(storage);
  if (!target) {
    return [];
  }

  const currentRuns = readRunsAtKey(target, RUN_STORAGE_KEY);
  const phaseNineRuns = readRunsAtKey(target, PHASE_NINE_RUN_STORAGE_KEY);
  const phaseSevenRuns = readRunsAtKey(target, PHASE_SEVEN_RUN_STORAGE_KEY);
  const phaseSixRuns = readRunsAtKey(target, PHASE_SIX_RUN_STORAGE_KEY);
  const phaseFiveRuns = readRunsAtKey(target, PHASE_FIVE_RUN_STORAGE_KEY);
  const legacyRuns = readRunsAtKey(target, LEGACY_RUN_STORAGE_KEY);
  const runs = [...currentRuns, ...phaseNineRuns, ...phaseSevenRuns, ...phaseSixRuns, ...phaseFiveRuns, ...legacyRuns].filter(
    (run, index, allRuns) => allRuns.findIndex((candidate) => candidate.id === run.id) === index,
  );

  return runs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function saveLocalRun(run: TestRun, storage?: StorageLike) {
  const target = resolveStorage(storage);
  const validatedRun = parseStoredRun(run);
  if (!target || !validatedRun) {
    return false;
  }

  try {
    const runs = listLocalRuns(target).filter((existingRun) => existingRun.id !== validatedRun.id);
    target.setItem(RUN_STORAGE_KEY, JSON.stringify([validatedRun, ...runs]));
    return true;
  } catch {
    return false;
  }
}

export const createLocalRun = saveLocalRun;

export function readLocalRun(id: string, storage?: StorageLike) {
  return listLocalRuns(storage).find((run) => run.id === id);
}

export function removeLocalRun(id: string, storage?: StorageLike) {
  const target = resolveStorage(storage);
  if (!target) {
    return false;
  }

  try {
    const runs = listLocalRuns(target);
    if (!runs.some((run) => run.id === id)) {
      return false;
    }
    const retainedRuns = runs.filter((run) => run.id !== id);
    if (retainedRuns.length === 0) {
      target.removeItem(RUN_STORAGE_KEY);
    } else {
      target.setItem(RUN_STORAGE_KEY, JSON.stringify(retainedRuns));
    }
    target.removeItem(LEGACY_RUN_STORAGE_KEY);
    target.removeItem(PHASE_FIVE_RUN_STORAGE_KEY);
    target.removeItem(PHASE_SIX_RUN_STORAGE_KEY);
    target.removeItem(PHASE_SEVEN_RUN_STORAGE_KEY);
    target.removeItem(PHASE_NINE_RUN_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
