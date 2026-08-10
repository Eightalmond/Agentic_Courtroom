import "server-only";

import OpenAI, { type ClientOptions } from "openai";

import { SimulationError } from "../errors";
import type { GroqProviderConfiguration } from "../environment";
import type { StructuredGenerationInput, StructuredGenerationProvider } from "../provider";
import { CUSTOMER_DECISION_JSON_SCHEMA, CustomerDecisionWireSchema, parseCustomerDecision } from "../schemas";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_MAX_RETRIES = 0;
export const GROQ_COURTROOM_TRANSPORT = "chat.completions.create" as const;
export const GROQ_COURTROOM_MAX_COMPLETION_TOKENS = 4_000;
export const GROQ_JUDGE_MAX_COMPLETION_TOKENS = 6_000;
const PROVIDER_TIMEOUT_MS = 20_000;
const MAX_PROVIDER_OUTPUT_CHARACTERS = 12_000;

type GroqResponsesClient = {
  responses: {
    create(request: unknown): Promise<{ output_text: string }>;
  };
  chat?: {
    completions: {
      create(request: unknown): Promise<{ choices: readonly { message: { content: string | null } }[] }>;
    };
  };
};

export type SafeGroqProviderDiagnostic = Readonly<{
  operation: string;
  status: number | null;
  code: string | null;
  type: string | null;
  description: string;
}>;

function safeDiagnosticToken(value: unknown) {
  return typeof value === "string" && /^[a-z0-9._-]{1,80}$/i.test(value) ? value : null;
}

function safeGroqDescription(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const errorName = error instanceof Error ? error.constructor.name : "";
  const providerCode = error instanceof OpenAI.APIError ? error.code : null;

  if (providerCode === "json_validate_failed") {
    return "Groq could not complete a response that matched the requested JSON Schema.";
  }
  if (errorName === "LengthFinishReasonError" || message.includes("length limit")) {
    return "The structured response reached its output-token limit.";
  }
  if (message.includes("json schema") || message.includes("json_schema") || message.includes("response_format")) {
    return "Groq rejected the JSON Schema structured-output request.";
  }
  if (error instanceof OpenAI.BadRequestError || error instanceof OpenAI.UnprocessableEntityError) {
    return "Groq rejected the structured-output request.";
  }
  if (error instanceof OpenAI.APIError) {
    return "Groq returned a provider API error.";
  }
  return "The OpenAI-compatible client could not complete the structured-output request.";
}

export function formatGroqProviderDiagnostic(
  error: unknown,
  operation = "structured_output",
): SafeGroqProviderDiagnostic {
  const apiError = error instanceof OpenAI.APIError ? error : null;
  return {
    operation,
    status: typeof apiError?.status === "number" ? apiError.status : null,
    code: safeDiagnosticToken(apiError?.code),
    type: safeDiagnosticToken(apiError?.type),
    description: safeGroqDescription(error),
  };
}

function logGroqProviderDiagnostic(error: unknown, operation: string) {
  if (process.env.NODE_ENV === "development") {
    console.error("[groq] safe provider diagnostic", formatGroqProviderDiagnostic(error, operation));
  }
}

export function createGroqClientOptions(configuration: GroqProviderConfiguration): ClientOptions {
  return {
    apiKey: configuration.apiKey,
    baseURL: GROQ_BASE_URL,
    maxRetries: GROQ_MAX_RETRIES,
    timeout: PROVIDER_TIMEOUT_MS,
  };
}

export function parseGroqStructuredOutput(output: unknown) {
  if (typeof output !== "string" || output.length === 0 || output.length > MAX_PROVIDER_OUTPUT_CHARACTERS) {
    throw new SimulationError(
      "GROQ_INVALID_RESPONSE",
      "Groq returned invalid structured output. Try again.",
      502,
      true,
      true,
    );
  }

  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new SimulationError(
      "GROQ_INVALID_RESPONSE",
      "Groq returned invalid structured output. Try again.",
      502,
      true,
      true,
    );
  }
}

export function parseGroqDecisionOutput(output: unknown) {
  try {
    return parseCustomerDecision(parseGroqStructuredOutput(output));
  } catch (error) {
    if (error instanceof SimulationError) throw error;
    throw new SimulationError(
      "GROQ_INVALID_RESPONSE",
      "Groq returned an invalid structured action. Try this step again.",
      502,
      true,
      true,
    );
  }
}

export function mapGroqProviderError(error: unknown): SimulationError {
  if (error instanceof SimulationError) {
    return error;
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new SimulationError("GROQ_TIMEOUT", "The Groq request timed out. Try this step again.", 504, true, true);
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new SimulationError(
      "GROQ_AUTHENTICATION_FAILED",
      "Groq rejected the server credentials. Check GROQ_API_KEY and try again.",
      502,
      false,
      true,
    );
  }
  if (
    error instanceof OpenAI.RateLimitError ||
    (error instanceof OpenAI.APIError && error.code === "rate_limit_exceeded")
  ) {
    return new SimulationError("GROQ_RATE_LIMITED", "Groq is temporarily rate limited. Try again shortly.", 429, true, true);
  }
  if (error instanceof OpenAI.BadRequestError || error instanceof OpenAI.UnprocessableEntityError) {
    const generatedJsonFailed = error.code === "json_validate_failed";
    return new SimulationError(
      "GROQ_STRUCTURED_OUTPUT_ERROR",
      generatedJsonFailed
        ? "Groq could not complete valid structured output. Try the courtroom request again."
        : "Groq rejected the structured-output request. Check the configured model and schema compatibility.",
      502,
      generatedJsonFailed,
      true,
    );
  }
  if (error instanceof Error && error.constructor.name === "LengthFinishReasonError") {
    return new SimulationError(
      "GROQ_OUTPUT_LIMIT_REACHED",
      "Groq reached the structured-output token limit. Try a shorter request.",
      502,
      true,
      true,
    );
  }

  return new SimulationError("GROQ_PROVIDER_ERROR", "The Groq request failed safely. Try this step again.", 502, true, true);
}

export function createGroqCustomerProvider(
  configuration: GroqProviderConfiguration,
  injectedClient?: GroqResponsesClient,
): StructuredGenerationProvider {
  const client =
    injectedClient ??
    (new OpenAI(createGroqClientOptions(configuration)) as unknown as GroqResponsesClient);

  async function generateStructured({
    useCase,
    instructions,
    input,
    schemaName,
    jsonSchema,
    maxOutputTokens,
  }: StructuredGenerationInput) {
    try {
      if (useCase === "courtroom-argument" || useCase === "courtroom-judge") {
        if (!client.chat) {
          throw new SimulationError(
            "GROQ_PROVIDER_ERROR",
            "The Groq courtroom transport is unavailable.",
            502,
            false,
            false,
          );
        }
        const response = await client.chat.completions.create({
          model: configuration.model,
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: input },
          ],
          max_completion_tokens: Math.max(
            maxOutputTokens,
            useCase === "courtroom-judge" ? GROQ_JUDGE_MAX_COMPLETION_TOKENS : GROQ_COURTROOM_MAX_COMPLETION_TOKENS,
          ),
          reasoning_effort: "low",
          response_format: {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              schema: jsonSchema,
              strict: true,
            },
          },
        });
        return parseGroqStructuredOutput(response.choices[0]?.message.content);
      }

      const response = await client.responses.create({
        model: configuration.model,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            schema: jsonSchema,
            strict: true,
          },
        },
      });

      return parseGroqStructuredOutput(response.output_text);
    } catch (error) {
      logGroqProviderDiagnostic(error, schemaName);
      throw mapGroqProviderError(error);
    }
  }

  return {
    provider: "groq",
    generateStructured,
    async decide({ instructions, input }) {
      try {
        return parseCustomerDecision(await generateStructured({
          useCase: "customer-decision",
          instructions,
          input,
          schemaName: "customer_decision",
          jsonSchema: CUSTOMER_DECISION_JSON_SCHEMA,
          zodSchema: CustomerDecisionWireSchema,
          maxOutputTokens: 500,
        }));
      } catch (error) {
        if (error instanceof SimulationError && error.code === "GROQ_INVALID_RESPONSE") throw error;
        throw new SimulationError(
          "GROQ_INVALID_RESPONSE",
          "Groq returned an invalid structured action. Try this step again.",
          502,
          true,
          true,
        );
      }
    },
  };
}
