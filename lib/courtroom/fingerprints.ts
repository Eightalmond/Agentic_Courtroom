import type { EvidenceBundle } from "@/lib/evidence/types";

import type { CourtroomArgumentRecord } from "./types";

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function fingerprint(value: unknown) {
  const serialized = stableSerialize(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `fp-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export function fingerprintEvidenceBundle(bundle: EvidenceBundle) {
  return fingerprint(bundle);
}

export function fingerprintCourtroomArgument(record: CourtroomArgumentRecord) {
  return fingerprint({
    argument: record.argument,
    createdAt: record.createdAt,
    provider: record.provider,
    evidenceBundleId: record.evidenceBundleId,
    evidenceBundleVersion: record.evidenceBundleVersion,
    evidenceBundleFingerprint: record.evidenceBundleFingerprint,
    role: record.role,
  });
}
