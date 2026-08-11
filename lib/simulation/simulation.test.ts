import { describe, expect, it, vi } from "vitest";

import { getCustomerPersona, getCustomerTask } from "@/lib/test-runs";

import { readOpenAIConfiguration } from "./environment";
import { SimulationError, mapProviderError } from "./errors";
import { requestSimulationStep, SimulationClientError } from "./client";
import { buildCustomerPrompt } from "./prompt";
import type { CustomerDecisionProvider } from "./provider";
import { CustomerDecisionSchema, SimulationStepResponseSchema } from "./schemas";
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

  it.each([
    ["SEARCH", decisions[0]],
    ["OPEN_PAGE", decisions[1]],
    ["INSPECT_SECTION", decisions[2]],
  ])("increments once for a successful %s action", (_label, decision) => {
    const result = executeCustomerAction(decision, request({ currentActionCount: 1, modelCallCount: 3, history: history(1) }));
    expect(result.action).toMatchObject({ number: 2, success: true });
    expect(result.simulation).toMatchObject({ currentActionCount: 2, modelCallCount: 4 });
  });

  it("rejects invalid page and section actions without creating a customer action", async () => {
    for (const decision of [
      { action: "OPEN_PAGE", explanation: "Open a page.", pageSlug: "not-a-page" } as const,
      { action: "INSPECT_SECTION", explanation: "Inspect a section.", sectionId: "not-a-section" } as const,
    ]) {
      const provider = { decide: vi.fn().mockResolvedValue(decision) } satisfies CustomerDecisionProvider;
      const error = await runSimulationStep(request({ currentActionCount: 1, modelCallCount: 2, history: history(1) }), provider).catch((caught) => caught);
      expect(error).toMatchObject({
        code: "INVALID_TOOL_ACTION",
        simulation: { status: "failed", currentActionCount: 1, modelCallCount: 3, completionReason: null },
      });
      expect(provider.decide).toHaveBeenCalledOnce();
    }
  });

  it("completes answer and give-up actions without evaluating them", () => {
    const answer = executeCustomerAction(decisions[3], request());
    const giveUp = executeCustomerAction(decisions[4], request());
    expect(answer.simulation).toMatchObject({ status: "completed", completionReason: "answer", finalConfidence: "high" });
    expect(giveUp.simulation).toMatchObject({ status: "completed", completionReason: "gave_up" });
    expect(answer.simulation.currentActionCount).toBe(1);
    expect(giveUp.simulation.currentActionCount).toBe(1);
    expect(JSON.stringify(answer)).not.toMatch(/verdict|pass|fail/i);
  });

  it("increments action numbers and completes exactly at budget exhaustion", () => {
    const result = executeCustomerAction(decisions[0], request({ maxActions: 3, currentActionCount: 2, modelCallCount: 2 }));
    expect(result.action.number).toBe(3);
    expect(result.simulation).toMatchObject({ status: "completed", currentActionCount: 3, modelCallCount: 3, completionReason: "budget_exhausted" });
    expect(result.simulation.finalAnswer).toBeNull();
  });

  it("rejects a failed action masquerading as a successful step response", () => {
    const response = executeCustomerAction(decisions[0], request());
    expect(SimulationStepResponseSchema.safeParse(response).success).toBe(true);
    expect(SimulationStepResponseSchema.safeParse({
      ...response,
      action: { ...response.action, success: false, error: { code: "TOOL_FAILED", message: "Failed." } },
    }).success).toBe(false);
  });
});

describe("prompt and provider safeguards", () => {
  it("includes task, persona, budget, compact history, and an untrusted-data boundary", () => {
    const task = { ...getCustomerTask("trial-cancellation")!, expectedRelevantPageSlugs: ["secret-expected-page"] };
    const prompt = buildCustomerPrompt(task, getCustomerPersona("careful-researcher")!, request({ currentActionCount: 1, modelCallCount: 1 }));
    const combined = `${prompt.instructions}\n${prompt.input}`;
    expect(combined).toContain("Careful researcher");
    expect(combined).toContain("Can I cancel the Pro free trial");
    expect(combined).toContain("3 of 4 successful actions remain");
    expect(combined).toContain("Provider failures do not consume this budget");
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

  it.each([
    ["GROQ_RATE_LIMITED", true],
    ["PROVIDER_RATE_LIMIT", true],
    ["PROVIDER_TIMEOUT", true],
    ["GROQ_AUTHENTICATION_FAILED", true],
    ["OPENAI_API_KEY_MISSING", false],
    ["MALFORMED_PROVIDER_RESPONSE", true],
  ])("keeps %s outside the customer-action budget", (code, modelCallConsumed) => {
    const error = new SimulationError(code, "The provider attempt failed safely.", 502, true, modelCallConsumed);
    const state = stateAfterFailedStep(
      request({ maxActions: 3, currentActionCount: 2, modelCallCount: 7, history: history(2) }),
      error,
      "2026-08-06T10:00:00.000Z",
    );
    expect(state).toMatchObject({
      status: "failed",
      currentActionCount: 2,
      modelCallCount: modelCallConsumed ? 8 : 7,
      completedAt: null,
      completionReason: null,
    });
  });

  it("retries the same next action number and increments exactly once after success", () => {
    const source = request({ maxActions: 4, currentActionCount: 2, modelCallCount: 5, history: history(2) });
    const failed = stateAfterFailedStep(
      source,
      new SimulationError("GROQ_RATE_LIMITED", "Rate limited.", 429, true, true),
      "2026-08-06T10:00:00.000Z",
    );
    const retried = executeCustomerAction(decisions[2], { ...source, ...failed });

    expect(failed.currentActionCount).toBe(2);
    expect(retried.action.number).toBe(3);
    expect(retried.simulation).toMatchObject({ currentActionCount: 3, modelCallCount: 7 });
  });

  it("never exhausts the action budget through repeated provider failures", () => {
    let active = request({ maxActions: 3, currentActionCount: 2, modelCallCount: 2, history: history(2) });
    const error = new SimulationError("GROQ_RATE_LIMITED", "Rate limited.", 429, true, true);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const failed = stateAfterFailedStep(active, error);
      active = {
        ...active,
        status: failed.status,
        currentActionCount: failed.currentActionCount,
        modelCallCount: failed.modelCallCount,
        startedAt: failed.startedAt,
      };
    }

    expect(active).toMatchObject({ status: "failed", currentActionCount: 2, modelCallCount: 22 });
    expect(() => validateSimulationRequest(active)).not.toThrow();
  });

  it("keeps a local application 429 outside persisted customer action state", async () => {
    const source = request({ currentActionCount: 2, modelCallCount: 4, history: history(2) });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: "DEMO_RATE_LIMITED",
        message: "No customer action was consumed.",
        retryable: true,
        retryAfterSeconds: 8,
      },
    }), { status: 429, headers: { "content-type": "application/json", "retry-after": "8" } }));

    const error = await requestSimulationStep(source, fetcher).catch((caught) => caught);
    expect(error).toBeInstanceOf(SimulationClientError);
    expect(error).toMatchObject({ safeError: { code: "DEMO_RATE_LIMITED", retryAfterSeconds: 8 }, simulation: undefined });
    expect(source).toMatchObject({ currentActionCount: 2, modelCallCount: 4 });
  });
});
