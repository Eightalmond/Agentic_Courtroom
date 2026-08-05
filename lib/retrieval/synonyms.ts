import type { ExpandedQuery, NormalizedSearchQuery } from "./types";

export type SynonymGroup = {
  concept: string;
  terms: readonly string[];
};

// These deliberately small groups cover only known FlowPilot vocabulary. The
// expansion is symmetric, bounded, and ordered so the same query always yields
// the same extra terms without implying broad semantic understanding.
export const FLOWPILOT_SYNONYMS: readonly SynonymGroup[] = [
  { concept: "cancellation", terms: ["cancel", "cancellation", "terminate"] },
  { concept: "billing", terms: ["charge", "billing", "payment", "charged"] },
  { concept: "trial", terms: ["trial", "free trial"] },
  { concept: "api", terms: ["api", "developer", "request", "requests"] },
  { concept: "limits", terms: ["limit", "allowance", "quota", "rate"] },
  { concept: "refund", terms: ["refund", "reimbursement"] },
  { concept: "viewer", terms: ["viewer", "read only", "view"] },
  { concept: "audit log", terms: ["audit log", "activity log"] },
  {
    concept: "hipaa",
    terms: ["hipaa", "healthcare", "protected health information", "phi"],
  },
  { concept: "export", terms: ["export", "download", "csv"] },
];

function queryContainsTerm(query: NormalizedSearchQuery, term: string) {
  if (term.includes(" ")) {
    return ` ${query.normalizedText} `.includes(` ${term} `);
  }

  return query.tokens.includes(term);
}

export function expandQueryTerms(query: NormalizedSearchQuery): ExpandedQuery {
  const directTerms = [...query.tokens];
  const directTermSet = new Set(directTerms);
  const synonymTerms: string[] = [];
  const seenSynonyms = new Set<string>();

  for (const group of FLOWPILOT_SYNONYMS) {
    if (!group.terms.some((term) => queryContainsTerm(query, term))) {
      continue;
    }

    for (const term of group.terms) {
      if (!directTermSet.has(term) && !seenSynonyms.has(term)) {
        synonymTerms.push(term);
        seenSynonyms.add(term);
      }
    }
  }

  return { directTerms, synonymTerms };
}
