import type { CustomerDecision } from "./types";

export type CustomerDecisionProviderInput = {
  instructions: string;
  input: string;
};

export interface CustomerDecisionProvider {
  decide(input: CustomerDecisionProviderInput): Promise<CustomerDecision>;
}
