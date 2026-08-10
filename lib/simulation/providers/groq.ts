import "server-only";

import OpenAI, { type ClientOptions } from "openai";

import { SimulationError } from "../errors";
import type { GroqProviderConfiguration } from "../environment";
import type { StructuredGenerationInput, StructuredGenerationProvider } from "../provider";
import { CUSTOMER_DECISION_JSON_SCHEMA, CustomerDecisionWireSchema, parseCustomerDecision } from "../schemas";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_MAX_RETRIES = 0;
const PROVIDER_TIMEOUT_MS = 20_000;
const MAX_PROVIDER_OUTPUT_CHARACTERS = 5_000;

type GroqResponsesClient = {
  responses: {
    create(request: unknown): Promise<{ output_text: string }>;
  };
};

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
  if (error instanceof OpenAI.RateLimitError) {
    return new SimulationError("GROQ_RATE_LIMITED", "Groq is temporarily rate limited. Try again shortly.", 429, true, true);
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
    instructions,
    input,
    schemaName,
    jsonSchema,
    maxOutputTokens,
  }: StructuredGenerationInput) {
    try {
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
      throw mapGroqProviderError(error);
    }
  }

  return {
    provider: "groq",
    generateStructured,
    async decide({ instructions, input }) {
      try {
        return parseCustomerDecision(await generateStructured({
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
