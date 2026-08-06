import "server-only";

import {
  readSimulationProviderConfiguration,
  type GroqProviderConfiguration,
  type OpenAIProviderConfiguration,
  type SimulationEnvironment,
} from "../environment";
import type { CustomerDecisionProvider } from "../provider";
import { createGroqCustomerProvider } from "./groq";
import { createOpenAICustomerProvider } from "./openai";

type ProviderFactories = {
  groq(configuration: GroqProviderConfiguration): CustomerDecisionProvider;
  openai(configuration: OpenAIProviderConfiguration): CustomerDecisionProvider;
};

const providerFactories: ProviderFactories = {
  groq: createGroqCustomerProvider,
  openai: createOpenAICustomerProvider,
};

export function createSimulationProvider(
  environment: SimulationEnvironment = process.env,
  factories: ProviderFactories = providerFactories,
): CustomerDecisionProvider {
  const configuration = readSimulationProviderConfiguration(environment);

  if (configuration.provider === "groq") {
    return factories.groq(configuration);
  }

  return factories.openai(configuration);
}
