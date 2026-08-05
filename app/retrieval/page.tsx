import type { Metadata } from "next";

import { RetrievalPlayground } from "@/components/retrieval-playground";

export const metadata: Metadata = {
  title: "Retrieval playground | Trial by User",
  description: "Inspect deterministic section-level retrieval over the fictional FlowPilot knowledge base.",
};

export default function RetrievalPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-14 sm:px-8 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Available now · Phase 4</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Retrieval playground</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Search the controlled FlowPilot knowledge base and inspect why individual sections rank. The engine uses local lexical rules—no AI, embeddings, or external service.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8 sm:py-16">
        <RetrievalPlayground />
      </div>
    </main>
  );
}
