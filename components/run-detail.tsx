"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { EvidenceWorkspace } from "@/components/evidence/evidence-workspace";
import { CourtroomWorkspace } from "@/components/courtroom/courtroom-workspace";
import { CourtroomClientError, requestCourtroomArgument, requestJudgeVerdict } from "@/lib/courtroom/client";
import type { CourtroomRole } from "@/lib/courtroom/types";
import { toDisplayError, type DisplayError } from "@/lib/demo/errors";
import { EvidenceClientError, requestEvidenceBundle } from "@/lib/evidence/client";
import { flowPilotProduct, getProductPage } from "@/lib/product";
import { getSectionById, searchProductKnowledge } from "@/lib/retrieval";
import { requestSimulationStep, SimulationClientError } from "@/lib/simulation/client";
import { runSequentially } from "@/lib/simulation/auto-run";
import type { SimulationActionEntry, SimulationObservation } from "@/lib/simulation/types";
import {
  applySimulationFailure,
  applySimulationStep,
  applyCourtroomArgument,
  applyJudgeVerdict,
  applyEvidenceBundle,
  getCustomerPersona,
  getCustomerTask,
  readLocalRun,
  resetSimulationRun,
  saveLocalRun,
  toEvidenceCollectionRequest,
  toCourtroomArgumentRequest,
  toJudgeVerdictRequest,
  toSimulationStepRequest,
  type TestRun,
} from "@/lib/test-runs";

type RunDetailProps = { runId: string; demoMode: boolean };

const emptySubscribe = () => () => undefined;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function observationSummary(observation: SimulationObservation) {
  switch (observation.kind) {
    case "search":
      return observation.results.length ? `${observation.results.length} product sections found.` : "No matching product sections found.";
    case "page":
      return `${observation.pageTitle} opened with ${observation.sections.length} sections.`;
    case "section":
      return `${observation.sectionTitle} inspected on ${observation.pageTitle}.`;
    case "answer":
      return `Final answer submitted with ${observation.confidence} confidence.`;
    case "give_up":
      return observation.reason;
    case "tool_error":
      return observation.message;
  }
}

function ActionTimeline({ actions }: { actions: readonly SimulationActionEntry[] }) {
  if (actions.length === 0) {
    return <p className="rounded-md border border-dashed border-lab-border px-5 py-8 text-center text-sm text-lab-muted">No customer actions yet.</p>;
  }

  return (
    <ol className="border-y border-lab-border">
      {actions.map((action) => (
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] border-b border-lab-border py-5 last:border-b-0" key={action.id}>
          <span className={`pt-0.5 font-mono text-xs ${action.success ? "text-lab-subtle" : "text-amber-400"}`}>
            {String(action.number).padStart(2, "0")}
          </span>
          <article className={`border-l-2 pl-4 ${action.success ? "border-indigo-500/60" : "border-amber-500/70 bg-amber-500/[0.04] py-2 pr-2"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`font-mono text-xs font-medium ${action.success ? "text-indigo-300" : "text-amber-300"}`}>{action.type}</span>
              <time className="font-mono text-[0.7rem] text-lab-subtle">{formatDateTime(action.timestamp)}</time>
            </div>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-100">{action.explanation}</p>
            <p className="mt-1 text-sm leading-6 text-lab-muted">{observationSummary(action.observation)}</p>
            {action.observation.kind === "search" && action.observation.results.length > 0 && (
              <ul className="mt-3 space-y-1 border-l border-lab-border pl-3 text-xs leading-5 text-lab-subtle">
                {action.observation.results.map((result) => <li key={result.sectionId}>{result.pageTitle} · {result.sectionTitle}</li>)}
              </ul>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}

function CurrentContent({ run }: { run: TestRun }) {
  const section = run.currentSectionId ? getSectionById(run.currentSectionId) : undefined;
  const page = getProductPage(section?.pageSlug ?? run.currentPageSlug ?? "");

  if (!page) {
    return <p className="rounded-md border border-dashed border-lab-border px-5 py-8 text-center text-sm text-lab-muted">The customer has not opened product content yet.</p>;
  }

  return (
    <div className="rounded-r-md border-l-2 border-indigo-400 bg-indigo-500/[0.06] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-indigo-300">{section ? "Current section" : "Current page"}</p>
      <h3 className="mt-2 text-base font-semibold text-slate-100">{page.title}{section ? ` / ${section.sectionTitle}` : ""}</h3>
      <p className="mt-3 text-sm leading-6 text-lab-muted">{section?.sectionBody ?? page.summary}</p>
      {section && page.callouts?.map((callout) => (
        <p className="mt-3 border-t border-lab-border pt-3 text-xs leading-5 text-slate-300" key={callout.title}><strong>{callout.title}:</strong> {callout.content}</p>
      ))}
      <Link className="mt-4 inline-block text-sm font-medium text-indigo-300 hover:text-indigo-200" href={`/product/${page.slug}`}>View source page →</Link>
    </div>
  );
}

export function RunDetail({ runId, demoMode }: RunDetailProps) {
  const browserReady = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [revision, setRevision] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [isEvidenceBusy, setIsEvidenceBusy] = useState(false);
  const [busyCourtroomRole, setBusyCourtroomRole] = useState<CourtroomRole | null>(null);
  const [isJudgeBusy, setIsJudgeBusy] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [courtroomErrors, setCourtroomErrors] = useState<Record<CourtroomRole, DisplayError | null>>({ prosecutor: null, defense: null });
  const [judgeError, setJudgeError] = useState<DisplayError | null>(null);
  const inFlight = useRef(false);
  const evidenceInFlight = useRef(false);
  const courtroomInFlight = useRef(false);
  const judgeInFlight = useRef(false);
  const autoRunRequested = useRef(false);
  const runCycle = useRef(0);
  const mounted = useRef(true);
  void revision;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      autoRunRequested.current = false;
      runCycle.current += 1;
    };
  }, []);

  const run = browserReady ? readLocalRun(runId) : undefined;
  const task = run ? getCustomerTask(run.taskId) : undefined;
  const persona = run ? getCustomerPersona(run.personaId) : undefined;

  function persist(nextRun: TestRun) {
    if (!saveLocalRun(nextRun)) {
      setStorageError("This browser could not save the updated run. Check browser storage settings before continuing.");
      return false;
    }
    setStorageError(null);
    setRevision((value) => value + 1);
    return true;
  }

  async function takeOneStep(sourceRun: TestRun, cycle = runCycle.current) {
    if (inFlight.current || sourceRun.evidenceBundle || sourceRun.status === "completed" || sourceRun.currentActionCount >= sourceRun.maxActions) {
      return undefined;
    }

    inFlight.current = true;
    setIsBusy(true);
    try {
      const response = await requestSimulationStep(toSimulationStepRequest(sourceRun));
      if (!mounted.current || cycle !== runCycle.current) return undefined;
      const nextRun = applySimulationStep(sourceRun, response);
      return persist(nextRun) ? nextRun : undefined;
    } catch (error) {
      if (!mounted.current || cycle !== runCycle.current) return undefined;
      const clientError = error instanceof SimulationClientError
        ? error
        : new SimulationClientError({ code: "SIMULATION_FAILED", message: "The step failed safely. Try again.", retryable: true });
      const now = new Date().toISOString();
      const fallbackState = {
        ...sourceRun,
        status: "failed" as const,
        updatedAt: now,
        lastError: clientError.safeError,
      };
      const nextRun = clientError.simulation
        ? applySimulationFailure(sourceRun, clientError.simulation, clientError.safeError)
        : fallbackState;
      persist(nextRun);
      return undefined;
    } finally {
      inFlight.current = false;
      if (mounted.current) setIsBusy(false);
    }
  }

  async function startAutoRun() {
    if (!run || inFlight.current || autoRunRequested.current || run.status === "completed") {
      return;
    }
    const remaining = Math.max(0, run.maxActions - run.currentActionCount);
    if (!window.confirm(`Auto-run may use one LLM request per remaining customer action (up to ${remaining}). Start sequential auto-run?`)) return;
    const cycle = runCycle.current;
    autoRunRequested.current = true;
    setIsAutoRunning(true);
    await runSequentially(run, {
      isActive: () => autoRunRequested.current && cycle === runCycle.current && mounted.current,
      canContinue: (activeRun) => activeRun.status !== "completed" && activeRun.status !== "failed" && activeRun.currentActionCount < activeRun.maxActions,
      takeStep: (activeRun) => takeOneStep(activeRun, cycle),
    });

    autoRunRequested.current = false;
    if (mounted.current) setIsAutoRunning(false);
  }

  function stopAutoRun() {
    autoRunRequested.current = false;
    setIsAutoRunning(false);
  }

  function resetRun() {
    if (!run || evidenceInFlight.current || courtroomInFlight.current || judgeInFlight.current) {
      return;
    }
    autoRunRequested.current = false;
    runCycle.current += 1;
    setIsAutoRunning(false);
    persist(resetSimulationRun(run));
  }

  async function prepareEvidence(sourceRun: TestRun) {
    if (sourceRun.status !== "completed" || evidenceInFlight.current || courtroomInFlight.current || judgeInFlight.current) return;
    if (
      (sourceRun.courtroom.prosecutor || sourceRun.courtroom.defense || sourceRun.courtroom.judge) &&
      !window.confirm("Rebuilding evidence will remove both courtroom arguments and the judge verdict. Continue?")
    ) return;
    evidenceInFlight.current = true;
    setIsEvidenceBusy(true);
    setEvidenceError(null);
    try {
      const bundle = await requestEvidenceBundle(toEvidenceCollectionRequest(sourceRun));
      persist(applyEvidenceBundle(sourceRun, bundle));
    } catch (error) {
      const clientError = error instanceof EvidenceClientError
        ? error
        : new EvidenceClientError({ code: "EVIDENCE_COLLECTION_FAILED", message: "Evidence collection failed safely.", retryable: true });
      setEvidenceError(`${clientError.safeError.code}: ${clientError.safeError.message}`);
    } finally {
      evidenceInFlight.current = false;
      setIsEvidenceBusy(false);
    }
  }

  async function runCourtroomRole(sourceRun: TestRun, role: CourtroomRole) {
    if (!sourceRun.evidenceBundle || courtroomInFlight.current || evidenceInFlight.current || judgeInFlight.current) return;
    if (
      sourceRun.courtroom[role] &&
      !window.confirm(`Regenerate the ${role} argument? A successful result will invalidate the current judge verdict; a failed result will preserve existing records.`)
    ) return;

    courtroomInFlight.current = true;
    setBusyCourtroomRole(role);
    setCourtroomErrors((current) => ({ ...current, [role]: null }));
    try {
      const record = await requestCourtroomArgument(toCourtroomArgumentRequest(sourceRun, role));
      persist(applyCourtroomArgument(sourceRun, record));
    } catch (error) {
      const message = error instanceof CourtroomClientError
        ? toDisplayError(error.detail)
        : { code: "COURTROOM_FAILED", message: "The advocate failed safely. Try again." };
      setCourtroomErrors((current) => ({ ...current, [role]: message }));
    } finally {
      courtroomInFlight.current = false;
      setBusyCourtroomRole(null);
    }
  }

  async function runJudge(sourceRun: TestRun) {
    if (!sourceRun.evidenceBundle || !sourceRun.courtroom.prosecutor || !sourceRun.courtroom.defense || courtroomInFlight.current || evidenceInFlight.current || judgeInFlight.current) return;
    if (
      sourceRun.courtroom.judge &&
      !window.confirm("Regenerate the judge verdict? The existing verdict will remain visible unless replacement succeeds.")
    ) return;

    judgeInFlight.current = true;
    setIsJudgeBusy(true);
    setJudgeError(null);
    try {
      const record = await requestJudgeVerdict(toJudgeVerdictRequest(sourceRun));
      persist(applyJudgeVerdict(sourceRun, record));
    } catch (error) {
      const message = error instanceof CourtroomClientError
        ? toDisplayError(error.detail)
        : { code: "JUDGE_FAILED", message: "The judge failed safely. Try again." };
      setJudgeError(message);
    } finally {
      judgeInFlight.current = false;
      setIsJudgeBusy(false);
    }
  }

  if (!browserReady) {
    return (
      <main className="grid min-h-[calc(100vh-73px)] place-items-center bg-lab-bg px-6 py-20" aria-live="polite">
        <div className="w-full max-w-lg rounded-lg border border-lab-border bg-lab-surface p-8 text-center">
          <span className="mx-auto block size-2 animate-pulse rounded-full bg-indigo-400 shadow-[0_0_16px_rgba(99,102,241,0.5)] motion-reduce:animate-none" />
          <h1 className="mt-5 text-xl font-semibold text-slate-100">Loading local run…</h1>
          <p className="mt-2 text-sm text-lab-muted">Checking this browser for the saved configuration.</p>
        </div>
      </main>
    );
  }

  if (!run || !task || !persona) {
    return (
      <main className="grid min-h-[calc(100vh-73px)] place-items-center bg-lab-bg px-6 py-20 text-slate-50">
        <div className="max-w-xl rounded-lg border border-lab-border bg-lab-surface p-8 text-center sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-300">Local run</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em]">Run not found</h1>
          <p className="mt-5 leading-7 text-lab-muted">Test runs are stored only in the browser where they were created. This run may belong to another browser, or its browser data may have been cleared.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white" href="/tests/new">Create a new test</Link>
            <Link className="rounded-md border border-lab-border bg-lab-elevated px-4 py-2.5 text-sm font-medium text-slate-300" href="/">Return home</Link>
          </div>
        </div>
      </main>
    );
  }

  const retrievalSuggestions = searchProductKnowledge(task.question, { limit: 3 });
  const usedPercent = Math.round((run.currentActionCount / run.maxActions) * 100);
  const isComplete = run.status === "completed";

  return (
    <main className="min-h-screen bg-lab-bg font-sans text-slate-50">
      <header className="border-b border-lab-border bg-lab-surface">
        <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8 sm:pt-10 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-indigo-300">Evaluation run</p>
            <p className={`flex items-center gap-2 text-xs font-medium capitalize ${run.status === "failed" ? "text-red-400" : run.status === "completed" ? "text-emerald-400" : "text-indigo-300"}`}>
              <span className={`size-1.5 rounded-full ${run.status === "failed" ? "bg-red-500" : run.status === "completed" ? "bg-emerald-500" : "bg-neutral-400"}`} aria-hidden="true" />
              {run.status}
            </p>
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{task.title}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-lab-muted">“{task.question}”</p>
          <dl className="mt-7 grid gap-4 border-t border-lab-border py-5 text-xs sm:grid-cols-5">
            <div><dt className="text-lab-subtle">Product</dt><dd className="mt-1 font-medium text-slate-200">{flowPilotProduct.name}</dd></div>
            <div><dt className="text-lab-subtle">Persona</dt><dd className="mt-1 font-medium text-slate-200">{persona.name}</dd></div>
            <div><dt className="text-lab-subtle">Actions</dt><dd className="mt-1 font-mono text-slate-200">{run.currentActionCount} / {run.maxActions}</dd></div>
            <div><dt className="text-lab-subtle">Provider attempts</dt><dd className="mt-1 font-mono text-slate-200">{run.modelCallCount}</dd></div>
            <div><dt className="text-lab-subtle">Run</dt><dd className="mt-1 break-all font-mono text-slate-400">{run.id}</dd></div>
          </dl>
          <nav className="-mx-5 overflow-x-auto border-t border-lab-border px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10" aria-label="Run sections">
            <ul className="flex min-w-max gap-6 text-sm text-lab-muted">
              {["Journey", "Evidence", "Courtroom", "Report"].map((label) => (
                <li key={label}><a className="block border-b-2 border-transparent py-3 hover:border-indigo-400 hover:text-slate-50" href={`#${label.toLowerCase()}`}>{label}</a></li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:px-10">
        <div className="min-w-0 space-y-8">
          <section id="journey" className="scroll-mt-6 rounded-lg border border-lab-border bg-lab-surface p-5 shadow-[0_16px_60px_rgba(0,0,0,0.1)] sm:p-7" aria-labelledby="journey-title">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-indigo-300">Synthetic customer</p>
                <h2 id="journey-title" className="mt-2 text-xl font-semibold tracking-[-0.02em]">Journey</h2>
              </div>
              <dl className="flex gap-6 text-right text-xs">
                <div><dt className="text-lab-subtle">Successful actions</dt><dd className="mt-1 font-mono text-slate-200">{run.currentActionCount}/{run.maxActions}</dd></div>
                <div><dt className="text-lab-subtle">Request attempts</dt><dd className="mt-1 font-mono text-slate-200">{run.modelCallCount}</dd></div>
              </dl>
            </div>
            <div className="mt-5 h-px bg-lab-border" aria-label={`${usedPercent}% of customer action budget used`} role="progressbar" aria-valuemin={0} aria-valuemax={run.maxActions} aria-valuenow={run.currentActionCount}>
              <div className="h-px bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.6)]" style={{ width: `${usedPercent}%` }} />
            </div>

            {isComplete && (
              <div className="mt-6 border-l-2 border-emerald-400 bg-emerald-400/[0.06] p-4" aria-labelledby="outcome-title">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-300">Customer outcome · not a verdict</p>
                <h3 id="outcome-title" className="mt-2 text-base font-semibold">
                  {run.completionReason === "answer" ? "Customer reached an answer" : run.completionReason === "gave_up" ? "Customer gave up" : "Action budget exhausted"}
                </h3>
                {run.finalAnswer && <p className="mt-3 text-sm leading-6 text-slate-200">{run.finalAnswer}</p>}
                {run.finalConfidence && <p className="mt-2 text-xs font-medium capitalize text-emerald-300">Confidence: {run.finalConfidence}</p>}
                {run.giveUpReason && <p className="mt-3 text-sm leading-6 text-lab-muted">{run.giveUpReason}</p>}
                {run.completionReason === "budget_exhausted" && <p className="mt-3 text-sm leading-6 text-lab-muted">The customer did not answer or give up before the configured limit. No answer was fabricated.</p>}
              </div>
            )}

            <div className="mt-6"><ActionTimeline actions={run.actions} /></div>

            <div className="mt-8 border-t border-lab-border pt-6" aria-labelledby="content-title">
              <div className="flex items-baseline justify-between gap-4">
                <h3 id="content-title" className="text-sm font-semibold">Current product content</h3>
                <span className="font-mono text-[0.7rem] text-lab-subtle">Deterministic tool</span>
              </div>
              <div className="mt-4"><CurrentContent run={run} /></div>
            </div>

            {run.actions.length === 0 && (
              <div className="mt-8 border-t border-lab-border pt-6" aria-labelledby="sources-title">
                <p className="font-mono text-[0.7rem] text-lab-subtle">Preview · not customer actions</p>
                <h3 id="sources-title" className="mt-2 text-sm font-semibold">Retrieval suggestions</h3>
                <ol className="mt-4 divide-y divide-lab-border border-y border-lab-border">
                  {retrievalSuggestions.map((result) => (
                    <li className="py-4" key={result.sectionId}>
                      <p className="font-mono text-[0.7rem] text-indigo-300">Rank {result.rank}</p>
                      <p className="mt-1 text-sm font-medium">{result.pageTitle} · {result.sectionTitle}</p>
                      <p className="mt-2 text-sm leading-6 text-lab-muted">{result.excerpt}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <section id="evidence" className="scroll-mt-6" aria-label="Evidence">
            {isComplete && !run.evidenceBundle && (
              <div className="rounded-lg border border-lab-border bg-lab-surface p-5 sm:p-7" aria-labelledby="prepare-evidence-title">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-300">Evidence</p>
                <h2 id="prepare-evidence-title" className="mt-2 text-xl font-semibold tracking-[-0.02em]">Prepare the journey for review</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-lab-muted">Collect customer-seen sources, bounded context, missing evidence, and mechanical checks. This is deterministic and uses no LLM request.</p>
                {evidenceError && <p className="mt-4 border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200" role="alert">{evidenceError}</p>}
                <button className="mt-5 rounded-md bg-teal-500 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={isEvidenceBusy} onClick={() => void prepareEvidence(run)} type="button">
                  {isEvidenceBusy ? "Preparing evidence…" : "Prepare evidence"}
                </button>
              </div>
            )}
            {!isComplete && <div className="border-l-2 border-teal-400/50 bg-lab-surface p-5 text-sm text-lab-muted sm:p-7"><span className="font-medium text-teal-300">Evidence</span> becomes available when the customer journey is complete.</div>}
            {run.evidenceBundle && <EvidenceWorkspace bundle={run.evidenceBundle} isRebuilding={isEvidenceBusy} onRebuild={() => void prepareEvidence(run)} />}
          </section>

          <section id="courtroom" className="scroll-mt-6" aria-label="Courtroom">
            {run.evidenceBundle ? (
              <CourtroomWorkspace
                bundle={run.evidenceBundle}
                busyRole={busyCourtroomRole}
                courtroom={run.courtroom}
                isJudgeBusy={isJudgeBusy}
                judgeError={judgeError}
                errors={courtroomErrors}
                onRun={(role) => void runCourtroomRole(run, role)}
                onRunJudge={() => void runJudge(run)}
                taskQuestion={task.question}
                personaName={persona.name}
                customerConclusion={run.finalAnswer ?? run.giveUpReason ?? "No final answer was provided."}
                actionsUsed={run.currentActionCount}
                maxActions={run.maxActions}
              />
            ) : (
              <div className="border-l-2 border-violet-400/50 bg-lab-surface p-5 text-sm text-lab-muted sm:p-7"><span className="font-medium text-violet-300">Courtroom</span> becomes available after evidence is prepared.</div>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-lab-border bg-lab-elevated p-5 shadow-[0_18px_60px_rgba(0,0,0,0.14)] lg:sticky lg:top-6" aria-labelledby="controls-heading">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-indigo-300">Run context</p>
          <h2 id="controls-heading" className="mt-2 text-lg font-semibold">{persona.name}</h2>
          <p className="mt-2 text-sm leading-6 text-lab-muted">{persona.description}</p>
          {demoMode && <p className="mt-3 font-mono text-[0.7rem] leading-5 text-lab-subtle">Controlled demo · bounded provider usage</p>}

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-lab-border py-4 text-xs">
            <div><dt className="text-lab-subtle">Actions</dt><dd className="mt-1 font-mono text-slate-200">{run.currentActionCount} / {run.maxActions}</dd></div>
            <div><dt className="text-lab-subtle">Attempts</dt><dd className="mt-1 font-mono text-slate-200">{run.modelCallCount}</dd></div>
            <div><dt className="text-lab-subtle">Status</dt><dd className="mt-1 capitalize text-slate-200">{run.status}</dd></div>
            <div><dt className="text-lab-subtle">Persistence</dt><dd className="mt-1 text-slate-200">This browser</dd></div>
          </dl>

          {(run.lastError || storageError || evidenceError) && (
            <div className="mt-5 border-l-2 border-red-400 bg-red-500/[0.08] p-4" role="alert">
              <p className="text-sm leading-6 text-red-200">{storageError ?? evidenceError ?? (run.lastError ? toDisplayError(run.lastError).message : undefined)}</p>
              {run.lastError?.retryAfterSeconds && <p className="mt-2 text-xs font-medium text-red-300">Retry in approximately {run.lastError.retryAfterSeconds} seconds.</p>}
              <p className="mt-2 font-mono text-[0.7rem] text-red-400">{run.lastError?.code ?? "LOCAL_STORAGE_FAILURE"}</p>
            </div>
          )}

          {!isComplete && (
            <div className="mt-5 space-y-3">
              <button className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50" type="button" disabled={isBusy || isAutoRunning} onClick={() => void takeOneStep(run)}>
                {isBusy ? "Taking one step…" : run.status === "ready" ? "Start simulation" : run.status === "failed" ? "Retry failed step" : "Take next step"}
              </button>
              <p className="text-center font-mono text-[0.7rem] text-lab-subtle">1 LLM request</p>
              {!isAutoRunning ? (
                <button className="w-full rounded-md border border-lab-border bg-lab-surface px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-50" type="button" disabled={isBusy || run.status === "failed"} onClick={() => void startAutoRun()}>Auto-run sequentially</button>
              ) : (
                <button className="w-full rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300" type="button" onClick={stopAutoRun}>Stop after current step</button>
              )}
              <p className="text-xs leading-5 text-lab-muted">{Math.max(0, run.maxActions - run.currentActionCount)} successful actions remain. Auto-run stays sequential and may use one request per action.</p>
            </div>
          )}

          <div className="mt-5 space-y-1 border-t border-lab-border pt-4">
            <button className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-lab-muted hover:bg-red-500/[0.07] hover:text-red-300 disabled:opacity-50" type="button" disabled={isEvidenceBusy || isJudgeBusy || busyCourtroomRole !== null || (run.actions.length === 0 && !run.lastError)} onClick={resetRun}>Reset simulation</button>
            <Link className="block rounded-md px-3 py-2 text-sm font-medium text-lab-muted hover:bg-lab-surface hover:text-slate-100" href="/tests/new">Configure another test</Link>
          </div>

          <p className="mt-5 border-t border-lab-border pt-4 text-xs leading-5 text-lab-subtle">Created {formatDateTime(run.createdAt)}. Failed provider attempts stop the run without consuming a customer action.</p>
        </aside>
      </div>
    </main>
  );
}
