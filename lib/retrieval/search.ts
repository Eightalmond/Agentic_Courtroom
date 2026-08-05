import { createSearchExcerpt } from "./excerpt";
import { normalizeSearchQuery, normalizeText } from "./normalize";
import { productSearchIndex } from "./search-index";
import { expandQueryTerms } from "./synonyms";
import type {
  MatchLocation,
  ScoreBreakdown,
  SearchOptions,
  SearchRecord,
  SearchResult,
} from "./types";

export const DEFAULT_RESULT_LIMIT = 5;
export const MAX_RESULT_LIMIT = 10;

export const SCORE_WEIGHTS = {
  exactSectionTitlePhrase: 40,
  exactSectionBodyPhrase: 24,
  sectionTitleDirect: 12,
  pageTitleDirect: 9,
  pageKeywordDirect: 8,
  calloutDirect: 7,
  sectionBodyDirect: 5,
  pageSummaryDirect: 4,
  sectionTitleSynonym: 4,
  pageTitleSynonym: 3,
  pageKeywordSynonym: 3,
  calloutSynonym: 3,
  sectionBodySynonym: 2,
  pageSummarySynonym: 2,
  additionalDirectTerm: 3,
} as const;

type NormalizedLocations = Record<MatchLocation, string>;

function containsTerm(value: string, term: string) {
  return ` ${value} `.includes(` ${term} `);
}

function normalizeRecordLocations(record: SearchRecord): NormalizedLocations {
  return {
    "section title": normalizeText(record.sectionTitle),
    "section body": normalizeText(record.sectionBody),
    "page title": normalizeText(record.pageTitle),
    "page keywords": normalizeText(record.pageKeywords.join(" ")),
    "page summary": normalizeText(record.pageSummary),
    callout: normalizeText(record.calloutText ?? ""),
  };
}

function blankBreakdown(): ScoreBreakdown {
  return {
    exactSectionTitlePhrase: 0,
    exactSectionBodyPhrase: 0,
    sectionTitleTerms: 0,
    sectionBodyTerms: 0,
    pageTitleTerms: 0,
    pageKeywordTerms: 0,
    pageSummaryTerms: 0,
    calloutTerms: 0,
    synonymTerms: 0,
    multiTermBonus: 0,
  };
}

function stableCompare(left: SearchResult, right: SearchResult) {
  if (left.totalScore !== right.totalScore) {
    return right.totalScore - left.totalScore;
  }
  if (left.pageSlug !== right.pageSlug) {
    return left.pageSlug < right.pageSlug ? -1 : 1;
  }
  return left.sectionId < right.sectionId ? -1 : left.sectionId > right.sectionId ? 1 : 0;
}

export function searchProductKnowledge(query: string, options: SearchOptions = {}): SearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);

  if (normalizedQuery.tokens.length === 0) {
    return [];
  }

  const expandedQuery = expandQueryTerms(normalizedQuery);
  const requestedLimit = Number.isInteger(options.limit) ? options.limit! : DEFAULT_RESULT_LIMIT;
  const limit = Math.max(1, Math.min(requestedLimit, MAX_RESULT_LIMIT));
  const results: SearchResult[] = [];

  for (const record of productSearchIndex) {
    if (options.pageSlug && record.pageSlug !== options.pageSlug) {
      continue;
    }
    if (options.category && record.pageCategory !== options.category) {
      continue;
    }

    const locations = normalizeRecordLocations(record);
    const breakdown = blankBreakdown();
    const directMatches = new Set<string>();
    const synonymMatches = new Set<string>();
    const matchLocations = new Set<MatchLocation>();

    if (normalizedQuery.normalizedText.length > 1) {
      if (locations["section title"].includes(normalizedQuery.normalizedText)) {
        breakdown.exactSectionTitlePhrase = SCORE_WEIGHTS.exactSectionTitlePhrase;
        matchLocations.add("section title");
      }
      if (locations["section body"].includes(normalizedQuery.normalizedText)) {
        breakdown.exactSectionBodyPhrase = SCORE_WEIGHTS.exactSectionBodyPhrase;
        matchLocations.add("section body");
      }
    }

    for (const term of expandedQuery.directTerms) {
      let matched = false;

      if (containsTerm(locations["section title"], term)) {
        breakdown.sectionTitleTerms += SCORE_WEIGHTS.sectionTitleDirect;
        matchLocations.add("section title");
        matched = true;
      }
      if (containsTerm(locations["page title"], term)) {
        breakdown.pageTitleTerms += SCORE_WEIGHTS.pageTitleDirect;
        matchLocations.add("page title");
        matched = true;
      }
      if (containsTerm(locations["page keywords"], term)) {
        breakdown.pageKeywordTerms += SCORE_WEIGHTS.pageKeywordDirect;
        matchLocations.add("page keywords");
        matched = true;
      }
      if (containsTerm(locations.callout, term)) {
        breakdown.calloutTerms += SCORE_WEIGHTS.calloutDirect;
        matchLocations.add("callout");
        matched = true;
      }
      if (containsTerm(locations["section body"], term)) {
        breakdown.sectionBodyTerms += SCORE_WEIGHTS.sectionBodyDirect;
        matchLocations.add("section body");
        matched = true;
      }
      if (containsTerm(locations["page summary"], term)) {
        breakdown.pageSummaryTerms += SCORE_WEIGHTS.pageSummaryDirect;
        matchLocations.add("page summary");
        matched = true;
      }

      if (matched) {
        directMatches.add(term);
      }
    }

    for (const term of expandedQuery.synonymTerms) {
      let synonymScore = 0;

      if (containsTerm(locations["section title"], term)) {
        synonymScore += SCORE_WEIGHTS.sectionTitleSynonym;
        matchLocations.add("section title");
      }
      if (containsTerm(locations["page title"], term)) {
        synonymScore += SCORE_WEIGHTS.pageTitleSynonym;
        matchLocations.add("page title");
      }
      if (containsTerm(locations["page keywords"], term)) {
        synonymScore += SCORE_WEIGHTS.pageKeywordSynonym;
        matchLocations.add("page keywords");
      }
      if (containsTerm(locations.callout, term)) {
        synonymScore += SCORE_WEIGHTS.calloutSynonym;
        matchLocations.add("callout");
      }
      if (containsTerm(locations["section body"], term)) {
        synonymScore += SCORE_WEIGHTS.sectionBodySynonym;
        matchLocations.add("section body");
      }
      if (containsTerm(locations["page summary"], term)) {
        synonymScore += SCORE_WEIGHTS.pageSummarySynonym;
        matchLocations.add("page summary");
      }

      if (synonymScore > 0) {
        breakdown.synonymTerms += synonymScore;
        synonymMatches.add(term);
      }
    }

    if (directMatches.size > 1) {
      breakdown.multiTermBonus = (directMatches.size - 1) * SCORE_WEIGHTS.additionalDirectTerm;
    }

    const totalScore = Object.values(breakdown).reduce((total, score) => total + score, 0);
    if (totalScore === 0) {
      continue;
    }

    const allMatchedTerms = [...directMatches, ...synonymMatches];
    results.push({
      sectionId: record.sectionId,
      pageSlug: record.pageSlug,
      pageTitle: record.pageTitle,
      pageCategory: record.pageCategory,
      sectionTitle: record.sectionTitle,
      excerpt: createSearchExcerpt(record, allMatchedTerms),
      totalScore,
      scoreBreakdown: breakdown,
      matchedDirectTerms: [...directMatches],
      matchedSynonymTerms: [...synonymMatches],
      matchLocations: [...matchLocations].sort(),
      rank: 0,
    });
  }

  return results
    .sort(stableCompare)
    .slice(0, limit)
    .map((result, index) => ({ ...result, rank: index + 1 }));
}
