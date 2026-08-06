import { SimulationError } from "./errors";

export const DEFAULT_LLM_PROVIDER = "groq" as const;

export type LlmProviderName = "groq" | "openai";

export type SimulationEnvironment = {
  LLM_PROVIDER?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  [key: string]: string | undefined;
};

export type OpenAIEnvironment = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  [key: string]: string | undefined;
};

export type GroqEnvironment = {
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  [key: string]: string | undefined;
};

export type OpenAIProviderConfiguration = {
  provider: "openai";
  apiKey: string;
  model: string;
};

export type GroqProviderConfiguration = {
  provider: "groq";
  apiKey: string;
  model: string;
};

export type SimulationProviderConfiguration = OpenAIProviderConfiguration | GroqProviderConfiguration;

export function readSelectedProvider(environment: SimulationEnvironment = process.env): LlmProviderName {
  const provider = environment.LLM_PROVIDER?.trim() || DEFAULT_LLM_PROVIDER;

  if (provider !== "groq" && provider !== "openai") {
    throw new SimulationError(
      "LLM_PROVIDER_INVALID",
      "LLM_PROVIDER must be either groq or openai.",
      503,
    );
  }

  return provider;
}

export function readGroqConfiguration(environment: GroqEnvironment = process.env) {
  const apiKey = environment.GROQ_API_KEY?.trim();
  const model = environment.GROQ_MODEL?.trim();

  if (!apiKey) {
    throw new SimulationError(
      "GROQ_API_KEY_MISSING",
      "Add GROQ_API_KEY to the server environment before starting a Groq simulation.",
      503,
    );
  }
  if (!model) {
    throw new SimulationError(
      "GROQ_MODEL_MISSING",
      "Add GROQ_MODEL to the server environment before starting a Groq simulation.",
      503,
    );
  }
  if (model.length > 120) {
    throw new SimulationError("GROQ_MODEL_INVALID", "GROQ_MODEL is not a valid model identifier.", 503);
  }

  return { apiKey, model };
}

export function readOpenAIConfiguration(environment: OpenAIEnvironment = process.env) {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = environment.OPENAI_MODEL?.trim();

  if (!apiKey) {
    throw new SimulationError(
      "OPENAI_API_KEY_MISSING",
      "Add OPENAI_API_KEY to the server environment before starting a simulation.",
      503,
    );
  }
  if (!model) {
    throw new SimulationError(
      "OPENAI_MODEL_MISSING",
      "Add OPENAI_MODEL to the server environment before starting a simulation.",
      503,
    );
  }
  if (model.length > 120) {
    throw new SimulationError("OPENAI_MODEL_INVALID", "OPENAI_MODEL is not a valid model identifier.", 503);
  }

  return { apiKey, model };
}

export function readSimulationProviderConfiguration(
  environment: SimulationEnvironment = process.env,
): SimulationProviderConfiguration {
  const provider = readSelectedProvider(environment);

  if (provider === "groq") {
    return { provider, ...readGroqConfiguration(environment) };
  }

  return { provider, ...readOpenAIConfiguration(environment) };
}
