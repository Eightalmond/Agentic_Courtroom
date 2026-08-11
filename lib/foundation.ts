export type FoundationCheck = {
  label: string;
  complete: boolean;
};

export const workflowSteps = [
  {
    number: "01",
    title: "Add product knowledge",
    description: "Provide the documents and screenshots that define the experience under review.",
  },
  {
    number: "02",
    title: "Define a customer task",
    description: "Set one narrow, observable goal for a synthetic customer to attempt.",
  },
  {
    number: "03",
    title: "Watch the customer journey",
    description: "Follow the actions, decisions, and evidence collected throughout the attempt.",
  },
  {
    number: "04",
    title: "Review the courtroom verdict",
    description: "Compare both arguments and receive a grounded verdict with a recommendation.",
  },
] as const;

export const foundationChecks: readonly FoundationCheck[] = [
  { label: "Responsive application shell", complete: true },
  { label: "Local and Docker workflows", complete: true },
  { label: "Automated quality checks", complete: true },
  { label: "Vercel-compatible architecture", complete: true },
  { label: "Controlled FlowPilot knowledge base", complete: true },
  { label: "Browser-local test configuration", complete: true },
  { label: "Deterministic section retrieval", complete: true },
  { label: "Bounded synthetic customer simulation", complete: true },
  { label: "Deterministic evidence collection", complete: true },
  { label: "Independent courtroom advocates", complete: true },
  { label: "Evidence-grounded judge verdict", complete: true },
  { label: "Public demo presets and usage visibility", complete: true },
  { label: "Best-effort provider route limits", complete: true },
  { label: "Application security headers", complete: true },
];

export const futureCapabilities = [
  "Document and screenshot uploads",
  "Controlled live-site testing",
] as const;

export function getFoundationProgress(checks: readonly FoundationCheck[]) {
  const completed = checks.filter((check) => check.complete).length;
  const total = checks.length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { completed, total, percentage };
}
