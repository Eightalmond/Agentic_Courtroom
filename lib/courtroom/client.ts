"use client";

import { CourtroomArgumentRecordSchema, JudgeVerdictRecordSchema, SafeCourtroomErrorSchema } from "./schemas";
import type {
  CourtroomArgumentRecord,
  CourtroomArgumentRequest,
  JudgeVerdictRecord,
  JudgeVerdictRequest,
  SafeCourtroomError,
} from "./types";

export class CourtroomClientError extends Error {
  constructor(public readonly detail: SafeCourtroomError) {
    super(detail.message);
    this.name = "CourtroomClientError";
  }
}

export async function requestCourtroomArgument(
  request: CourtroomArgumentRequest,
): Promise<CourtroomArgumentRecord> {
  let response: Response;
  try {
    response = await fetch("/api/courtroom/argue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new CourtroomClientError({
      code: "COURTROOM_NETWORK_ERROR",
      message: "The courtroom request could not reach the server. Try again.",
      retryable: true,
    });
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = SafeCourtroomErrorSchema.safeParse(payload);
    throw new CourtroomClientError(parsed.success ? parsed.data : {
      code: "COURTROOM_REQUEST_FAILED",
      message: "The courtroom request failed safely. Try again.",
      retryable: response.status >= 500,
    });
  }

  const parsed = CourtroomArgumentRecordSchema.safeParse(payload);
  if (!parsed.success) {
    throw new CourtroomClientError({
      code: "COURTROOM_INVALID_RESPONSE",
      message: "The server returned an invalid courtroom record. Try again.",
      retryable: true,
    });
  }
  return parsed.data;
}

export async function requestJudgeVerdict(request: JudgeVerdictRequest): Promise<JudgeVerdictRecord> {
  let response: Response;
  try {
    response = await fetch("/api/courtroom/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new CourtroomClientError({
      code: "JUDGE_NETWORK_ERROR",
      message: "The judge request could not reach the server. Try again.",
      retryable: true,
    });
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = SafeCourtroomErrorSchema.safeParse(payload);
    throw new CourtroomClientError(parsed.success ? parsed.data : {
      code: "JUDGE_REQUEST_FAILED",
      message: "The judge request failed safely. Try again.",
      retryable: response.status >= 500,
    });
  }

  const parsed = JudgeVerdictRecordSchema.safeParse(payload);
  if (!parsed.success) {
    throw new CourtroomClientError({
      code: "JUDGE_INVALID_RESPONSE",
      message: "The server returned an invalid judge record. Try again.",
      retryable: true,
    });
  }
  return parsed.data;
}
