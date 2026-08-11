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
    return <p className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">No customer actions yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {actions.map((action) => (
        <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3" key={action.id}>
          <span className={`grid size-9 place-items-center rounded-full font-mono text-xs font-bold ${action.success ? "bg-slate-950 text-amber-300" : "bg-red-100 text-red-700"}`}>
            {action.number}
          </span>
          <article className={`rounded-2xl border bg-white p-5 ${action.success ? "border-slate-200" : "border-red-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">{action.type}</span>
              <time className="text-xs text-slate-400">{formatDateTime(action.timestamp)}</time>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{action.explanation}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{observationSummary(action.observation)}</p>
            {action.observation.kind === "search" && action.observation.results.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
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
    return <p className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">The customer has not opened product content yet.</p>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">{section ? "Current section" : "Current page"}</p>
      <h3 className="mt-2 text-lg font-bold text-slate-950">{page.title}{section ? ` / ${section.sectionTitle}` : ""}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{section?.sectionBody ?? page.summary}</p>
      {section && page.callouts?.map((callout) => (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" key={callout.title}><strong>{callout.title}:</strong> {callout.content}</p>
      ))}
      <Link className="mt-4 inline-block text-sm font-bold text-amber-800 hover:text-amber-950" href={`/product/${page.slug}`}>View source page →</Link>
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
      <main className="grid min-h-[calc(100vh-73px)] place-items-center bg-stone-50 px-6 py-20" aria-live="polite">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <span className="mx-auto block size-3 animate-pulse rounded-full bg-amber-400 motion-reduce:animate-none" />
          <h1 className="mt-5 text-xl font-bold text-slate-900">Loading local run…</h1>
          <p className="mt-2 text-sm text-slate-500">Checking this browser for the saved configuration.</p>
        </div>
      </main>
    );
  }

  if (!run || !task || !persona) {
    return (
      <main className="grid min-h-[calc(100vh-73px)] place-items-center bg-stone-50 px-6 py-20 text-slate-950">
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg shadow-slate-900/5 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Local run</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.035em]">Run not found</h1>
          <p className="mt-5 leading-7 text-slate-600">Test runs are stored only in the browser where they were created. This run may belong to another browser, or its browser data may have been cleared.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white" href="/tests/new">Create a new test</Link>
            <Link className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700" href="/">Return home</Link>
          </div>
        </div>
      </main>
    );
  }

  const retrievalSuggestions = searchProductKnowledge(task.question, { limit: 3 });
  const usedPercent = Math.round((run.currentActionCount / run.maxActions) * 100);
  const isComplete = run.status === "completed";

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="break-all font-mono text-xs text-slate-400">{run.id}</p>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${run.status === "failed" ? "border-red-300/30 bg-red-300/10 text-red-200" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"}`}>{run.status}</span>
          </div>
          <h1 className="mt-6 max-w-3xl font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{task.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">“{task.question}”</p>
          {demoMode && <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Public demo · provider-backed actions use limited external requests</p>}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-10">
        <div className="min-w-0 space-y-8">
          {isComplete && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8" aria-labelledby="outcome-title">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Customer outcome · No verdict</p>
              <h2 id="outcome-title" className="mt-3 text-2xl font-bold text-slate-950">
                {run.completionReason === "answer" ? "The customer reached an answer" : run.completionReason === "gave_up" ? "The customer gave up" : "Action budget exhausted"}
              </h2>
              {run.finalAnswer && <p className="mt-4 text-lg leading-8 text-slate-800">{run.finalAnswer}</p>}
              {run.finalConfidence && <p className="mt-3 text-sm font-bold capitalize text-emerald-900">Confidence: {run.finalConfidence}</p>}
              {run.giveUpReason && <p className="mt-4 leading-7 text-slate-700">{run.giveUpReason}</p>}
              {run.completionReason === "budget_exhausted" && <p className="mt-4 leading-7 text-slate-700">The customer did not answer or give up before the configured limit. No answer was fabricated.</p>}
            </section>
          )}

          {isComplete && !run.evidenceBundle && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8" aria-labelledby="prepare-evidence-title">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">Deterministic evidence preparation</p>
              <h2 id="prepare-evidence-title" className="mt-3 text-2xl font-bold text-slate-950">Prepare the customer journey for review</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">Collect customer-seen sources, bounded context, missing required evidence, and mechanical fact checks. This makes no courtroom judgment and uses no LLM call.</p>
              {evidenceError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{evidenceError}</p>}
              <button className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={isEvidenceBusy} onClick={() => void prepareEvidence(run)} type="button">
                {isEvidenceBusy ? "Preparing evidence…" : "Prepare evidence"}
              </button>
            </section>
          )}

          {run.evidenceBundle && (
            <EvidenceWorkspace bundle={run.evidenceBundle} isRebuilding={isEvidenceBusy} onRebuild={() => void prepareEvidence(run)} />
          )}

          {run.evidenceBundle && (
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
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="journey-title">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Synthetic customer</p>
                <h2 id="journey-title" className="mt-2 text-2xl font-bold">Customer journey</h2>
              </div>
              <p className="text-sm font-semibold text-slate-500">{run.currentActionCount}/{run.maxActions} customer actions · {run.modelCallCount} provider requests attempted</p>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${usedPercent}% of customer action budget used`} role="progressbar" aria-valuemin={0} aria-valuemax={run.maxActions} aria-valuenow={run.currentActionCount}>
              <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${usedPercent}%` }} />
            </div>
            <div className="mt-7"><ActionTimeline actions={run.actions} /></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="content-title">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Deterministic product tool</p>
            <h2 id="content-title" className="mt-2 text-2xl font-bold">Current content</h2>
            <div className="mt-6"><CurrentContent run={run} /></div>
          </section>

          {run.actions.length === 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="sources-title">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Preview · Not customer actions</p>
              <h2 id="sources-title" className="mt-2 text-2xl font-bold">Retrieval suggestions</h2>
              <ol className="mt-5 space-y-3">
                {retrievalSuggestions.map((result) => (
                  <li className="rounded-xl border border-slate-200 p-4" key={result.sectionId}>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Rank {result.rank}</p>
                    <p className="mt-1 font-bold">{result.pageTitle} · {result.sectionTitle}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{result.excerpt}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 lg:sticky lg:top-6" aria-labelledby="controls-heading">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Run controls</p>
          <h2 id="controls-heading" className="mt-2 text-xl font-bold">{persona.name}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{persona.description}</p>

          {(run.lastError || storageError || evidenceError) && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
              <p className="text-sm leading-6 text-red-900">{storageError ?? evidenceError ?? (run.lastError ? toDisplayError(run.lastError).message : undefined)}</p>
              {run.lastError?.retryAfterSeconds && <p className="mt-2 text-xs font-semibold text-red-800">Retry in approximately {run.lastError.retryAfterSeconds} seconds.</p>}
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-red-700">{run.lastError?.code ?? "LOCAL_STORAGE_FAILURE"}</p>
            </div>
          )}

          {!isComplete && (
            <div className="mt-6 space-y-3">
              <button className="w-full rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={isBusy || isAutoRunning} onClick={() => void takeOneStep(run)}>
                {isBusy ? "Taking one step…" : run.status === "ready" ? "Start simulation" : run.status === "failed" ? "Retry failed step" : "Take next step"}
              </button>
              {!isAutoRunning ? (
                <button className="w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50" type="button" disabled={isBusy || run.status === "failed"} onClick={() => void startAutoRun()}>Auto-run sequentially</button>
              ) : (
                <button className="w-full rounded-xl border border-red-300 px-5 py-3 text-sm font-bold text-red-700" type="button" onClick={stopAutoRun}>Stop after current step</button>
              )}
              <p className="text-xs leading-5 text-slate-500">One successful customer step uses 1 LLM request. {Math.max(0, run.maxActions - run.currentActionCount)} customer actions remain.</p>
              <p className="text-xs leading-5 text-slate-500">Auto-run stays sequential and may use one LLM request per remaining action.</p>
            </div>
          )}

          <button className="mt-3 w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 disabled:opacity-50" type="button" disabled={isEvidenceBusy || isJudgeBusy || busyCourtroomRole !== null || (run.actions.length === 0 && !run.lastError)} onClick={resetRun}>Reset simulation</button>
          <Link className="mt-3 block rounded-xl border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-700" href="/tests/new">Configure another test</Link>

          <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Product</dt><dd className="font-bold text-slate-700">{flowPilotProduct.name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Created</dt><dd className="text-right font-bold text-slate-700">{formatDateTime(run.createdAt)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Persistence</dt><dd className="font-bold text-slate-700">This browser</dd></div>
          </dl>
          <p className="mt-5 text-xs leading-5 text-slate-400">Provider requests are attempted sequentially. Failed attempts stop the run without consuming a customer action.</p>
        </aside>
      </div>
    </main>
  );
}
