"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { flowPilotProduct, type ProductCategory } from "@/lib/product";
import {
  normalizeSearchQuery,
  searchProductKnowledge,
  type ScoreBreakdown,
  type SearchResult,
} from "@/lib/retrieval";

const exampleQueries = [
  "cancel free trial before charge",
  "Pro API request limit",
  "HIPAA compliant",
  "viewer cannot edit",
  "refund after renewal",
  "audit log export Pro",
] as const;

const categories = [...new Set(flowPilotProduct.pages.map((page) => page.category))];

const scoreLabels: ReadonlyArray<[keyof ScoreBreakdown, string]> = [
  ["exactSectionTitlePhrase", "Exact phrase in section title"],
  ["exactSectionBodyPhrase", "Exact phrase in section body"],
  ["sectionTitleTerms", "Direct terms in section title"],
  ["pageTitleTerms", "Direct terms in page title"],
  ["pageKeywordTerms", "Direct terms in page keywords"],
  ["calloutTerms", "Direct terms in callout"],
  ["sectionBodyTerms", "Direct terms in section body"],
  ["pageSummaryTerms", "Direct terms in page summary"],
  ["synonymTerms", "Bounded synonym matches"],
  ["multiTermBonus", "Multiple direct terms together"],
];

function ScoreExplanation({ result }: { result: SearchResult }) {
  const activeScores = scoreLabels.filter(([key]) => result.scoreBreakdown[key] > 0);

  return (
    <details className="mt-4 border-t border-lab-border pt-4">
      <summary className="text-xs font-medium text-teal-300">Ranking breakdown</summary>
      <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs text-lab-muted sm:grid-cols-2">
        {activeScores.map(([key, label]) => (
          <div className="flex justify-between gap-3 border-b border-lab-border pb-2" key={key}>
            <dt>{label}</dt>
            <dd className="font-mono text-teal-300">+{result.scoreBreakdown[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-lab-subtle">
        Matched in {result.matchLocations.join(", ")}. Scores are lexical weights, not confidence probabilities.
      </p>
    </details>
  );
}

export function RetrievalPlayground() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [limit, setLimit] = useState(5);

  const normalizedQuery = submittedQuery === null ? null : normalizeSearchQuery(submittedQuery);
  const hasMeaningfulQuery = Boolean(normalizedQuery && normalizedQuery.tokens.length > 0);
  const results = hasMeaningfulQuery
    ? searchProductKnowledge(submittedQuery!, {
        limit,
        category: category === "all" ? undefined : category,
      })
    : [];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query);
  }

  function runExample(example: string) {
    setQuery(example);
    setSubmittedQuery(example);
  }

  return (
    <div>
      <form className="rounded-lg border border-lab-border bg-lab-surface p-5 sm:p-6" onSubmit={submitSearch}>
        <label className="text-sm font-medium text-slate-100" htmlFor="retrieval-query">Query</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="retrieval-query"
            className="min-w-0 flex-1 rounded-md border border-lab-border bg-lab-elevated px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-lab-subtle focus:border-teal-400"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: Pro API request limit"
          />
          <button className="rounded-md bg-teal-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-teal-400" type="submit">
            Search
          </button>
        </div>

        <div className="mt-5 grid gap-4 border-t border-lab-border pt-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-lab-muted" htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              className="mt-2 block w-full rounded-md border border-lab-border bg-lab-elevated px-3 py-2.5 text-sm text-slate-100"
              value={category}
              onChange={(event) => setCategory(event.target.value as "all" | ProductCategory)}
            >
              <option value="all">All categories</option>
              {categories.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-lab-muted" htmlFor="result-limit">Results</label>
            <select
              id="result-limit"
              className="mt-2 block w-full rounded-md border border-lab-border bg-lab-elevated px-3 py-2.5 text-sm text-slate-100"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            >
              {[3, 5, 8, 10].map((value) => <option value={value} key={value}>Top {value}</option>)}
            </select>
          </div>
        </div>
      </form>

      <section className="mt-6" aria-labelledby="examples-title">
        <h2 id="examples-title" className="text-xs font-medium uppercase tracking-[0.14em] text-lab-subtle">Example queries</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {exampleQueries.map((example) => (
            <button
              className="rounded-md border border-lab-border bg-lab-surface px-3 py-2 text-left text-xs text-lab-muted hover:border-teal-400/70 hover:text-teal-200"
              type="button"
              onClick={() => runExample(example)}
              key={example}
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="results-title" aria-live="polite">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-300">Section-level ranking</p>
            <h2 id="results-title" className="mt-2 text-xl font-semibold tracking-[-0.02em]">Results</h2>
          </div>
          {hasMeaningfulQuery && (
            <p className="font-mono text-xs text-lab-subtle">{results.length} ranked {results.length === 1 ? "section" : "sections"}</p>
          )}
        </div>

        {!hasMeaningfulQuery && (
          <div className="mt-6 rounded-lg border border-dashed border-lab-border bg-lab-surface p-8 text-center">
            <h3 className="font-medium text-slate-100">Start with a product question</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-lab-muted">
              Enter meaningful terms or choose an example. Empty and common-word-only queries intentionally return no pages.
            </p>
          </div>
        )}

        {hasMeaningfulQuery && results.length === 0 && (
          <div className="mt-6 rounded-lg border border-lab-border bg-lab-surface p-8 text-center">
            <h3 className="font-medium text-slate-100">No matching FlowPilot sections</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-lab-muted">
              Try a product term such as trial, API, refund, permissions, export, or security—or remove the category filter.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <ol className="mt-6 divide-y divide-lab-border border-y border-lab-border bg-lab-surface">
            {results.map((result) => (
              <li className="min-w-0 p-5 sm:p-6" key={result.sectionId}>
                <article>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-teal-300">Rank {result.rank} · {result.pageCategory}</p>
                      <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-100">{result.pageTitle}</h3>
                      <p className="mt-1 break-words text-sm text-lab-muted">{result.sectionTitle}</p>
                    </div>
                    <div className="border-l border-lab-border pl-4 text-right">
                      <span className="block font-mono text-lg text-teal-300">{result.totalScore}</span>
                      <span className="block text-[0.65rem] uppercase tracking-[0.12em] text-lab-subtle">score</span>
                    </div>
                  </div>

                  <p className="mt-5 break-words text-sm leading-7 text-slate-300">{result.excerpt}</p>

                  <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
                    <div>
                      <p className="font-medium text-lab-subtle">Direct terms</p>
                      <p className="mt-2 break-words font-mono leading-5 text-lab-muted">{result.matchedDirectTerms.join(", ") || "None"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-lab-subtle">Synonym terms</p>
                      <p className="mt-2 break-words font-mono leading-5 text-lab-muted">{result.matchedSynonymTerms.join(", ") || "None"}</p>
                    </div>
                  </div>

                  <ScoreExplanation result={result} />

                  <Link className="mt-5 inline-block text-sm font-medium text-teal-300 hover:text-teal-200" href={`/product/${result.pageSlug}`}>
                    Open full FlowPilot page <span aria-hidden="true">→</span>
                  </Link>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
