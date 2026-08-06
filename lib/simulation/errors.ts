import OpenAI from "openai";

import type { SafeSimulationError } from "./types";

export class SimulationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
    public readonly modelCallConsumed = false,
  ) {
    super(message);
    this.name = "SimulationError";
  }

  toSafeError(): SafeSimulationError {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

export function mapProviderError(error: unknown): SimulationError {
  if (error instanceof SimulationError) {
    return error;
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new SimulationError("PROVIDER_TIMEOUT", "The model request timed out. Try this step again.", 504, true, true);
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new SimulationError(
      "PROVIDER_AUTHENTICATION",
      "OpenAI rejected the server credentials. Check OPENAI_API_KEY and try again.",
      502,
      false,
      true,
    );
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new SimulationError("PROVIDER_RATE_LIMIT", "The model is temporarily rate limited. Try again shortly.", 429, true, true);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new SimulationError("PROVIDER_NETWORK", "The server could not reach OpenAI. Try this step again.", 502, true, true);
  }

  return new SimulationError("PROVIDER_FAILURE", "The model request failed safely. Try this step again.", 502, true, true);
}
