import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import OpenAI from "openai";
import { z } from "zod";

import {
  COURTROOM_ARGUMENT_JSON_SCHEMA,
  CourtroomArgumentWireSchema,
  JUDGE_VERDICT_JSON_SCHEMA,
  JudgeVerdictWireSchema,
} from "@/lib/courtroom/schemas";

import {
  readGroqConfiguration,
  readSelectedProvider,
  readSimulationProviderConfiguration,
} from "../environment";
import type { StructuredGenerationProvider } from "../provider";
import { SimulationStepRequestSchema } from "../schemas";
import { createSimulationProvider } from "./factory";
import {
  createGroqClientOptions,
  createGroqCustomerProvider,
  GROQ_BASE_URL,
  GROQ_COURTROOM_TRANSPORT,
  GROQ_COURTROOM_MAX_COMPLETION_TOKENS,
  GROQ_JUDGE_MAX_COMPLETION_TOKENS,
  GROQ_MAX_RETRIES,
  formatGroqProviderDiagnostic,
  mapGroqProviderError,
  parseGroqDecisionOutput,
} from "./groq";
import { createOpenAICustomerProvider } from "./openai";
import { PROVIDER_MAX_RETRIES, PROVIDER_TIMEOUT_MS } from "./constants";

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

function provider(label: "groq" | "openai"): StructuredGenerationProvider {
  return {
    provider: label,
    async generateStructured() {
      return {};
    },
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
      maxRetries: PROVIDER_MAX_RETRIES,
      timeout: PROVIDER_TIMEOUT_MS,
    });
    expect(GROQ_BASE_URL).toBe("https://api.groq.com/openai/v1");
    expect(GROQ_MAX_RETRIES).toBe(0);
    expect(PROVIDER_TIMEOUT_MS).toBe(20_000);
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

  it("preserves safe provider failures instead of misclassifying them as invalid output", async () => {
    const create = vi.fn().mockRejectedValue(
      new OpenAI.AuthenticationError(401, { message: "raw provider detail" }, "raw provider response", new Headers()),
    );
    const selected = createGroqCustomerProvider(groqConfiguration, { responses: { create } });

    await expect(selected.decide({ instructions: "instructions", input: "input" })).rejects.toMatchObject({
      code: "GROQ_AUTHENTICATION_FAILED",
      retryable: false,
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it("supports one reusable structured courtroom request with the configured model", async () => {
    const courtroomWireOutput = {
      role: "prosecutor",
      thesis: "The journey had material friction.",
      keyClaims: [{ claim: "Required details were not seen.", evidenceIds: ["evidence-run-v1-item"], strength: "strong" }],
      strongestPointClaim: "Required details were not seen.",
      strongestPointEvidenceIds: ["evidence-run-v1-item"],
      acknowledgements: [],
      requestedVerdictDirection: "pass_with_friction",
      closingStatement: "The cited journey supports material friction.",
    };
    const responsesCreate = vi.fn();
    const chatCreate = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify(courtroomWireOutput) } }] });
    const selected = createGroqCustomerProvider(groqConfiguration, {
      responses: { create: responsesCreate },
      chat: { completions: { create: chatCreate } },
    });
    await expect(selected.generateStructured({
      useCase: "courtroom-argument",
      instructions: "shared",
      input: "same evidence",
      schemaName: "courtroom_prosecutor_argument",
      jsonSchema: COURTROOM_ARGUMENT_JSON_SCHEMA,
      zodSchema: CourtroomArgumentWireSchema,
      maxOutputTokens: 1_400,
    })).resolves.toEqual(courtroomWireOutput);
    expect(selected.provider).toBe("groq");
    expect(GROQ_COURTROOM_TRANSPORT).toBe("chat.completions.create");
    expect(chatCreate).toHaveBeenCalledOnce();
    expect(responsesCreate).not.toHaveBeenCalled();
    expect(chatCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: groqConfiguration.model,
      messages: [
        { role: "system", content: "shared" },
        { role: "user", content: "same evidence" },
      ],
      max_completion_tokens: GROQ_COURTROOM_MAX_COMPLETION_TOKENS,
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: expect.objectContaining({ name: "courtroom_prosecutor_argument", strict: true }),
      },
    }));
  });

  it("does not make a second courtroom request when Chat Completions returns malformed output", async () => {
    const responsesCreate = vi.fn();
    const chatCreate = vi.fn().mockResolvedValue({ choices: [{ message: { content: "not-json" } }] });
    const selected = createGroqCustomerProvider(groqConfiguration, {
      responses: { create: responsesCreate },
      chat: { completions: { create: chatCreate } },
    });

    await expect(selected.generateStructured({
      useCase: "courtroom-argument",
      instructions: "shared",
      input: "same evidence",
      schemaName: "courtroom_prosecutor_argument",
      jsonSchema: COURTROOM_ARGUMENT_JSON_SCHEMA,
      zodSchema: CourtroomArgumentWireSchema,
      maxOutputTokens: 1_400,
    })).rejects.toMatchObject({ code: "GROQ_INVALID_RESPONSE" });
    expect(chatCreate).toHaveBeenCalledOnce();
    expect(responsesCreate).not.toHaveBeenCalled();
  });

  it("uses one strict Chat Completions request with the larger judge budget", async () => {
    const output = {
      verdict: "pass",
      summary: "The record supports a pass.",
      findings: [{ title: "Supported", finding: "The answer is supported.", evidenceIds: ["evidence-run-v1-item"], weight: "major" }],
      prosecutorAssessment: { strongestSupportedPoint: "Some friction existed.", evidenceIds: ["evidence-run-v1-item"], overreachOrWeakness: "It did not block completion." },
      defenseAssessment: { strongestSupportedPoint: "The answer was correct.", evidenceIds: ["evidence-run-v1-item"], overreachOrWeakness: "It understates friction." },
      customerAnswerStatus: "supported",
      customerOutcomeExplanation: "The answer matches the source.",
      customerOutcomeEvidenceIds: ["evidence-run-v1-item"],
      primaryFrictionPresent: false,
      primaryFrictionTitle: "Not applicable",
      primaryFrictionExplanation: "No material friction was established.",
      primaryFrictionEvidenceIds: [],
      recommendationTitle: "Preserve clarity",
      recommendationAction: "Keep the policy easy to find.",
      recommendationRationale: "The cited source supported the answer.",
      recommendationEvidenceIds: ["evidence-run-v1-item"],
      confidence: "high",
    };
    const responsesCreate = vi.fn();
    const chatCreate = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify(output) } }] });
    const selected = createGroqCustomerProvider(groqConfiguration, {
      responses: { create: responsesCreate },
      chat: { completions: { create: chatCreate } },
    });
    await expect(selected.generateStructured({
      useCase: "courtroom-judge",
      instructions: "judge fairly",
      input: "evidence and arguments",
      schemaName: "courtroom_judge_verdict",
      jsonSchema: JUDGE_VERDICT_JSON_SCHEMA,
      zodSchema: JudgeVerdictWireSchema,
      maxOutputTokens: 2_400,
    })).resolves.toEqual(output);
    expect(chatCreate).toHaveBeenCalledOnce();
    expect(responsesCreate).not.toHaveBeenCalled();
    expect(chatCreate).toHaveBeenCalledWith(expect.objectContaining({
      max_completion_tokens: GROQ_JUDGE_MAX_COMPLETION_TOKENS,
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: expect.objectContaining({ name: "courtroom_judge_verdict", strict: true }) },
    }));
  });
});

describe("OpenAI reusable structured provider", () => {
  it("makes exactly one parsed request using the configured model and Zod format", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: { role: "defense" } });
    const selected = createOpenAICustomerProvider(
      { provider: "openai", apiKey: "test-key", model: "gpt-test" },
      { responses: { parse } },
    );
    await expect(selected.generateStructured({
      useCase: "courtroom-argument",
      instructions: "shared",
      input: "same evidence",
      schemaName: "courtroom_defense_argument",
      jsonSchema: { type: "object" },
      zodSchema: z.object({ role: z.literal("defense") }),
      maxOutputTokens: 1_400,
    })).resolves.toEqual({ role: "defense" });
    expect(selected.provider).toBe("openai");
    expect(parse).toHaveBeenCalledOnce();
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-test", input: "same evidence", store: false }));
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
      message: "The configured Groq credentials were rejected. Ask the demo owner to check deployment settings.",
      retryable: false,
    });
    expect(JSON.stringify(mapped.toSafeError())).not.toContain("secret raw response");
  });

  it("maps rate limits and timeouts to retryable stable errors", () => {
    expect(mapGroqProviderError(new OpenAI.RateLimitError(429, {}, "raw", new Headers({ "retry-after": "8" })))).toMatchObject({
      code: "GROQ_RATE_LIMITED",
      retryable: true,
      modelCallConsumed: true,
      retryAfterSeconds: 8,
    });
    expect(
      mapGroqProviderError(
        new OpenAI.APIError(
          413,
          { message: "secret token limit details", code: "rate_limit_exceeded", type: "tokens" },
          "secret raw response",
          new Headers(),
        ),
      ),
    ).toMatchObject({
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

  it("maps structured-output request errors safely and exposes only sanitized development diagnostics", () => {
    const error = new OpenAI.BadRequestError(
      400,
      {
        message: "secret raw JSON schema body",
        code: "json_schema_invalid",
        type: "invalid_request_error",
      },
      "secret raw response",
      new Headers(),
    );
    expect(mapGroqProviderError(error).toSafeError()).toEqual({
      code: "GROQ_STRUCTURED_OUTPUT_ERROR",
      message: "Groq rejected the structured-output request. Check the configured model and schema compatibility.",
      retryable: false,
    });
    const diagnostic = formatGroqProviderDiagnostic(error, "courtroom_prosecutor_argument");
    expect(diagnostic).toEqual({
      operation: "courtroom_prosecutor_argument",
      status: 400,
      code: "json_schema_invalid",
      type: "invalid_request_error",
      description: "Groq rejected the JSON Schema structured-output request.",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("secret raw");
  });

  it("classifies Groq JSON validation failures without exposing the provider body", () => {
    const error = new OpenAI.BadRequestError(
      400,
      {
        message: "secret generated JSON",
        code: "json_validate_failed",
        type: "invalid_request_error",
      },
      "secret raw response",
      new Headers(),
    );
    const diagnostic = formatGroqProviderDiagnostic(error, "courtroom_defense_argument");
    expect(diagnostic).toMatchObject({
      status: 400,
      code: "json_validate_failed",
      type: "invalid_request_error",
      description: "Groq could not complete a response that matched the requested JSON Schema.",
    });
    expect(mapGroqProviderError(error).toSafeError()).toEqual({
      code: "GROQ_STRUCTURED_OUTPUT_ERROR",
      message: "Groq could not complete valid structured output. Try the courtroom request again.",
      retryable: true,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
  });
});
