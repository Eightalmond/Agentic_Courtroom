"use client";

import { z } from "zod";

import { EvidenceBundleSchema, SafeEvidenceErrorSchema } from "./schemas";
import type { EvidenceBundle, EvidenceCollectionRequest } from "./types";

const EvidenceCollectionResponseSchema = z.object({ bundle: EvidenceBundleSchema }).strict();

export class EvidenceClientError extends Error {
  constructor(public readonly safeError: { code: string; message: string; retryable: boolean }) {
    super(safeError.message);
    this.name = "EvidenceClientError";
  }
}

export async function requestEvidenceBundle(
  request: EvidenceCollectionRequest,
  fetcher: typeof fetch = fetch,
): Promise<EvidenceBundle> {
  let response: Response;
  try {
    response = await fetcher("/api/evidence/collect", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new EvidenceClientError({
      code: "NETWORK_FAILURE",
      message: "The browser could not reach the evidence route. Check the connection and try again.",
      retryable: true,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new EvidenceClientError({
      code: "INVALID_SERVER_RESPONSE",
      message: "The server returned an unreadable evidence response. Try again.",
      retryable: true,
    });
  }

  if (response.ok) {
    const result = EvidenceCollectionResponseSchema.safeParse(payload);
    if (result.success) return result.data.bundle as EvidenceBundle;
  } else {
    const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
    const safeError = SafeEvidenceErrorSchema.safeParse(record.error);
    if (safeError.success) throw new EvidenceClientError(safeError.data);
  }

  throw new EvidenceClientError({
    code: "INVALID_SERVER_RESPONSE",
    message: "The server returned an invalid evidence response. Try again.",
    retryable: true,
  });
}
