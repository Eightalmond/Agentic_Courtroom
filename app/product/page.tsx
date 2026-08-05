import type { Metadata } from "next";
import Link from "next/link";

import { flowPilotProduct } from "@/lib/product";

export const metadata: Metadata = {
  title: "FlowPilot knowledge base | Trial by User",
  description: "Browse the controlled fictional FlowPilot product knowledge used by Trial by User.",
};

export default function ProductIndexPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Controlled demo product</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div>
              <h1 className="font-serif text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
                {flowPilotProduct.name}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                {flowPilotProduct.description}
              </p>
            </div>
            <aside className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm leading-6 text-amber-50">
              <p className="font-bold text-amber-200">Fictional product notice</p>
              <p className="mt-1">{flowPilotProduct.disclaimer}</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:px-10" aria-labelledby="knowledge-title">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Product knowledge</p>
          <h2 id="knowledge-title" className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Browse the FlowPilot documentation
          </h2>
          <p className="mt-4 leading-7 text-slate-600">
            These ten pages form a fixed, internally consistent test environment. Some important details are intentionally easier to find on one page than another.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flowPilotProduct.pages.map((page, index) => (
            <li key={page.slug}>
              <Link
                className="group flex h-full min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-lg hover:shadow-slate-900/5"
                href={`/product/${page.slug}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {page.category}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-7 text-xl font-bold tracking-[-0.02em] text-slate-900 group-hover:text-amber-800">
                  {page.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{page.summary}</p>
                <span className="mt-6 text-sm font-bold text-amber-700">Read page <span aria-hidden="true">→</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-12 sm:px-8 lg:grid-cols-[0.4fr_1fr] lg:items-center lg:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Why controlled?</p>
          <p className="max-w-3xl text-lg leading-8 text-slate-700">
            A local, deterministic knowledge base gives future synthetic customers a safe environment with stable facts and no external actions. Customer simulations are not implemented yet.
          </p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-8 lg:px-10">
        <p>FlowPilot is fictional and exists only for testing.</p>
        <Link className="font-semibold text-slate-700 hover:text-amber-700" href="/">Return to Trial by User</Link>
      </footer>
    </main>
  );
}
