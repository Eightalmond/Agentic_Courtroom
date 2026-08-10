import "server-only";

import {
  readSimulationProviderConfiguration,
  type GroqProviderConfiguration,
  type OpenAIProviderConfiguration,
  type SimulationEnvironment,
} from "../environment";
import type { StructuredGenerationProvider } from "../provider";
import { createGroqCustomerProvider } from "./groq";
import { createOpenAICustomerProvider } from "./openai";

type ProviderFactories = {
  groq(configuration: GroqProviderConfiguration): StructuredGenerationProvider;
  openai(configuration: OpenAIProviderConfiguration): StructuredGenerationProvider;
};

const providerFactories: ProviderFactories = {
  groq: createGroqCustomerProvider,
  openai: createOpenAICustomerProvider,
};

export function createSimulationProvider(
  environment: SimulationEnvironment = process.env,
  factories: ProviderFactories = providerFactories,
): StructuredGenerationProvider {
  const configuration = readSimulationProviderConfiguration(environment);

  if (configuration.provider === "groq") {
    return factories.groq(configuration);
  }

  return factories.openai(configuration);
}
