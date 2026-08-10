import type { EvidenceBundle } from "@/lib/evidence/types";

import { CourtroomError } from "./errors";
import { CourtroomArgumentSchema } from "./schemas";
import type { CourtroomArgument, CourtroomRole } from "./types";

export function validateCourtroomArgument(
  value: unknown,
  expectedRole: CourtroomRole,
  bundle: EvidenceBundle,
): CourtroomArgument {
  const parsed = CourtroomArgumentSchema.safeParse(value);
  if (!parsed.success) {
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

  const validIds = new Set(bundle.evidenceItems.map((item) => item.evidenceId));
  const citations = [
    ...parsed.data.keyClaims.flatMap((claim) => claim.evidenceIds),
    ...parsed.data.strongestPoint.evidenceIds,
    ...parsed.data.acknowledges.flatMap((point) => point.evidenceIds),
  ];
  if (citations.some((evidenceId) => !validIds.has(evidenceId))) {
    throw new CourtroomError(
      "COURTROOM_INVALID_CITATION",
      "The advocate cited evidence outside this bundle. Try generating this side again.",
      502,
      true,
    );
  }

  return parsed.data;
}
