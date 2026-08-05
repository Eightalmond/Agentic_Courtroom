"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { flowPilotProduct, getProductPage } from "@/lib/product";
import { getCustomerPersona, getCustomerTask, readLocalRun } from "@/lib/test-runs";

type RunDetailProps = {
  runId: string;
};

const emptySubscribe = () => () => undefined;

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RunDetail({ runId }: RunDetailProps) {
  const browserReady = useSyncExternalStore(emptySubscribe, () => true, () => false);

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

  const run = readLocalRun(runId);
  const task = run ? getCustomerTask(run.taskId) : undefined;
  const persona = run ? getCustomerPersona(run.personaId) : undefined;

  if (!run || !task || !persona) {
    return (
      <main className="grid min-h-[calc(100vh-73px)] place-items-center bg-stone-50 px-6 py-20 text-slate-950">
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg shadow-slate-900/5 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Local run</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.035em]">Run not found</h1>
          <p className="mt-5 leading-7 text-slate-600">
            Test runs are stored only in the browser where they were created. This run may belong to another browser, or its browser data may have been cleared.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800" href="/tests/new">Create a new test</Link>
            <Link className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:border-amber-300 hover:text-amber-800" href="/">Return home</Link>
          </div>
        </div>
      </main>
    );
  }

  const relevantPages = task.expectedRelevantPageSlugs.map((slug) => getProductPage(slug)).filter(Boolean);

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-mono text-xs text-slate-400">{run.id}</p>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
              {run.status}
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{task.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">“{task.question}”</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_19rem] lg:px-10">
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="configuration-title">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Ready configuration</p>
            <h2 id="configuration-title" className="mt-3 text-2xl font-bold tracking-[-0.02em]">Test details</h2>
            <dl className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Product</dt>
                <dd className="mt-1 font-semibold text-slate-900">{flowPilotProduct.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Created</dt>
                <dd className="mt-1 font-semibold text-slate-900">{formatCreatedAt(run.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Maximum actions</dt>
                <dd className="mt-1 font-semibold text-slate-900">{run.maxActions}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Current action count</dt>
                <dd className="mt-1 font-semibold text-slate-900">{run.currentActionCount}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="persona-title">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-950 font-mono text-xs font-bold text-amber-300">{persona.visualLabel}</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer persona</p>
                <h2 id="persona-title" className="mt-1 text-2xl font-bold tracking-[-0.02em]">{persona.name}</h2>
              </div>
            </div>
            <p className="mt-5 leading-7 text-slate-600">{persona.description}</p>
            <ul className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              {persona.traits.map((trait) => (
                <li className="flex gap-2" key={trait}><span aria-hidden="true" className="text-amber-600">•</span>{trait}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="sources-title">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Manual exploration</p>
            <h2 id="sources-title" className="mt-3 text-2xl font-bold tracking-[-0.02em]">Relevant product knowledge</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">These pages are useful starting points for exploring the customer question. No answer has been generated.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {relevantPages.map((page) => page && (
                <li key={page.slug}>
                  <Link className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-amber-300 hover:text-amber-800" href={`/product/${page.slug}`}>
                    {page.title} <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-6" aria-labelledby="simulation-heading">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Next phase</p>
          <h2 id="simulation-heading" className="mt-2 text-xl font-bold">Simulation</h2>
          <p id="simulation-note" className="mt-3 text-sm leading-6 text-slate-600">
            This run is configured and ready. Synthetic customer actions will be added in Phase 5.
          </p>
          <button
            type="button"
            disabled
            aria-describedby="simulation-note"
            className="mt-6 w-full cursor-not-allowed rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
          >
            Start simulation · Coming in Phase 5
          </button>
          <Link className="mt-4 block rounded-xl border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-700 hover:border-amber-300 hover:text-amber-800" href="/tests/new">
            Configure another test
          </Link>
          <p className="mt-5 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-400">
            This run exists only in the current browser and is not synced to a server.
          </p>
        </aside>
      </div>
    </main>
  );
}
