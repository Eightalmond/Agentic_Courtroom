import type { Metadata } from "next";

import { TestCreationForm } from "@/components/test-creation-form";
import { readDemoConfiguration } from "@/lib/demo/environment";

export const metadata: Metadata = {
  title: "Create a test | Trial by User",
  description: "Configure a local synthetic customer test against the fictional FlowPilot product.",
};

export default function NewTestPage() {
  const { demoMode } = readDemoConfiguration();
  return (
    <main className="min-h-screen bg-lab-bg font-sans text-foreground">
      <header className="border-b border-lab-border bg-lab-surface">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-accent">{demoMode ? "Controlled FlowPilot test" : "New evaluation"}</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Configure a customer test</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-lab-muted">Choose one scenario, one customer perspective, and a bounded action budget.</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
        <TestCreationForm demoMode={demoMode} />
      </div>
    </main>
  );
}
