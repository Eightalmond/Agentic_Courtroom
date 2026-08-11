import "server-only";

export class RequestBoundaryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RequestBoundaryError";
  }
}

function trustedRequestAuthority(request: Request, isVercel = process.env.VERCEL === "1") {
  const requestUrl = new URL(request.url);
  if (!isVercel) {
    return { host: request.headers.get("host") ?? requestUrl.host, protocol: requestUrl.protocol.replace(":", "") };
  }

  return {
    host: (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host)
      .split(",")[0]
      ?.trim(),
    protocol: (request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", ""))
      .split(",")[0]
      ?.trim(),
  };
}

export function assertSameOrigin(request: Request, isVercel = process.env.VERCEL === "1") {
  const origin = request.headers.get("origin");
  if (!origin) return;

  try {
    const parsedOrigin = new URL(origin);
    const authority = trustedRequestAuthority(request, isVercel);
    if (
      parsedOrigin.host === authority.host &&
      parsedOrigin.protocol.replace(":", "") === authority.protocol
    ) return;
  } catch {
    // Fall through to the same safe rejection used for a mismatched origin.
  }

  throw new RequestBoundaryError("ORIGIN_REJECTED", "This request origin is not allowed.", 403);
}

export async function readBoundedJson(request: Request, maximumBytes: number) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new RequestBoundaryError("INVALID_CONTENT_TYPE", "The request must use application/json.", 415);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new RequestBoundaryError("REQUEST_TOO_LARGE", "The request is too large.", 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    throw new RequestBoundaryError("INVALID_JSON", "The request body must be valid JSON.", 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > maximumBytes) {
    throw new RequestBoundaryError("REQUEST_TOO_LARGE", "The request is too large.", 413);
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new RequestBoundaryError("INVALID_JSON", "The request body must be valid JSON.", 400);
  }
}
