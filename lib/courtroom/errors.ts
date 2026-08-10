import type { SafeCourtroomError } from "./types";

export class CourtroomError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "CourtroomError";
  }

  toSafeError(): SafeCourtroomError {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}
