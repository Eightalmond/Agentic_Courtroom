import OpenAI from "openai";

import type { SafeSimulationError } from "./types";

export class SimulationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
    public readonly modelCallConsumed = false,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SimulationError";
  }

  toSafeError(): SafeSimulationError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.retryAfterSeconds ? { retryAfterSeconds: this.retryAfterSeconds } : {}),
    };
  }
}

export function providerRetryAfterSeconds(error: unknown, now = Date.now()) {
  const retryAfter = error instanceof OpenAI.APIError ? error.headers?.get("retry-after") : null;
  if (!retryAfter) return undefined;

  const numericSeconds = Number(retryAfter);
  const seconds = Number.isFinite(numericSeconds)
    ? Math.ceil(numericSeconds)
    : Math.ceil((Date.parse(retryAfter) - now) / 1_000);

  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined;
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
      "The configured OpenAI credentials were rejected. Ask the demo owner to check deployment settings.",
      502,
      false,
      true,
    );
  }
  if (
    error instanceof OpenAI.RateLimitError ||
    (error instanceof OpenAI.APIError && error.code === "rate_limit_exceeded")
  ) {
    return new SimulationError(
      "PROVIDER_RATE_LIMIT",
      "The model is temporarily rate limited. Try again shortly.",
      429,
      true,
      true,
      providerRetryAfterSeconds(error),
    );
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new SimulationError("PROVIDER_NETWORK", "The server could not reach OpenAI. Try this step again.", 502, true, true);
  }

  return new SimulationError("PROVIDER_FAILURE", "The model request failed safely. Try this step again.", 502, true, true);
}
