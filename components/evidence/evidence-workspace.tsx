"use client";

import Link from "next/link";
import { useState } from "react";

import type { EvidenceBundle, EvidenceCategory, EvidenceItem } from "@/lib/evidence/types";
import { getSectionById } from "@/lib/retrieval";

type EvidenceFilter = "all" | "customer-saw" | EvidenceCategory;

const filters: readonly { id: EvidenceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "customer-saw", label: "Customer saw" },
  { id: "supporting", label: "Supporting" },
  { id: "contradicting", label: "Contradicting" },
  { id: "context", label: "Context" },
  { id: "missing", label: "Missing" },
];

const categoryStyles: Record<EvidenceCategory, string> = {
  journey: "text-neutral-600",
  supporting: "text-emerald-700",
  contradicting: "text-red-700",
  context: "text-blue-700",
  missing: "text-amber-800",
};

function matchesFilter(item: EvidenceItem, filter: EvidenceFilter) {
  if (filter === "all") return true;
  if (filter === "customer-saw") return item.customerSaw;
  return item.category === filter;
}

function outcomeLabel(bundle: EvidenceBundle) {
  if (bundle.customerOutcome === "answered") return "Customer answered";
  if (bundle.customerOutcome === "gave-up") return "Customer gave up";
  return "Action budget exhausted";
}

export function EvidenceWorkspace({
  bundle,
  isRebuilding,
  onRebuild,
}: {
  bundle: EvidenceBundle;
  isRebuilding: boolean;
  onRebuild?: () => void;
}) {
  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const visibleEvidence = bundle.evidenceItems.filter((item) => matchesFilter(item, filter));

  return (
    <section className="space-y-5" aria-labelledby="evidence-workspace-title">
      <div className="border border-neutral-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Prepared evidence</p>
            <h2 id="evidence-workspace-title" className="mt-2 text-xl font-semibold tracking-[-0.02em]">Evidence record</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{bundle.journeySummary}</p>
          </div>
          {onRebuild && (
            <button
              className="rounded-md border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 disabled:opacity-50"
              disabled={isRebuilding}
              onClick={onRebuild}
              type="button"
            >
              {isRebuilding ? "Rebuilding…" : "Rebuild evidence"}
            </button>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Outcome", outcomeLabel(bundle)],
            ["Actions", bundle.integrity.actionsProcessed],
            ["Pages", bundle.pagesVisited.length],
            ["Sections", bundle.sectionsInspected.length],
            ["Required seen", bundle.coverage.requiredEvidenceSeen],
            ["Required missing", bundle.coverage.requiredEvidenceMissing],
          ].map(([label, value]) => (
            <div className="min-w-0 bg-white p-3" key={label}>
              <dt className="text-[0.68rem] text-neutral-400">{label}</dt>
              <dd className="mt-2 break-words text-sm font-medium text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>

        {(bundle.customerFinalAnswer || bundle.giveUpReason) && (
          <div className="mt-6 border-t border-neutral-200 pt-5">
            <p className="text-xs font-medium text-neutral-400">
              {bundle.customerFinalAnswer ? "Final customer answer" : "Give-up reason"}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{bundle.customerFinalAnswer ?? bundle.giveUpReason}</p>
          </div>
        )}
      </div>

      <div className="border border-neutral-200 bg-white p-5 sm:p-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Coverage · not a verdict</p>
        <div className="mt-5 grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-5">
          {([
            ["Journey", bundle.coverage.journey],
            ["Supporting", bundle.coverage.supporting],
            ["Contradicting", bundle.coverage.contradicting],
            ["Context", bundle.coverage.context],
            ["Missing", bundle.coverage.missing],
          ] as const).map(([label, count]) => (
            <div className="bg-white p-4" key={label}>
              <p className="font-mono text-xl text-neutral-950">{count}</p>
              <p className="mt-1 text-xs text-neutral-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-neutral-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Source-traceable bundle</p>
            <h3 className="mt-2 text-xl font-semibold">Evidence list</h3>
          </div>
          <p className="font-mono text-xs text-neutral-500">{visibleEvidence.length} shown</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter evidence">
          {filters.map((option) => (
            <button
              aria-pressed={filter === option.id}
              className={`border-b-2 px-2 py-2 text-xs font-medium ${filter === option.id ? "border-indigo-600 text-neutral-950" : "border-transparent text-neutral-500 hover:text-neutral-900"}`}
              key={option.id}
              onClick={() => setFilter(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <ol className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
          {visibleEvidence.map((item) => (
            <li className="py-5" key={item.evidenceId}>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[0.7rem]">
                <span className={`font-medium capitalize ${categoryStyles[item.category]}`}>{item.category}</span>
                <span className="text-neutral-400">
                  {item.customerSaw ? `Customer saw${item.firstExposedByAction ? ` · Action ${item.firstExposedByAction}` : ""}` : "Customer did not see"}
                </span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-neutral-950">{item.pageTitle}{item.sectionTitle ? ` · ${item.sectionTitle}` : ""}</h4>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{item.excerpt}</p>
              <p className="mt-2 text-xs leading-5 text-neutral-500">{item.relevanceReason}</p>
              <Link className="mt-3 inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900" href={`/product/${item.pageSlug}`}>
                Open FlowPilot source →
              </Link>
            </li>
          ))}
        </ol>
        {visibleEvidence.length === 0 && <p className="mt-6 bg-neutral-50 p-5 text-sm text-neutral-500">No evidence matches this filter.</p>}
      </div>

      <div className="border border-neutral-200 bg-neutral-50 p-5 sm:p-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Mechanical checks</p>
        <h3 className="mt-2 text-lg font-semibold text-neutral-950">Bounded fact checks</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-600">Deterministic preparation signals, not the final verdict.</p>
        <div className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
          {bundle.factChecks.map((check) => (
            <article className="py-5" key={check.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-neutral-950">{check.name}</h4>
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-neutral-600">{check.result}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-700">{check.explanation}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {check.sourceSectionIds.map((sectionId) => {
                  const source = getSectionById(sectionId);
                  return source ? <Link className="font-medium text-indigo-700 underline decoration-indigo-200" href={`/product/${source.pageSlug}`} key={sectionId}>{source.pageTitle} · {source.sectionTitle}</Link> : null;
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500">Limitation: {check.limitation}</p>
            </article>
          ))}
        </div>
      </div>

    </section>
  );
}
