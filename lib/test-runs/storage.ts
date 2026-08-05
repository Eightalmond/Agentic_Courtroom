"use client";

import { flowPilotProduct } from "@/lib/product";

import { getCustomerPersona, getCustomerTask } from "./data";
import { MAX_ACTIONS, MIN_ACTIONS, RUN_STATUSES, type RunStatus, type TestRun } from "./types";

export const RUN_STORAGE_KEY = "trial-by-user:runs:v1";

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

  const { id, taskId, personaId, maxActions, createdAt, status, productId, currentActionCount } = value;
  const validId = typeof id === "string" && /^run-[a-z0-9-]+$/.test(id);
  const validTask = typeof taskId === "string" && Boolean(getCustomerTask(taskId));
  const validPersona = typeof personaId === "string" && Boolean(getCustomerPersona(personaId));
  const validMaximum =
    typeof maxActions === "number" &&
    Number.isInteger(maxActions) &&
    maxActions >= MIN_ACTIONS &&
    maxActions <= MAX_ACTIONS;
  const validCreatedAt = typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt));
  const validCurrentCount =
    typeof currentActionCount === "number" &&
    Number.isInteger(currentActionCount) &&
    currentActionCount >= 0 &&
    typeof maxActions === "number" &&
    currentActionCount <= maxActions;

  if (
    !validId ||
    !validTask ||
    !validPersona ||
    !validMaximum ||
    !validCreatedAt ||
    !isRunStatus(status) ||
    productId !== flowPilotProduct.id ||
    !validCurrentCount
  ) {
    return undefined;
  }

  return {
    id,
    taskId,
    personaId,
    maxActions,
    createdAt,
    status,
    productId,
    currentActionCount,
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

export function listLocalRuns(storage?: StorageLike): TestRun[] {
  const target = resolveStorage(storage);

  if (!target) {
    return [];
  }

  try {
    const rawValue = target.getItem(RUN_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(parseStoredRun)
      .filter((run): run is TestRun => Boolean(run))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return [];
  }
}

export function createLocalRun(run: TestRun, storage?: StorageLike) {
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
    const retainedRuns = runs.filter((run) => run.id !== id);

    if (retainedRuns.length === runs.length) {
      return false;
    }

    if (retainedRuns.length === 0) {
      target.removeItem(RUN_STORAGE_KEY);
    } else {
      target.setItem(RUN_STORAGE_KEY, JSON.stringify(retainedRuns));
    }

    return true;
  } catch {
    return false;
  }
}
