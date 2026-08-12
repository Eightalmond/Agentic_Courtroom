import Link from "next/link";

import {
  foundationChecks,
  getFoundationProgress,
  workflowSteps,
} from "@/lib/foundation";
import { readDemoConfiguration } from "@/lib/demo/environment";

export default function Home() {
  const progress = getFoundationProgress(foundationChecks);
  const { demoMode } = readDemoConfiguration();

  return (
    <main className="min-h-screen bg-[#f7f7f5] font-sans text-neutral-950">
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-32">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
            {demoMode ? "Controlled product evaluation" : "Agentic product evaluation"}
          </p>
          <h1 className="mt-6 max-w-5xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Synthetic customers test your product. Adversarial agents judge the experience.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg">
            Run a focused customer task, preserve the evidence, and turn opposing assessments into a cited product recommendation.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800" href="/tests/new">
              Create a test
            </Link>
            <Link className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50" href="/product">
              Explore demo product
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10" aria-labelledby="workflow-title">
        <div className="flex flex-col justify-between gap-4 border-b border-neutral-300 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Workflow</p>
            <h2 id="workflow-title" className="mt-3 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">One task. One traceable decision.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-neutral-600">From controlled product context to an evidence-grounded verdict.</p>
        </div>
        <ol className="grid border-b border-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
          {workflowSteps.map((step) => (
            <li className="border-neutral-200 py-6 sm:odd:border-r sm:odd:pr-6 sm:even:pl-6 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0" key={step.number}>
              <span className="font-mono text-xs text-neutral-400">{step.number}</span>
              <h3 className="mt-5 text-sm font-semibold text-neutral-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-neutral-200 bg-white" aria-labelledby="how-title">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">How it works</p>
            <h2 id="how-title" className="mt-3 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">Evaluation, not spectacle.</h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden border border-neutral-200 bg-neutral-200 lg:grid-cols-3">
            {[
              ["Observe", "A synthetic customer searches and reads only the controlled product knowledge needed for one narrow task."],
              ["Contest", "Prosecutor and defense independently interpret the same immutable, source-traceable evidence."],
              ["Decide", "A neutral judge weighs both cases and returns a cited verdict, friction point, and recommended change."],
            ].map(([title, description], index) => (
              <article className="bg-white p-6 sm:p-8" key={title}>
                <p className="font-mono text-xs text-neutral-400">0{index + 1}</p>
                <h3 className="mt-8 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.7fr_1.3fr] lg:px-10" aria-labelledby="boundaries-title">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Demo boundaries</p>
          <h2 id="boundaries-title" className="mt-3 text-2xl font-semibold tracking-[-0.025em]">A controlled environment.</h2>
          <p className="mt-4 text-sm leading-6 text-neutral-600">FlowPilot is fictional. The system cannot browse or act on live websites, and runs stay in this browser.</p>
        </div>
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {[
            ["Product surface", "Repository-owned FlowPilot documentation only."],
            ["Retrieval and evidence", "Deterministic and reproducible."],
            ["Model work", "Customer decisions, arguments, and verdict only."],
            ["Persistence", "Local to this browser; no account or database."],
          ].map(([term, description]) => (
            <div className="border-t border-neutral-300 pt-4" key={term}>
              <dt className="text-sm font-medium text-neutral-950">{term}</dt>
              <dd className="mt-2 text-sm leading-6 text-neutral-600">{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-neutral-200 bg-white" aria-labelledby="status-title">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> MVP status
            </p>
            <h2 id="status-title" className="mt-2 text-lg font-semibold">Evaluation loop ready</h2>
            <p className="mt-1 text-sm text-neutral-600">Customer journey, evidence, advocates, judge, and final report are available.</p>
          </div>
          <p className="font-mono text-xs text-neutral-500">{progress.completed}/{progress.total} checks passing</p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p>Trial by User · Evidence before opinion.</p>
        <p>Controlled public demo</p>
      </footer>
    </main>
  );
}
