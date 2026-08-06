"use client";

import { SafeSimulationErrorSchema, SimulationStateSchema, SimulationStepResponseSchema } from "./schemas";
import type { SafeSimulationError, SimulationState, SimulationStepRequest, SimulationStepResponse } from "./types";

export class SimulationClientError extends Error {
  constructor(
    public readonly safeError: SafeSimulationError,
    public readonly simulation?: SimulationState,
  ) {
    super(safeError.message);
    this.name = "SimulationClientError";
  }
}

export async function requestSimulationStep(
  request: SimulationStepRequest,
  fetcher: typeof fetch = fetch,
): Promise<SimulationStepResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/simulations/step", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new SimulationClientError({
      code: "NETWORK_FAILURE",
      message: "The browser could not reach the simulation route. Check the connection and try again.",
      retryable: true,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SimulationClientError({
      code: "INVALID_SERVER_RESPONSE",
      message: "The server returned an unreadable response. Try this step again.",
      retryable: true,
    });
  }

  if (response.ok) {
    const result = SimulationStepResponseSchema.safeParse(payload);
    if (result.success) {
      return result.data;
    }
    throw new SimulationClientError({
      code: "INVALID_SERVER_RESPONSE",
      message: "The server returned an invalid simulation update. Try this step again.",
      retryable: true,
    });
  }

  const errorPayload = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  const error = SafeSimulationErrorSchema.safeParse(errorPayload.error);
  const simulation = SimulationStateSchema.safeParse(errorPayload.simulation);

  throw new SimulationClientError(
    error.success
      ? error.data
      : { code: "SIMULATION_FAILED", message: "The simulation step failed safely. Try again.", retryable: true },
    simulation.success ? simulation.data : undefined,
  );
}
