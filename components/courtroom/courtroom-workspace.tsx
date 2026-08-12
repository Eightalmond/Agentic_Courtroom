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
    button: "border border-red-300 text-red-800 hover:bg-red-50",
  },
  defense: {
    eyebrow: "Case for success",
    title: "Defense",
    description: "Builds the strongest evidence-grounded case that the experience worked or remained reasonably usable.",
    accent: "text-blue-700",
    button: "border border-blue-300 text-blue-800 hover:bg-blue-50",
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
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 border-b border-neutral-300 py-1 text-xs text-neutral-600 hover:border-indigo-500 hover:text-neutral-950"
              href={`/product/${item.pageSlug}`}
              title={id}
            >
              <span className={`size-1.5 shrink-0 rounded-full ${item.customerSaw ? "bg-emerald-500" : "bg-neutral-300"}`} />
              <span className="truncate">{item.pageTitle}{item.sectionTitle ? ` · ${item.sectionTitle}` : ""}</span>
              <span className="shrink-0 text-neutral-400">{item.customerSaw ? "seen" : "not seen"}</span>
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
    <article className={`min-w-0 border bg-white p-5 sm:p-6 ${role === "prosecutor" ? "border-red-200" : "border-blue-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-lg">
          <p className={`text-xs font-medium uppercase tracking-[0.14em] ${copy.accent}`}>{copy.eyebrow}</p>
          <h3 className="mt-2 text-xl font-semibold text-neutral-950">{copy.title}</h3>
          {!record && <p className="mt-3 text-sm leading-6 text-neutral-600">{copy.description}</p>}
        </div>
        <div className="shrink-0 text-right">
          <button
            className={`rounded-md px-3.5 py-2 text-sm font-medium disabled:opacity-50 ${copy.button}`}
            disabled={busyRole !== null || controlsDisabled}
            onClick={() => onRun(role)}
            type="button"
          >
            {busy ? `Running ${copy.title.toLowerCase()}…` : record ? `Regenerate ${copy.title.toLowerCase()}` : `Run ${copy.title.toLowerCase()}`}
          </button>
          <p className="mt-2 font-mono text-[0.7rem] text-neutral-500">1 LLM request</p>
        </div>
      </div>

      {anotherBusy && <p className="mt-4 text-xs text-neutral-500">Waiting for the other advocate&apos;s single provider call to finish.</p>}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-left" role="alert">
          <p className="text-sm text-red-900">{error.message}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-red-700">{error.code}</p>
        </div>
      )}

      {record && (
        <div className="mt-6 space-y-6 border-t border-neutral-200 pt-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">Thesis</p>
            <p className="mt-2 text-base font-medium leading-7 text-neutral-900">{record.argument.thesis}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">Key claims</p>
            <ol className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
              {record.argument.keyClaims.map((claim) => (
                <li className="py-4" key={claim.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-6 text-neutral-800">{claim.claim}</p>
                    <span className="font-mono text-[0.68rem] uppercase tracking-wide text-neutral-500">{claim.strength}</span>
                  </div>
                  <EvidenceCitations bundle={bundle} ids={claim.evidenceIds} />
                </li>
              ))}
            </ol>
          </div>

          <div className={`border-l-2 p-4 ${role === "prosecutor" ? "border-red-400 bg-red-50/60" : "border-blue-400 bg-blue-50/60"}`}>
            <p className={`text-xs font-medium uppercase tracking-[0.12em] ${copy.accent}`}>Strongest point</p>
            <p className="mt-2 text-sm font-medium leading-6 text-neutral-900">{record.argument.strongestPoint.claim}</p>
            <EvidenceCitations bundle={bundle} ids={record.argument.strongestPoint.evidenceIds} />
          </div>

          {record.argument.acknowledges.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">Acknowledges</p>
              <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
                {record.argument.acknowledges.map((point, index) => (
                  <li className="py-4" key={`${index}-${point.claim}`}>
                    <p className="text-sm leading-6 text-neutral-700">{point.claim}</p>
                    <EvidenceCitations bundle={bundle} ids={point.evidenceIds} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-neutral-200 pt-5">
            <p className="text-xs font-medium text-neutral-400">Requested direction · advocacy, not verdict</p>
            <p className="mt-2 font-mono text-sm text-neutral-800">{record.argument.requestedVerdictDirection.replaceAll("_", " ")}</p>
            <p className="mt-3 text-sm leading-6 text-neutral-700">{record.argument.closingStatement}</p>
          </div>

          <p className="font-mono text-[0.7rem] text-neutral-400">Generated {new Date(record.createdAt).toLocaleString()} · {record.provider} · bundle v{record.evidenceBundleVersion}</p>
        </div>
      )}
    </article>
  );
}

function JudgeResult({ record, bundle }: { record: JudgeVerdictRecord; bundle: EvidenceBundle }) {
  const result = record.verdict;
  return (
    <div className="space-y-5">
      <article className="border border-neutral-300 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Final judge verdict</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950 sm:text-4xl">{VERDICT_LABELS[result.verdict]}</h3>
          </div>
          <span className="font-mono text-xs capitalize text-neutral-500">{result.confidence} confidence</span>
        </div>
        <p className="mt-5 max-w-4xl text-base leading-7 text-neutral-700">{result.summary}</p>
        <div className="mt-6 border-l-2 border-indigo-500 bg-neutral-50 p-4">
          <p className="text-xs font-medium text-neutral-500">Customer answer · {result.customerOutcomeAssessment.answerStatus.replaceAll("_", " ")}</p>
          <p className="mt-2 text-sm leading-6 text-neutral-700">{result.customerOutcomeAssessment.explanation}</p>
          <EvidenceCitations bundle={bundle} ids={result.customerOutcomeAssessment.evidenceIds} />
        </div>
        <p className="mt-5 font-mono text-[0.7rem] text-neutral-400">Generated {new Date(record.createdAt).toLocaleString()} · {record.provider} · bundle v{record.evidenceBundleVersion}</p>
      </article>

      <section className="border border-neutral-200 bg-white p-6 sm:p-8" aria-labelledby="judge-findings-title">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Evidence-grounded findings</p>
        <h3 className="mt-2 text-xl font-semibold text-neutral-950" id="judge-findings-title">Findings</h3>
        <ol className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
          {result.findings.map((finding, index) => (
            <li className="py-4" key={`${index}-${finding.title}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-medium text-neutral-900">{finding.title}</h4>
                <span className="font-mono text-[0.68rem] uppercase tracking-wide text-neutral-500">{finding.weight}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{finding.finding}</p>
              <EvidenceCitations bundle={bundle} ids={finding.evidenceIds} />
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Judge assessment of both sides">
        {(["prosecutor", "defense"] as const).map((role) => {
          const assessment = role === "prosecutor" ? result.prosecutorAssessment : result.defenseAssessment;
          return (
            <article className={`border bg-white p-6 ${role === "prosecutor" ? "border-red-200" : "border-blue-200"}`} key={role}>
              <p className={`text-xs font-medium uppercase tracking-[0.14em] ${role === "prosecutor" ? "text-red-700" : "text-blue-700"}`}>{role} assessment</p>
              <h3 className="mt-4 font-semibold text-neutral-950">Strongest supported point</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{assessment.strongestSupportedPoint}</p>
              <EvidenceCitations bundle={bundle} ids={assessment.evidenceIds} />
              <h3 className="mt-5 border-t border-neutral-200 pt-5 font-semibold text-neutral-950">Weakness or overreach</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{assessment.overreachOrWeakness}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {result.primaryFriction && (
          <article className="border border-red-200 bg-red-50/50 p-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-red-700">Primary friction</p>
            <h3 className="mt-3 text-lg font-semibold text-neutral-950">{result.primaryFriction.title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{result.primaryFriction.explanation}</p>
            <EvidenceCitations bundle={bundle} ids={result.primaryFriction.evidenceIds} />
          </article>
        )}
        <article className={`border border-emerald-200 bg-emerald-50/50 p-6 ${result.primaryFriction ? "" : "lg:col-span-2"}`}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-800">Recommended product change</p>
          <h3 className="mt-3 text-lg font-semibold text-neutral-950">{result.recommendation.title}</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-neutral-800">{result.recommendation.action}</p>
          <p className="mt-2 text-sm leading-6 text-neutral-700">{result.recommendation.rationale}</p>
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
    <section id="report" className="scroll-mt-6 border border-neutral-300 bg-white p-6 sm:p-8" aria-labelledby="final-report-title">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Evaluation record</p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-neutral-950" id="final-report-title">Final report</h2>
      <dl className="mt-6 grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2">
        {reportRows.map(([label, value]) => (
          <div className="bg-white p-4" key={label}>
            <dt className="text-xs text-neutral-400">{label}</dt>
            <dd className="mt-2 text-sm leading-6 text-neutral-700">{value}</dd>
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
      <div className="border border-neutral-200 bg-white p-5 sm:p-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Adversarial review</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-neutral-950" id="courtroom-title">Courtroom</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">Both advocates receive the same immutable evidence. The judge compares their cases without retrieving new material.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ArgumentCard bundle={bundle} busyRole={busyRole} controlsDisabled={isJudgeBusy} error={errors.prosecutor} onRun={onRun} record={courtroom.prosecutor} role="prosecutor" />
        <ArgumentCard bundle={bundle} busyRole={busyRole} controlsDisabled={isJudgeBusy} error={errors.defense} onRun={onRun} record={courtroom.defense} role="defense" />
      </div>

      <div className={`border p-6 text-center ${judgeEligible ? "border-indigo-300 bg-indigo-50/40" : "border-neutral-200 bg-white"}`}>
        <p className="text-sm font-medium text-neutral-900">{judgeAvailabilityMessage}</p>
        <p className="mt-2 text-xs text-neutral-600">One LLM request · no automatic retry or fallback.</p>
        {judgeError && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-3 text-left" role="alert">
            <p className="text-sm text-red-900">{judgeError.message}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-red-700">{judgeError.code}</p>
          </div>
        )}
        <button className="mt-4 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40" disabled={!judgeEligible || busyRole !== null || isJudgeBusy} onClick={onRunJudge} type="button">
          {isJudgeBusy ? (courtroom.judge ? "Regenerating judge…" : "Running judge…") : courtroom.judge ? "Regenerate judge" : "Run judge"}
        </button>
      </div>

      {courtroom.judge && <JudgeResult bundle={bundle} record={courtroom.judge} />}
      {isFinalReportAvailable(courtroom) && <FinalReport actionsUsed={actionsUsed} bundle={bundle} courtroom={courtroom} customerConclusion={customerConclusion} maxActions={maxActions} personaName={personaName} taskQuestion={taskQuestion} />}
    </section>
  );
}
