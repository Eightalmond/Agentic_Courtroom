import type { Metadata } from "next";

import { RetrievalPlayground } from "@/components/retrieval-playground";

export const metadata: Metadata = {
  title: "Retrieval playground | Trial by User",
  description: "Inspect deterministic section-level retrieval over the fictional FlowPilot knowledge base.",
};

export default function RetrievalPage() {
  return (
    <main className="min-h-screen bg-lab-bg font-sans text-foreground">
      <header className="border-b border-lab-border bg-lab-surface">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-evidence">Deterministic retrieval</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Search the product record</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-lab-muted">Inspect section-level lexical ranking over the controlled FlowPilot knowledge base. No model or external service is used.</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <RetrievalPlayground />
      </div>
    </main>
  );
}
