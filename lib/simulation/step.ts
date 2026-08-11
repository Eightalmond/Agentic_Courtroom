import { getCustomerPersona, getCustomerTask } from "@/lib/test-runs";

import { SimulationError, mapProviderError } from "./errors";
import { buildCustomerPrompt } from "./prompt";
import type { CustomerDecisionProvider } from "./provider";
import { SimulationStepRequestSchema } from "./schemas";
import { executeCustomerAction } from "./tools";
import type { SimulationState, SimulationStepRequest } from "./types";

export function validateSimulationRequest(input: unknown): SimulationStepRequest {
  const result = SimulationStepRequestSchema.safeParse(input);
  if (!result.success) {
    throw new SimulationError("INVALID_REQUEST", "The simulation request is invalid or too large.", 400);
  }

  if (!getCustomerTask(result.data.taskId)) {
    throw new SimulationError("UNKNOWN_TASK", "The selected customer task no longer exists.", 404);
  }
  if (!getCustomerPersona(result.data.personaId)) {
    throw new SimulationError("UNKNOWN_PERSONA", "The selected customer persona no longer exists.", 404);
  }
  if (result.data.status === "completed") {
    throw new SimulationError("RUN_COMPLETED", "This simulation is already complete.", 409);
  }
  if (result.data.currentActionCount >= result.data.maxActions) {
    throw new SimulationError("ACTION_BUDGET_EXHAUSTED", "This run has used its full action budget.", 409);
  }

  return result.data;
}

export function stateAfterFailedStep(
  request: SimulationStepRequest,
  error: SimulationError,
  now = new Date().toISOString(),
): SimulationState {
  const modelCallCount = request.modelCallCount + (error.modelCallConsumed ? 1 : 0);

  return {
    status: "failed",
    currentActionCount: request.currentActionCount,
    modelCallCount,
    startedAt: request.startedAt ?? (error.modelCallConsumed ? now : null),
    updatedAt: now,
    completedAt: null,
    currentPageSlug: request.currentPageSlug,
    currentSectionId: request.currentSectionId,
    latestSearchResults: request.latestSearchResults,
    finalAnswer: null,
    finalConfidence: null,
    giveUpReason: null,
    completionReason: null,
    lastError: error.toSafeError(),
  };
}

export async function runSimulationStep(input: unknown, provider: CustomerDecisionProvider) {
  const request = validateSimulationRequest(input);
  const task = getCustomerTask(request.taskId)!;
  const persona = getCustomerPersona(request.personaId)!;
  const prompt = buildCustomerPrompt(task, persona, request);

  try {
    const decision = await provider.decide(prompt);
    return executeCustomerAction(decision, request);
  } catch (error) {
    const safeError = mapProviderError(error);
    throw Object.assign(safeError, { simulation: stateAfterFailedStep(request, safeError) });
  }
}
