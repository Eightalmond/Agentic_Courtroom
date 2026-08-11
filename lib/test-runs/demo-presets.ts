export const demoPresets = [
  {
    id: "best-first-demo",
    label: "Best first demo",
    description: "See whether an impatient prospective customer can confirm how trial cancellation affects billing.",
    taskId: "trial-cancellation",
    personaId: "impatient-first-time-customer",
    maxActions: 6,
  },
  {
    id: "discover-hidden-limit",
    label: "Discover hidden limit",
    description: "Send a skeptical buyer beyond plan headlines to find the concrete API allowance.",
    taskId: "api-allowance",
    personaId: "skeptical-buyer",
    maxActions: 7,
  },
  {
    id: "policy-trap",
    label: "Policy trap",
    description: "Test whether a frustrated customer distinguishes cancellation from an automatic refund.",
    taskId: "refund-after-renewal",
    personaId: "existing-frustrated-customer",
    maxActions: 6,
  },
] as const;

export type DemoPreset = (typeof demoPresets)[number];
