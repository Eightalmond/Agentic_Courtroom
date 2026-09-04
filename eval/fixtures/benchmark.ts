import { z } from "zod";

import { taskEvaluationSpecs } from "@/lib/evidence/evaluation-specs";
import { getSectionById } from "@/lib/retrieval";
import type { CustomerDecision } from "@/lib/simulation/types";
import { customerPersonas, customerTasks, getCustomerPersona } from "@/lib/test-runs";

import { BENCHMARK_VERSION, type BenchmarkCase } from "../types";

const personaByTask: Readonly<Record<string, string>> = {
  "trial-cancellation": "impatient-first-time-customer",
  "api-allowance": "careful-researcher",
  "refund-after-renewal": "existing-frustrated-customer",
  "hipaa-suitability": "non-technical-small-business-owner",
  "viewer-permissions": "skeptical-buyer",
  "audit-log-export": "careful-researcher",
};

const benchmarkCaseSchema = z.object({
  benchmarkId: z.string().regex(/^flowpilot-[a-z0-9-]+$/),
  taskId: z.string().min(1),
  question: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.enum(["Focused", "Moderate", "Subtle"]),
  defaultPersonaId: z.string().min(1),
  maxActions: z.number().int().min(3).max(10),
  expectedCriticalFacts: z.array(z.object({
    id: z.string().min(1),
    conceptGroups: z.array(z.array(z.string().min(1)).min(1)).min(1),
    sourceSectionIds: z.array(z.string().min(1)).min(1),
  }).strict()).min(1),
  forbiddenClaims: z.array(z.string().min(1)),
  requiredSourceSectionIds: z.array(z.string().min(1)).min(1),
  qualificationSectionIds: z.array(z.string().min(1)),
  expectedRetrievalTargets: z.array(z.string().min(1)).min(1),
  expectedAnswerConcepts: z.array(z.array(z.string().min(1)).min(1)).min(1),
  acceptableAnswerVariants: z.array(z.string().min(1)).min(1),
}).strict();

export const benchmarkManifest = {
  version: BENCHMARK_VERSION,
  productId: "flowpilot",
  cases: customerTasks.map((task): BenchmarkCase => {
    const specification = taskEvaluationSpecs.find((item) => item.taskId === task.id);
    if (!specification) throw new Error(`Missing trusted evaluation specification for ${task.id}.`);
    const personaId = personaByTask[task.id];
    const persona = getCustomerPersona(personaId);
    if (!persona) throw new Error(`Missing benchmark persona for ${task.id}.`);
    const conceptGroups = specification.factChecks.flatMap((check) => check.requiredConceptGroups);
    return {
      benchmarkId: `flowpilot-${task.id}`,
      taskId: task.id,
      question: task.question,
      category: task.category,
      difficulty: task.difficulty,
      defaultPersonaId: personaId,
      maxActions: persona.defaultMaxActions,
      expectedCriticalFacts: specification.factChecks.map((check) => ({
        id: check.id,
        conceptGroups: check.requiredConceptGroups,
        sourceSectionIds: check.sourceSectionIds,
      })),
      forbiddenClaims: [...new Set(specification.factChecks.flatMap((check) => check.forbiddenClaims))],
      requiredSourceSectionIds: specification.requiredSectionIds,
      qualificationSectionIds: specification.qualificationSectionIds,
      expectedRetrievalTargets: specification.requiredSectionIds,
      expectedAnswerConcepts: conceptGroups,
      acceptableAnswerVariants: [...new Set(conceptGroups.flat())],
    };
  }),
} as const;

export function validateBenchmarkManifest(value: unknown = benchmarkManifest) {
  const schema = z.object({
    version: z.literal(BENCHMARK_VERSION),
    productId: z.literal("flowpilot"),
    cases: z.array(benchmarkCaseSchema).min(1),
  }).strict().superRefine((manifest, context) => {
    const taskIds = manifest.cases.map((item) => item.taskId);
    const benchmarkIds = manifest.cases.map((item) => item.benchmarkId);
    if (new Set(taskIds).size !== taskIds.length) {
      context.addIssue({ code: "custom", path: ["cases"], message: "Task IDs must be unique." });
    }
    if (new Set(benchmarkIds).size !== benchmarkIds.length) {
      context.addIssue({ code: "custom", path: ["cases"], message: "Benchmark IDs must be unique." });
    }
    manifest.cases.forEach((item, index) => {
      if (!customerTasks.some((task) => task.id === item.taskId)) {
        context.addIssue({ code: "custom", path: ["cases", index, "taskId"], message: "Unknown task." });
      }
      if (!customerPersonas.some((persona) => persona.id === item.defaultPersonaId)) {
        context.addIssue({ code: "custom", path: ["cases", index, "defaultPersonaId"], message: "Unknown persona." });
      }
      item.requiredSourceSectionIds.forEach((sectionId) => {
        if (!getSectionById(sectionId)) {
          context.addIssue({ code: "custom", path: ["cases", index, "requiredSourceSectionIds"], message: "Unknown section." });
        }
      });
    });
  });
  return schema.parse(value);
}

export const deterministicDecisionFixtures = {
  "trial-cancellation": [
    { action: "SEARCH", explanation: "Look for the trial cancellation terms.", query: "Pro trial cancellation charge access" },
    { action: "INSPECT_SECTION", explanation: "Read the automatic billing details.", sectionId: "flowpilot-free-trial-and-billing-automatic-billing-after-the-trial" },
    { action: "INSPECT_SECTION", explanation: "Confirm what cancellation changes during the trial.", sectionId: "flowpilot-cancellation-policy-cancelling-during-a-trial" },
    { action: "ANSWER", explanation: "The required timing and access details are available.", answer: "Yes. Cancelling during the trial, before day 14, prevents the first charge. Access remains until the trial ends.", confidence: "high" },
  ],
  "api-allowance": [
    { action: "SEARCH", explanation: "Find API plan and allowance details.", query: "Pro API access monthly requests rate limits" },
    { action: "INSPECT_SECTION", explanation: "Confirm which plan includes the API.", sectionId: "flowpilot-api-access-plan-availability" },
    { action: "INSPECT_SECTION", explanation: "Read the monthly allowance.", sectionId: "flowpilot-api-rate-limits-monthly-request-allowances" },
    { action: "INSPECT_SECTION", explanation: "Check the short-term qualification.", sectionId: "flowpilot-api-rate-limits-short-term-limits" },
    { action: "ANSWER", explanation: "Both the plan and two limit types are clear.", answer: "Pro includes API access with 10,000 requests per month. Short-term rate limits also apply, including 60 requests per minute.", confidence: "high" },
  ],
  "refund-after-renewal": [
    { action: "SEARCH", explanation: "Find what cancellation does after renewal.", query: "cancel after renewal automatic refund" },
    { action: "INSPECT_SECTION", explanation: "Read paid-subscription cancellation behavior.", sectionId: "flowpilot-cancellation-policy-cancelling-a-paid-subscription" },
    { action: "INSPECT_SECTION", explanation: "Confirm the general refund policy.", sectionId: "flowpilot-refund-policy-general-policy" },
    { action: "ANSWER", explanation: "Cancellation and refund effects can now be separated.", answer: "No. Cancelling now does not automatically create a refund and stops a future renewal, but does not reverse a charge.", confidence: "high" },
  ],
  "hipaa-suitability": [
    { action: "SEARCH", explanation: "Find the compliance boundary.", query: "HIPAA protected health information" },
    { action: "INSPECT_SECTION", explanation: "Read the identity and compliance statement.", sectionId: "flowpilot-security-and-privacy-identity-and-compliance" },
    { action: "ANSWER", explanation: "The compliance limitation is explicit.", answer: "No. FlowPilot is not HIPAA compliant and should not be used to store protected health information.", confidence: "high" },
  ],
  "viewer-permissions": [
    { action: "SEARCH", explanation: "Find read-only role availability.", query: "viewer read only cannot edit plans" },
    { action: "INSPECT_SECTION", explanation: "Read the standard role definitions.", sectionId: "flowpilot-team-permissions-standard-roles" },
    { action: "ANSWER", explanation: "The role and eligible plans are explicit.", answer: "Yes. The Viewer role is available on Pro and Business and is read only, so the viewer cannot edit.", confidence: "high" },
  ],
  "audit-log-export": [
    { action: "SEARCH", explanation: "Distinguish audit-log export from workflow export.", query: "complete audit log export Pro Business" },
    { action: "INSPECT_SECTION", explanation: "Read the complete audit-log export rule.", sectionId: "flowpilot-data-export-audit-log-export" },
    { action: "INSPECT_SECTION", explanation: "Check the nearby workflow CSV distinction.", sectionId: "flowpilot-data-export-workflow-csv-export" },
    { action: "ANSWER", explanation: "The plan boundary is explicit.", answer: "No. A complete audit-log export is available only on Business, not on Pro.", confidence: "high" },
  ],
} as const satisfies Readonly<Record<string, readonly CustomerDecision[]>>;
