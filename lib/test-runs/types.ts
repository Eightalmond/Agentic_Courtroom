import type { SimulationActionEntry, SimulationState } from "@/lib/simulation/types";
import type { EvidenceBundle } from "@/lib/evidence/types";
import type { CourtroomState } from "@/lib/courtroom/types";

export const MIN_ACTIONS = 3;
export const MAX_ACTIONS = 10;

export type TaskCategory =
  | "Billing"
  | "Developer access"
  | "Security"
  | "Permissions"
  | "Data & reporting";

export type TaskDifficulty = "Focused" | "Moderate" | "Subtle";

export type CustomerTask = {
  id: string;
  title: string;
  question: string;
  scenario: string;
  category: TaskCategory;
  expectedRelevantPageSlugs: readonly string[];
  difficulty: TaskDifficulty;
  tags?: readonly string[];
};

export type CustomerPersona = {
  id: string;
  name: string;
  description: string;
  traits: readonly string[];
  defaultMaxActions: number;
  visualLabel?: string;
};

export const RUN_STATUSES = ["ready", "running", "completed", "failed"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export type TestRun = SimulationState & {
  id: string;
  taskId: string;
  personaId: string;
  maxActions: number;
  createdAt: string;
  productId: string;
  actions: readonly SimulationActionEntry[];
  evidenceBundle: EvidenceBundle | null;
  courtroom: CourtroomState;
};

export type NewRunInput = {
  taskId: string;
  personaId: string;
  maxActions: number;
};
