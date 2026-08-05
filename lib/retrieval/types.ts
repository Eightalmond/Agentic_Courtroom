import type { ProductCategory } from "@/lib/product";

export type SearchRecord = {
  sectionId: string;
  productId: string;
  pageSlug: string;
  pageTitle: string;
  pageCategory: ProductCategory;
  sectionTitle: string;
  sectionBody: string;
  pageSummary: string;
  pageKeywords: readonly string[];
  calloutText?: string;
  relatedPageSlugs: readonly string[];
  searchableNormalizedText: string;
};

export type NormalizedSearchQuery = {
  normalizedText: string;
  tokens: readonly string[];
};

export type ExpandedQuery = {
  directTerms: readonly string[];
  synonymTerms: readonly string[];
};

export type MatchLocation =
  | "section title"
  | "section body"
  | "page title"
  | "page keywords"
  | "page summary"
  | "callout";

export type ScoreBreakdown = {
  exactSectionTitlePhrase: number;
  exactSectionBodyPhrase: number;
  sectionTitleTerms: number;
  sectionBodyTerms: number;
  pageTitleTerms: number;
  pageKeywordTerms: number;
  pageSummaryTerms: number;
  calloutTerms: number;
  synonymTerms: number;
  multiTermBonus: number;
};

export type SearchResult = {
  sectionId: string;
  pageSlug: string;
  pageTitle: string;
  pageCategory: ProductCategory;
  sectionTitle: string;
  excerpt: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  matchedDirectTerms: readonly string[];
  matchedSynonymTerms: readonly string[];
  matchLocations: readonly MatchLocation[];
  rank: number;
};

export type SearchOptions = {
  limit?: number;
  pageSlug?: string;
  category?: ProductCategory;
};
