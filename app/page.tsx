import Link from "next/link";

import {
  foundationChecks,
  futureCapabilities,
  getFoundationProgress,
  workflowSteps,
} from "@/lib/foundation";

export default function Home() {
  const progress = getFoundationProgress(foundationChecks);

  return (
    <main className="min-h-screen overflow-hidden bg-stone-50 text-slate-950">
      <section className="relative isolate border-b border-slate-200/80 bg-slate-950 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-80 [background-image:radial-gradient(circle_at_15%_20%,rgba(244,180,74,0.16),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(56,189,248,0.10),transparent_25%)]"
        />
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-20 sm:px-8 sm:pb-24 lg:px-10 lg:pt-28">
          <div id="top" className="grid gap-14 pb-2 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                <span className="h-px w-7 bg-amber-300" />
                Agentic product testing
              </p>
              <h1 className="max-w-4xl font-serif text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                Put the product experience on trial.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Synthetic customers test your product. AI agents argue whether the experience worked.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_40px_rgba(244,180,74,0.16)] transition-colors hover:bg-amber-200"
                  href="/tests/new"
                >
                  Create a test
                </Link>
                <Link
                  className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:border-white/35 hover:bg-white/10"
                  href="/product"
                >
                  Browse FlowPilot demo
                </Link>
                <Link
                  className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:border-white/35 hover:bg-white/10"
                  href="/retrieval"
                >
                  Test retrieval
                </Link>
                <span id="create-test-note" className="w-full text-sm text-slate-400">
                  Synthetic customer, evidence preparation, and independent courtroom advocates are available now.
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-7">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Available now · Phase 7</p>
                  <p className="mt-2 font-semibold text-slate-100">Put prepared evidence before both advocates</p>
                </div>
                <span className="size-2.5 shrink-0 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(253,230,138,0.8)]" />
              </div>
              <ol className="mt-5 space-y-4" aria-label="Available synthetic customer features">
                {["One call per independent advocate", "Same immutable evidence bundle", "Source-cited opposing arguments"].map(
                  (stage, index) => (
                    <li className="flex items-center gap-4" key={stage}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/8 font-mono text-xs text-amber-200">
                        0{index + 1}
                      </span>
                      <span className="text-sm text-slate-300">{stage}</span>
                    </li>
                  ),
                )}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-24 lg:px-10" aria-labelledby="workflow-title">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">How it will work</p>
            <h2 id="workflow-title" className="mt-4 max-w-md font-serif text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              A rigorous journey from product context to verdict.
            </h2>
            <p className="mt-5 max-w-md leading-7 text-slate-600">
              Trial by User will turn product knowledge into a focused customer simulation, preserve what happened, and let opposing agents make an evidence-grounded case.
            </p>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2">
            {workflowSteps.map((step) => (
              <li
                key={step.number}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold tracking-[0.12em] text-amber-700">STEP {step.number}</span>
                  <span className="h-px w-8 bg-slate-200 transition-all duration-300 group-hover:w-12 group-hover:bg-amber-400" />
                </div>
                <h3 className="mt-8 text-lg font-bold tracking-[-0.01em] text-slate-900">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white" aria-labelledby="status-title">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:px-8 lg:grid-cols-[0.65fr_1.35fr] lg:items-center lg:px-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">MVP status · Phase 7</p>
            </div>
            <h2 id="status-title" className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em]">Opposing courtroom arguments ready</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A customer can inspect controlled FlowPilot knowledge, prepare a deterministic evidence bundle, and run prosecutor or defense in either order. Judge and final verdict generation remain unavailable.
            </p>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm font-semibold text-slate-700">Available now</p>
              <p className="font-mono text-sm text-slate-500">
                {progress.completed}/{progress.total} complete
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${progress.percentage}% of foundation checks complete`}>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percentage}%` }} />
            </div>
            <ul className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              {foundationChecks.map((check) => (
                <li className="flex items-center gap-2" key={check.label}>
                  <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">✓</span>
                  {check.label}
                </li>
              ))}
            </ul>
            <div className="mt-7 border-t border-slate-200 pt-5">
              <p className="text-sm font-semibold text-slate-700">Coming later</p>
              <ul className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                {futureCapabilities.map((capability) => (
                  <li className="flex items-center gap-2" key={capability}>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-slate-300" />
                    {capability}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p>Trial by User · Evidence before opinion.</p>
        <p>Phase 7 · Independent advocates available · Judge next</p>
      </footer>
    </main>
  );
}
