import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { SimulationError, mapProviderError } from "../errors";
import type { OpenAIProviderConfiguration } from "../environment";
import type { StructuredGenerationInput, StructuredGenerationProvider } from "../provider";
import { CustomerDecisionWireSchema, parseCustomerDecision } from "../schemas";
import { PROVIDER_MAX_RETRIES, PROVIDER_TIMEOUT_MS } from "./constants";

type OpenAIResponsesClient = {
  responses: {
    parse(request: unknown): Promise<{ output_parsed: unknown }>;
  };
};

export function createOpenAICustomerProvider(
  configuration: OpenAIProviderConfiguration,
  injectedClient?: OpenAIResponsesClient,
): StructuredGenerationProvider {
  const client =
    injectedClient ??
    (new OpenAI({
      apiKey: configuration.apiKey,
      maxRetries: PROVIDER_MAX_RETRIES,
      timeout: PROVIDER_TIMEOUT_MS,
    }) as unknown as OpenAIResponsesClient);

  async function generateStructured({
    instructions,
    input,
    schemaName,
    zodSchema,
    maxOutputTokens,
  }: StructuredGenerationInput) {
    try {
      const response = await client.responses.parse({
        model: configuration.model,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        store: false,
        text: { format: zodTextFormat(zodSchema, schemaName) },
      });

      if (!response.output_parsed) {
        throw new SimulationError(
          "MALFORMED_PROVIDER_RESPONSE",
          "The model did not return usable structured output. Try again.",
          502,
          true,
          true,
        );
      }
      return response.output_parsed;
    } catch (error) {
      throw mapProviderError(error);
    }
  }

  return {
    provider: "openai",
    generateStructured,
    async decide({ instructions, input }) {
      try {
        return parseCustomerDecision(await generateStructured({
          useCase: "customer-decision",
          instructions,
          input,
          schemaName: "customer_decision",
          jsonSchema: {},
          zodSchema: CustomerDecisionWireSchema,
          maxOutputTokens: 500,
        }));
      } catch (error) {
        if (error instanceof SimulationError) throw error;
        throw new SimulationError(
          "MALFORMED_PROVIDER_RESPONSE",
          "The model returned an invalid action shape. Try this step again.",
          502,
          true,
          true,
        );
      }
    },
  };
}
