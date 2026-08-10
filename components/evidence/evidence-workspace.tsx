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
  journey: "bg-slate-100 text-slate-700",
  supporting: "bg-emerald-100 text-emerald-800",
  contradicting: "bg-red-100 text-red-800",
  context: "bg-sky-100 text-sky-800",
  missing: "bg-amber-100 text-amber-900",
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
    <section className="space-y-6" aria-labelledby="evidence-workspace-title">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Phase 6 · Prepared evidence</p>
            <h2 id="evidence-workspace-title" className="mt-3 font-serif text-3xl font-semibold">Evidence workspace</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{bundle.journeySummary}</p>
          </div>
          {onRebuild && (
            <button
              className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRebuilding}
              onClick={onRebuild}
              type="button"
            >
              {isRebuilding ? "Rebuilding…" : "Rebuild evidence"}
            </button>
          )}
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Outcome", outcomeLabel(bundle)],
            ["Actions", bundle.integrity.actionsProcessed],
            ["Pages", bundle.pagesVisited.length],
            ["Sections", bundle.sectionsInspected.length],
            ["Required seen", bundle.coverage.requiredEvidenceSeen],
            ["Required missing", bundle.coverage.requiredEvidenceMissing],
          ].map(([label, value]) => (
            <div className="min-w-0 rounded-xl bg-white/[0.07] p-3" key={label}>
              <dt className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
              <dd className="mt-2 break-words text-sm font-bold text-white">{value}</dd>
            </div>
          ))}
        </dl>

        {(bundle.customerFinalAnswer || bundle.giveUpReason) && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              {bundle.customerFinalAnswer ? "Final customer answer" : "Give-up reason"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{bundle.customerFinalAnswer ?? bundle.giveUpReason}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Evidence coverage · No verdict</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([
            ["Journey", bundle.coverage.journey],
            ["Supporting", bundle.coverage.supporting],
            ["Contradicting", bundle.coverage.contradicting],
            ["Context", bundle.coverage.context],
            ["Missing", bundle.coverage.missing],
          ] as const).map(([label, count]) => (
            <div className="rounded-xl border border-slate-200 p-4" key={label}>
              <p className="text-2xl font-bold text-slate-950">{count}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Source-traceable bundle</p>
            <h3 className="mt-2 text-2xl font-bold">Evidence list</h3>
          </div>
          <p className="text-sm font-semibold text-slate-500">{visibleEvidence.length} shown</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter evidence">
          {filters.map((option) => (
            <button
              aria-pressed={filter === option.id}
              className={`rounded-full px-3 py-2 text-xs font-bold ${filter === option.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
              key={option.id}
              onClick={() => setFilter(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <ol className="mt-6 space-y-4">
          {visibleEvidence.map((item) => (
            <li className="rounded-2xl border border-slate-200 p-5" key={item.evidenceId}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${categoryStyles[item.category]}`}>{item.category}</span>
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {item.customerSaw ? `Customer saw${item.firstExposedByAction ? ` · Action ${item.firstExposedByAction}` : ""}` : "Customer did not see"}
                </span>
              </div>
              <h4 className="mt-3 font-bold text-slate-950">{item.pageTitle}{item.sectionTitle ? ` · ${item.sectionTitle}` : ""}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.excerpt}</p>
              <p className="mt-3 text-xs leading-5 text-slate-500">{item.relevanceReason}</p>
              <Link className="mt-4 inline-block text-sm font-bold text-amber-800 hover:text-amber-950" href={`/product/${item.pageSlug}`}>
                Open FlowPilot source →
              </Link>
            </li>
          ))}
        </ol>
        {visibleEvidence.length === 0 && <p className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No evidence matches this filter.</p>}
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-800">Mechanical evidence check</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">Bounded fact checks</h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">These checks prepare evidence for the courtroom. They are deterministic rules, not the final verdict.</p>
        <div className="mt-5 space-y-4">
          {bundle.factChecks.map((check) => (
            <article className="rounded-xl border border-sky-200 bg-white p-5" key={check.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-slate-950">{check.name}</h4>
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-sky-900">{check.result}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{check.explanation}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {check.sourceSectionIds.map((sectionId) => {
                  const source = getSectionById(sectionId);
                  return source ? <Link className="font-bold text-sky-800 underline decoration-sky-300" href={`/product/${source.pageSlug}`} key={sectionId}>{source.pageTitle} · {source.sectionTitle}</Link> : null;
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Limitation: {check.limitation}</p>
            </article>
          ))}
        </div>
      </div>

    </section>
  );
}
