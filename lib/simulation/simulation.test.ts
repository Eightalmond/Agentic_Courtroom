import { describe, expect, it, vi } from "vitest";

import { getCustomerPersona, getCustomerTask } from "@/lib/test-runs";

import { readOpenAIConfiguration } from "./environment";
import { SimulationError, mapProviderError } from "./errors";
import { buildCustomerPrompt } from "./prompt";
import type { CustomerDecisionProvider } from "./provider";
import { CustomerDecisionSchema } from "./schemas";
import { runSimulationStep, stateAfterFailedStep, validateSimulationRequest } from "./step";
import { executeCustomerAction } from "./tools";
import type { CustomerDecision, SimulationStepRequest } from "./types";

function history(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    type: "SEARCH" as const,
    explanation: "Looked for the relevant policy.",
    observation: "Found a bounded product section.",
    success: true,
  }));
}

function request(overrides: Partial<SimulationStepRequest> = {}): SimulationStepRequest {
  const currentActionCount = overrides.currentActionCount ?? 0;
  return {
    runId: "run-simulation-test",
    taskId: "trial-cancellation",
    personaId: "careful-researcher",
    maxActions: 4,
    status: "ready",
    currentActionCount,
    modelCallCount: overrides.modelCallCount ?? currentActionCount,
    startedAt: null,
    history: overrides.history ?? history(currentActionCount),
    currentPageSlug: null,
    currentSectionId: null,
    latestSearchResults: [],
    ...overrides,
  };
}

const decisions: readonly CustomerDecision[] = [
  { action: "SEARCH", explanation: "Search for billing terms.", query: "trial cancellation" },
  { action: "OPEN_PAGE", explanation: "Open the billing page.", pageSlug: "free-trial-and-billing" },
  {
    action: "INSPECT_SECTION",
    explanation: "Read the cancellation detail.",
    sectionId: "flowpilot-free-trial-and-billing-automatic-billing-after-the-trial",
  },
  {
    action: "ANSWER",
    explanation: "The policy now supports an answer.",
    answer: "Yes. Cancelling before day 14 prevents the first charge.",
    confidence: "high",
  },
  { action: "GIVE_UP", explanation: "The available content is insufficient.", reason: "I could not verify the requirement." },
];

describe("customer decision schema", () => {
  it.each(decisions)("accepts $action", (decision) => {
    expect(CustomerDecisionSchema.parse(decision)).toEqual(decision);
  });

  it("rejects unknown actions", () => {
    expect(CustomerDecisionSchema.safeParse({ action: "VISIT_URL", explanation: "Leave the product." }).success).toBe(false);
  });

  it("enforces public string limits and rejects markup", () => {
    expect(CustomerDecisionSchema.safeParse({ action: "SEARCH", explanation: "Search.", query: "x".repeat(161) }).success).toBe(false);
    expect(CustomerDecisionSchema.safeParse({ action: "GIVE_UP", explanation: "<b>Stop</b>", reason: "No evidence." }).success).toBe(false);
  });
});

describe("simulation request boundary", () => {
  it("rejects unknown task IDs", () => {
    expect(() => validateSimulationRequest(request({ taskId: "unknown-task" }))).toThrowError(expect.objectContaining({ code: "UNKNOWN_TASK" }));
  });

  it("rejects unknown persona IDs", () => {
    expect(() => validateSimulationRequest(request({ personaId: "unknown-persona" }))).toThrowError(expect.objectContaining({ code: "UNKNOWN_PERSONA" }));
  });

  it("rejects completed runs and exhausted budgets", () => {
    expect(() => validateSimulationRequest(request({ status: "completed" }))).toThrowError(expect.objectContaining({ code: "RUN_COMPLETED" }));
    expect(() => validateSimulationRequest(request({ currentActionCount: 4, modelCallCount: 4, history: history(4) }))).toThrowError(
      expect.objectContaining({ code: "ACTION_BUDGET_EXHAUSTED" }),
    );
  });

  it("does not call the provider when deterministic validation fails", async () => {
    const provider = { decide: vi.fn() } satisfies CustomerDecisionProvider;
    await expect(runSimulationStep(request({ taskId: "unknown-task" }), provider)).rejects.toMatchObject({ code: "UNKNOWN_TASK" });
    expect(provider.decide).not.toHaveBeenCalled();
  });

  it("rejects oversized action history before the provider boundary", async () => {
    const provider = { decide: vi.fn() } satisfies CustomerDecisionProvider;
    const oversized = {
      ...request(),
      currentActionCount: 11,
      modelCallCount: 11,
      history: history(11),
    };
    await expect(runSimulationStep(oversized, provider)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(provider.decide).not.toHaveBeenCalled();
  });
});

describe("deterministic action execution", () => {
  it("uses real retrieval results for search actions", () => {
    const result = executeCustomerAction(decisions[0], request(), { now: "2026-08-06T10:00:00.000Z" });
    expect(result.action.observation).toMatchObject({ kind: "search", query: "trial cancellation" });
    if (result.action.observation.kind === "search") {
      expect(result.action.observation.results[0]).toMatchObject({ pageSlug: "free-trial-and-billing" });
      expect(result.action.observation.results.some((item) => item.pageSlug === "cancellation-policy")).toBe(true);
    }
  });

  it("records tool errors for unknown pages and sections without a repair call", () => {
    const page = executeCustomerAction(
      { action: "OPEN_PAGE", explanation: "Open a page.", pageSlug: "not-a-page" },
      request(),
    );
    const section = executeCustomerAction(
      { action: "INSPECT_SECTION", explanation: "Inspect a section.", sectionId: "not-a-section" },
      request(),
    );
    expect(page.action).toMatchObject({ success: false, error: { code: "UNKNOWN_PAGE" } });
    expect(section.action).toMatchObject({ success: false, error: { code: "UNKNOWN_SECTION" } });
    expect(page.simulation.status).toBe("running");
  });

  it("completes answer and give-up actions without evaluating them", () => {
    const answer = executeCustomerAction(decisions[3], request());
    const giveUp = executeCustomerAction(decisions[4], request());
    expect(answer.simulation).toMatchObject({ status: "completed", completionReason: "answer", finalConfidence: "high" });
    expect(giveUp.simulation).toMatchObject({ status: "completed", completionReason: "gave_up" });
    expect(JSON.stringify(answer)).not.toMatch(/verdict|pass|fail/i);
  });

  it("increments action numbers and completes exactly at budget exhaustion", () => {
    const result = executeCustomerAction(decisions[0], request({ maxActions: 3, currentActionCount: 2, modelCallCount: 2 }));
    expect(result.action.number).toBe(3);
    expect(result.simulation).toMatchObject({ status: "completed", modelCallCount: 3, completionReason: "budget_exhausted" });
    expect(result.simulation.finalAnswer).toBeNull();
  });
});

describe("prompt and provider safeguards", () => {
  it("includes task, persona, budget, compact history, and an untrusted-data boundary", () => {
    const task = { ...getCustomerTask("trial-cancellation")!, expectedRelevantPageSlugs: ["secret-expected-page"] };
    const prompt = buildCustomerPrompt(task, getCustomerPersona("careful-researcher")!, request({ currentActionCount: 1, modelCallCount: 1 }));
    const combined = `${prompt.instructions}\n${prompt.input}`;
    expect(combined).toContain("Careful researcher");
    expect(combined).toContain("Can I cancel the Pro free trial");
    expect(combined).toContain("3 of 4 model calls remain");
    expect(combined).toContain("Compact action history");
    expect(combined).toContain("<untrusted_product_data");
    expect(combined).not.toContain("secret-expected-page");
    expect(combined).not.toContain("expectedRelevantPageSlugs");
  });

  it("maps provider failures without exposing raw messages", () => {
    const mapped = mapProviderError(new Error("sk-secret raw provider trace"));
    expect(mapped.toSafeError()).toEqual({
      code: "PROVIDER_FAILURE",
      message: "The model request failed safely. Try this step again.",
      retryable: true,
    });
    expect(JSON.stringify(mapped.toSafeError())).not.toContain("sk-secret");
  });

  it("loads environment configuration at request time", () => {
    expect(() => readOpenAIConfiguration({})).toThrowError(expect.objectContaining({ code: "OPENAI_API_KEY_MISSING" }));
    expect(() => readOpenAIConfiguration({ OPENAI_API_KEY: "test-key" })).toThrowError(expect.objectContaining({ code: "OPENAI_MODEL_MISSING" }));
    expect(readOpenAIConfiguration({ OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" })).toEqual({ apiKey: "test-key", model: "test-model" });
  });

  it("charges a provider failure to the budget without leaking the provider error", () => {
    const error = new SimulationError("PROVIDER_TIMEOUT", "The model request timed out. Try this step again.", 504, true, true);
    const state = stateAfterFailedStep(request({ maxActions: 3, currentActionCount: 2, modelCallCount: 2 }), error, "2026-08-06T10:00:00.000Z");
    expect(state).toMatchObject({ status: "completed", modelCallCount: 3, completionReason: "budget_exhausted" });
  });
});
