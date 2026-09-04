import type { CourtroomArgument, CourtroomRole, VerdictDirection } from "@/lib/courtroom/types";
import type { EvidenceBundle } from "@/lib/evidence/types";
import type { CustomerDecision } from "@/lib/simulation/types";

import type { CourtroomBenchmarkFixture } from "../types";
import { deterministicDecisionFixtures } from "./benchmark";
import { buildFixtureEvidence, buildFixtureRun } from "./customer";

type FixtureDefinition = Readonly<{
  fixtureId: string;
  title: string;
  taskId: string;
  scenario: string;
  personaId: string;
  maxActions: number;
  decisions: readonly CustomerDecision[];
  expectedVerdict: VerdictDirection;
  rationale: string;
  acceptableConfidence: readonly ("low" | "medium" | "high")[];
  prosecutor: Readonly<{ thesis: string; claim: string; direction: VerdictDirection }>;
  defense: Readonly<{ thesis: string; claim: string; direction: VerdictDirection }>;
}>;

const definitions: readonly FixtureDefinition[] = [
  {
    fixtureId: "court-pass-trial",
    title: "Complete trial-cancellation answer",
    taskId: "trial-cancellation",
    scenario: "The customer finds both required policies and answers accurately within four actions.",
    personaId: "impatient-first-time-customer",
    maxActions: 4,
    decisions: deterministicDecisionFixtures["trial-cancellation"],
    expectedVerdict: "pass",
    rationale: "The customer reached a complete, supported answer and encountered both required sources without avoidable detours.",
    acceptableConfidence: ["medium", "high"],
    prosecutor: { thesis: "The customer needed several steps to verify a simple billing question.", claim: "Cancellation timing and access are split across separate policy sections.", direction: "pass_with_friction" },
    defense: { thesis: "The experience supplied a complete and accurate answer within the available budget.", claim: "The evidence supports both avoiding the first charge and retaining access through the trial.", direction: "pass" },
  },
  {
    fixtureId: "court-pass-hipaa",
    title: "Direct compliance boundary",
    taskId: "hipaa-suitability",
    scenario: "A customer searches once, reads the compliance section, and gives the correct safety answer.",
    personaId: "non-technical-small-business-owner",
    maxActions: 3,
    decisions: deterministicDecisionFixtures["hipaa-suitability"],
    expectedVerdict: "pass",
    rationale: "A critical safety boundary was explicit, discoverable, and correctly understood.",
    acceptableConfidence: ["high"],
    prosecutor: { thesis: "The safety answer depends on locating a specific compliance statement.", claim: "General security language could be confused with regulatory suitability without the compliance section.", direction: "pass_with_friction" },
    defense: { thesis: "The product states the compliance boundary plainly and the customer understood it.", claim: "The cited source explicitly rules out HIPAA and protected-health-information use.", direction: "pass" },
  },
  {
    fixtureId: "court-friction-api",
    title: "Correct API answer after repetition",
    taskId: "api-allowance",
    scenario: "The customer repeats a search before gathering plan, monthly, and short-term limits.",
    personaId: "careful-researcher",
    maxActions: 9,
    decisions: [
      deterministicDecisionFixtures["api-allowance"][0],
      deterministicDecisionFixtures["api-allowance"][0],
      ...deterministicDecisionFixtures["api-allowance"].slice(1),
    ],
    expectedVerdict: "pass_with_friction",
    rationale: "The answer is supported, but important limits are distributed and the journey contains redundant retrieval.",
    acceptableConfidence: ["medium", "high"],
    prosecutor: { thesis: "The customer succeeded only after redundant search and multiple policy inspections.", claim: "Plan availability, monthly allowance, and short-term limits require separate evidence.", direction: "pass_with_friction" },
    defense: { thesis: "The customer still reached a fully supported answer within the generous research budget.", claim: "The bundle provides the concrete monthly allowance and its short-term qualification.", direction: "pass" },
  },
  {
    fixtureId: "court-friction-viewer",
    title: "Viewer answer after a pricing detour",
    taskId: "viewer-permissions",
    scenario: "The customer opens pricing before locating the definitive role-permissions section.",
    personaId: "skeptical-buyer",
    maxActions: 8,
    decisions: [
      { action: "OPEN_PAGE", explanation: "Check whether pricing names the role.", pageSlug: "pricing" },
      ...deterministicDecisionFixtures["viewer-permissions"],
    ],
    expectedVerdict: "pass_with_friction",
    rationale: "The correct answer is available, but the customer detours through pricing before finding the definitive permissions detail.",
    acceptableConfidence: ["medium", "high"],
    prosecutor: { thesis: "A plan-selection detour adds avoidable effort before the read-only role is confirmed.", claim: "The definitive edit restriction is located in team permissions rather than the first page opened.", direction: "pass_with_friction" },
    defense: { thesis: "The detour was small and the customer still reached a complete supported answer.", claim: "The role source clearly identifies Viewer as read-only on the eligible plans.", direction: "pass" },
  },
  {
    fixtureId: "court-misleading-refund",
    title: "Incorrect automatic-refund conclusion",
    taskId: "refund-after-renewal",
    scenario: "The customer sees the relevant cancellation and refund policies but concludes that cancellation guarantees a refund.",
    personaId: "existing-frustrated-customer",
    maxActions: 5,
    decisions: [
      ...deterministicDecisionFixtures["refund-after-renewal"].slice(0, -1),
      { action: "ANSWER", explanation: "Assume cancellation reverses the renewal.", answer: "Yes, cancelling now will automatically refund the renewal charge.", confidence: "high" },
    ],
    expectedVerdict: "misleading",
    rationale: "The confident conclusion directly contradicts the policy distinction between cancellation and refunds.",
    acceptableConfidence: ["high"],
    prosecutor: { thesis: "The journey ended in a confident conclusion that the trusted policy contradicts.", claim: "Cancellation does not automatically reverse an already processed renewal charge.", direction: "misleading" },
    defense: { thesis: "The relevant policies were available and the failure may be attributed to customer interpretation.", claim: "The bundle contains both cancellation and refund sources for comparison.", direction: "pass_with_friction" },
  },
  {
    fixtureId: "court-misleading-audit",
    title: "Incorrect Pro audit-export conclusion",
    taskId: "audit-log-export",
    scenario: "The customer confuses workflow CSV export with complete audit-log export on Pro.",
    personaId: "careful-researcher",
    maxActions: 6,
    decisions: [
      ...deterministicDecisionFixtures["audit-log-export"].slice(0, -1),
      { action: "ANSWER", explanation: "Treat workflow export as a complete audit log.", answer: "Yes, Pro includes full audit log export and it is available on Pro.", confidence: "high" },
    ],
    expectedVerdict: "misleading",
    rationale: "The answer conflates two export types and contradicts the Business-only boundary.",
    acceptableConfidence: ["high"],
    prosecutor: { thesis: "Nearby export features led to a materially wrong plan conclusion.", claim: "Complete audit-log export is Business-only and is not the workflow CSV export.", direction: "misleading" },
    defense: { thesis: "The product contains the correct boundary even though the customer applied it incorrectly.", claim: "The cited audit source directly distinguishes complete audit export by plan.", direction: "pass_with_friction" },
  },
  {
    fixtureId: "court-blocked-trial",
    title: "Customer gives up on cancellation path",
    taskId: "trial-cancellation",
    scenario: "The customer searches for cancellation but gives up without producing an answer.",
    personaId: "impatient-first-time-customer",
    maxActions: 4,
    decisions: [
      { action: "SEARCH", explanation: "Look for a direct cancellation answer.", query: "where cancel Pro trial" },
      { action: "GIVE_UP", explanation: "Stop because the path still feels unclear.", reason: "I could not establish the cancellation outcome quickly enough." },
    ],
    expectedVerdict: "blocked",
    rationale: "The target customer abandoned the task without an answer despite attempting the relevant path.",
    acceptableConfidence: ["medium", "high"],
    prosecutor: { thesis: "The experience failed because the customer abandoned a high-stakes billing task.", claim: "The recorded outcome is a give-up rather than a usable conclusion.", direction: "blocked" },
    defense: { thesis: "Relevant policy material exists in the evidence even though the customer stopped early.", claim: "The bundle contains sources that can resolve the trial timing question.", direction: "insufficient_evidence" },
  },
  {
    fixtureId: "court-blocked-api-budget",
    title: "API research exhausts its budget",
    taskId: "api-allowance",
    scenario: "The customer spends all three allowed actions on general pricing material and never answers.",
    personaId: "impatient-first-time-customer",
    maxActions: 3,
    decisions: [
      { action: "SEARCH", explanation: "Start with general pricing.", query: "Pro pricing" },
      { action: "OPEN_PAGE", explanation: "Open the pricing page.", pageSlug: "pricing" },
      { action: "INSPECT_SECTION", explanation: "Read the Pro plan summary.", sectionId: "flowpilot-pricing-pro-29-per-user-per-month" },
    ],
    expectedVerdict: "blocked",
    rationale: "The bounded journey ends without an answer because the concrete allowance was not reached in time.",
    acceptableConfidence: ["medium", "high"],
    prosecutor: { thesis: "The customer exhausted the action budget before reaching the concrete API allowance.", claim: "The required API limit evidence was not encountered during the journey.", direction: "blocked" },
    defense: { thesis: "The small action budget limits what this journey can prove about the product.", claim: "The evidence bundle still identifies the missing API sources for review.", direction: "insufficient_evidence" },
  },
  {
    fixtureId: "court-insufficient-hipaa",
    title: "Uncertain answer without compliance evidence",
    taskId: "hipaa-suitability",
    scenario: "The customer reads only general pricing and says there is not enough information to decide.",
    personaId: "non-technical-small-business-owner",
    maxActions: 3,
    decisions: [
      { action: "OPEN_PAGE", explanation: "Start with the product pricing overview.", pageSlug: "pricing" },
      { action: "ANSWER", explanation: "Do not infer compliance from unrelated information.", answer: "I cannot establish HIPAA suitability from the information I found.", confidence: "low" },
    ],
    expectedVerdict: "insufficient_evidence",
    rationale: "The customer makes no false compliance claim, and the observed journey lacks the decisive source needed to grade a product-understanding outcome.",
    acceptableConfidence: ["low", "medium"],
    prosecutor: { thesis: "The journey did not expose the decisive compliance boundary.", claim: "The required compliance source is represented as unseen evidence rather than customer-seen evidence.", direction: "insufficient_evidence" },
    defense: { thesis: "The customer responsibly avoided inventing a compliance conclusion.", claim: "The low-confidence answer accurately states that the observed material was insufficient.", direction: "insufficient_evidence" },
  },
  {
    fixtureId: "court-insufficient-viewer",
    title: "Viewer journey ends before role evidence",
    taskId: "viewer-permissions",
    scenario: "The customer opens only the overview and gives up before encountering permissions evidence.",
    personaId: "impatient-first-time-customer",
    maxActions: 3,
    decisions: [
      { action: "OPEN_PAGE", explanation: "Start from the product overview.", pageSlug: "product-overview" },
      { action: "GIVE_UP", explanation: "Stop without guessing about permissions.", reason: "I did not find enough role detail to answer responsibly." },
    ],
    expectedVerdict: "insufficient_evidence",
    rationale: "The observed record is too thin to distinguish missing product guidance from an prematurely abandoned journey.",
    acceptableConfidence: ["low", "medium"],
    prosecutor: { thesis: "The journey lacks the required permissions evidence and cannot support success.", claim: "The role definition was not customer-seen before the give-up outcome.", direction: "insufficient_evidence" },
    defense: { thesis: "The sparse journey does not justify a stronger failure category.", claim: "Trusted role evidence exists only as unseen material in this record.", direction: "insufficient_evidence" },
  },
] as const;

function findCitation(bundle: EvidenceBundle, taskId: string) {
  const preferred = bundle.evidenceItems.find((item) => item.relatedFactCheckIds.length > 0)
    ?? bundle.evidenceItems.find((item) => item.sectionId)
    ?? bundle.evidenceItems[0];
  if (!preferred) throw new Error(`Courtroom fixture ${taskId} has no evidence.`);
  return preferred.evidenceId;
}

function makeArgument(
  role: CourtroomRole,
  input: FixtureDefinition["prosecutor"] | FixtureDefinition["defense"],
  evidenceId: string,
): CourtroomArgument {
  return Object.freeze({
    role,
    thesis: input.thesis,
    keyClaims: Object.freeze([Object.freeze({ id: "claim-1", claim: input.claim, evidenceIds: Object.freeze([evidenceId]), strength: "strong" as const })]),
    strongestPoint: Object.freeze({ claim: input.claim, evidenceIds: Object.freeze([evidenceId]) }),
    acknowledges: Object.freeze([Object.freeze({
      claim: "The opposing interpretation must still remain within the same fixed evidence boundary.",
      evidenceIds: Object.freeze([evidenceId]),
    })]),
    requestedVerdictDirection: input.direction,
    closingStatement: role === "prosecutor"
      ? "The cited record supports the requested failure-oriented direction."
      : "The cited record supports the requested success-oriented or cautious direction.",
  });
}

export const courtroomBenchmarkFixtures: readonly CourtroomBenchmarkFixture[] = Object.freeze(definitions.map((definition) => {
  const run = buildFixtureRun({
    runId: `run-eval-${definition.fixtureId}`,
    taskId: definition.taskId,
    personaId: definition.personaId,
    maxActions: definition.maxActions,
    decisions: definition.decisions,
  });
  const evidenceBundle = buildFixtureEvidence(run);
  const evidenceId = findCitation(evidenceBundle, definition.taskId);
  return Object.freeze({
    fixtureId: definition.fixtureId,
    title: definition.title,
    taskId: definition.taskId,
    scenario: definition.scenario,
    journeySummary: evidenceBundle.journeySummary,
    evidenceBundle,
    prosecutorArgument: makeArgument("prosecutor", definition.prosecutor, evidenceId),
    defenseArgument: makeArgument("defense", definition.defense, evidenceId),
    expectedVerdict: definition.expectedVerdict,
    humanRationale: definition.rationale,
    acceptableConfidence: definition.acceptableConfidence,
  });
}));
