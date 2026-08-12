"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { flowPilotProduct } from "@/lib/product";
import {
  createLocalRun,
  createReadyRun,
  customerPersonas,
  customerTasks,
  demoPresets,
  getCustomerPersona,
  getCustomerTask,
  MAX_ACTIONS,
  MIN_ACTIONS,
} from "@/lib/test-runs";

type FormErrors = {
  task?: string;
  persona?: string;
  actions?: string;
  storage?: string;
};

const actionOptions = Array.from(
  { length: MAX_ACTIONS - MIN_ACTIONS + 1 },
  (_, index) => MIN_ACTIONS + index,
);

export function TestCreationForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [maxActions, setMaxActions] = useState(6);
  const [actionLimitTouched, setActionLimitTouched] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const selectedTask = getCustomerTask(selectedTaskId);
  const selectedPersona = getCustomerPersona(selectedPersonaId);

  function selectTask(taskId: string) {
    setSelectedTaskId(taskId);
    setErrors((current) => ({ ...current, task: undefined, storage: undefined }));
  }

  function selectPersona(personaId: string) {
    const persona = getCustomerPersona(personaId);
    setSelectedPersonaId(personaId);
    setErrors((current) => ({ ...current, persona: undefined, storage: undefined }));

    if (persona && !actionLimitTouched) {
      setMaxActions(persona.defaultMaxActions);
    }
  }

  function updateActionLimit(value: number) {
    setMaxActions(value);
    setActionLimitTouched(true);
    setErrors((current) => ({ ...current, actions: undefined, storage: undefined }));
  }

  function applyPreset(taskId: string, personaId: string, actions: number) {
    setSelectedTaskId(taskId);
    setSelectedPersonaId(personaId);
    setMaxActions(actions);
    setActionLimitTouched(true);
    setErrors({});
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!selectedTask) {
      nextErrors.task = "Choose a customer task before creating the test.";
    }
    if (!selectedPersona) {
      nextErrors.persona = "Choose a customer persona before creating the test.";
    }
    if (!Number.isInteger(maxActions) || maxActions < MIN_ACTIONS || maxActions > MAX_ACTIONS) {
      nextErrors.actions = `Choose between ${MIN_ACTIONS} and ${MAX_ACTIONS} actions.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      const run = createReadyRun({
        taskId: selectedTaskId,
        personaId: selectedPersonaId,
        maxActions,
      });

      if (!createLocalRun(run)) {
        setErrors({ storage: "This browser could not save the run. Check browser storage settings and try again." });
        return;
      }

      router.push(`/runs/${run.id}`);
    } catch {
      setErrors({ storage: "The configuration could not be created. Review the selections and try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-8">
          <section className="rounded-lg border border-lab-border bg-lab-surface p-5 sm:p-6" aria-labelledby="preset-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-indigo-300">{demoMode ? "Recommended demos" : "Recommended configurations"}</p>
                <h2 id="preset-heading" className="mt-2 text-lg font-semibold tracking-[-0.02em]">Start with a representative test</h2>
              </div>
              <p className="font-mono text-[0.7rem] text-lab-subtle">Selection only · 0 requests</p>
            </div>
            <div className="mt-5 divide-y divide-lab-border border-y border-lab-border">
              {demoPresets.map((preset) => {
                const task = getCustomerTask(preset.taskId)!;
                const persona = getCustomerPersona(preset.personaId)!;
                return (
                  <article className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={preset.id}>
                    <div>
                      <p className="text-xs font-medium text-indigo-300">{preset.label}</p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-100">{task.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-lab-muted">{persona.name} · {preset.maxActions} actions · {preset.description}</p>
                    </div>
                    <button
                      className="justify-self-start rounded-md border border-lab-border bg-lab-elevated px-3 py-2 text-xs font-medium text-slate-200 hover:border-indigo-400 hover:text-white sm:justify-self-auto"
                      onClick={() => applyPreset(preset.taskId, preset.personaId, preset.maxActions)}
                      type="button"
                    >
                      Use configuration
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col justify-between gap-4 border-y border-lab-border py-5 sm:flex-row sm:items-center" aria-labelledby="product-heading">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-lab-subtle">Product surface</p>
                <h2 id="product-heading" className="mt-1 text-base font-semibold">{flowPilotProduct.name}</h2>
                <p className="mt-1 max-w-2xl text-sm text-lab-muted">Controlled fictional product · ten deterministic knowledge pages</p>
              </div>
            </div>
            <Link className="shrink-0 text-sm font-medium text-indigo-300 hover:text-indigo-200" href="/product">Browse knowledge →</Link>
          </section>

          <fieldset className="rounded-lg border border-lab-border bg-lab-surface p-5 sm:p-6" aria-describedby={errors.task ? "task-error" : undefined}>
            <legend className="px-2 text-lg font-semibold tracking-[-0.02em] text-slate-50">1 · Scenario</legend>
            <p className="text-sm leading-6 text-lab-muted">Choose one narrow question for the synthetic customer to investigate.</p>
            {errors.task && <p id="task-error" role="alert" className="mt-3 text-sm font-semibold text-red-400">{errors.task}</p>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {customerTasks.map((task) => {
                const selected = selectedTaskId === task.id;
                return (
                  <label
                    className={`relative flex cursor-pointer flex-col rounded-md border p-4 transition-colors focus-within:ring-2 focus-within:ring-indigo-400 focus-within:ring-offset-2 focus-within:ring-offset-lab-surface ${
                      selected ? "border-indigo-400 bg-indigo-500/10" : "border-lab-border bg-lab-elevated/50 hover:border-slate-500"
                    }`}
                    key={task.id}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="task"
                      value={task.id}
                      checked={selected}
                      onChange={() => selectTask(task.id)}
                    />
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-lab-muted">{task.category}</span>
                      <span className={`font-mono ${selected ? "text-indigo-300" : "text-lab-subtle"}`}>{selected ? "✓ Selected" : task.difficulty}</span>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-100">{task.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-lab-muted">{task.scenario}</p>
                    <blockquote className="mt-4 border-l border-indigo-400/60 pl-3 text-sm leading-6 text-slate-300">
                      “{task.question}”
                    </blockquote>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-lab-border bg-lab-surface p-5 sm:p-6" aria-describedby={errors.persona ? "persona-error" : undefined}>
            <legend className="px-2 text-lg font-semibold tracking-[-0.02em] text-slate-50">2 · Persona</legend>
            <p className="text-sm leading-6 text-lab-muted">Choose how the customer approaches the product record.</p>
            {errors.persona && <p id="persona-error" role="alert" className="mt-3 text-sm font-semibold text-red-400">{errors.persona}</p>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {customerPersonas.map((persona) => {
                const selected = selectedPersonaId === persona.id;
                return (
                  <label
                    className={`relative flex cursor-pointer flex-col rounded-md border p-4 transition-colors focus-within:ring-2 focus-within:ring-indigo-400 focus-within:ring-offset-2 focus-within:ring-offset-lab-surface ${
                      selected ? "border-indigo-400 bg-indigo-500/10" : "border-lab-border bg-lab-elevated/50 hover:border-slate-500"
                    }`}
                    key={persona.id}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="persona"
                      value={persona.id}
                      checked={selected}
                      onChange={() => selectPersona(persona.id)}
                    />
                    <div className="flex items-start justify-between gap-4 text-xs">
                      <span className="font-mono text-lab-subtle">{persona.visualLabel}</span>
                      <span className={selected ? "font-mono text-indigo-300" : "font-mono text-lab-subtle"}>{selected ? "✓ Selected" : `${persona.defaultMaxActions} actions`}</span>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-100">{persona.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-lab-muted">{persona.description}</p>
                    <ul className="mt-3 space-y-1 text-xs leading-5 text-lab-subtle">
                      {persona.traits.map((trait) => <li key={trait}>• {trait}</li>)}
                    </ul>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <section className="rounded-lg border border-lab-border bg-lab-surface p-5 sm:p-6" aria-labelledby="action-heading">
            <h2 id="action-heading" className="text-lg font-semibold tracking-[-0.02em] text-slate-50">3 · Action budget</h2>
            <p className="mt-2 text-sm leading-6 text-lab-muted">Set the maximum number of successful customer actions.</p>
            <div className="mt-5 max-w-sm">
              <label className="text-sm font-medium text-slate-200" htmlFor="max-actions">Maximum actions</label>
              <select
                id="max-actions"
                className="mt-2 block w-full rounded-md border border-lab-border bg-lab-elevated px-3 py-2.5 text-sm text-slate-100"
                value={maxActions}
                onChange={(event) => updateActionLimit(Number(event.target.value))}
                aria-describedby={`action-help${errors.actions ? " action-error" : ""}`}
              >
                {actionOptions.map((value) => <option key={value} value={value}>{value} actions</option>)}
              </select>
              <p id="action-help" className="mt-2 text-xs leading-5 text-lab-subtle">
                Persona defaults apply until you deliberately choose a value.
              </p>
              {errors.actions && <p id="action-error" role="alert" className="mt-2 text-sm font-semibold text-red-400">{errors.actions}</p>}
            </div>
          </section>
        </div>

        <aside className="rounded-lg border border-lab-border bg-lab-elevated p-5 shadow-[0_18px_60px_rgba(0,0,0,0.14)] lg:sticky lg:top-6" aria-labelledby="summary-heading">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-indigo-300">Configuration</p>
          <h2 id="summary-heading" className="mt-2 text-lg font-semibold">Review test</h2>
          <dl className="mt-5 divide-y divide-lab-border border-y border-lab-border">
            <div>
              <dt className="pt-3 text-xs text-lab-subtle">Product</dt>
              <dd className="pb-3 pt-1 text-sm font-medium text-slate-100">FlowPilot</dd>
            </div>
            <div>
              <dt className="pt-3 text-xs text-lab-subtle">Scenario</dt>
              <dd className="pb-3 pt-1 text-sm font-medium text-slate-100">{selectedTask?.title ?? "Not selected"}</dd>
            </div>
            <div>
              <dt className="pt-3 text-xs text-lab-subtle">Persona</dt>
              <dd className="pb-3 pt-1 text-sm font-medium text-slate-100">{selectedPersona?.name ?? "Not selected"}</dd>
            </div>
            <div>
              <dt className="pt-3 text-xs text-lab-subtle">Action budget</dt>
              <dd className="pb-3 pt-1 text-sm font-medium text-slate-100">{maxActions} actions</dd>
            </div>
          </dl>
          <div className="mt-5 border-l-2 border-indigo-400/70 pl-3 text-xs leading-5 text-lab-muted">
            Creating this test saves a ready configuration in this browser. The run begins only when you explicitly start the simulation.
          </div>
          {errors.storage && <p role="alert" className="mt-4 text-sm font-semibold leading-6 text-red-400">{errors.storage}</p>}
          <button className="mt-6 w-full rounded-md bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-600" type="submit">
            Create test
          </button>
          <p className="mt-3 text-center font-mono text-[0.7rem] text-lab-subtle">Saved to this browser</p>
        </aside>
      </div>
    </form>
  );
}
