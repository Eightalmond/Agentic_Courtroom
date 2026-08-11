import type { Confidence, CompletionReason } from "@/lib/simulation/types";

export const EVIDENCE_BUNDLE_VERSION = 1 as const;
export const MAX_CONTEXT_EVIDENCE = 3;
export const MAX_EVIDENCE_ITEMS = 80;

export type EvidenceCategory = "journey" | "supporting" | "contradicting" | "context" | "missing";
export type EvidenceSourceType =
  | "search-result"
  | "opened-page"
  | "inspected-section"
  | "page-callout"
  | "context-section"
  | "missing-section";
export type EvidenceCollectionMethod =
  | "journey-observation"
  | "task-evaluation-spec"
  | "deterministic-retrieval";
export type MechanicalFactCheckResult = "supported" | "unsupported" | "contradicted" | "not-assessable";
export type CustomerOutcome = "answered" | "gave-up" | "budget-exhausted";

export type EvidenceItem = Readonly<{
  evidenceId: string;
  category: EvidenceCategory;
  sourceType: EvidenceSourceType;
  productId: string;
  pageSlug: string;
  pageTitle: string;
  sectionId: string | null;
  sectionTitle: string | null;
  exactSourceText: string;
  excerpt: string;
  sourceLocation: string;
  customerSaw: boolean;
  firstExposedByAction: number | null;
  exposureActionNumbers: readonly number[];
  relevanceReason: string;
  relatedFactCheckIds: readonly string[];
  collectionMethod: EvidenceCollectionMethod;
  orderingIndex: number;
}>;

export type MechanicalFactCheck = Readonly<{
  id: string;
  name: string;
  result: MechanicalFactCheckResult;
  sourceSectionIds: readonly string[];
  explanation: string;
  limitation: string;
}>;

export type EvidenceCoverageSummary = Readonly<{
  journey: number;
  supporting: number;
  contradicting: number;
  context: number;
  missing: number;
  requiredEvidenceTotal: number;
  requiredEvidenceSeen: number;
  requiredEvidenceMissing: number;
}>;

export type EvidenceIntegrity = Readonly<{
  actionsProcessed: number;
  successfulToolObservations: number;
  failedToolActions: number;
  simulationCompletedNormally: boolean;
  actionBudgetExhausted: boolean;
  finalAnswerExists: boolean;
  requiredEvidenceSeen: boolean;
  journeyEvidenceCount: number;
  contextualEvidenceCount: number;
  missingEvidenceCount: number;
}>;

export type EvidenceBundle = Readonly<{
  version: typeof EVIDENCE_BUNDLE_VERSION;
  bundleId: string;
  runId: string;
  productId: string;
  taskId: string;
  personaId: string;
  createdAt: string;
  customerOutcome: CustomerOutcome;
  customerFinalAnswer: string | null;
  customerConfidence: Confidence | null;
  giveUpReason: string | null;
  completionReason: CompletionReason;
  journeySummary: string;
  evidenceItems: readonly EvidenceItem[];
  factChecks: readonly MechanicalFactCheck[];
  coverage: EvidenceCoverageSummary;
  missingRequiredEvidence: readonly string[];
  pagesVisited: readonly string[];
  sectionsInspected: readonly string[];
  searchQueries: readonly string[];
  integrity: EvidenceIntegrity;
}>;

export type EvidenceCollectionRequest = Readonly<{
  id: string;
  taskId: string;
  personaId: string;
  maxActions: number;
  createdAt: string;
  productId: string;
  status: "ready" | "running" | "completed" | "failed";
  currentActionCount: number;
  modelCallCount: number;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  actions: readonly import("@/lib/simulation/types").SimulationActionEntry[];
  currentPageSlug: string | null;
  currentSectionId: string | null;
  latestSearchResults: readonly import("@/lib/simulation/types").SearchResultSnapshot[];
  finalAnswer: string | null;
  finalConfidence: Confidence | null;
  giveUpReason: string | null;
  completionReason: CompletionReason | null;
  lastError: import("@/lib/simulation/types").SafeSimulationError | null;
}>;
