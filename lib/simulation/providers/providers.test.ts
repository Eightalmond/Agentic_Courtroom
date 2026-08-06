import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import OpenAI from "openai";

import {
  readGroqConfiguration,
  readSelectedProvider,
  readSimulationProviderConfiguration,
} from "../environment";
import type { CustomerDecisionProvider } from "../provider";
import { SimulationStepRequestSchema } from "../schemas";
import { createSimulationProvider } from "./factory";
import {
  createGroqClientOptions,
  createGroqCustomerProvider,
  GROQ_BASE_URL,
  GROQ_MAX_RETRIES,
  mapGroqProviderError,
  parseGroqDecisionOutput,
} from "./groq";

const groqConfiguration = {
  provider: "groq" as const,
  apiKey: "test-groq-key",
  model: "openai/gpt-oss-20b",
};

const validWireDecision = {
  action: "SEARCH",
  explanation: "Search the controlled product knowledge.",
  query: "trial cancellation",
  pageSlug: null,
  sectionId: null,
  answer: null,
  confidence: null,
  reason: null,
};

function provider(label: string): CustomerDecisionProvider {
  return {
    async decide() {
      return { action: "GIVE_UP", explanation: label, reason: "No evidence." };
    },
  };
}

describe("provider environment selection", () => {
  it("defaults to Groq when LLM_PROVIDER is absent or blank", () => {
    expect(readSelectedProvider({})).toBe("groq");
    expect(readSelectedProvider({ LLM_PROVIDER: "  " })).toBe("groq");
  });

  it("accepts each supported provider exactly", () => {
    expect(readSelectedProvider({ LLM_PROVIDER: "groq" })).toBe("groq");
    expect(readSelectedProvider({ LLM_PROVIDER: "openai" })).toBe("openai");
  });

  it("rejects unknown and differently cased provider names", () => {
    expect(() => readSelectedProvider({ LLM_PROVIDER: "anthropic" })).toThrowError(
      expect.objectContaining({ code: "LLM_PROVIDER_INVALID" }),
    );
    expect(() => readSelectedProvider({ LLM_PROVIDER: "GROQ" })).toThrowError(
      expect.objectContaining({ code: "LLM_PROVIDER_INVALID" }),
    );
  });

  it("validates only the selected provider credentials", () => {
    expect(
      readSimulationProviderConfiguration({
        LLM_PROVIDER: "groq",
        GROQ_API_KEY: "groq-key",
        GROQ_MODEL: "openai/gpt-oss-20b",
      }),
    ).toEqual({ provider: "groq", apiKey: "groq-key", model: "openai/gpt-oss-20b" });
    expect(
      readSimulationProviderConfiguration({
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "openai-key",
        OPENAI_MODEL: "gpt-test",
      }),
    ).toEqual({ provider: "openai", apiKey: "openai-key", model: "gpt-test" });
  });

  it("returns safe missing Groq credential errors", () => {
    expect(() => readGroqConfiguration({})).toThrowError(expect.objectContaining({ code: "GROQ_API_KEY_MISSING" }));
    expect(() => readGroqConfiguration({ GROQ_API_KEY: "key" })).toThrowError(
      expect.objectContaining({ code: "GROQ_MODEL_MISSING" }),
    );
  });

  it("does not accept provider selection in a simulation request", () => {
    const result = SimulationStepRequestSchema.safeParse({
      runId: "run-provider-boundary",
      taskId: "trial-cancellation",
      personaId: "careful-researcher",
      maxActions: 4,
      status: "ready",
      currentActionCount: 0,
      modelCallCount: 0,
      startedAt: null,
      history: [],
      currentPageSlug: null,
      currentSectionId: null,
      latestSearchResults: [],
      LLM_PROVIDER: "openai",
    });
    expect(result.success).toBe(false);
  });
});

describe("provider factory", () => {
  const groqFactory = vi.fn(() => provider("groq"));
  const openaiFactory = vi.fn(() => provider("openai"));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs only the selected Groq provider", () => {
    const selected = createSimulationProvider(
      { LLM_PROVIDER: "groq", GROQ_API_KEY: "key", GROQ_MODEL: "model" },
      { groq: groqFactory, openai: openaiFactory },
    );
    expect(selected).toBe(groqFactory.mock.results[0]?.value);
    expect(groqFactory).toHaveBeenCalledOnce();
    expect(openaiFactory).not.toHaveBeenCalled();
  });

  it("constructs only the selected OpenAI provider", () => {
    createSimulationProvider(
      { LLM_PROVIDER: "openai", OPENAI_API_KEY: "key", OPENAI_MODEL: "model" },
      { groq: groqFactory, openai: openaiFactory },
    );
    expect(openaiFactory).toHaveBeenCalledOnce();
    expect(groqFactory).not.toHaveBeenCalled();
  });

  it("does not fall back when selected-provider configuration is invalid", () => {
    expect(() =>
      createSimulationProvider(
        { LLM_PROVIDER: "groq", OPENAI_API_KEY: "key", OPENAI_MODEL: "model" },
        { groq: groqFactory, openai: openaiFactory },
      ),
    ).toThrowError(expect.objectContaining({ code: "GROQ_API_KEY_MISSING" }));
    expect(groqFactory).not.toHaveBeenCalled();
    expect(openaiFactory).not.toHaveBeenCalled();
  });
});

describe("Groq Responses provider", () => {
  it("uses a fixed official base URL with SDK retries disabled", () => {
    expect(createGroqClientOptions(groqConfiguration)).toMatchObject({
      baseURL: GROQ_BASE_URL,
      maxRetries: GROQ_MAX_RETRIES,
      timeout: 20_000,
    });
    expect(GROQ_BASE_URL).toBe("https://api.groq.com/openai/v1");
    expect(GROQ_MAX_RETRIES).toBe(0);
  });

  it("makes exactly one Responses API request and returns the Zod-validated decision", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: JSON.stringify(validWireDecision) });
    const selected = createGroqCustomerProvider(groqConfiguration, { responses: { create } });

    await expect(selected.decide({ instructions: "instructions", input: "input" })).resolves.toEqual({
      action: "SEARCH",
      explanation: validWireDecision.explanation,
      query: "trial cancellation",
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it("sends strict JSON Schema through the Responses API without unsupported persistence", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: JSON.stringify(validWireDecision) });
    await createGroqCustomerProvider(groqConfiguration, { responses: { create } }).decide({
      instructions: "instructions",
      input: "input",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-oss-20b",
        text: {
          format: expect.objectContaining({ type: "json_schema", name: "customer_decision", strict: true }),
        },
      }),
    );
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("store");
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("tools");
  });

  it("does not perform a repair request after an invalid response", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: "not-json" });
    const selected = createGroqCustomerProvider(groqConfiguration, { responses: { create } });
    await expect(selected.decide({ instructions: "instructions", input: "input" })).rejects.toMatchObject({
      code: "GROQ_INVALID_RESPONSE",
    });
    expect(create).toHaveBeenCalledOnce();
  });
});

describe("Groq response validation", () => {
  it("parses a complete valid wire response into its exact action shape", () => {
    expect(parseGroqDecisionOutput(JSON.stringify(validWireDecision))).toEqual({
      action: "SEARCH",
      explanation: validWireDecision.explanation,
      query: "trial cancellation",
    });
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["Markdown-wrapped JSON", `\`\`\`json\n${JSON.stringify(validWireDecision)}\n\`\`\``],
    ["unknown actions", JSON.stringify({ ...validWireDecision, action: "VISIT_URL" })],
    ["extra fields", JSON.stringify({ ...validWireDecision, secret: "raw" })],
    ["missing fields", JSON.stringify({ action: "SEARCH", explanation: "Search." })],
  ])("rejects %s without repair heuristics", (_label, output) => {
    expect(() => parseGroqDecisionOutput(output)).toThrowError(expect.objectContaining({ code: "GROQ_INVALID_RESPONSE" }));
  });
});

describe("Groq safe error mapping", () => {
  it("maps authentication failures without provider details", () => {
    const mapped = mapGroqProviderError(
      new OpenAI.AuthenticationError(401, { message: "secret raw response" }, "secret raw response", new Headers()),
    );
    expect(mapped.toSafeError()).toEqual({
      code: "GROQ_AUTHENTICATION_FAILED",
      message: "Groq rejected the server credentials. Check GROQ_API_KEY and try again.",
      retryable: false,
    });
    expect(JSON.stringify(mapped.toSafeError())).not.toContain("secret raw response");
  });

  it("maps rate limits and timeouts to retryable stable errors", () => {
    expect(mapGroqProviderError(new OpenAI.RateLimitError(429, {}, "raw", new Headers()))).toMatchObject({
      code: "GROQ_RATE_LIMITED",
      retryable: true,
      modelCallConsumed: true,
    });
    expect(mapGroqProviderError(new OpenAI.APIConnectionTimeoutError())).toMatchObject({
      code: "GROQ_TIMEOUT",
      retryable: true,
      modelCallConsumed: true,
    });
  });

  it("maps unknown failures to a generic error without leaking raw text", () => {
    const mapped = mapGroqProviderError(new Error("gsk_secret and stack"));
    expect(mapped.toSafeError()).toEqual({
      code: "GROQ_PROVIDER_ERROR",
      message: "The Groq request failed safely. Try this step again.",
      retryable: true,
    });
    expect(JSON.stringify(mapped.toSafeError())).not.toContain("gsk_secret");
  });
});
