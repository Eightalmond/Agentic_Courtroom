import type { EvidenceBundle } from "@/lib/evidence/types";

import { CourtroomError } from "./errors";
import { CourtroomArgumentSchema, JudgeVerdictSchema } from "./schemas";
import type { CourtroomArgument, CourtroomRole, JudgeVerdict } from "./types";

function ensureEvidenceIdsExist(citationLists: readonly (readonly string[])[], bundle: EvidenceBundle, subject: string) {
  const validIds = new Set(bundle.evidenceItems.map((item) => item.evidenceId));
  if (citationLists.flat().some((evidenceId) => !validIds.has(evidenceId))) {
    throw new CourtroomError(
      "COURTROOM_INVALID_CITATION",
      `The ${subject} cited evidence outside this bundle. Try generating it again.`,
      502,
      true,
    );
  }
}

export function validateCourtroomArgument(
  value: unknown,
  expectedRole: CourtroomRole,
  bundle: EvidenceBundle,
): CourtroomArgument {
  const parsed = CourtroomArgumentSchema.safeParse(value);
  if (!parsed.success) {
    if (process.env.NODE_ENV === "development") {
      console.error("[courtroom] safe response validation diagnostic", parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      })));
    }
    throw new CourtroomError(
      "COURTROOM_INVALID_RESPONSE",
      "The advocate returned an invalid argument. Try generating this side again.",
      502,
      true,
    );
  }

  if (parsed.data.role !== expectedRole) {
    throw new CourtroomError(
      "COURTROOM_ROLE_MISMATCH",
      "The advocate returned the wrong courtroom role. Try generating this side again.",
      502,
      true,
    );
  }

  ensureEvidenceIdsExist([
    ...parsed.data.keyClaims.map((claim) => claim.evidenceIds),
    parsed.data.strongestPoint.evidenceIds,
    ...parsed.data.acknowledges.map((point) => point.evidenceIds),
  ], bundle, "advocate");

  return parsed.data;
}

export function validateJudgeVerdict(value: unknown, bundle: EvidenceBundle): JudgeVerdict {
  const parsed = JudgeVerdictSchema.safeParse(value);
  if (!parsed.success) {
    throw new CourtroomError(
      "JUDGE_INVALID_RESPONSE",
      "The judge returned an invalid verdict. Try running the judge again.",
      502,
      true,
    );
  }

  ensureEvidenceIdsExist([
    ...parsed.data.findings.map((finding) => finding.evidenceIds),
    parsed.data.prosecutorAssessment.evidenceIds,
    parsed.data.defenseAssessment.evidenceIds,
    parsed.data.customerOutcomeAssessment.evidenceIds,
    ...(parsed.data.primaryFriction ? [parsed.data.primaryFriction.evidenceIds] : []),
    parsed.data.recommendation.evidenceIds,
  ], bundle, "judge");
  return parsed.data;
}
