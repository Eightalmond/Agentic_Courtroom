import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import { POST } from "@/app/api/evidence/collect/route";
import { getSectionById, searchProductKnowledge } from "@/lib/retrieval";
import { buildCustomerPrompt } from "@/lib/simulation/prompt";
import { executeCustomerAction } from "@/lib/simulation/tools";
import type { CustomerDecision } from "@/lib/simulation/types";
import {
  applyEvidenceBundle,
  applySimulationStep,
  createReadyRun,
  getCustomerPersona,
  getCustomerTask,
  resetSimulationRun,
  readLocalRun,
  RUN_STORAGE_KEY,
  saveLocalRun,
  toEvidenceCollectionRequest,
  toSimulationStepRequest,
  type StorageLike,
} from "@/lib/test-runs";

import { collectEvidenceBundle } from "./collector";
import { taskEvaluationSpecs } from "./evaluation-specs";
import { EvidenceBundleSchema } from "./schemas";
import { MAX_CONTEXT_EVIDENCE, MAX_EVIDENCE_ITEMS } from "./types";

const NOW = "2026-08-06T12:00:00.000Z";
const TRIAL_SECTION = "flowpilot-cancellation-policy-cancelling-during-a-trial";
const API_MONTHLY_SECTION = "flowpilot-api-rate-limits-monthly-request-allowances";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function completedRun(
  decisions: readonly CustomerDecision[],
  options: { taskId?: string; personaId?: string; maxActions?: number; id?: string } = {},
) {
  let run = createReadyRun(
    {
      taskId: options.taskId ?? "trial-cancellation",
      personaId: options.personaId ?? "careful-researcher",
      maxActions: options.maxActions ?? Math.max(3, decisions.length),
    },
    { id: options.id ?? "run-evidence-test", createdAt: "2026-08-06T11:00:00.000Z" },
  );

  decisions.forEach((decision, index) => {
    const timestamp = `2026-08-06T11:0${index + 1}:00.000Z`;
    run = applySimulationStep(
      run,
      executeCustomerAction(decision, toSimulationStepRequest(run), {
        now: timestamp,
        actionId: `action-${run.id}-${index + 1}`,
      }),
    );
  });
  return run;
}

function answerRun(answer: string, taskId = "trial-cancellation") {
  return completedRun(
    [{ action: "ANSWER", explanation: "The available product evidence supports an answer.", answer, confidence: "high" }],
    { taskId, id: `run-${taskId}` },
  );
}

describe("evidence eligibility", () => {
  it("accepts completed answer, give-up, and budget-exhausted runs", () => {
    const answered = answerRun("Cancel before day 14. This prevents the first charge. Trial access remains until the trial ends.");
    const gaveUp = completedRun([
      { action: "GIVE_UP", explanation: "The journey is inconclusive.", reason: "I could not verify enough information." },
    ]);
    const exhausted = completedRun(
      [
        { action: "SEARCH", explanation: "Search once.", query: "trial cancellation" },
        { action: "SEARCH", explanation: "Search twice.", query: "billing" },
        { action: "SEARCH", explanation: "Search a third time.", query: "trial access" },
      ],
      { maxActions: 3, id: "run-budget-evidence" },
    );

    expect(collectEvidenceBundle(answered, { now: NOW }).customerOutcome).toBe("answered");
    expect(collectEvidenceBundle(gaveUp, { now: NOW }).customerOutcome).toBe("gave-up");
    expect(collectEvidenceBundle(exhausted, { now: NOW }).customerOutcome).toBe("budget-exhausted");
  });

  it("rejects an oversized evidence payload at the schema boundary", () => {
    const bundle = collectEvidenceBundle(answerRun("I am unsure."), { now: NOW });
    const template = bundle.evidenceItems[0]!;
    const evidenceItems = Array.from({ length: MAX_EVIDENCE_ITEMS + 1 }, (_, index) => ({
      ...template,
      evidenceId: `evidence-oversized-${index}`,
      orderingIndex: index,
    }));
    const result = EvidenceBundleSchema.safeParse({ ...bundle, evidenceItems });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({ code: "too_big", path: ["evidenceItems"] }));
    }
  });

  it("rejects ready, running, and reset-without-history runs", () => {
    const ready = createReadyRun(
      { taskId: "trial-cancellation", personaId: "careful-researcher", maxActions: 3 },
      { id: "run-ready-evidence", createdAt: NOW },
    );
    const running = completedRun([{ action: "SEARCH", explanation: "Search.", query: "trial" }], {
      maxActions: 3,
      id: "run-running-evidence",
    });
    expect(() => collectEvidenceBundle(ready)).toThrowError(expect.objectContaining({ code: "RUN_NOT_STARTED" }));
    expect(() => collectEvidenceBundle(running)).toThrowError(expect.objectContaining({ code: "RUN_STILL_RUNNING" }));
    expect(() => collectEvidenceBundle(resetSimulationRun(answerRun("No answer."), NOW))).toThrowError(
      expect.objectContaining({ code: "RUN_NOT_STARTED" }),
    );
  });

  it("rejects unknown tasks, personas, products, and malformed source references safely", () => {
    const base = answerRun("No answer.");
    expect(() => collectEvidenceBundle({ ...base, taskId: "unknown-task" })).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_TASK" }),
    );
    expect(() => collectEvidenceBundle({ ...base, personaId: "unknown-persona" })).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_PERSONA" }),
    );
    expect(() => collectEvidenceBundle({ ...base, productId: "another-product" })).toThrowError(
      expect.objectContaining({ code: "INVALID_PRODUCT" }),
    );

    const inspected = completedRun([
      { action: "INSPECT_SECTION", explanation: "Inspect.", sectionId: TRIAL_SECTION },
      { action: "ANSWER", explanation: "Answer.", answer: "No answer.", confidence: "low" },
    ]);
    const tampered = structuredClone(inspected);
    const firstAction = tampered.actions[0];
    if (firstAction?.observation.kind === "section") {
      firstAction.observation.sectionId = "flowpilot-unknown-section";
      firstAction.input = { sectionId: "flowpilot-unknown-section" };
    }
    expect(() => collectEvidenceBundle(tampered)).toThrowError(expect.objectContaining({ code: "INVALID_SOURCE_REFERENCE" }));
  });
});

describe("journey evidence extraction", () => {
  it("collects trusted search results, opened pages, inspected sections, and callouts", () => {
    const run = completedRun([
      { action: "SEARCH", explanation: "Search.", query: "trial cancellation" },
      { action: "OPEN_PAGE", explanation: "Open.", pageSlug: "free-trial-and-billing" },
      { action: "INSPECT_SECTION", explanation: "Inspect.", sectionId: TRIAL_SECTION },
      { action: "ANSWER", explanation: "Answer.", answer: "Cancel before the trial ends to avoid the first charge.", confidence: "medium" },
    ]);
    const bundle = collectEvidenceBundle(run, { now: NOW });

    expect(bundle.evidenceItems.some((item) => item.sourceType === "search-result" && item.customerSaw)).toBe(true);
    expect(bundle.evidenceItems.some((item) => item.sourceType === "opened-page" && item.pageSlug === "free-trial-and-billing")).toBe(true);
    expect(bundle.evidenceItems.some((item) => item.sourceType === "inspected-section" && item.sectionId === TRIAL_SECTION)).toBe(true);
    expect(bundle.evidenceItems.some((item) => item.sourceType === "page-callout" && item.customerSaw)).toBe(true);
  });

  it("ignores failed tool actions as product evidence", () => {
    const run = completedRun([
      { action: "OPEN_PAGE", explanation: "Open an invalid page.", pageSlug: "not-a-page" },
      { action: "ANSWER", explanation: "Answer anyway.", answer: "I could not verify this.", confidence: "low" },
    ]);
    const bundle = collectEvidenceBundle(run, { now: NOW });
    expect(bundle.integrity.failedToolActions).toBe(1);
    expect(bundle.evidenceItems.some((item) => item.pageSlug === "not-a-page")).toBe(false);
  });

  it("de-duplicates repeated section exposure and preserves the earliest action", () => {
    const run = completedRun([
      { action: "INSPECT_SECTION", explanation: "Inspect once.", sectionId: TRIAL_SECTION },
      { action: "INSPECT_SECTION", explanation: "Inspect twice.", sectionId: TRIAL_SECTION },
      { action: "ANSWER", explanation: "Answer.", answer: "Cancel before day 14 to prevent the first charge.", confidence: "medium" },
    ]);
    const bundle = collectEvidenceBundle(run, { now: NOW });
    const matching = bundle.evidenceItems.filter((item) => item.sectionId === TRIAL_SECTION && item.customerSaw);
    expect(matching).toHaveLength(1);
    expect(matching[0]).toMatchObject({ firstExposedByAction: 1, exposureActionNumbers: [1, 2] });
  });

  it("marks required unseen evidence missing and bounded context unseen", () => {
    const bundle = collectEvidenceBundle(answerRun("I am unsure."), { now: NOW });
    const missing = bundle.evidenceItems.filter((item) => item.category === "missing");
    const context = bundle.evidenceItems.filter((item) => item.category === "context");
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((item) => !item.customerSaw && item.firstExposedByAction === null)).toBe(true);
    expect(context.length).toBeLessThanOrEqual(MAX_CONTEXT_EVIDENCE);
    expect(context.every((item) => !item.customerSaw)).toBe(true);
  });

  it("produces deterministic ordering and immutable nested structures", () => {
    const run = completedRun([
      { action: "SEARCH", explanation: "Search.", query: "trial cancellation" },
      { action: "ANSWER", explanation: "Answer.", answer: "Cancel before the trial ends.", confidence: "medium" },
    ]);
    const first = collectEvidenceBundle(run, { now: NOW });
    const second = collectEvidenceBundle(run, { now: NOW });
    expect(second).toEqual(first);
    expect(first.evidenceItems.map((item) => item.orderingIndex)).toEqual(first.evidenceItems.map((_, index) => index));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.evidenceItems)).toBe(true);
  });

  it("uses trusted source excerpts and keeps seen, context, and missing states distinct", () => {
    const bundle = collectEvidenceBundle(answerRun("I am unsure."), { now: NOW });
    for (const item of bundle.evidenceItems.filter((candidate) => candidate.sectionId)) {
      const trusted = getSectionById(item.sectionId!);
      expect(trusted).toBeDefined();
      expect(trusted!.sectionBody).toContain(item.excerpt.replace(/…$/, "").slice(0, 80));
    }
    expect(bundle.evidenceItems.filter((item) => item.category === "missing").every((item) => !item.customerSaw)).toBe(true);
    expect(bundle.evidenceItems.filter((item) => item.category === "context").every((item) => !item.customerSaw)).toBe(true);
  });
});

describe("mechanical fact checks", () => {
  it.each([
    ["trial-cancellation", "Cancel before day 14. This prevents the first charge. Trial access remains until the trial ends."],
    ["api-allowance", "Pro includes API access with 10,000 requests per month. Short-term rate limits also apply."],
    ["refund-after-renewal", "Cancelling does not automatically create a refund."],
    ["hipaa-suitability", "FlowPilot is not HIPAA compliant and should not be used to store protected health information."],
    ["viewer-permissions", "Viewer is available on Pro and Business and can view workflows but cannot edit them."],
    ["audit-log-export", "Full audit-log export is available only on Business. Pro cannot export a complete audit log."],
  ])("supports bounded concepts for %s", (taskId, answer) => {
    expect(collectEvidenceBundle(answerRun(answer, taskId), { now: NOW }).factChecks[0]?.result).toBe("supported");
  });

  it.each([
    ["refund-after-renewal", "Cancelling will automatically refund the charge."],
    ["hipaa-suitability", "FlowPilot is HIPAA compliant and can store protected health information."],
    ["audit-log-export", "Pro can export a complete audit log."],
  ])("detects explicit contradictory claims for %s", (taskId, answer) => {
    expect(collectEvidenceBundle(answerRun(answer, taskId), { now: NOW }).factChecks[0]?.result).toBe("contradicted");
  });

  it("detects a missing API allowance concept without broad semantic evaluation", () => {
    const bundle = collectEvidenceBundle(answerRun("Pro includes API access and rate limits apply.", "api-allowance"), { now: NOW });
    expect(bundle.factChecks[0]?.result).toBe("unsupported");
    expect(bundle.factChecks[0]?.sourceSectionIds).toContain(API_MONTHLY_SECTION);
  });

  it("marks answer checks not assessable for give-up and budget outcomes", () => {
    const gaveUp = completedRun([
      { action: "GIVE_UP", explanation: "Give up.", reason: "No reliable answer." },
    ]);
    expect(collectEvidenceBundle(gaveUp, { now: NOW }).factChecks[0]?.result).toBe("not-assessable");
  });
});

describe("metadata isolation, persistence, and endpoint", () => {
  it("keeps evaluation metadata out of the synthetic customer prompt", () => {
    const run = createReadyRun(
      { taskId: "trial-cancellation", personaId: "careful-researcher", maxActions: 4 },
      { id: "run-prompt-isolation", createdAt: NOW },
    );
    const prompt = buildCustomerPrompt(getCustomerTask(run.taskId)!, getCustomerPersona(run.personaId)!, toSimulationStepRequest(run));
    const serialized = `${prompt.instructions}\n${prompt.input}`;
    expect(serialized).not.toContain("trial-cancellation-terms");
    expect(serialized).not.toContain("requiredSectionIds");
    expect(serialized).not.toContain("riskMarkers");
  });

  it("uses only valid source IDs in all six internal task specifications", () => {
    expect(taskEvaluationSpecs).toHaveLength(6);
    taskEvaluationSpecs.forEach((specification) => {
      const ids = [
        ...specification.requiredSectionIds,
        ...specification.optionalSupportingSectionIds,
        ...specification.qualificationSectionIds,
        ...specification.factChecks.flatMap((check) => check.sourceSectionIds),
      ];
      ids.forEach((sectionId) => expect(getSectionById(sectionId), `${specification.taskId}: ${sectionId}`).toBeDefined());
    });
  });

  it("attaches one bundle, preserves it on read-shaped data, and reset clears it", () => {
    const run = answerRun("I am unsure.");
    const bundle = collectEvidenceBundle(run, { now: NOW });
    const collected = applyEvidenceBundle(run, bundle);
    expect(collected.evidenceBundle).toEqual(bundle);
    expect(resetSimulationRun(collected, NOW).evidenceBundle).toBeNull();
    expect(() => toSimulationStepRequest(collected)).toThrowError(/Reset the simulation/);
    expect(() => collectEvidenceBundle(collected)).toThrowError(expect.objectContaining({ code: "EVIDENCE_ALREADY_EXISTS" }));
  });

  it("persists one evidence bundle across refresh without internal evaluation specifications", () => {
    const storage = memoryStorage();
    const run = answerRun("I am unsure.");
    const collected = applyEvidenceBundle(run, collectEvidenceBundle(run, { now: NOW }));
    expect(saveLocalRun(collected, storage)).toBe(true);
    expect(readLocalRun(run.id, storage)?.evidenceBundle).toEqual(collected.evidenceBundle);
    const serialized = storage.getItem(RUN_STORAGE_KEY) ?? "";
    expect(serialized).not.toContain("requiredSectionIds");
    expect(serialized).not.toContain("riskMarkers");
    expect(serialized).not.toContain("requiredConceptGroups");
  });

  it("contains no hidden reasoning or expected natural-language answer fields", () => {
    const serialized = JSON.stringify(collectEvidenceBundle(answerRun("I am unsure."), { now: NOW }));
    expect(serialized).not.toMatch(/chain.of.thought|hidden.reasoning|expectedAnswer|expectedNaturalLanguageAnswer/i);
  });

  it("collects through the endpoint without credentials or provider calls", async () => {
    const run = answerRun("Cancel before day 14. This prevents the first charge. Trial access remains until the trial ends.");
    const previousEnvironment = {
      groq: process.env.GROQ_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    };
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const response = await POST(
        new NextRequest("http://localhost/api/evidence/collect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(toEvidenceCollectionRequest(run)),
        }),
      );
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { bundle: { runId: string } };
      expect(payload.bundle.runId).toBe(run.id);
    } finally {
      if (previousEnvironment.groq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = previousEnvironment.groq;
      if (previousEnvironment.openai === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousEnvironment.openai;
    }
  });

  it("recomputes recorded search results from trusted deterministic retrieval", () => {
    const result = searchProductKnowledge("trial cancellation", { limit: 3 });
    expect(result.length).toBeGreaterThan(0);
    const run = completedRun([
      { action: "SEARCH", explanation: "Search.", query: "trial cancellation" },
      { action: "ANSWER", explanation: "Answer.", answer: "I am unsure.", confidence: "low" },
    ]);
    const bundle = collectEvidenceBundle(run, { now: NOW });
    expect(bundle.evidenceItems.some((item) => item.sectionId === result[0]?.sectionId && item.customerSaw)).toBe(true);
  });
});
