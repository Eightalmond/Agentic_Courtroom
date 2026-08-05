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
];

export function getFoundationProgress(checks: readonly FoundationCheck[]) {
  const completed = checks.filter((check) => check.complete).length;
  const total = checks.length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { completed, total, percentage };
}
