import type { CustomerPersona, CustomerTask } from "./types";

export const customerTasks: readonly CustomerTask[] = [
  {
    id: "trial-cancellation",
    title: "Trial cancellation",
    question: "Can I cancel the Pro free trial before it ends without being charged?",
    scenario: "A prospective customer entered card details for Pro but wants to avoid the first charge.",
    category: "Billing",
    expectedRelevantPageSlugs: ["pricing", "free-trial-and-billing", "cancellation-policy"],
    difficulty: "Focused",
    tags: ["trial", "cancellation"],
  },
  {
    id: "api-allowance",
    title: "API allowance",
    question: "Does the Pro plan include API access, and how many API requests can I make?",
    scenario: "A developer is comparing plans and needs both eligibility and concrete usage limits.",
    category: "Developer access",
    expectedRelevantPageSlugs: ["pricing", "api-access", "api-rate-limits"],
    difficulty: "Subtle",
    tags: ["api", "limits", "pro"],
  },
  {
    id: "refund-after-renewal",
    title: "Refund after renewal",
    question: "I forgot to cancel before renewal. Will cancelling now automatically refund the charge?",
    scenario: "An existing customer noticed a renewal charge and is deciding what cancellation will do.",
    category: "Billing",
    expectedRelevantPageSlugs: ["cancellation-policy", "refund-policy", "free-trial-and-billing"],
    difficulty: "Moderate",
    tags: ["refund", "renewal", "cancellation"],
  },
  {
    id: "hipaa-suitability",
    title: "HIPAA suitability",
    question: "Can my healthcare team use FlowPilot for protected health information?",
    scenario: "A healthcare team is checking whether FlowPilot meets a critical compliance requirement.",
    category: "Security",
    expectedRelevantPageSlugs: ["security-and-privacy"],
    difficulty: "Focused",
    tags: ["hipaa", "healthcare", "privacy"],
  },
  {
    id: "viewer-permissions",
    title: "Viewer permissions",
    question: "Can I invite someone who can view workflows but cannot edit them?",
    scenario: "A team lead needs read-only access for a stakeholder and wants to know which plans support it.",
    category: "Permissions",
    expectedRelevantPageSlugs: ["pricing", "team-permissions"],
    difficulty: "Moderate",
    tags: ["viewer", "roles", "permissions"],
  },
  {
    id: "audit-log-export",
    title: "Audit-log export",
    question: "Can I export a complete audit log on the Pro plan?",
    scenario: "An operations lead needs a downloadable record of all workspace activity for an audit.",
    category: "Data & reporting",
    expectedRelevantPageSlugs: ["data-export", "pricing"],
    difficulty: "Subtle",
    tags: ["export", "audit log", "pro"],
  },
];

export const customerPersonas: readonly CustomerPersona[] = [
  {
    id: "impatient-first-time-customer",
    name: "Impatient first-time customer",
    description: "Wants a direct answer quickly and has little tolerance for an unclear path.",
    traits: ["Skims content quickly", "Prefers concise answers", "Gives up when navigation is unclear"],
    defaultMaxActions: 4,
    visualLabel: "IF",
  },
  {
    id: "careful-researcher",
    name: "Careful researcher",
    description: "Builds confidence by comparing details across several pieces of product knowledge.",
    traits: [
      "Reads several related pages",
      "Verifies details before answering",
      "Uses most of the available action budget",
    ],
    defaultMaxActions: 9,
    visualLabel: "CR",
  },
  {
    id: "non-technical-small-business-owner",
    name: "Non-technical small-business owner",
    description: "Needs practical language and may struggle with developer or compliance terminology.",
    traits: [
      "Avoids technical terminology",
      "May misunderstand limits or security language",
      "Prefers practical explanations",
    ],
    defaultMaxActions: 6,
    visualLabel: "SB",
  },
  {
    id: "skeptical-buyer",
    name: "Skeptical buyer",
    description: "Looks beyond headline claims before deciding whether the product fits.",
    traits: ["Looks for hidden limits and exceptions", "Distrusts vague marketing language", "Checks policies first"],
    defaultMaxActions: 8,
    visualLabel: "SK",
  },
  {
    id: "existing-frustrated-customer",
    name: "Existing frustrated customer",
    description: "Arrives with a problem and expects billing or policy information to be easy to find.",
    traits: [
      "Begins with a negative assumption",
      "Focuses on billing, cancellation, and refunds",
      "Has low patience for indirect answers",
    ],
    defaultMaxActions: 5,
    visualLabel: "EF",
  },
];

export function getCustomerTask(id: string) {
  return customerTasks.find((task) => task.id === id);
}

export function getCustomerPersona(id: string) {
  return customerPersonas.find((persona) => persona.id === id);
}
