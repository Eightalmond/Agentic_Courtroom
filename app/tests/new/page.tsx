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
    <main className="min-h-screen bg-[#f7f7f5] font-sans text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">{demoMode ? "Controlled FlowPilot test" : "New evaluation"}</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Configure a customer test</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">Choose one scenario, one customer perspective, and a bounded action budget.</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
        <TestCreationForm demoMode={demoMode} />
      </div>
    </main>
  );
}
