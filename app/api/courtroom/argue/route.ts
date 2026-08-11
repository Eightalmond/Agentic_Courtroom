import { NextResponse } from "next/server";

import { CourtroomError } from "@/lib/courtroom/errors";
import { generateCourtroomArgument, validateCourtroomArgumentRequest } from "@/lib/courtroom/service";
import { RequestBoundaryError, assertSameOrigin, readBoundedJson } from "@/lib/server/request-boundary";
import { acquireProviderRequest, executeRateLimited } from "@/lib/server/rate-limit";
import { SimulationError } from "@/lib/simulation/errors";

const MAX_REQUEST_BYTES = 256_000;

export async function POST(request: Request) {
  let release: (() => boolean) | null = null;
  try {
    assertSameOrigin(request);
    const body = await readBoundedJson(request, MAX_REQUEST_BYTES);
    const validated = validateCourtroomArgumentRequest(body);
    release = acquireProviderRequest(request, "courtroom", validated.runId);
    if (!release) {
      return NextResponse.json(
        { code: "COURTROOM_REQUEST_IN_PROGRESS", message: "A courtroom model request is already running for this test.", retryable: true },
        { status: 409 },
      );
    }
    const execution = await executeRateLimited(request, "courtroom", () => generateCourtroomArgument(validated));
    if (!execution.allowed) {
      return NextResponse.json(
        { code: "DEMO_RATE_LIMITED", message: "This demo has reached its courtroom-generation limit. Try again after the limit resets.", retryable: true },
        { status: 429, headers: { "Retry-After": String(execution.rateLimit.retryAfterSeconds) } },
      );
    }
    return NextResponse.json(execution.value);
  } catch (error) {
    if (error instanceof RequestBoundaryError) {
      return NextResponse.json({ code: error.code, message: error.message, retryable: false }, { status: error.status });
    }
    if (error instanceof CourtroomError || error instanceof SimulationError) {
      return NextResponse.json(error.toSafeError(), { status: error.status });
    }
    return NextResponse.json(
      { code: "COURTROOM_INTERNAL_ERROR", message: "The courtroom request failed safely.", retryable: true },
      { status: 500 },
    );
  } finally {
    release?.();
  }
}
