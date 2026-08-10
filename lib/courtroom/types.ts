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
  evidenceBundleFingerprint: string | null;
  role: CourtroomRole;
}>;

export type JudgeFindingWeight = "minor" | "moderate" | "major";
export type CustomerAnswerStatus =
  | "supported"
  | "partially_supported"
  | "contradicted"
  | "not_assessable";

export type JudgeVerdict = Readonly<{
  verdict: VerdictDirection;
  summary: string;
  findings: readonly Readonly<{
    title: string;
    finding: string;
    evidenceIds: readonly string[];
    weight: JudgeFindingWeight;
  }>[];
  prosecutorAssessment: Readonly<{
    strongestSupportedPoint: string;
    evidenceIds: readonly string[];
    overreachOrWeakness: string;
  }>;
  defenseAssessment: Readonly<{
    strongestSupportedPoint: string;
    evidenceIds: readonly string[];
    overreachOrWeakness: string;
  }>;
  customerOutcomeAssessment: Readonly<{
    answerStatus: CustomerAnswerStatus;
    explanation: string;
    evidenceIds: readonly string[];
  }>;
  primaryFriction: Readonly<{
    title: string;
    explanation: string;
    evidenceIds: readonly string[];
  }> | null;
  recommendation: Readonly<{
    title: string;
    action: string;
    rationale: string;
    evidenceIds: readonly string[];
  }>;
  confidence: "low" | "medium" | "high";
}>;

export type JudgeVerdictRecord = Readonly<{
  verdict: JudgeVerdict;
  createdAt: string;
  provider: LlmProviderName;
  evidenceBundleId: string;
  evidenceBundleVersion: number;
  evidenceBundleFingerprint: string;
  prosecutorArgumentFingerprint: string;
  defenseArgumentFingerprint: string;
}>;

export type CourtroomState = Readonly<{
  prosecutor: CourtroomArgumentRecord | null;
  defense: CourtroomArgumentRecord | null;
  judge: JudgeVerdictRecord | null;
}>;

export type CourtroomArgumentRequest = Readonly<{
  runId: string;
  role: CourtroomRole;
  evidenceBundle: EvidenceBundle;
}>;

export type JudgeVerdictRequest = Readonly<{
  runId: string;
  maxActions: number;
  evidenceBundle: EvidenceBundle;
  prosecutor: CourtroomArgumentRecord;
  defense: CourtroomArgumentRecord;
}>;

export type SafeCourtroomError = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
}>;

export const EMPTY_COURTROOM_STATE: CourtroomState = {
  prosecutor: null,
  defense: null,
  judge: null,
};
