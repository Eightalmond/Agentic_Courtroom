import { flowPilotProduct } from "@/lib/product";

import { normalizeText } from "./normalize";
import type { SearchRecord } from "./types";

function toSectionId(pageSlug: string, sectionTitle: string) {
  const sectionSlug = normalizeText(sectionTitle).replace(/\s+/g, "-");
  return `${flowPilotProduct.id}-${pageSlug}-${sectionSlug}`;
}

export function buildProductSearchIndex(): readonly SearchRecord[] {
  return flowPilotProduct.pages.flatMap((page) => {
    const calloutText = page.callouts
      ?.map((callout) => `${callout.title}. ${callout.content}`)
      .join(" ");

    return page.sections.map((section) => {
      const sectionBody = [...section.paragraphs, ...(section.bullets ?? [])].join(" ");
      const searchableNormalizedText = normalizeText(
        [
          page.title,
          page.category,
          page.summary,
          page.keywords.join(" "),
          section.heading,
          sectionBody,
          calloutText ?? "",
        ].join(" "),
      );

      return {
        sectionId: toSectionId(page.slug, section.heading),
        productId: flowPilotProduct.id,
        pageSlug: page.slug,
        pageTitle: page.title,
        pageCategory: page.category,
        sectionTitle: section.heading,
        sectionBody,
        pageSummary: page.summary,
        pageKeywords: page.keywords,
        calloutText,
        relatedPageSlugs: page.relatedSlugs,
        searchableNormalizedText,
      } satisfies SearchRecord;
    });
  });
}

export const productSearchIndex = buildProductSearchIndex();

export function getSectionById(sectionId: string) {
  return productSearchIndex.find((record) => record.sectionId === sectionId);
}
