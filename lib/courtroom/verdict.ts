import type { CourtroomState, VerdictDirection } from "./types";

export const VERDICT_LABELS: Record<VerdictDirection, string> = {
  pass: "Pass",
  pass_with_friction: "Pass with friction",
  misleading: "Misleading",
  blocked: "Blocked",
  insufficient_evidence: "Insufficient evidence",
};

export function isFinalReportAvailable(courtroom: CourtroomState) {
  return courtroom.judge !== null;
}
