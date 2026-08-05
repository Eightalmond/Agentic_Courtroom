import { describe, expect, it } from "vitest";

import { flowPilotProduct, getProductPage, type ProductPage } from ".";

function pageText(page: ProductPage) {
  return page.sections
    .flatMap((section) => [section.heading, ...section.paragraphs, ...(section.bullets ?? [])])
    .join(" ");
}

describe("FlowPilot product knowledge", () => {
  it("uses a unique slug for every knowledge page", () => {
    const slugs = flowPilotProduct.pages.map((page) => page.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toHaveLength(10);
  });

  it("only links to existing related pages", () => {
    const slugs = new Set(flowPilotProduct.pages.map((page) => page.slug));

    for (const page of flowPilotProduct.pages) {
      for (const relatedSlug of page.relatedSlugs) {
        expect(slugs.has(relatedSlug), `${page.slug} links to missing page ${relatedSlug}`).toBe(true);
      }
    }
  });

  it("gives every page structured content", () => {
    for (const page of flowPilotProduct.pages) {
      expect(page.sections.length, `${page.slug} must contain a section`).toBeGreaterThan(0);
      expect(page.sections.every((section) => section.paragraphs.length > 0)).toBe(true);
    }
  });

  it("keeps required pricing, trial, and API facts on their appropriate pages", () => {
    const pricing = getProductPage("pricing");
    const trial = getProductPage("free-trial-and-billing");
    const apiLimits = getProductPage("api-rate-limits");

    expect(pricing).toBeDefined();
    expect(trial).toBeDefined();
    expect(apiLimits).toBeDefined();

    expect(pageText(pricing!)).toContain("Starter — $12 per user per month");
    expect(pageText(pricing!)).toContain("Pro — $29 per user per month");
    expect(pageText(pricing!)).toContain("Business — $59 per user per month");
    expect(pageText(pricing!)).toContain("API access included");
    expect(pageText(pricing!)).not.toMatch(/10,000|100,000/);

    expect(pageText(trial!)).toContain("A payment card is required");
    expect(pageText(trial!)).toContain("automatically charges");
    expect(pageText(trial!)).toContain("prevents the first charge");

    expect(pageText(apiLimits!)).toContain("10,000 API requests per month");
    expect(pageText(apiLimits!)).toContain("100,000 API requests per month");
    expect(pageText(apiLimits!)).toContain("Short-term rate limits also apply");
  });

  it("keeps policy, permission, export, and security facts discoverable", () => {
    expect(pageText(getProductPage("cancellation-policy")!)).toContain(
      "Cancellation takes effect at the end of the current billing period",
    );
    expect(pageText(getProductPage("refund-policy")!)).toContain("generally non-refundable");
    expect(pageText(getProductPage("team-permissions")!)).toContain("Starter provides two roles: Admin and Member");
    expect(pageText(getProductPage("data-export")!)).toContain("All plans can export workflow data as CSV");
    expect(pageText(getProductPage("security-and-privacy")!)).toContain("encrypts data in transit and at rest");
    expect(pageText(getProductPage("security-and-privacy")!)).toContain("does not claim to be HIPAA compliant");
  });

  it("looks up known pages and returns undefined for an unknown slug", () => {
    expect(getProductPage("pricing")?.title).toBe("Pricing");
    expect(getProductPage("missing-page")).toBeUndefined();
  });
});
