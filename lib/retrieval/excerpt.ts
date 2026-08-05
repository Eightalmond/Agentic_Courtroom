import type { SearchRecord } from "./types";

export const MAX_EXCERPT_LENGTH = 220;

function finishAtWord(value: string, maximumLength: number) {
  if (value.length <= maximumLength) {
    return value;
  }

  const candidate = value.slice(0, maximumLength + 1);
  const lastSpace = candidate.lastIndexOf(" ");
  return candidate.slice(0, lastSpace > maximumLength * 0.6 ? lastSpace : maximumLength).trimEnd();
}

export function createSearchExcerpt(
  record: SearchRecord,
  matchedTerms: readonly string[],
  maximumLength = MAX_EXCERPT_LENGTH,
) {
  const source = record.sectionBody || record.pageSummary || record.sectionTitle;

  if (source.length <= maximumLength) {
    return source;
  }

  const lowerSource = source.toLowerCase();
  const matchIndexes = matchedTerms
    .map((term) => lowerSource.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0);
  const earliestMatch = matchIndexes.length > 0 ? Math.min(...matchIndexes) : 0;
  const prefixNeeded = earliestMatch > maximumLength * 0.35;
  const suffixAllowance = 1;
  const prefixAllowance = prefixNeeded ? 1 : 0;
  const contentLength = maximumLength - prefixAllowance - suffixAllowance;
  let start = prefixNeeded ? Math.max(0, earliestMatch - Math.floor(contentLength * 0.35)) : 0;

  if (start > 0) {
    const nextSpace = source.indexOf(" ", start);
    start = nextSpace >= 0 ? nextSpace + 1 : start;
  }

  const available = source.slice(start);
  const content = finishAtWord(available, contentLength);
  const suffixNeeded = start + content.length < source.length;

  return `${start > 0 ? "…" : ""}${content}${suffixNeeded ? "…" : ""}`;
}
