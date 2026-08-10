import { NextResponse } from "next/server";

import { CourtroomError } from "@/lib/courtroom/errors";
import { generateCourtroomArgument } from "@/lib/courtroom/service";
import { SimulationError } from "@/lib/simulation/errors";

const MAX_REQUEST_BYTES = 256_000;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { code: "COURTROOM_REQUEST_TOO_LARGE", message: "The courtroom request is too large.", retryable: false },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { code: "COURTROOM_REQUEST_TOO_LARGE", message: "The courtroom request is too large.", retryable: false },
        { status: 413 },
      );
    }
    body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      { code: "COURTROOM_INVALID_JSON", message: "The courtroom request must be valid JSON.", retryable: false },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await generateCourtroomArgument(body));
  } catch (error) {
    if (error instanceof CourtroomError || error instanceof SimulationError) {
      return NextResponse.json(error.toSafeError(), { status: error.status });
    }
    return NextResponse.json(
      { code: "COURTROOM_INTERNAL_ERROR", message: "The courtroom request failed safely.", retryable: true },
      { status: 500 },
    );
  }
}
