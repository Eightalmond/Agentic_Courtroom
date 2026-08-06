import { NextRequest, NextResponse } from "next/server";

import { SimulationError, runSimulationStep } from "@/lib/simulation";
import { createOpenAICustomerProvider } from "@/lib/simulation/openai-provider";

const MAX_REQUEST_BYTES = 64 * 1024;

function safeErrorResponse(error: SimulationError & { simulation?: unknown }) {
  return NextResponse.json(
    {
      error: error.toSafeError(),
      ...(error.simulation ? { simulation: error.simulation } : {}),
    },
    { status: error.status },
  );
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0]?.trim();
    const requestProtocol = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")).split(",")[0]?.trim();
    let sameOrigin = false;
    try {
      const parsedOrigin = new URL(origin);
      sameOrigin = parsedOrigin.host === requestHost && parsedOrigin.protocol.replace(":", "") === requestProtocol;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      return safeErrorResponse(new SimulationError("ORIGIN_REJECTED", "This request origin is not allowed.", 403));
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return safeErrorResponse(new SimulationError("REQUEST_TOO_LARGE", "The simulation request is too large.", 413));
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) {
      return safeErrorResponse(new SimulationError("REQUEST_TOO_LARGE", "The simulation request is too large.", 413));
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return safeErrorResponse(new SimulationError("INVALID_JSON", "The request body must be valid JSON.", 400));
  }

  try {
    // Configuration is resolved only after deterministic request validation.
    // This keeps builds and invalid requests independent of API credentials.
    const result = await runSimulationStep(body, {
      async decide(input) {
        return createOpenAICustomerProvider().decide(input);
      },
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof SimulationError) {
      return safeErrorResponse(error);
    }
    return safeErrorResponse(new SimulationError("INTERNAL_ERROR", "The simulation step failed safely.", 500, true));
  }
}
