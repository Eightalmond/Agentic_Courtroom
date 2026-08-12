import Link from "next/link";

import {
  foundationChecks,
  getFoundationProgress,
  workflowSteps,
} from "@/lib/foundation";

export default function Home() {
  const progress = getFoundationProgress(foundationChecks);

  return (
    <main className="min-h-screen bg-lab-bg font-sans text-slate-50">
      <section className="relative overflow-hidden border-b border-lab-border">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_35%_0%,rgba(99,102,241,0.12),transparent_62%)]" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-indigo-300">Trial by User</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            Test how real users understand your product.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-lab-muted sm:text-lg">
            Synthetic customers navigate the experience. Adversarial agents evaluate the evidence.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_30px_rgba(99,102,241,0.18)] hover:bg-indigo-600" href="/tests/new">
              Create a test
            </Link>
            <Link className="rounded-md border border-lab-border bg-lab-surface px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-lab-elevated" href="/product">
              Explore demo product
            </Link>
          </div>
          <div className="mt-12 max-w-3xl border-y border-lab-border py-4" aria-label="Evaluation architecture">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] sm:gap-x-4">
              <li className="text-indigo-300">Customer</li><li className="text-lab-subtle" aria-hidden="true">→</li>
              <li className="text-teal-300">Evidence</li><li className="text-lab-subtle" aria-hidden="true">→</li>
              <li><span className="text-[#f97360]">Debate</span><span className="text-lab-subtle"> / </span><span className="text-sky-300">Challenge</span></li><li className="text-lab-subtle" aria-hidden="true">→</li>
              <li className="text-violet-300">Verdict</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10" aria-labelledby="workflow-title">
        <div className="flex flex-col justify-between gap-4 border-b border-lab-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-300">How it works</p>
            <h2 id="workflow-title" className="mt-3 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">One task. One traceable decision.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-lab-muted">From controlled product context to an evidence-grounded verdict.</p>
        </div>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4">
          {workflowSteps.map((step) => (
            <li className="border-b border-lab-border py-6 sm:odd:pr-6 sm:even:pl-6 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0" key={step.number}>
              <span className="font-mono text-xs text-lab-subtle">{step.number}</span>
              <h3 className="mt-5 text-sm font-semibold text-slate-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-lab-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-lab-border bg-lab-surface" aria-labelledby="how-title">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal-300">Evaluation boundary</p>
              <h2 id="how-title" className="mt-3 text-2xl font-semibold tracking-[-0.025em]">Know what is computed.</h2>
            </div>
            <dl className="grid gap-8 sm:grid-cols-2">
              <div className="border-l-2 border-teal-400 pl-4"><dt className="text-sm font-semibold text-slate-100">Deterministic</dt><dd className="mt-2 text-sm leading-6 text-lab-muted">Retrieval ranking, tool execution, evidence preparation, citations, and action accounting.</dd></div>
              <div className="border-l-2 border-indigo-400 pl-4"><dt className="text-sm font-semibold text-slate-100">Uses an LLM</dt><dd className="mt-2 text-sm leading-6 text-lab-muted">Customer decisions, independent advocate arguments, and the final judge verdict.</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.7fr_1.3fr] lg:px-10" aria-labelledby="boundaries-title">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-lab-subtle">Demo boundaries</p>
          <h2 id="boundaries-title" className="mt-3 text-2xl font-semibold tracking-[-0.025em]">A controlled environment.</h2>
          <p className="mt-4 text-sm leading-6 text-lab-muted">FlowPilot is fictional. The system cannot browse or act on live websites, and runs stay in this browser.</p>
        </div>
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {[
            ["Product surface", "Repository-owned FlowPilot documentation only."],
            ["Retrieval and evidence", "Deterministic and reproducible."],
            ["Model work", "Customer decisions, arguments, and verdict only."],
            ["Persistence", "Local to this browser; no account or database."],
          ].map(([term, description]) => (
            <div className="border-t border-lab-border pt-4" key={term}>
              <dt className="text-sm font-medium text-slate-100">{term}</dt>
              <dd className="mt-2 text-sm leading-6 text-lab-muted">{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-lab-border bg-lab-surface" aria-labelledby="status-title">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-lab-muted">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" /> MVP status
            </p>
            <h2 id="status-title" className="mt-2 text-lg font-semibold">Evaluation loop ready</h2>
            <p className="mt-1 text-sm text-lab-muted">Customer journey, evidence, advocates, judge, and final report are available.</p>
          </div>
          <p className="font-mono text-xs text-lab-subtle">{progress.completed}/{progress.total} checks passing</p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-lab-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p>Trial by User · Evidence before opinion.</p>
        <p>Controlled public demo</p>
      </footer>
    </main>
  );
}
