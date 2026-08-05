import type { NormalizedSearchQuery } from "./types";

export const SEARCH_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "can",
  "i",
  "my",
  "to",
  "of",
  "for",
  "and",
  "or",
]);

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSearchQuery(query: string): NormalizedSearchQuery {
  const normalizedInput = normalizeText(query);
  const tokens = [
    ...new Set(normalizedInput.split(" ").filter((token) => token && !SEARCH_STOP_WORDS.has(token))),
  ];
  const normalizedText = tokens.join(" ");

  return { normalizedText, tokens };
}
