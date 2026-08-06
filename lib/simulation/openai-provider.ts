import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { SimulationError, mapProviderError } from "./errors";
import { readOpenAIConfiguration, type OpenAIEnvironment } from "./environment";
import type { CustomerDecisionProvider } from "./provider";
import { CustomerDecisionWireSchema, parseCustomerDecision } from "./schemas";

const PROVIDER_TIMEOUT_MS = 20_000;

export function createOpenAICustomerProvider(environment: OpenAIEnvironment = process.env): CustomerDecisionProvider {
  const { apiKey, model } = readOpenAIConfiguration(environment);
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: PROVIDER_TIMEOUT_MS });

  return {
    async decide({ instructions, input }) {
      try {
        const response = await client.responses.parse({
          model,
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
