import type { EvidenceBundle } from "@/lib/evidence/types";
import type { LlmProviderName } from "@/lib/simulation/environment";

export const COURTROOM_ROLES = ["prosecutor", "defense"] as const;
export const VERDICT_DIRECTIONS = [
  "pass",
  "pass_with_friction",
  "misleading",
  "blocked",
  "insufficient_evidence",
] as const;

export type CourtroomRole = (typeof COURTROOM_ROLES)[number];
export type VerdictDirection = (typeof VERDICT_DIRECTIONS)[number];
export type ClaimStrength = "weak" | "moderate" | "strong";

export type CourtroomClaim = Readonly<{
  id: string;
  claim: string;
  evidenceIds: readonly string[];
  strength: ClaimStrength;
}>;

export type CitedCourtroomPoint = Readonly<{
  claim: string;
  evidenceIds: readonly string[];
}>;

export type CourtroomArgument = Readonly<{
  role: CourtroomRole;
  thesis: string;
  keyClaims: readonly CourtroomClaim[];
  strongestPoint: CitedCourtroomPoint;
  acknowledges: readonly CitedCourtroomPoint[];
  requestedVerdictDirection: VerdictDirection;
  closingStatement: string;
}>;

export type CourtroomArgumentRecord = Readonly<{
  argument: CourtroomArgument;
  createdAt: string;
  provider: LlmProviderName;
  evidenceBundleId: string;
  evidenceBundleVersion: number;
  role: CourtroomRole;
}>;

export type CourtroomState = Readonly<{
  prosecutor: CourtroomArgumentRecord | null;
  defense: CourtroomArgumentRecord | null;
}>;

export type CourtroomArgumentRequest = Readonly<{
  runId: string;
  role: CourtroomRole;
  evidenceBundle: EvidenceBundle;
}>;

export type SafeCourtroomError = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
}>;

export const EMPTY_COURTROOM_STATE: CourtroomState = {
  prosecutor: null,
  defense: null,
};
