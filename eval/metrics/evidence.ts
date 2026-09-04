import { getProductPage } from "@/lib/product";
import { getSectionById } from "@/lib/retrieval";
import type { EvidenceBundle } from "@/lib/evidence/types";
import type { SimulationActionEntry } from "@/lib/simulation/types";

import { safeRatio } from "./core";

function boundedExcerpt(value: string, maximum = 280) {
  if (value.length <= maximum) return value;
  const candidate = value.slice(0, maximum - 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > maximum * 0.6 ? boundary : candidate.length).trimEnd()}…`;
}

function itemMatchesTrustedSource(item: EvidenceBundle["evidenceItems"][number]) {
  const page = getProductPage(item.pageSlug);
  if (!page || page.title !== item.pageTitle || item.excerpt !== boundedExcerpt(item.exactSourceText)) return false;
  if (item.sectionId) {
    const section = getSectionById(item.sectionId);
    if (!section || section.pageSlug !== item.pageSlug || section.sectionTitle !== item.sectionTitle) return false;
    if (item.sourceType === "search-result") {
      const excerptBody = item.exactSourceText.replace(/^…/, "").replace(/…$/, "");
      return excerptBody.length > 0 && section.sectionBody.includes(excerptBody);
    }
    return item.exactSourceText === section.sectionBody;
  }
  if (item.sourceType === "opened-page") return item.exactSourceText === page.summary;
  if (item.sourceType === "page-callout") {
    return (page.callouts ?? []).some((callout) => `${callout.title}: ${callout.content}` === item.exactSourceText);
  }
  return false;
}

export function evidenceSourceIntegrity(bundle: EvidenceBundle) {
  return safeRatio(bundle.evidenceItems.filter(itemMatchesTrustedSource).length, bundle.evidenceItems.length);
}

export function requiredEvidenceRepresentation(bundle: EvidenceBundle, requiredSectionIds: readonly string[]) {
  const represented = new Set(bundle.evidenceItems.flatMap((item) => item.sectionId ? [item.sectionId] : []));
  return safeRatio(requiredSectionIds.filter((id) => represented.has(id)).length, requiredSectionIds.length);
}

type Exposure = { action: number; keys: string[] };

function journeyExposures(actions: readonly SimulationActionEntry[]): Exposure[] {
  return actions.flatMap((action) => {
    if (!action.success) return [];
    if (action.observation.kind === "search") {
      return [{ action: action.number, keys: action.observation.results.map((result) => `section:${result.sectionId}`) }];
    }
    if (action.observation.kind === "page") {
      const observation = action.observation;
      return [{
        action: action.number,
        keys: [
          `page:${observation.pageSlug}`,
          ...observation.callouts.map((callout) => `callout:${observation.pageSlug}:${callout}`),
        ],
      }];
    }
    if (action.observation.kind === "section") {
      const observation = action.observation;
      return [{
        action: action.number,
        keys: [
          `section:${observation.sectionId}`,
          ...observation.callouts.map((callout) => `callout:${observation.pageSlug}:${callout}`),
        ],
      }];
    }
    return [];
  });
}

function itemExposureKey(item: EvidenceBundle["evidenceItems"][number]) {
  if (item.sectionId) return `section:${item.sectionId}`;
  if (item.sourceType === "opened-page") return `page:${item.pageSlug}`;
  if (item.sourceType === "page-callout") return `callout:${item.pageSlug}:${item.exactSourceText}`;
  return `unknown:${item.evidenceId}`;
}

export function seenUnseenEvidenceCorrectness(bundle: EvidenceBundle, actions: readonly SimulationActionEntry[]) {
  const exposures = journeyExposures(actions);
  const correct = bundle.evidenceItems.filter((item) => {
    const key = itemExposureKey(item);
    const exposureActions = exposures.filter((entry) => entry.keys.includes(key)).map((entry) => entry.action);
    if (!item.customerSaw) return exposureActions.length === 0 && item.exposureActionNumbers.length === 0;
    return exposureActions.length > 0
      && item.firstExposedByAction === exposureActions[0]
      && item.exposureActionNumbers.every((action) => exposureActions.includes(action));
  });
  return safeRatio(correct.length, bundle.evidenceItems.length);
}

export function evidenceDeduplicationIntegrity(bundle: EvidenceBundle) {
  const keys = bundle.evidenceItems.map(itemExposureKey);
  return safeRatio(new Set(keys).size, keys.length);
}

export function normalizeEvidenceForComparison(bundle: EvidenceBundle) {
  return {
    ...bundle,
    runId: "<run>",
    bundleId: "<bundle>",
    createdAt: "<timestamp>",
    evidenceItems: bundle.evidenceItems.map((item) => ({
      ...item,
      evidenceId: item.evidenceId.replace(bundle.bundleId, "<bundle>"),
    })),
  };
}

export function deterministicEvidenceConsistency(left: EvidenceBundle, right: EvidenceBundle) {
  return JSON.stringify(normalizeEvidenceForComparison(left)) === JSON.stringify(normalizeEvidenceForComparison(right)) ? 1 : 0;
}
