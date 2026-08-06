export { SimulationError, mapProviderError } from "./errors";
export { readOpenAIConfiguration, type OpenAIEnvironment } from "./environment";
export { buildCustomerPrompt } from "./prompt";
export type { CustomerDecisionProvider, CustomerDecisionProviderInput } from "./provider";
export {
  CustomerDecisionSchema,
  CustomerDecisionWireSchema,
  parseCustomerDecision,
  SearchResultSnapshotSchema,
  SafeSimulationErrorSchema,
  SimulationActionEntrySchema,
  SimulationObservationSchema,
  SimulationStateSchema,
  SimulationStepRequestSchema,
  SimulationStepResponseSchema,
} from "./schemas";
export { runSimulationStep, stateAfterFailedStep, validateSimulationRequest } from "./step";
export { executeCustomerAction } from "./tools";
export type {
  CompactHistoryEntry,
  CompletionReason,
  Confidence,
  CustomerActionType,
  CustomerDecision,
  SafeSimulationError,
  SearchResultSnapshot,
  SimulationActionEntry,
  SimulationObservation,
  SimulationState,
  SimulationStepRequest,
  SimulationStepResponse,
} from "./types";
