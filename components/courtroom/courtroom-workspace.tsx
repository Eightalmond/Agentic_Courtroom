"use client";

import Link from "next/link";

import type { EvidenceBundle } from "@/lib/evidence/types";
import type { DisplayError } from "@/lib/demo/errors";
import { fingerprintEvidenceBundle } from "@/lib/courtroom/fingerprints";
import type {
  CourtroomArgumentRecord,
  CourtroomRole,
  CourtroomState,
  JudgeVerdictRecord,
} from "@/lib/courtroom/types";
import { isFinalReportAvailable, VERDICT_LABELS } from "@/lib/courtroom/verdict";

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
          <li className="min-w-0 max-w-full" key={id}>
            <Link
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-300"
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
  controlsDisabled,
  error,
  onRun,
}: {
  role: CourtroomRole;
  record: CourtroomArgumentRecord | null;
  bundle: EvidenceBundle;
  busyRole: CourtroomRole | null;
  controlsDisabled: boolean;
  error: DisplayError | null;
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
        <div className="shrink-0 text-right">
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${copy.button}`}
            disabled={busyRole !== null || controlsDisabled}
            onClick={() => onRun(role)}
            type="button"
          >
            {busy ? `Running ${copy.title.toLowerCase()}…` : record ? `Regenerate ${copy.title.toLowerCase()}` : `Run ${copy.title.toLowerCase()}`}
          </button>
          <p className="mt-2 text-xs text-slate-500">Uses 1 LLM request</p>
        </div>
      </div>

      {anotherBusy && <p className="mt-4 text-xs text-slate-500">Waiting for the other advocate&apos;s single provider call to finish.</p>}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-left" role="alert">
          <p className="text-sm text-red-900">{error.message}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-red-700">{error.code}</p>
        </div>
      )}

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

function JudgeResult({ record, bundle }: { record: JudgeVerdictRecord; bundle: EvidenceBundle }) {
  const result = record.verdict;
  return (
    <div className="space-y-5">
      <article className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-6 shadow-lg shadow-amber-900/5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">Final judge verdict</p>
            <h3 className="mt-3 font-serif text-4xl font-semibold text-slate-950">{VERDICT_LABELS[result.verdict]}</h3>
          </div>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold capitalize text-slate-700">{result.confidence} confidence</span>
        </div>
        <p className="mt-5 max-w-4xl text-base leading-7 text-slate-700">{result.summary}</p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Customer answer assessment · {result.customerOutcomeAssessment.answerStatus.replaceAll("_", " ")}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{result.customerOutcomeAssessment.explanation}</p>
          <EvidenceCitations bundle={bundle} ids={result.customerOutcomeAssessment.evidenceIds} />
        </div>
        <p className="mt-5 text-xs text-slate-500">Generated {new Date(record.createdAt).toLocaleString()} · {record.provider} · bundle v{record.evidenceBundleVersion}</p>
      </article>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="judge-findings-title">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Evidence-grounded findings</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950" id="judge-findings-title">Findings</h3>
        <ol className="mt-5 grid gap-4 md:grid-cols-2">
          {result.findings.map((finding, index) => (
            <li className="rounded-xl border border-slate-200 p-4" key={`${index}-${finding.title}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-bold text-slate-900">{finding.title}</h4>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-slate-600">{finding.weight}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{finding.finding}</p>
              <EvidenceCitations bundle={bundle} ids={finding.evidenceIds} />
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Judge assessment of both sides">
        {(["prosecutor", "defense"] as const).map((role) => {
          const assessment = role === "prosecutor" ? result.prosecutorAssessment : result.defenseAssessment;
          return (
            <article className="rounded-2xl border border-slate-200 bg-white p-6" key={role}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{role} assessment</p>
              <h3 className="mt-4 font-bold text-slate-950">Strongest supported point</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{assessment.strongestSupportedPoint}</p>
              <EvidenceCitations bundle={bundle} ids={assessment.evidenceIds} />
              <h3 className="mt-5 border-t border-slate-100 pt-5 font-bold text-slate-950">Weakness or overreach</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{assessment.overreachOrWeakness}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {result.primaryFriction && (
          <article className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">Primary friction</p>
            <h3 className="mt-3 text-xl font-bold text-slate-950">{result.primaryFriction.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">{result.primaryFriction.explanation}</p>
            <EvidenceCitations bundle={bundle} ids={result.primaryFriction.evidenceIds} />
          </article>
        )}
        <article className={`rounded-2xl border border-emerald-200 bg-emerald-50 p-6 ${result.primaryFriction ? "" : "lg:col-span-2"}`}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Recommended product change</p>
          <h3 className="mt-3 text-xl font-bold text-slate-950">{result.recommendation.title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{result.recommendation.action}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{result.recommendation.rationale}</p>
          <EvidenceCitations bundle={bundle} ids={result.recommendation.evidenceIds} />
        </article>
      </section>
    </div>
  );
}

function FinalReport({
  courtroom,
  bundle,
  taskQuestion,
  personaName,
  customerConclusion,
  actionsUsed,
  maxActions,
}: {
  courtroom: CourtroomState;
  bundle: EvidenceBundle;
  taskQuestion: string;
  personaName: string;
  customerConclusion: string;
  actionsUsed: number;
  maxActions: number;
}) {
  const judge = courtroom.judge;
  if (!judge || !courtroom.prosecutor || !courtroom.defense) return null;
  const reportRows = [
    ["Customer task", taskQuestion],
    ["Persona", personaName],
    ["Customer final answer", customerConclusion],
    ["Actions used", `${actionsUsed}/${maxActions}`],
    ["Evidence coverage", `${bundle.coverage.requiredEvidenceSeen}/${bundle.coverage.requiredEvidenceTotal} required sources seen`],
    ["Prosecutor position", courtroom.prosecutor.argument.thesis],
    ["Defense position", courtroom.defense.argument.thesis],
    ["Final judge verdict", VERDICT_LABELS[judge.verdict.verdict]],
    ["Primary friction", judge.verdict.primaryFriction?.explanation ?? "No primary friction identified."],
    ["Recommended product change", judge.verdict.recommendation.action],
  ] as const;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white sm:p-8" aria-labelledby="final-report-title">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Complete courtroom report</p>
      <h2 className="mt-3 font-serif text-3xl font-semibold" id="final-report-title">Final report</h2>
      <dl className="mt-6 grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-2">
        {reportRows.map(([label, value]) => (
          <div className="bg-slate-900 p-4" key={label}>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
            <dd className="mt-2 text-sm leading-6 text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CourtroomWorkspace({
  bundle,
  courtroom,
  busyRole,
  isJudgeBusy,
  judgeError,
  errors,
  onRun,
  onRunJudge,
  taskQuestion,
  personaName,
  customerConclusion,
  actionsUsed,
  maxActions,
}: {
  bundle: EvidenceBundle;
  courtroom: CourtroomState;
  busyRole: CourtroomRole | null;
  isJudgeBusy: boolean;
  judgeError: DisplayError | null;
  errors: Record<CourtroomRole, DisplayError | null>;
  onRun(role: CourtroomRole): void;
  onRunJudge(): void;
  taskQuestion: string;
  personaName: string;
  customerConclusion: string;
  actionsUsed: number;
  maxActions: number;
}) {
  const bundleFingerprint = fingerprintEvidenceBundle(bundle);
  const bothReady = Boolean(courtroom.prosecutor && courtroom.defense);
  const judgeEligible = Boolean(
    courtroom.prosecutor?.evidenceBundleFingerprint === bundleFingerprint &&
    courtroom.defense?.evidenceBundleFingerprint === bundleFingerprint,
  );
  const judgeAvailabilityMessage = !bothReady
    ? "Generate both courtroom arguments first."
    : !judgeEligible
      ? "Regenerate both legacy arguments so the judge can verify the exact evidence bundle they used."
      : "Both current arguments are ready for the judge.";

  return (
    <section className="space-y-5" aria-labelledby="courtroom-title">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Phase 8 · Complete courtroom</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold" id="courtroom-title">Arguments and final verdict</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Each advocate receives the same immutable evidence. Once both sides are current, the neutral judge compares them in one provider call without retrieving new evidence.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ArgumentCard bundle={bundle} busyRole={busyRole} controlsDisabled={isJudgeBusy} error={errors.prosecutor} onRun={onRun} record={courtroom.prosecutor} role="prosecutor" />
        <ArgumentCard bundle={bundle} busyRole={busyRole} controlsDisabled={isJudgeBusy} error={errors.defense} onRun={onRun} record={courtroom.defense} role="defense" />
      </div>

      <div className={`rounded-2xl border p-6 text-center ${judgeEligible ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
        <p className="text-sm font-bold text-slate-900">{judgeAvailabilityMessage}</p>
        <p className="mt-2 text-xs text-slate-600">Running the judge uses one request from the configured LLM provider. There are no automatic retries or fallback calls.</p>
        {judgeError && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-3 text-left" role="alert">
            <p className="text-sm text-red-900">{judgeError.message}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-red-700">{judgeError.code}</p>
          </div>
        )}
        <button className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!judgeEligible || busyRole !== null || isJudgeBusy} onClick={onRunJudge} type="button">
          {isJudgeBusy ? (courtroom.judge ? "Regenerating judge…" : "Running judge…") : courtroom.judge ? "Regenerate judge" : "Run judge"}
        </button>
      </div>

      {courtroom.judge && <JudgeResult bundle={bundle} record={courtroom.judge} />}
      {isFinalReportAvailable(courtroom) && <FinalReport actionsUsed={actionsUsed} bundle={bundle} courtroom={courtroom} customerConclusion={customerConclusion} maxActions={maxActions} personaName={personaName} taskQuestion={taskQuestion} />}
    </section>
  );
}
