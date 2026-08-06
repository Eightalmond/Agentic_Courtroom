import "server-only";

import OpenAI, { type ClientOptions } from "openai";

import { SimulationError } from "../errors";
import type { GroqProviderConfiguration } from "../environment";
import type { CustomerDecisionProvider } from "../provider";
import { CUSTOMER_DECISION_JSON_SCHEMA, parseCustomerDecision } from "../schemas";

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

export function parseGroqDecisionOutput(output: unknown) {
  if (typeof output !== "string" || output.length === 0 || output.length > MAX_PROVIDER_OUTPUT_CHARACTERS) {
    throw new SimulationError(
      "GROQ_INVALID_RESPONSE",
      "Groq returned an invalid structured action. Try this step again.",
      502,
      true,
      true,
    );
  }

  try {
    return parseCustomerDecision(JSON.parse(output) as unknown);
  } catch {
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
): CustomerDecisionProvider {
  const client =
    injectedClient ??
    (new OpenAI(createGroqClientOptions(configuration)) as unknown as GroqResponsesClient);

  return {
    async decide({ instructions, input }) {
      try {
        const response = await client.responses.create({
          model: configuration.model,
          instructions,
          input,
          max_output_tokens: 500,
          text: {
            format: {
              type: "json_schema",
              name: "customer_decision",
              schema: CUSTOMER_DECISION_JSON_SCHEMA,
              strict: true,
            },
          },
        });

        return parseGroqDecisionOutput(response.output_text);
      } catch (error) {
        throw mapGroqProviderError(error);
      }
    },
  };
}
