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
  journey: "text-lab-evidence",
  supporting: "text-lab-success",
  contradicting: "text-lab-error",
  context: "text-lab-defense",
  missing: "text-lab-warning",
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
  const customerSeenCount = bundle.evidenceItems.filter((item) => item.customerSaw).length;

  return (
    <section className="space-y-5" aria-labelledby="evidence-workspace-title">
      <div className="rounded-lg border border-lab-evidence/40 bg-lab-elevated p-5 shadow-[0_1px_2px_rgba(31,35,33,0.05)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-evidence">Evidence</p>
            <h2 id="evidence-workspace-title" className="mt-2 text-xl font-semibold tracking-[-0.02em]">Research record</h2>
            <p className="mt-2 font-mono text-[0.7rem] text-lab-evidence">{bundle.evidenceItems.length} items · {customerSeenCount} seen · {bundle.coverage.context} context · {bundle.coverage.missing} missing</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-lab-muted">{bundle.journeySummary}</p>
          </div>
          {onRebuild && (
            <button
              className="rounded-md border border-lab-border bg-lab-surface px-3.5 py-2 text-sm font-medium text-foreground hover:border-lab-evidence hover:bg-lab-accent-soft hover:text-lab-accent disabled:opacity-50"
              disabled={isRebuilding}
              onClick={onRebuild}
              type="button"
            >
              {isRebuilding ? "Rebuilding…" : "Rebuild evidence"}
            </button>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-lab-border pt-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Outcome", outcomeLabel(bundle)],
            ["Actions", bundle.integrity.actionsProcessed],
            ["Pages", bundle.pagesVisited.length],
            ["Sections", bundle.sectionsInspected.length],
            ["Required seen", bundle.coverage.requiredEvidenceSeen],
            ["Required missing", bundle.coverage.requiredEvidenceMissing],
          ].map(([label, value]) => (
            <div className="min-w-0" key={label}>
              <dt className="text-[0.68rem] text-lab-subtle">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        {(bundle.customerFinalAnswer || bundle.giveUpReason) && (
          <div className="mt-6 border-t border-lab-border pt-5">
            <p className="text-xs font-medium text-lab-subtle">
              {bundle.customerFinalAnswer ? "Final customer answer" : "Give-up reason"}
            </p>
            <p className="mt-2 text-sm leading-6 text-lab-muted">{bundle.customerFinalAnswer ?? bundle.giveUpReason}</p>
          </div>
        )}
      </div>

      <div className="px-1 py-3 sm:px-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-subtle">Coverage · not a verdict</p>
        <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-5">
          {([
            ["Journey", bundle.coverage.journey],
            ["Supporting", bundle.coverage.supporting],
            ["Contradicting", bundle.coverage.contradicting],
            ["Context", bundle.coverage.context],
            ["Missing", bundle.coverage.missing],
          ] as const).map(([label, count]) => (
            <div className="border-t border-lab-border pt-3" key={label}>
              <p className="font-mono text-xl text-foreground">{count}</p>
              <p className="mt-1 text-xs text-lab-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-lab-border bg-lab-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-evidence">Source-traceable bundle</p>
            <h3 className="mt-2 text-xl font-semibold">Evidence list</h3>
          </div>
          <p className="font-mono text-xs text-lab-subtle">{visibleEvidence.length} shown</p>
        </div>
        <div className="mt-5 flex max-w-full gap-1 overflow-x-auto border-b border-lab-border" aria-label="Filter evidence">
          {filters.map((option) => (
            <button
              aria-pressed={filter === option.id}
              className={`shrink-0 border-b-2 px-2 py-2 text-xs font-medium ${filter === option.id ? "border-lab-evidence text-lab-accent" : "border-transparent text-lab-muted hover:text-foreground"}`}
              key={option.id}
              onClick={() => setFilter(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <ol className="mt-5 divide-y divide-lab-border border-y border-lab-border">
          {visibleEvidence.map((item) => (
            <li className="py-5" key={item.evidenceId}>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[0.7rem]">
                <span className={`font-medium capitalize ${categoryStyles[item.category]}`}>{item.category}</span>
                <span className="text-lab-subtle">
                  {item.customerSaw ? `Customer saw${item.firstExposedByAction ? ` · Action ${item.firstExposedByAction}` : ""}` : "Customer did not see"}
                </span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-foreground">{item.pageTitle}{item.sectionTitle ? ` · ${item.sectionTitle}` : ""}</h4>
              <blockquote className="mt-3 border-l border-lab-evidence pl-4 text-sm leading-6 text-lab-muted">{item.excerpt}</blockquote>
              <p className="mt-3 text-xs leading-5 text-lab-subtle">{item.relevanceReason}</p>
              <Link className="mt-3 inline-block text-sm font-medium text-lab-accent hover:text-lab-accent-hover" href={`/product/${item.pageSlug}`}>
                Open FlowPilot source →
              </Link>
            </li>
          ))}
        </ol>
        {visibleEvidence.length === 0 && <p className="mt-6 bg-lab-elevated p-5 text-sm text-lab-muted">No evidence matches this filter.</p>}
      </div>

      <div className="border-l-2 border-lab-evidence bg-lab-surface/60 p-5 sm:p-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-subtle">Mechanical checks</p>
        <h3 className="mt-2 text-lg font-semibold text-foreground">Bounded fact checks</h3>
        <p className="mt-2 text-sm leading-6 text-lab-muted">Deterministic preparation signals, not the final verdict.</p>
        <div className="mt-5 divide-y divide-lab-border border-y border-lab-border">
          {bundle.factChecks.map((check) => (
            <article className="py-5" key={check.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">{check.name}</h4>
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-lab-evidence">{check.result}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-lab-muted">{check.explanation}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {check.sourceSectionIds.map((sectionId) => {
                  const source = getSectionById(sectionId);
                  return source ? <Link className="font-medium text-lab-accent underline decoration-lab-evidence/40" href={`/product/${source.pageSlug}`} key={sectionId}>{source.pageTitle} · {source.sectionTitle}</Link> : null;
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-lab-subtle">Limitation: {check.limitation}</p>
            </article>
          ))}
        </div>
      </div>

    </section>
  );
}
