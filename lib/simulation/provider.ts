import type { CustomerDecision } from "./types";
import type { z } from "zod";
import type { LlmProviderName } from "./environment";

export type CustomerDecisionProviderInput = {
  instructions: string;
  input: string;
};

export interface CustomerDecisionProvider {
  decide(input: CustomerDecisionProviderInput): Promise<CustomerDecision>;
}

export type StructuredGenerationInput = {
  instructions: string;
  input: string;
  schemaName: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  zodSchema: z.ZodType;
  maxOutputTokens: number;
};

export interface StructuredGenerationProvider extends CustomerDecisionProvider {
  readonly provider: LlmProviderName;
  generateStructured(input: StructuredGenerationInput): Promise<unknown>;
}
