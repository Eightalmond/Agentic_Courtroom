import { describe, expect, it } from "vitest";

import { flowPilotProduct } from "@/lib/product";

import {
  createLocalRun,
  createReadyRun,
  customerPersonas,
  customerTasks,
  generateRunId,
  getCustomerPersona,
  getCustomerTask,
  LEGACY_RUN_STORAGE_KEY,
  MAX_ACTIONS,
  MIN_ACTIONS,
  parseStoredRun,
  PHASE_FIVE_RUN_STORAGE_KEY,
  readLocalRun,
  resetSimulationRun,
  RUN_STORAGE_KEY,
  type StorageLike,
} from ".";

const validRun = createReadyRun(
  { taskId: "api-allowance", personaId: "careful-researcher", maxActions: 9 },
  { id: "run-demo-valid123", createdAt: "2026-08-05T10:00:00.000Z" },
);

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("test library", () => {
  it("uses unique task IDs", () => {
    const ids = customerTasks.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(6);
  });

  it("uses unique persona IDs", () => {
    const ids = customerPersonas.map((persona) => persona.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(5);
  });

  it("only references existing FlowPilot knowledge pages", () => {
    const slugs = new Set(flowPilotProduct.pages.map((page) => page.slug));

    for (const task of customerTasks) {
      for (const slug of task.expectedRelevantPageSlugs) {
        expect(slugs.has(slug), `${task.id} references missing page ${slug}`).toBe(true);
      }
    }
  });

  it("keeps persona defaults inside the allowed action range", () => {
    for (const persona of customerPersonas) {
      expect(persona.defaultMaxActions).toBeGreaterThanOrEqual(MIN_ACTIONS);
      expect(persona.defaultMaxActions).toBeLessThanOrEqual(MAX_ACTIONS);
    }
  });

  it("generates non-constant URL-safe run IDs", () => {
    const first = generateRunId({ timestamp: 1, randomId: "11111111-1111-4111-8111-111111111111" });
    const second = generateRunId({ timestamp: 2, randomId: "22222222-2222-4222-8222-222222222222" });

    expect(first).toMatch(/^[a-z0-9-]+$/);
    expect(second).toMatch(/^[a-z0-9-]+$/);
    expect(first).not.toBe(second);
  });

  it("accepts valid stored data and strips unexpected fields", () => {
    expect(parseStoredRun({ ...validRun, expectedAnswer: "must not persist" })).toEqual(validRun);
  });

  it("rejects malformed stored data", () => {
    expect(parseStoredRun({ ...validRun, maxActions: 99 })).toBeUndefined();
    expect(parseStoredRun({ ...validRun, taskId: "unknown" })).toBeUndefined();
    expect(parseStoredRun("not a run")).toBeUndefined();
  });

  it("creates ready runs with zero actions", () => {
    expect(validRun).toMatchObject({ status: "ready", currentActionCount: 0, modelCallCount: 0, actions: [], productId: "flowpilot" });
  });

  it("looks up tasks and personas and handles unknown IDs", () => {
    expect(getCustomerTask("trial-cancellation")?.title).toBe("Trial cancellation");
    expect(getCustomerTask("unknown")).toBeUndefined();
    expect(getCustomerPersona("skeptical-buyer")?.name).toBe("Skeptical buyer");
    expect(getCustomerPersona("unknown")).toBeUndefined();
  });

  it("creates and reads a sanitized local run", () => {
    const storage = createMemoryStorage();

    expect(createLocalRun(validRun, storage)).toBe(true);
    expect(readLocalRun(validRun.id, storage)).toEqual(validRun);
    expect(storage.getItem(RUN_STORAGE_KEY)).not.toContain("expectedAnswer");
  });

  it("keeps Phase 3 v1 runs readable after storage migration", () => {
    const storage = createMemoryStorage();
    const phaseThreeRun = {
      id: "run-phase-three",
      taskId: "api-allowance",
      personaId: "careful-researcher",
      maxActions: 9,
      createdAt: "2026-08-05T10:00:00.000Z",
      status: "ready",
      productId: "flowpilot",
      currentActionCount: 0,
    };
    storage.setItem(LEGACY_RUN_STORAGE_KEY, JSON.stringify([phaseThreeRun]));

    expect(readLocalRun("run-phase-three", storage)).toMatchObject({
      ...phaseThreeRun,
      actions: [],
      modelCallCount: 0,
      startedAt: null,
    });
  });

  it("keeps Phase 5 v2 runs readable after evidence-storage migration", () => {
    const storage = createMemoryStorage();
    storage.setItem(PHASE_FIVE_RUN_STORAGE_KEY, JSON.stringify([validRun]));

    expect(readLocalRun(validRun.id, storage)).toEqual(validRun);
  });

  it("reopens an unprepared legacy run exhausted by provider attempts while preserving successful history", () => {
    const actions = [1, 2].map((number) => ({
      id: `action-run-legacy-attempts-${number}`,
      number,
      type: "SEARCH" as const,
      explanation: "Search the controlled product knowledge.",
      timestamp: `2026-08-06T10:0${number}:00.000Z`,
      input: { query: "trial cancellation" },
      observation: { kind: "search" as const, query: "trial cancellation", results: [] },
      success: true,
    }));
    const migrated = parseStoredRun({
      ...validRun,
      id: "run-legacy-attempts",
      maxActions: 3,
      status: "completed",
      currentActionCount: 2,
      modelCallCount: 3,
      actions,
      completedAt: "2026-08-06T10:03:00.000Z",
      completionReason: "budget_exhausted",
      lastError: { code: "GROQ_RATE_LIMITED", message: "Rate limited.", retryable: true },
    });

    expect(migrated).toMatchObject({
      status: "failed",
      currentActionCount: 2,
      modelCallCount: 3,
      actions,
      completedAt: null,
      completionReason: null,
    });
  });

  it("removes unprepared legacy failed tool entries from customer-action numbering", () => {
    const successful = {
      id: "action-run-legacy-tool-1",
      number: 1,
      type: "SEARCH" as const,
      explanation: "Search the controlled product knowledge.",
      timestamp: "2026-08-06T10:01:00.000Z",
      input: { query: "trial cancellation" },
      observation: { kind: "search" as const, query: "trial cancellation", results: [] },
      success: true,
    };
    const failed = {
      id: "action-run-legacy-tool-2",
      number: 2,
      type: "OPEN_PAGE" as const,
      explanation: "Open an unavailable page.",
      timestamp: "2026-08-06T10:02:00.000Z",
      input: { pageSlug: "not-a-page" },
      observation: { kind: "tool_error" as const, code: "UNKNOWN_PAGE" as const, message: "No page exists." },
      success: false,
      error: { code: "UNKNOWN_PAGE", message: "No page exists." },
    };
    const migrated = parseStoredRun({
      ...validRun,
      id: "run-legacy-tool",
      maxActions: 3,
      status: "failed",
      currentActionCount: 2,
      modelCallCount: 2,
      actions: [successful, failed],
      lastError: { code: "UNKNOWN_PAGE", message: "No page exists.", retryable: true },
    });

    expect(migrated).toMatchObject({ currentActionCount: 1, modelCallCount: 2, actions: [{ number: 1, success: true }] });
  });

  it("resets simulation state while preserving task and persona", () => {
    const completed = {
      ...validRun,
      status: "completed" as const,
      currentActionCount: 1,
      modelCallCount: 1,
      startedAt: "2026-08-06T10:00:00.000Z",
      completedAt: "2026-08-06T10:01:00.000Z",
      completionReason: "answer" as const,
      finalAnswer: "A supported answer.",
      finalConfidence: "high" as const,
      actions: [
        {
          id: "action-run-demo-valid123-1",
          number: 1,
          type: "ANSWER" as const,
          explanation: "The policy supports an answer.",
          timestamp: "2026-08-06T10:01:00.000Z",
          input: { answer: "A supported answer.", confidence: "high" },
          observation: { kind: "answer" as const, answer: "A supported answer.", confidence: "high" as const },
          success: true,
        },
      ],
    };
    const reset = resetSimulationRun(completed, "2026-08-06T11:00:00.000Z");

    expect(reset).toMatchObject({ taskId: validRun.taskId, personaId: validRun.personaId, status: "ready", currentActionCount: 0, actions: [] });
    expect(reset.finalAnswer).toBeNull();
  });
});
