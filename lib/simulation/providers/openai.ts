import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { SimulationError, mapProviderError } from "../errors";
import type { OpenAIProviderConfiguration } from "../environment";
import type { CustomerDecisionProvider } from "../provider";
import { CustomerDecisionWireSchema, parseCustomerDecision } from "../schemas";

const PROVIDER_TIMEOUT_MS = 20_000;

type OpenAIResponsesClient = {
  responses: {
    parse(request: unknown): Promise<{ output_parsed: unknown }>;
  };
};

export function createOpenAICustomerProvider(
  configuration: OpenAIProviderConfiguration,
  injectedClient?: OpenAIResponsesClient,
): CustomerDecisionProvider {
  const client =
    injectedClient ??
    (new OpenAI({
      apiKey: configuration.apiKey,
      maxRetries: 0,
      timeout: PROVIDER_TIMEOUT_MS,
    }) as unknown as OpenAIResponsesClient);

  return {
    async decide({ instructions, input }) {
      try {
        const response = await client.responses.parse({
          model: configuration.model,
          instructions,
          input,
          max_output_tokens: 500,
          store: false,
          text: { format: zodTextFormat(CustomerDecisionWireSchema, "customer_decision") },
        });

        if (!response.output_parsed) {
          throw new SimulationError(
            "MALFORMED_PROVIDER_RESPONSE",
            "The model did not return a usable structured action. Try this step again.",
            502,
            true,
            true,
          );
        }

        try {
          return parseCustomerDecision(response.output_parsed);
        } catch {
          throw new SimulationError(
            "MALFORMED_PROVIDER_RESPONSE",
            "The model returned an invalid action shape. Try this step again.",
            502,
            true,
            true,
          );
        }
      } catch (error) {
        throw mapProviderError(error);
      }
    },
  };
}
