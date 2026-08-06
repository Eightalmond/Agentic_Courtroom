import { NextRequest, NextResponse } from "next/server";

import { collectEvidenceBundle } from "@/lib/evidence/collector";
import { EvidenceCollectionError } from "@/lib/evidence/errors";

const MAX_REQUEST_BYTES = 256 * 1024;

function safeErrorResponse(error: EvidenceCollectionError) {
  return NextResponse.json({ error: error.toSafeError() }, { status: error.status });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return safeErrorResponse(new EvidenceCollectionError("REQUEST_TOO_LARGE", "The evidence request is too large.", 413));
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) {
      return safeErrorResponse(new EvidenceCollectionError("REQUEST_TOO_LARGE", "The evidence request is too large.", 413));
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return safeErrorResponse(new EvidenceCollectionError("INVALID_JSON", "The request body must be valid JSON."));
  }

  try {
    return NextResponse.json({ bundle: collectEvidenceBundle(body) }, { status: 200 });
  } catch (error) {
    if (error instanceof EvidenceCollectionError) {
      return safeErrorResponse(error);
    }
    return safeErrorResponse(
      new EvidenceCollectionError("EVIDENCE_COLLECTION_FAILED", "Evidence collection failed safely.", 500, true),
    );
  }
}
