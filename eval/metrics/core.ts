import type { CourtroomArgument, JudgeVerdict, VerdictDirection } from "@/lib/courtroom/types";
import type { EvidenceBundle } from "@/lib/evidence/types";
import type { SimulationActionEntry } from "@/lib/simulation/types";

import type {
  AnswerCorrectness,
  CustomerCaseResult,
  EndToEndCaseResult,
  PersonaResult,
  ReliabilityMetrics,
} from "../types";

export function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

export function mean(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function median(values: readonly number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

export function recallAtK(retrievedIds: readonly string[], relevantIds: readonly string[], k: number) {
  const relevant = new Set(relevantIds);
  const found = new Set(retrievedIds.slice(0, Math.max(0, k)).filter((id) => relevant.has(id)));
  return safeRatio(found.size, relevant.size);
}

export function reciprocalRank(retrievedIds: readonly string[], relevantIds: readonly string[]) {
  const relevant = new Set(relevantIds);
  const firstIndex = retrievedIds.findIndex((id) => relevant.has(id));
  return firstIndex === -1 ? 0 : 1 / (firstIndex + 1);
}

export function requiredSectionCoverage(retrievedIds: readonly string[], requiredIds: readonly string[], k: number) {
  return recallAtK(retrievedIds, requiredIds, k);
}

export function completionRate(cases: readonly Pick<CustomerCaseResult, "completionStatus">[]) {
  return safeRatio(cases.filter((item) => item.completionStatus === "answer").length, cases.length);
}

export function correctnessCounts(cases: readonly Pick<CustomerCaseResult, "correctness">[]) {
  const counts: Record<AnswerCorrectness, number> = {
    "fully-supported": 0,
    unsupported: 0,
    contradicted: 0,
    "not-assessable": 0,
  };
  cases.forEach((item) => { counts[item.correctness] += 1; });
  return counts;
}

export function actionEfficiency(cases: readonly Pick<CustomerCaseResult, "correctness" | "completionStatus" | "successfulCustomerActions" | "maxActions">[]) {
  const eligible = cases.filter((item) => item.completionStatus === "answer" && item.correctness === "fully-supported");
  return mean(eligible.map((item) => safeRatio(item.successfulCustomerActions, item.maxActions)));
}

function repeatedCount(values: readonly string[]) {
  const seen = new Set<string>();
  let repeated = 0;
  values.forEach((value) => {
    if (seen.has(value)) repeated += 1;
    else seen.add(value);
  });
  return repeated;
}

export function actionBehavior(actions: readonly SimulationActionEntry[]) {
  const searches = actions.filter((action) => action.type === "SEARCH").map((action) => action.input.query ?? "");
  const pages = actions.filter((action) => action.type === "OPEN_PAGE").map((action) => action.input.pageSlug ?? "");
  const sections = actions.filter((action) => action.type === "INSPECT_SECTION").map((action) => action.input.sectionId ?? "");
  const repeatedSearches = repeatedCount(searches);
  const repeatedPageOpenings = repeatedCount(pages);
  const repeatedSectionInspections = repeatedCount(sections);
  const retrievalActions = searches.length + pages.length + sections.length;
  const repeated = repeatedSearches + repeatedPageOpenings + repeatedSectionInspections;
  return {
    searches: searches.length,
    pagesOpened: pages.length,
    sectionsInspected: sections.length,
    repeatedSearches,
    repeatedPageOpenings,
    repeatedSectionInspections,
    redundantActionRate: safeRatio(repeated, retrievalActions),
  };
}

export function allArgumentCitationLists(argument: CourtroomArgument) {
  return [
    ...argument.keyClaims.map((claim) => claim.evidenceIds),
    argument.strongestPoint.evidenceIds,
    ...argument.acknowledges.map((point) => point.evidenceIds),
  ];
}

export function allJudgeCitationLists(verdict: JudgeVerdict) {
  return [
    ...verdict.findings.map((finding) => finding.evidenceIds),
    verdict.prosecutorAssessment.evidenceIds,
    verdict.defenseAssessment.evidenceIds,
    verdict.customerOutcomeAssessment.evidenceIds,
    ...(verdict.primaryFriction ? [verdict.primaryFriction.evidenceIds] : []),
    verdict.recommendation.evidenceIds,
  ];
}

export function citationValidity(citationLists: readonly (readonly string[])[], bundle: EvidenceBundle) {
  const validIds = new Set(bundle.evidenceItems.map((item) => item.evidenceId));
  const citations = citationLists.flat();
  return safeRatio(citations.filter((id) => validIds.has(id)).length, citations.length);
}

export function claimCitationCoverage(argument: CourtroomArgument, bundle: EvidenceBundle) {
  const validIds = new Set(bundle.evidenceItems.map((item) => item.evidenceId));
  const claims = [
    ...argument.keyClaims.map((claim) => claim.evidenceIds),
    argument.strongestPoint.evidenceIds,
    ...argument.acknowledges.map((point) => point.evidenceIds),
  ];
  return safeRatio(claims.filter((ids) => ids.some((id) => validIds.has(id))).length, claims.length);
}

const CUSTOMER_SAW_ASSERTION = /\b(customer|they|user)\b.{0,36}\b(saw|viewed|encountered|found|read)\b/i;

export function seenUnseenArgumentIntegrity(argument: CourtroomArgument, bundle: EvidenceBundle) {
  const evidenceById = new Map(bundle.evidenceItems.map((item) => [item.evidenceId, item]));
  const claims = [
    ...argument.keyClaims.map((claim) => ({ text: claim.claim, ids: claim.evidenceIds })),
    { text: argument.strongestPoint.claim, ids: argument.strongestPoint.evidenceIds },
    ...argument.acknowledges.map((point) => ({ text: point.claim, ids: point.evidenceIds })),
  ].filter((claim) => CUSTOMER_SAW_ASSERTION.test(claim.text));
  if (!claims.length) return 1;
  return safeRatio(
    claims.filter((claim) => claim.ids.some((id) => evidenceById.get(id)?.customerSaw)).length,
    claims.length,
  );
}

export function verdictExactMatch(actual: VerdictDirection | null, expected: VerdictDirection) {
  return actual === expected;
}

export function endToEndSuccess(input: {
  customerAnswered: boolean;
  correctness: AnswerCorrectness;
  evidenceBuilt: boolean;
  prosecutorSucceeded: boolean;
  defenseSucceeded: boolean;
  advocateCitationsValid: boolean;
  judgeSucceeded: boolean;
  judgeCitationsValid: boolean;
}) {
  const completed = input.customerAnswered
    && input.correctness !== "contradicted"
    && input.evidenceBuilt
    && input.prosecutorSucceeded
    && input.defenseSucceeded
    && input.advocateCitationsValid
    && input.judgeSucceeded
    && input.judgeCitationsValid;
  return { completed, grounded: completed && input.correctness === "fully-supported" };
}

export function aggregateEndToEnd(cases: readonly EndToEndCaseResult[], reliability: ReliabilityMetrics) {
  const completed = cases.filter((item) => item.completed);
  return {
    runCount: cases.length,
    pipelineCompletionRate: safeRatio(completed.length, cases.length),
    groundedPipelineSuccessRate: safeRatio(cases.filter((item) => item.grounded).length, cases.length),
    providerFailureRate: reliability.providerFailureRate,
    averageLlmCallsPerCompletedRun: mean(completed.map((item) => item.llmCalls)),
    averageSuccessfulCustomerActionsPerCompletedRun: mean(completed.map((item) => item.successfulCustomerActions)),
    cases,
  };
}

export function aggregatePersonas(cases: readonly CustomerCaseResult[]): PersonaResult[] {
  const personaIds = [...new Set(cases.map((item) => item.personaId))].sort();
  return personaIds.map((personaId) => {
    const matches = cases.filter((item) => item.personaId === personaId);
    return {
      personaId,
      runCount: matches.length,
      completionRate: completionRate(matches),
      fullySupportedRate: safeRatio(matches.filter((item) => item.correctness === "fully-supported").length, matches.length),
      averageActions: mean(matches.map((item) => item.successfulCustomerActions)),
      giveUpRate: safeRatio(matches.filter((item) => item.gaveUp).length, matches.length),
      requiredEvidenceCoverage: mean(matches.map((item) => item.requiredEvidenceCoverage)),
    };
  });
}
