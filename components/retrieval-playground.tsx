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
    <details className="mt-5 rounded-xl bg-slate-50 p-4">
      <summary className="cursor-pointer text-sm font-bold text-slate-700">Why this matched</summary>
      <dl className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        {activeScores.map(([key, label]) => (
          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2" key={key}>
            <dt>{label}</dt>
            <dd className="font-mono font-bold text-slate-800">+{result.scoreBreakdown[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-slate-500">
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
      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 sm:p-7" onSubmit={submitSearch}>
        <label className="text-sm font-bold text-slate-900" htmlFor="retrieval-query">Search FlowPilot knowledge</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="retrieval-query"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 placeholder:text-slate-400"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: Pro API request limit"
          />
          <button className="rounded-xl bg-amber-300 px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-200" type="submit">
            Search knowledge
          </button>
        </div>

        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500" htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              value={category}
              onChange={(event) => setCategory(event.target.value as "all" | ProductCategory)}
            >
              <option value="all">All categories</option>
              {categories.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500" htmlFor="result-limit">Results</label>
            <select
              id="result-limit"
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            >
              {[3, 5, 8, 10].map((value) => <option value={value} key={value}>Top {value}</option>)}
            </select>
          </div>
        </div>
      </form>

      <section className="mt-8" aria-labelledby="examples-title">
        <h2 id="examples-title" className="text-sm font-bold text-slate-700">Example queries</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {exampleQueries.map((example) => (
            <button
              className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:border-amber-300 hover:text-amber-800"
              type="button"
              onClick={() => runExample(example)}
              key={example}
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="results-title" aria-live="polite">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Section-level ranking</p>
            <h2 id="results-title" className="mt-2 text-2xl font-bold tracking-[-0.025em]">Search results</h2>
          </div>
          {hasMeaningfulQuery && (
            <p className="text-sm text-slate-500">{results.length} ranked {results.length === 1 ? "section" : "sections"}</p>
          )}
        </div>

        {!hasMeaningfulQuery && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="font-bold text-slate-900">Start with a product question</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Enter meaningful terms or choose an example. Empty and common-word-only queries intentionally return no pages.
            </p>
          </div>
        )}

        {hasMeaningfulQuery && results.length === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <h3 className="font-bold text-slate-900">No matching FlowPilot sections</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Try a product term such as trial, API, refund, permissions, export, or security—or remove the category filter.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <ol className="mt-6 space-y-4">
            {results.map((result) => (
              <li className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" key={result.sectionId}>
                <article>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Rank {result.rank} · {result.pageCategory}</p>
                      <h3 className="mt-2 text-xl font-bold tracking-[-0.02em] text-slate-950">{result.pageTitle}</h3>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-500">Section: {result.sectionTitle}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950 px-3 py-2 text-center text-white">
                      <span className="block font-mono text-lg font-bold">{result.totalScore}</span>
                      <span className="block text-[0.65rem] uppercase tracking-[0.12em] text-slate-400">score</span>
                    </div>
                  </div>

                  <p className="mt-5 break-words text-sm leading-7 text-slate-700">{result.excerpt}</p>

                  <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
                    <div>
                      <p className="font-bold uppercase tracking-[0.12em] text-slate-400">Direct terms</p>
                      <p className="mt-2 break-words leading-5 text-slate-700">{result.matchedDirectTerms.join(", ") || "None"}</p>
                    </div>
                    <div>
                      <p className="font-bold uppercase tracking-[0.12em] text-slate-400">Synonym terms</p>
                      <p className="mt-2 break-words leading-5 text-slate-700">{result.matchedSynonymTerms.join(", ") || "None"}</p>
                    </div>
                  </div>

                  <ScoreExplanation result={result} />

                  <Link className="mt-5 inline-block rounded-lg text-sm font-bold text-amber-700 hover:text-amber-900" href={`/product/${result.pageSlug}`}>
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
