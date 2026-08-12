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
    accent: "text-lab-prosecutor",
    border: "border-t-lab-prosecutor",
    button: "border border-lab-prosecutor/50 text-lab-prosecutor hover:bg-lab-prosecutor/10",
  },
  defense: {
    eyebrow: "Case for success",
    title: "Defense",
    description: "Builds the strongest evidence-grounded case that the experience worked or remained reasonably usable.",
    accent: "text-lab-defense",
    border: "border-t-lab-defense",
    button: "border border-lab-defense/50 text-lab-defense hover:bg-lab-defense/10",
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
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 border-b border-lab-border py-1 text-xs text-lab-muted hover:border-lab-accent hover:text-lab-accent"
              href={`/product/${item.pageSlug}`}
              title={id}
            >
              <span className={`size-1.5 shrink-0 rounded-full ${item.customerSaw ? "bg-lab-success" : "bg-lab-subtle"}`} />
              <span className="truncate">{item.pageTitle}{item.sectionTitle ? ` · ${item.sectionTitle}` : ""}</span>
              <span className="shrink-0 text-lab-subtle">{item.customerSaw ? "seen" : "not seen"}</span>
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
    <article className={`min-w-0 rounded-lg border border-t-2 border-lab-border bg-lab-surface p-5 sm:p-6 ${copy.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-lg">
          <p className={`text-xs font-medium uppercase tracking-[0.14em] ${copy.accent}`}>{copy.eyebrow}</p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">{copy.title}</h3>
          {!record && <p className="mt-3 text-sm leading-6 text-lab-muted">{copy.description}</p>}
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
          <p className="mt-2 font-mono text-[0.7rem] text-lab-subtle">1 LLM request</p>
        </div>
      </div>

      {anotherBusy && <p className="mt-4 text-xs text-lab-muted">Waiting for the other advocate&apos;s single provider call to finish.</p>}
      {error && (
        <div className="mt-4 border-l-2 border-lab-error bg-lab-error/10 p-3 text-left" role="alert">
          <p className="text-sm text-lab-error">{error.message}</p>
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-wide text-lab-error">{error.code}</p>
        </div>
      )}

      {record && (
        <div className="mt-6 space-y-6 border-t border-lab-border pt-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-lab-subtle">Thesis</p>
            <p className="mt-2 text-base font-medium leading-7 text-foreground">{record.argument.thesis}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-lab-subtle">Key claims</p>
            <ol className="mt-3 divide-y divide-lab-border border-y border-lab-border">
              {record.argument.keyClaims.map((claim) => (
                <li className="py-4" key={claim.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-6 text-foreground">{claim.claim}</p>
                    <span className="font-mono text-[0.68rem] uppercase tracking-wide text-lab-subtle">{claim.strength}</span>
                  </div>
                  <EvidenceCitations bundle={bundle} ids={claim.evidenceIds} />
                </li>
              ))}
            </ol>
          </div>

          <div className={`border-l-2 p-4 ${role === "prosecutor" ? "border-lab-prosecutor bg-lab-prosecutor/[0.06]" : "border-lab-defense bg-lab-defense/[0.06]"}`}>
            <p className={`text-xs font-medium uppercase tracking-[0.12em] ${copy.accent}`}>Strongest point</p>
            <p className="mt-2 text-sm font-medium leading-6 text-foreground">{record.argument.strongestPoint.claim}</p>
            <EvidenceCitations bundle={bundle} ids={record.argument.strongestPoint.evidenceIds} />
          </div>

          {record.argument.acknowledges.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-lab-subtle">Acknowledges</p>
              <ul className="mt-3 divide-y divide-lab-border border-y border-lab-border">
                {record.argument.acknowledges.map((point, index) => (
                  <li className="py-4" key={`${index}-${point.claim}`}>
                    <p className="text-sm leading-6 text-lab-muted">{point.claim}</p>
                    <EvidenceCitations bundle={bundle} ids={point.evidenceIds} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-lab-border pt-5">
            <p className="text-xs font-medium text-lab-subtle">Requested direction · advocacy, not verdict</p>
            <p className="mt-2 font-mono text-sm text-foreground">{record.argument.requestedVerdictDirection.replaceAll("_", " ")}</p>
            <p className="mt-3 text-sm leading-6 text-lab-muted">{record.argument.closingStatement}</p>
          </div>

          <p className="font-mono text-[0.7rem] text-lab-subtle">Generated {new Date(record.createdAt).toLocaleString()} · {record.provider} · bundle v{record.evidenceBundleVersion}</p>
        </div>
      )}
    </article>
  );
}

function JudgeResult({ record, bundle }: { record: JudgeVerdictRecord; bundle: EvidenceBundle }) {
  const result = record.verdict;
  const verdictTone = {
    pass: "border-lab-success bg-lab-success/10 text-lab-success",
    pass_with_friction: "border-lab-warning bg-lab-warning/10 text-lab-warning",
    misleading: "border-lab-prosecutor bg-lab-prosecutor/10 text-lab-prosecutor",
    blocked: "border-lab-error bg-lab-error/10 text-lab-error",
    insufficient_evidence: "border-lab-subtle bg-lab-subtle/10 text-lab-muted",
  }[result.verdict];
  return (
    <div className="space-y-5">
      <article className="border border-lab-judge/50 bg-lab-elevated p-6 shadow-[0_1px_2px_rgba(31,35,33,0.06)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-judge">Final judge verdict</p>
            <h3 className={`mt-3 inline-flex border-l-2 px-3 py-1 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl ${verdictTone}`}>{VERDICT_LABELS[result.verdict]}</h3>
          </div>
          <span className="font-mono text-xs capitalize text-lab-muted">{result.confidence} confidence</span>
        </div>
        <p className="mt-5 max-w-4xl text-base leading-7 text-foreground">{result.summary}</p>
        <div className="mt-6 border-l-2 border-lab-judge bg-lab-judge/[0.06] p-4">
          <p className="text-xs font-medium text-lab-judge">Customer answer · {result.customerOutcomeAssessment.answerStatus.replaceAll("_", " ")}</p>
          <p className="mt-2 text-sm leading-6 text-lab-muted">{result.customerOutcomeAssessment.explanation}</p>
          <EvidenceCitations bundle={bundle} ids={result.customerOutcomeAssessment.evidenceIds} />
        </div>
        <p className="mt-5 font-mono text-[0.7rem] text-lab-subtle">Generated {new Date(record.createdAt).toLocaleString()} · {record.provider} · bundle v{record.evidenceBundleVersion}</p>
      </article>

      <section className="border border-lab-border bg-lab-surface p-6 sm:p-8" aria-labelledby="judge-findings-title">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-judge">Evidence-grounded findings</p>
        <h3 className="mt-2 text-xl font-semibold text-foreground" id="judge-findings-title">Findings</h3>
        <ol className="mt-5 divide-y divide-lab-border border-y border-lab-border">
          {result.findings.map((finding, index) => (
            <li className="py-4" key={`${index}-${finding.title}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-medium text-foreground">{finding.title}</h4>
                <span className="font-mono text-[0.68rem] uppercase tracking-wide text-lab-subtle">{finding.weight}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-lab-muted">{finding.finding}</p>
              <EvidenceCitations bundle={bundle} ids={finding.evidenceIds} />
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Judge assessment of both sides">
        {(["prosecutor", "defense"] as const).map((role) => {
          const assessment = role === "prosecutor" ? result.prosecutorAssessment : result.defenseAssessment;
          return (
            <article className={`min-w-0 border border-t-2 bg-lab-surface p-6 ${role === "prosecutor" ? "border-lab-border border-t-lab-prosecutor" : "border-lab-border border-t-lab-defense"}`} key={role}>
              <p className={`text-xs font-medium uppercase tracking-[0.14em] ${role === "prosecutor" ? "text-lab-prosecutor" : "text-lab-defense"}`}>{role} assessment</p>
              <h3 className="mt-4 font-semibold text-foreground">Strongest supported point</h3>
              <p className="mt-2 text-sm leading-6 text-lab-muted">{assessment.strongestSupportedPoint}</p>
              <EvidenceCitations bundle={bundle} ids={assessment.evidenceIds} />
              <h3 className="mt-5 border-t border-lab-border pt-5 font-semibold text-foreground">Weakness or overreach</h3>
              <p className="mt-2 text-sm leading-6 text-lab-muted">{assessment.overreachOrWeakness}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {result.primaryFriction && (
          <article className="min-w-0 border border-lab-warning/30 bg-lab-warning/[0.06] p-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-warning">Primary friction</p>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{result.primaryFriction.title}</h3>
            <p className="mt-2 text-sm leading-6 text-lab-muted">{result.primaryFriction.explanation}</p>
            <EvidenceCitations bundle={bundle} ids={result.primaryFriction.evidenceIds} />
          </article>
        )}
        <article className={`min-w-0 border border-lab-success/30 bg-lab-success/[0.06] p-6 ${result.primaryFriction ? "" : "lg:col-span-2"}`}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-success">Recommended product change</p>
          <h3 className="mt-3 text-lg font-semibold text-foreground">{result.recommendation.title}</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-foreground">{result.recommendation.action}</p>
          <p className="mt-2 text-sm leading-6 text-lab-muted">{result.recommendation.rationale}</p>
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
    <section id="report" className="scroll-mt-6 border border-lab-border-strong bg-lab-elevated p-6 sm:p-8" aria-labelledby="final-report-title">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-judge">Evaluation record</p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground" id="final-report-title">Final report</h2>
      <dl className="mt-6 grid gap-px border border-lab-border bg-lab-border sm:grid-cols-2">
        {reportRows.map(([label, value]) => (
          <div className="bg-lab-surface p-4" key={label}>
            <dt className="text-xs text-lab-subtle">{label}</dt>
            <dd className="mt-2 text-sm leading-6 text-lab-muted">{value}</dd>
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
      <div className="border border-lab-border bg-lab-surface p-5 sm:p-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-judge">Adversarial review</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground" id="courtroom-title">Courtroom</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-lab-muted">Both advocates receive the same immutable evidence. The judge compares their cases without retrieving new material.</p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <ArgumentCard bundle={bundle} busyRole={busyRole} controlsDisabled={isJudgeBusy} error={errors.prosecutor} onRun={onRun} record={courtroom.prosecutor} role="prosecutor" />
        <div className="flex items-center justify-center xl:min-h-48" aria-hidden="true">
          <span className="border border-lab-border bg-lab-elevated px-3 py-2 font-mono text-[0.7rem] font-medium tracking-[0.16em] text-lab-subtle">VS</span>
        </div>
        <ArgumentCard bundle={bundle} busyRole={busyRole} controlsDisabled={isJudgeBusy} error={errors.defense} onRun={onRun} record={courtroom.defense} role="defense" />
      </div>

      <div className={`border p-6 text-center ${judgeEligible ? "border-lab-judge/60 bg-lab-judge/[0.06] shadow-[0_1px_2px_rgba(31,35,33,0.05)]" : "border-lab-border bg-lab-surface"}`}>
        <p className="text-sm font-medium text-foreground">{judgeAvailabilityMessage}</p>
        <p className="mt-2 text-xs text-lab-muted">One LLM request · no automatic retry or fallback.</p>
        {judgeError && (
          <div className="mx-auto mt-4 max-w-2xl border-l-2 border-lab-error bg-lab-error/10 p-3 text-left" role="alert">
            <p className="text-sm text-lab-error">{judgeError.message}</p>
            <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-wide text-lab-error">{judgeError.code}</p>
          </div>
        )}
        <button className="mt-4 rounded-md bg-lab-judge px-4 py-2.5 text-sm font-medium text-white hover:bg-[#755934] disabled:opacity-40" disabled={!judgeEligible || busyRole !== null || isJudgeBusy} onClick={onRunJudge} type="button">
          {isJudgeBusy ? (courtroom.judge ? "Regenerating judge…" : "Running judge…") : courtroom.judge ? "Regenerate judge" : "Run judge"}
        </button>
      </div>

      {courtroom.judge && <JudgeResult bundle={bundle} record={courtroom.judge} />}
      {isFinalReportAvailable(courtroom) && <FinalReport actionsUsed={actionsUsed} bundle={bundle} courtroom={courtroom} customerConclusion={customerConclusion} maxActions={maxActions} personaName={personaName} taskQuestion={taskQuestion} />}
    </section>
  );
}
