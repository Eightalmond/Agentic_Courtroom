import "server-only";

import { EvidenceBundleSchema } from "@/lib/evidence/schemas";
import { EVIDENCE_BUNDLE_VERSION, type EvidenceBundle } from "@/lib/evidence/types";
import { getTaskEvaluationSpec } from "@/lib/evidence/evaluation-specs";
import { evaluateMechanicalFactCheck } from "@/lib/evidence/fact-checks";
import { getProductPage } from "@/lib/product";
import { getSectionById } from "@/lib/retrieval/search-index";
import { getCustomerPersona, getCustomerTask } from "@/lib/test-runs";

import { CourtroomError } from "./errors";

function failSourceReference(): never {
  throw new CourtroomError(
    "COURTROOM_INVALID_EVIDENCE",
    "The evidence bundle no longer matches trusted product content. Rebuild the evidence before continuing.",
    400,
  );
}

function sourceExcerpt(value: string, maximum = 280) {
  if (value.length <= maximum) return value;
  const candidate = value.slice(0, maximum - 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > maximum * 0.6 ? boundary : candidate.length).trimEnd()}…`;
}

function sourceMatches(item: EvidenceBundle["evidenceItems"][number]) {
  const page = getProductPage(item.pageSlug);
  if (!page || page.title !== item.pageTitle || item.excerpt !== sourceExcerpt(item.exactSourceText)) return false;

  if (item.sectionId) {
    const section = getSectionById(item.sectionId);
    if (
      !section ||
      section.pageSlug !== item.pageSlug ||
      section.pageTitle !== item.pageTitle ||
      section.sectionTitle !== item.sectionTitle
    ) return false;

    if (item.sourceType === "search-result") {
      const excerptBody = item.exactSourceText.replace(/^…/, "").replace(/…$/, "");
      return excerptBody.length > 0 && section.sectionBody.includes(excerptBody);
    }
    return item.exactSourceText === section.sectionBody;
  }

  if (item.sourceType === "opened-page") return item.exactSourceText === page.summary;
  if (item.sourceType === "page-callout") {
    return (page.callouts ?? []).some(
      (callout) => `${callout.title}: ${callout.content}` === item.exactSourceText,
    );
  }
  return false;
}

export function revalidateCourtroomEvidence(value: unknown, runId: string): EvidenceBundle {
  const parsed = EvidenceBundleSchema.safeParse(value);
  if (!parsed.success) {
    throw new CourtroomError(
      "COURTROOM_INVALID_EVIDENCE",
      "A valid evidence bundle is required before an advocate can argue.",
      400,
    );
  }
  const bundle = parsed.data;

  if (bundle.version !== EVIDENCE_BUNDLE_VERSION) {
    throw new CourtroomError(
      "COURTROOM_EVIDENCE_VERSION_UNSUPPORTED",
      "This evidence version is not supported. Rebuild the evidence before continuing.",
      400,
    );
  }
  if (bundle.runId !== runId || bundle.bundleId !== `evidence-${runId}-v${bundle.version}`) {
    throw new CourtroomError(
      "COURTROOM_EVIDENCE_RUN_MISMATCH",
      "The evidence bundle does not belong to this run.",
      400,
    );
  }
  if (!getCustomerTask(bundle.taskId) || !getCustomerPersona(bundle.personaId)) {
    throw new CourtroomError(
      "COURTROOM_INVALID_EVIDENCE",
      "The evidence bundle references an unknown task or persona.",
      400,
    );
  }
  if (bundle.evidenceItems.some((item) => !sourceMatches(item))) failSourceReference();

  const specification = getTaskEvaluationSpec(bundle.taskId);
  if (!specification) failSourceReference();
  const requiredItems = specification.requiredSectionIds.map((sectionId) =>
    bundle.evidenceItems.find((item) => item.sectionId === sectionId),
  );
  if (requiredItems.some((item) => !item)) failSourceReference();
  const requiredSeen = requiredItems.filter((item) => item?.customerSaw).length;
  const requiredMissingIds = requiredItems
    .filter((item) => !item?.customerSaw)
    .map((item) => item!.sectionId!);
  if (
    bundle.coverage.requiredEvidenceTotal !== specification.requiredSectionIds.length ||
    bundle.coverage.requiredEvidenceSeen !== requiredSeen ||
    bundle.coverage.requiredEvidenceMissing !== requiredMissingIds.length ||
    JSON.stringify(bundle.missingRequiredEvidence) !== JSON.stringify(requiredMissingIds)
  ) failSourceReference();
  const expectedChecks = specification.factChecks.map((rule) =>
    evaluateMechanicalFactCheck(rule, bundle.customerFinalAnswer),
  );
  if (JSON.stringify(expectedChecks) !== JSON.stringify(bundle.factChecks)) failSourceReference();

  return bundle;
}
