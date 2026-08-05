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

export const RUN_STATUSES = ["configured", "ready", "running", "completed", "failed"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export type TestRun = {
  id: string;
  taskId: string;
  personaId: string;
  maxActions: number;
  createdAt: string;
  status: RunStatus;
  productId: string;
  currentActionCount: number;
};

export type NewRunInput = {
  taskId: string;
  personaId: string;
  maxActions: number;
};
