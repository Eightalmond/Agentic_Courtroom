import type { z } from "zod";

import type { CustomerDecisionSchema } from "./schemas";

export type CustomerDecision = z.infer<typeof CustomerDecisionSchema>;
export type CustomerActionType = CustomerDecision["action"];
export type Confidence = "low" | "medium" | "high";
export type CompletionReason = "answer" | "gave_up" | "budget_exhausted";
export const MAX_PROVIDER_REQUEST_ATTEMPTS = 1_000_000;

export type SearchResultSnapshot = {
  sectionId: string;
  pageSlug: string;
  pageTitle: string;
  sectionTitle: string;
  excerpt: string;
};

export type SimulationObservation =
  | { kind: "search"; query: string; results: readonly SearchResultSnapshot[] }
  | {
      kind: "page";
      pageSlug: string;
      pageTitle: string;
      summary: string;
      sections: readonly { id: string; title: string }[];
      callouts: readonly string[];
      relatedPages: readonly { slug: string; title: string }[];
    }
  | {
      kind: "section";
      sectionId: string;
      pageSlug: string;
      pageTitle: string;
      sectionTitle: string;
      content: string;
      callouts: readonly string[];
    }
  | { kind: "answer"; answer: string; confidence: Confidence }
  | { kind: "give_up"; reason: string }
  | { kind: "tool_error"; code: "UNKNOWN_PAGE" | "UNKNOWN_SECTION"; message: string };

export type SimulationActionEntry = {
  id: string;
  number: number;
  type: CustomerActionType;
  explanation: string;
  timestamp: string;
  input: Readonly<Record<string, string>>;
  observation: SimulationObservation;
  success: boolean;
  error?: { code: string; message: string };
};

export type SafeSimulationError = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
};

export type SimulationState = {
  status: "ready" | "running" | "completed" | "failed";
  currentActionCount: number;
  modelCallCount: number;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  currentPageSlug: string | null;
  currentSectionId: string | null;
  latestSearchResults: readonly SearchResultSnapshot[];
  finalAnswer: string | null;
  finalConfidence: Confidence | null;
  giveUpReason: string | null;
  completionReason: CompletionReason | null;
  lastError: SafeSimulationError | null;
};

export type CompactHistoryEntry = {
  number: number;
  type: CustomerActionType;
  explanation: string;
  observation: string;
  success: boolean;
};

export type SimulationStepRequest = {
  runId: string;
  taskId: string;
  personaId: string;
  maxActions: number;
  status: SimulationState["status"];
  currentActionCount: number;
  modelCallCount: number;
  startedAt: string | null;
  history: readonly CompactHistoryEntry[];
  currentPageSlug: string | null;
  currentSectionId: string | null;
  latestSearchResults: readonly SearchResultSnapshot[];
};

export type SimulationStepResponse = {
  action: SimulationActionEntry;
  simulation: SimulationState;
};
