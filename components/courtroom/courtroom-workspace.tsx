"use client";

import Link from "next/link";

import type { EvidenceBundle } from "@/lib/evidence/types";
import type {
  CourtroomArgumentRecord,
  CourtroomRole,
  CourtroomState,
} from "@/lib/courtroom/types";

const roleCopy = {
  prosecutor: {
    eyebrow: "Case for failure",
    title: "Prosecutor",
    description: "Builds the strongest evidence-grounded case that the product experience failed or caused material friction.",
    accent: "text-red-700",
    button: "bg-red-700 text-white hover:bg-red-800",
  },
  defense: {
    eyebrow: "Case for success",
    title: "Defense",
    description: "Builds the strongest evidence-grounded case that the experience worked or remained reasonably usable.",
    accent: "text-emerald-700",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
  },
} as const;

function EvidenceCitations({ ids, bundle }: { ids: readonly string[]; bundle: EvidenceBundle }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Evidence citations">
      {ids.map((id) => {
        const item = bundle.evidenceItems.find((candidate) => candidate.evidenceId === id);
        if (!item) return null;
        return (
          <li key={id}>
            <Link
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-300"
              href={`/product/${item.pageSlug}`}
              title={id}
            >
              <span className={`size-1.5 shrink-0 rounded-full ${item.customerSaw ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span className="truncate">{item.pageTitle}{item.sectionTitle ? ` · ${item.sectionTitle}` : ""}</span>
              <span className="shrink-0 text-slate-400">{item.customerSaw ? "seen" : "not seen"}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ArgumentCard({
  role,
  record,
  bundle,
  busyRole,
  error,
  onRun,
}: {
  role: CourtroomRole;
  record: CourtroomArgumentRecord | null;
  bundle: EvidenceBundle;
  busyRole: CourtroomRole | null;
  error: string | null;
  onRun(role: CourtroomRole): void;
}) {
  const copy = roleCopy[role];
  const busy = busyRole === role;
  const anotherBusy = busyRole !== null && !busy;

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-lg">
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${copy.accent}`}>{copy.eyebrow}</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">{copy.title}</h3>
          {!record && <p className="mt-3 text-sm leading-6 text-slate-600">{copy.description}</p>}
        </div>
        <button
          className={`rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${copy.button}`}
          disabled={busyRole !== null}
          onClick={() => onRun(role)}
          type="button"
        >
          {busy ? `Running ${copy.title.toLowerCase()}…` : record ? `Regenerate ${copy.title.toLowerCase()}` : `Run ${copy.title.toLowerCase()}`}
        </button>
      </div>

      {anotherBusy && <p className="mt-4 text-xs text-slate-500">Waiting for the other advocate&apos;s single provider call to finish.</p>}
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}

      {record && (
        <div className="mt-6 space-y-6 border-t border-slate-100 pt-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Thesis</p>
            <p className="mt-2 text-base font-semibold leading-7 text-slate-900">{record.argument.thesis}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Key claims</p>
            <ol className="mt-3 space-y-4">
              {record.argument.keyClaims.map((claim) => (
                <li className="rounded-xl border border-slate-200 p-4" key={claim.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-6 text-slate-800">{claim.claim}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-slate-600">{claim.strength}</span>
                  </div>
                  <EvidenceCitations bundle={bundle} ids={claim.evidenceIds} />
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Strongest point</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{record.argument.strongestPoint.claim}</p>
            <EvidenceCitations bundle={bundle} ids={record.argument.strongestPoint.evidenceIds} />
          </div>

          {record.argument.acknowledges.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Acknowledges</p>
              <ul className="mt-3 space-y-3">
                {record.argument.acknowledges.map((point, index) => (
                  <li className="rounded-xl bg-slate-50 p-4" key={`${index}-${point.claim}`}>
                    <p className="text-sm leading-6 text-slate-700">{point.claim}</p>
                    <EvidenceCitations bundle={bundle} ids={point.evidenceIds} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Requested direction · advocacy, not verdict</p>
            <p className="mt-2 font-mono text-sm font-bold text-slate-800">{record.argument.requestedVerdictDirection.replaceAll("_", " ")}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{record.argument.closingStatement}</p>
          </div>

          <p className="text-xs text-slate-400">Generated {new Date(record.createdAt).toLocaleString()} · {record.provider} · bundle v{record.evidenceBundleVersion}</p>
        </div>
      )}
    </article>
  );
}

export function CourtroomWorkspace({
  bundle,
  courtroom,
  busyRole,
  errors,
  onRun,
}: {
  bundle: EvidenceBundle;
  courtroom: CourtroomState;
  busyRole: CourtroomRole | null;
  errors: Record<CourtroomRole, string | null>;
  onRun(role: CourtroomRole): void;
}) {
  const bothReady = Boolean(courtroom.prosecutor && courtroom.defense);

  return (
    <section className="space-y-5" aria-labelledby="courtroom-title">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Phase 7 · Independent advocates</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold" id="courtroom-title">Courtroom arguments</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Run either side first. Each advocate receives the same immutable evidence bundle, cannot see the other argument, and makes one serverless provider call.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ArgumentCard bundle={bundle} busyRole={busyRole} error={errors.prosecutor} onRun={onRun} record={courtroom.prosecutor} role="prosecutor" />
        <ArgumentCard bundle={bundle} busyRole={busyRole} error={errors.defense} onRun={onRun} record={courtroom.defense} role="defense" />
      </div>

      <div className={`rounded-2xl border p-6 text-center ${bothReady ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
        <p className="text-sm font-bold text-slate-900">{bothReady ? "Both arguments are ready for a future judge." : "Run both independent advocates to complete this phase."}</p>
        <button className="mt-4 rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500" disabled type="button">Run judge · Coming in Phase 8</button>
      </div>
    </section>
  );
}
