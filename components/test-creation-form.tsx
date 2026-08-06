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

export function TestCreationForm() {
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
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="space-y-10">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7" aria-labelledby="product-heading">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Fixed product</p>
                <h2 id="product-heading" className="mt-2 text-2xl font-bold tracking-[-0.02em]">{flowPilotProduct.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  This test uses the controlled fictional product and its ten deterministic knowledge pages.
                </p>
              </div>
              <Link className="shrink-0 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-amber-300 hover:text-amber-800" href="/product">
                Browse knowledge base
              </Link>
            </div>
          </section>

          <fieldset aria-describedby={errors.task ? "task-error" : undefined}>
            <legend className="text-2xl font-bold tracking-[-0.025em] text-slate-950">1. Select a customer task</legend>
            <p className="mt-2 text-sm leading-6 text-slate-600">Choose one narrow question for the synthetic customer to investigate.</p>
            {errors.task && <p id="task-error" role="alert" className="mt-3 text-sm font-semibold text-red-700">{errors.task}</p>}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {customerTasks.map((task) => {
                const selected = selectedTaskId === task.id;
                return (
                  <label
                    className={`relative flex cursor-pointer flex-col rounded-2xl border bg-white p-5 transition duration-200 focus-within:ring-3 focus-within:ring-amber-500 focus-within:ring-offset-2 ${
                      selected ? "border-amber-500 shadow-md shadow-amber-900/10" : "border-slate-200 hover:border-slate-300"
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
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{task.category}</span>
                      <span className={`text-xs font-bold ${selected ? "text-amber-700" : "text-slate-400"}`}>
                        {selected ? "Selected ✓" : task.difficulty}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-slate-900">{task.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{task.scenario}</p>
                    <blockquote className="mt-5 border-l-2 border-amber-400 pl-3 text-sm font-medium leading-6 text-slate-800">
                      “{task.question}”
                    </blockquote>
                    <span className="mt-4 text-xs font-semibold text-slate-400">Difficulty: {task.difficulty}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset aria-describedby={errors.persona ? "persona-error" : undefined}>
            <legend className="text-2xl font-bold tracking-[-0.025em] text-slate-950">2. Select a customer persona</legend>
            <p className="mt-2 text-sm leading-6 text-slate-600">The persona describes how the customer will approach the product knowledge.</p>
            {errors.persona && <p id="persona-error" role="alert" className="mt-3 text-sm font-semibold text-red-700">{errors.persona}</p>}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {customerPersonas.map((persona) => {
                const selected = selectedPersonaId === persona.id;
                return (
                  <label
                    className={`relative flex cursor-pointer flex-col rounded-2xl border bg-white p-5 transition duration-200 focus-within:ring-3 focus-within:ring-amber-500 focus-within:ring-offset-2 ${
                      selected ? "border-amber-500 shadow-md shadow-amber-900/10" : "border-slate-200 hover:border-slate-300"
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
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-950 font-mono text-xs font-bold text-amber-300">
                        {persona.visualLabel}
                      </span>
                      <span className={`text-xs font-bold ${selected ? "text-amber-700" : "text-slate-400"}`}>
                        {selected ? "Selected ✓" : `${persona.defaultMaxActions} actions`}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-900">{persona.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{persona.description}</p>
                    <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-500">
                      {persona.traits.map((trait) => <li key={trait}>• {trait}</li>)}
                    </ul>
                    <p className="mt-4 text-xs font-semibold text-slate-400">Default allowance: {persona.defaultMaxActions} actions</p>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <section aria-labelledby="action-heading">
            <h2 id="action-heading" className="text-2xl font-bold tracking-[-0.025em] text-slate-950">3. Set the action limit</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Set how many model-assisted product actions the customer may take before stopping.</p>
            <div className="mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-6">
              <label className="font-bold text-slate-900" htmlFor="max-actions">Maximum actions</label>
              <select
                id="max-actions"
                className="mt-3 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
                value={maxActions}
                onChange={(event) => updateActionLimit(Number(event.target.value))}
                aria-describedby={`action-help${errors.actions ? " action-error" : ""}`}
              >
                {actionOptions.map((value) => <option key={value} value={value}>{value} actions</option>)}
              </select>
              <p id="action-help" className="mt-3 text-xs leading-5 text-slate-500">
                Persona defaults apply until you deliberately choose a value.
              </p>
              {errors.actions && <p id="action-error" role="alert" className="mt-2 text-sm font-semibold text-red-700">{errors.actions}</p>}
            </div>
          </section>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 lg:sticky lg:top-6" aria-labelledby="summary-heading">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Live configuration</p>
          <h2 id="summary-heading" className="mt-2 text-xl font-bold">Review your test</h2>
          <dl className="mt-6 space-y-5">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Product</dt>
              <dd className="mt-1 font-semibold text-slate-900">FlowPilot</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Customer task</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{selectedTask?.title ?? "Not selected"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Persona</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{selectedPersona?.name ?? "Not selected"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Action limit</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{maxActions} actions</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">
            Creating this test saves a ready configuration in this browser. The run begins only when you explicitly start the simulation.
          </div>
          {errors.storage && <p role="alert" className="mt-4 text-sm font-semibold leading-6 text-red-700">{errors.storage}</p>}
          <button className="mt-6 w-full rounded-xl bg-amber-300 px-5 py-3.5 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-200" type="submit">
            Create test run
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-slate-400">Saved only to this browser</p>
        </aside>
      </div>
    </form>
  );
}
