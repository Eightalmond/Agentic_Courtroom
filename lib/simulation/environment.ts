import { SimulationError } from "./errors";

export type OpenAIEnvironment = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  [key: string]: string | undefined;
};

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
