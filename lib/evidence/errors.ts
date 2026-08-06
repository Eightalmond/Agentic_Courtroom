export class EvidenceCollectionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "EvidenceCollectionError";
  }

  toSafeError() {
    return { code: this.code, message: this.message, retryable: this.retryable } as const;
  }
}
