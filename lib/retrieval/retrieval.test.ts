import { describe, expect, it } from "vitest";

import { flowPilotProduct } from "@/lib/product";

import {
  buildProductSearchIndex,
  getSectionById,
  MAX_EXCERPT_LENGTH,
  MAX_RESULT_LIMIT,
  normalizeSearchQuery,
  SCORE_WEIGHTS,
  searchProductKnowledge,
} from ".";

describe("deterministic FlowPilot retrieval", () => {
  it("builds one search record for every product section", () => {
    const expectedSectionCount = flowPilotProduct.pages.reduce(
      (total, page) => total + page.sections.length,
      0,
    );

    expect(buildProductSearchIndex()).toHaveLength(expectedSectionCount);
  });

  it("uses unique URL-safe section IDs", () => {
    const ids = buildProductSearchIndex().map((record) => record.sectionId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });

  it("normalizes case, punctuation, whitespace, stop words, and duplicate tokens", () => {
    expect(normalizeSearchQuery("  Can I PRO, api!! pro   limit? ")).toEqual({
      normalizedText: "pro api limit",
      tokens: ["pro", "api", "limit"],
    });
  });

  it("returns no results for empty or stop-word-only queries", () => {
    expect(searchProductKnowledge("")).toEqual([]);
    expect(searchProductKnowledge("the a an is can i my to of for and or")).toEqual([]);
  });

  it("scores direct matches above synonym-only matches for the same section", () => {
    const direct = searchProductKnowledge("cancellation", { limit: 10 }).find(
      (result) => result.pageSlug === "cancellation-policy",
    );
    const synonymOnly = searchProductKnowledge("terminate", { limit: 10 }).find(
      (result) => result.sectionId === direct?.sectionId,
    );

    expect(direct).toBeDefined();
    expect(synonymOnly).toBeDefined();
    expect(direct!.totalScore).toBeGreaterThan(synonymOnly!.totalScore);
  });

  it("weights section-title terms above section-body terms", () => {
    expect(SCORE_WEIGHTS.sectionTitleDirect).toBeGreaterThan(SCORE_WEIGHTS.sectionBodyDirect);
    const result = searchProductKnowledge("custom roles", { limit: 1 })[0];
    expect(result.sectionTitle).toBe("Custom roles on Business");
    expect(result.scoreBreakdown.sectionTitleTerms).toBeGreaterThan(0);
  });

  it("orders the same query deterministically", () => {
    expect(searchProductKnowledge("Pro API request limit")).toEqual(
      searchProductKnowledge("Pro API request limit"),
    );
  });

  it("enforces requested and maximum result limits", () => {
    expect(searchProductKnowledge("pro", { limit: 2 })).toHaveLength(2);
    expect(searchProductKnowledge("pro", { limit: 100 }).length).toBeLessThanOrEqual(
      MAX_RESULT_LIMIT,
    );
  });

  it("filters results by page slug", () => {
    const results = searchProductKnowledge("api requests", {
      pageSlug: "api-rate-limits",
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.pageSlug === "api-rate-limits")).toBe(true);
  });

  it("filters results by category", () => {
    const results = searchProductKnowledge("cancel billing", {
      category: "Plans & billing",
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.pageCategory === "Plans & billing")).toBe(true);
  });

  it("keeps excerpts within the configured maximum", () => {
    const results = searchProductKnowledge("workflow product access export", { limit: 10 });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.excerpt.length <= MAX_EXCERPT_LENGTH)).toBe(true);
  });

  it("ranks numerical API rate-limit content highly", () => {
    const results = searchProductKnowledge("Pro API request limit", { limit: 3 });

    expect(results[0].pageSlug).toBe("api-rate-limits");
    expect(results.some((result) => result.excerpt.includes("10,000"))).toBe(true);
  });

  it("retrieves trial and cancellation information", () => {
    const slugs = searchProductKnowledge("cancel trial before charge", { limit: 5 }).map(
      (result) => result.pageSlug,
    );

    expect(slugs).toContain("free-trial-and-billing");
    expect(slugs).toContain("cancellation-policy");
  });

  it("retrieves the security page for a HIPAA query", () => {
    expect(searchProductKnowledge("HIPAA compliant", { limit: 1 })[0].pageSlug).toBe(
      "security-and-privacy",
    );
  });

  it("retrieves team permissions for a viewer query", () => {
    expect(searchProductKnowledge("viewer cannot edit", { limit: 1 })[0].pageSlug).toBe(
      "team-permissions",
    );
  });

  it("retrieves refund policy for a renewal query", () => {
    expect(searchProductKnowledge("refund after renewal", { limit: 1 })[0].pageSlug).toBe(
      "refund-policy",
    );
  });

  it("retrieves data export for an audit-log query", () => {
    expect(searchProductKnowledge("audit log export Pro", { limit: 1 })[0].pageSlug).toBe(
      "data-export",
    );
  });

  it("handles unknown section IDs safely", () => {
    expect(getSectionById("flowpilot-not-a-section")).toBeUndefined();
  });

  it("does not expose customer-task evaluation metadata", () => {
    const result = searchProductKnowledge("cancel free trial", { limit: 1 })[0];

    expect(result).toBeDefined();
    expect("expectedRelevantPageSlugs" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain("expectedRelevantPageSlugs");
  });
});
