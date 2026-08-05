type RunIdOptions = {
  timestamp?: number;
  randomId?: string;
};

export function generateRunId(options: RunIdOptions = {}) {
  const timestamp = options.timestamp ?? Date.now();
  const randomId = options.randomId ?? globalThis.crypto.randomUUID();
  const safeRandomId = randomId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);

  if (!safeRandomId) {
    throw new Error("Run ID entropy must contain at least one URL-safe character.");
  }

  return `run-${timestamp.toString(36)}-${safeRandomId}`;
}
