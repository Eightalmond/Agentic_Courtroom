import { flowPilotProduct } from "@/lib/product";

import { getCustomerPersona, getCustomerTask } from "./data";
import { generateRunId } from "./run-id";
import { MAX_ACTIONS, MIN_ACTIONS, type NewRunInput, type TestRun } from "./types";

type CreateReadyRunOptions = {
  id?: string;
  createdAt?: string;
};

export function createReadyRun(input: NewRunInput, options: CreateReadyRunOptions = {}): TestRun {
  if (!getCustomerTask(input.taskId)) {
    throw new Error("Select a valid customer task.");
  }

  if (!getCustomerPersona(input.personaId)) {
    throw new Error("Select a valid customer persona.");
  }

  if (!Number.isInteger(input.maxActions) || input.maxActions < MIN_ACTIONS || input.maxActions > MAX_ACTIONS) {
    throw new Error(`Maximum actions must be an integer between ${MIN_ACTIONS} and ${MAX_ACTIONS}.`);
  }

  const createdAt = options.createdAt ?? new Date().toISOString();

  return {
    id: options.id ?? generateRunId(),
    taskId: input.taskId,
    personaId: input.personaId,
    maxActions: input.maxActions,
    createdAt,
    status: "ready",
    productId: flowPilotProduct.id,
    currentActionCount: 0,
    modelCallCount: 0,
    startedAt: null,
    updatedAt: createdAt,
    completedAt: null,
    actions: [],
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
