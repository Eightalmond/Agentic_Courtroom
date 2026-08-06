import "server-only";

export type MechanicalFactRule = Readonly<{
  id: string;
  name: string;
  requiredConceptGroups: readonly (readonly string[])[];
  forbiddenClaims: readonly string[];
  sourceSectionIds: readonly string[];
}>;

export type TaskEvaluationSpec = Readonly<{
  taskId: string;
  requiredSectionIds: readonly string[];
  optionalSupportingSectionIds: readonly string[];
  qualificationSectionIds: readonly string[];
  factChecks: readonly MechanicalFactRule[];
  riskMarkers: readonly string[];
}>;

const sections = {
  trialBilling: "flowpilot-free-trial-and-billing-automatic-billing-after-the-trial",
  trialCancellation: "flowpilot-cancellation-policy-cancelling-during-a-trial",
  paidCancellation: "flowpilot-cancellation-policy-cancelling-a-paid-subscription",
  apiAvailability: "flowpilot-api-access-plan-availability",
  apiUsage: "flowpilot-api-access-using-the-api",
  apiMonthly: "flowpilot-api-rate-limits-monthly-request-allowances",
  apiShortTerm: "flowpilot-api-rate-limits-short-term-limits",
  refundGeneral: "flowpilot-refund-policy-general-policy",
  refundErrors: "flowpilot-refund-policy-duplicate-charges-and-billing-errors",
  compliance: "flowpilot-security-and-privacy-identity-and-compliance",
  viewerRoles: "flowpilot-team-permissions-standard-roles",
  proPricing: "flowpilot-pricing-pro-29-per-user-per-month",
  auditExport: "flowpilot-data-export-audit-log-export",
  workflowExport: "flowpilot-data-export-workflow-csv-export",
} as const;

export const taskEvaluationSpecs: readonly TaskEvaluationSpec[] = [
  {
    taskId: "trial-cancellation",
    requiredSectionIds: [sections.trialBilling, sections.trialCancellation],
    optionalSupportingSectionIds: [],
    qualificationSectionIds: [sections.paidCancellation],
    factChecks: [
      {
        id: "trial-cancellation-terms",
        name: "Trial cancellation timing and outcome",
        requiredConceptGroups: [
          ["before day 14", "before the 14 day trial ends", "before the trial ends", "during the trial"],
          ["prevents the first charge", "without being charged", "no first charge", "not be charged"],
          ["access until the trial ends", "access remains until", "trial access until", "features remain available until"],
        ],
        forbiddenClaims: ["charged immediately when cancelling", "lose access immediately"],
        sourceSectionIds: [sections.trialBilling, sections.trialCancellation],
      },
    ],
    riskMarkers: ["Cancellation after a paid renewal is different from cancellation during a trial."],
  },
  {
    taskId: "api-allowance",
    requiredSectionIds: [sections.apiAvailability, sections.apiMonthly],
    optionalSupportingSectionIds: [sections.apiUsage],
    qualificationSectionIds: [sections.apiShortTerm],
    factChecks: [
      {
        id: "api-pro-allowance",
        name: "Pro API access and limits",
        requiredConceptGroups: [
          ["api access is available on pro", "pro includes api access", "api access included on pro"],
          ["10 000", "10000", "10k"],
          ["per month", "monthly"],
          ["short term rate limits", "rate limits also apply", "60 requests per minute"],
        ],
        forbiddenClaims: ["unlimited api requests", "no rate limit"],
        sourceSectionIds: [sections.apiAvailability, sections.apiMonthly, sections.apiShortTerm],
      },
    ],
    riskMarkers: ["Monthly allowance and short-term rate limits are separate constraints."],
  },
  {
    taskId: "refund-after-renewal",
    requiredSectionIds: [sections.paidCancellation, sections.refundGeneral],
    optionalSupportingSectionIds: [sections.refundErrors],
    qualificationSectionIds: [sections.refundErrors],
    factChecks: [
      {
        id: "renewal-refund-separation",
        name: "Cancellation and renewal refund separation",
        requiredConceptGroups: [
          ["does not automatically create a refund", "not automatically refund", "no automatic refund", "does not reverse a charge"],
        ],
        forbiddenClaims: ["automatically refund", "automatic refund", "will refund the charge"],
        sourceSectionIds: [sections.paidCancellation, sections.refundGeneral],
      },
    ],
    riskMarkers: ["Cancellation stops a future renewal but does not reverse an already processed charge."],
  },
  {
    taskId: "hipaa-suitability",
    requiredSectionIds: [sections.compliance],
    optionalSupportingSectionIds: [],
    qualificationSectionIds: [],
    factChecks: [
      {
        id: "hipaa-boundary",
        name: "HIPAA and protected-health-information boundary",
        requiredConceptGroups: [
          ["not hipaa compliant", "does not claim hipaa compliance", "should not be used to store protected health information", "do not store protected health information"],
        ],
        forbiddenClaims: ["is hipaa compliant", "can store protected health information", "safe for phi"],
        sourceSectionIds: [sections.compliance],
      },
    ],
    riskMarkers: ["Encryption does not establish HIPAA compliance."],
  },
  {
    taskId: "viewer-permissions",
    requiredSectionIds: [sections.viewerRoles],
    optionalSupportingSectionIds: [sections.proPricing],
    qualificationSectionIds: [],
    factChecks: [
      {
        id: "viewer-plan-and-permissions",
        name: "Viewer plan availability and read-only behavior",
        requiredConceptGroups: [
          ["viewer"],
          ["pro and business", "pro or business", "on pro", "on business"],
          ["cannot edit", "can not edit", "view without editing", "read only"],
        ],
        forbiddenClaims: ["viewer can edit", "viewer is available on starter"],
        sourceSectionIds: [sections.viewerRoles, sections.proPricing],
      },
    ],
    riskMarkers: ["Starter does not include the Viewer role."],
  },
  {
    taskId: "audit-log-export",
    requiredSectionIds: [sections.auditExport],
    optionalSupportingSectionIds: [],
    qualificationSectionIds: [sections.workflowExport],
    factChecks: [
      {
        id: "audit-export-plan-boundary",
        name: "Complete audit-log export plan boundary",
        requiredConceptGroups: [
          ["only on business", "business only", "available only on business"],
          ["not on pro", "pro does not", "pro cannot", "no complete audit log on pro"],
        ],
        forbiddenClaims: ["pro includes full audit log export", "pro can export a complete audit log", "available on pro"],
        sourceSectionIds: [sections.auditExport],
      },
    ],
    riskMarkers: ["Workflow CSV export is not the same as complete audit-log export."],
  },
] as const;

export function getTaskEvaluationSpec(taskId: string) {
  return taskEvaluationSpecs.find((specification) => specification.taskId === taskId);
}
