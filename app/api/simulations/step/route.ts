import { NextRequest, NextResponse } from "next/server";

import { RequestBoundaryError, assertSameOrigin, readBoundedJson } from "@/lib/server/request-boundary";
import { acquireProviderRequest, executeRateLimited } from "@/lib/server/rate-limit";
import { SimulationError, runSimulationStep, validateSimulationRequest } from "@/lib/simulation";
import { createSimulationProvider } from "@/lib/simulation/providers/factory";

const MAX_REQUEST_BYTES = 64 * 1024;

function safeErrorResponse(error: SimulationError & { simulation?: unknown }) {
  return NextResponse.json(
    {
      error: error.toSafeError(),
      ...(error.simulation ? { simulation: error.simulation } : {}),
    },
    {
      status: error.status,
      ...(error.retryAfterSeconds ? { headers: { "Retry-After": String(error.retryAfterSeconds) } } : {}),
    },
  );
}

export async function POST(request: NextRequest) {
  let release: (() => boolean) | null = null;
  try {
    assertSameOrigin(request);
    const body = await readBoundedJson(request, MAX_REQUEST_BYTES);
    const validated = validateSimulationRequest(body);
    release = acquireProviderRequest(request, "simulation", validated.runId);
    if (!release) {
      return safeErrorResponse(new SimulationError("REQUEST_IN_PROGRESS", "A model request is already running for this test.", 409, true));
    }
    const execution = await executeRateLimited(request, "simulation", () => runSimulationStep(validated, {
      async decide(input) {
        return createSimulationProvider().decide(input);
      },
    }));
    if (!execution.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "DEMO_RATE_LIMITED",
            message: "This demo has reached its customer-step limit. No customer action was consumed.",
            retryable: true,
            retryAfterSeconds: execution.rateLimit.retryAfterSeconds,
          },
        },
        { status: 429, headers: { "Retry-After": String(execution.rateLimit.retryAfterSeconds) } },
      );
    }
    // Configuration is resolved only after deterministic request validation.
    // This keeps builds and invalid requests independent of API credentials.
    return NextResponse.json(execution.value, { status: 200 });
  } catch (error) {
    if (error instanceof RequestBoundaryError) {
      return safeErrorResponse(new SimulationError(error.code, error.message, error.status));
    }
    if (error instanceof SimulationError) {
      return safeErrorResponse(error);
    }
    return safeErrorResponse(new SimulationError("INTERNAL_ERROR", "The simulation step failed safely.", 500, true));
  } finally {
    release?.();
  }
}
