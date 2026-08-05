export { createSearchExcerpt, MAX_EXCERPT_LENGTH } from "./excerpt";
export { normalizeSearchQuery, normalizeText, SEARCH_STOP_WORDS } from "./normalize";
export { buildProductSearchIndex, getSectionById, productSearchIndex } from "./search-index";
export {
  DEFAULT_RESULT_LIMIT,
  MAX_RESULT_LIMIT,
  SCORE_WEIGHTS,
  searchProductKnowledge,
} from "./search";
export { expandQueryTerms, FLOWPILOT_SYNONYMS, type SynonymGroup } from "./synonyms";
export type {
  ExpandedQuery,
  MatchLocation,
  NormalizedSearchQuery,
  ScoreBreakdown,
  SearchOptions,
  SearchRecord,
  SearchResult,
} from "./types";
