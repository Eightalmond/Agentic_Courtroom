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
  MAX_ACTIONS,
  MIN_ACTIONS,
  parseStoredRun,
  readLocalRun,
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
    expect(validRun).toMatchObject({ status: "ready", currentActionCount: 0, productId: "flowpilot" });
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
});
