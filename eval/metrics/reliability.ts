import type { ReliabilityMetrics } from "../types";
import { safeRatio } from "./core";

export type MutableReliability = {
  attemptedProviderCalls: number;
  successfulProviderCalls: number;
  rateLimitFailures: number;
  timeoutFailures: number;
  authenticationOrConfigErrors: number;
  structuredOutputFailures: number;
  invalidCitationFailures: number;
  otherProviderFailures: number;
};

export function createReliabilityCounter(): MutableReliability {
  return {
    attemptedProviderCalls: 0,
    successfulProviderCalls: 0,
    rateLimitFailures: 0,
    timeoutFailures: 0,
    authenticationOrConfigErrors: 0,
    structuredOutputFailures: 0,
    invalidCitationFailures: 0,
    otherProviderFailures: 0,
  };
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "UNKNOWN";
}

export function recordProviderFailure(counter: MutableReliability, error: unknown) {
  const code = errorCode(error);
  if (code.includes("RATE_LIMIT")) counter.rateLimitFailures += 1;
  else if (code.includes("TIMEOUT")) counter.timeoutFailures += 1;
  else if (code.includes("AUTHENTICATION") || code.includes("KEY_MISSING") || code.includes("MODEL_MISSING") || code === "LLM_PROVIDER_INVALID") {
    counter.authenticationOrConfigErrors += 1;
  } else if (code.includes("INVALID_RESPONSE") || code.includes("STRUCTURED_OUTPUT") || code.includes("OUTPUT_LIMIT") || code.includes("MALFORMED_PROVIDER")) {
    counter.structuredOutputFailures += 1;
  } else if (code.includes("INVALID_CITATION")) counter.invalidCitationFailures += 1;
  else if (code !== "INVALID_TOOL_ACTION") counter.otherProviderFailures += 1;
  return code;
}

export function finalizeReliability(counter: MutableReliability): ReliabilityMetrics {
  const failures = counter.rateLimitFailures
    + counter.timeoutFailures
    + counter.authenticationOrConfigErrors
    + counter.structuredOutputFailures
    + counter.invalidCitationFailures
    + counter.otherProviderFailures;
  return {
    ...counter,
    providerFailureRate: safeRatio(failures, counter.attemptedProviderCalls),
  };
}
