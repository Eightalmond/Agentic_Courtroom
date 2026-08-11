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
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8 sm:py-16 lg:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">{demoMode ? "Public demo · Controlled FlowPilot test" : "Available now · Controlled FlowPilot test"}</p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Configure a customer test
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Choose a focused question, a customer perspective, and a bounded action allowance for FlowPilot.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-16 lg:px-10">
        <TestCreationForm demoMode={demoMode} />
      </div>
    </main>
  );
}
