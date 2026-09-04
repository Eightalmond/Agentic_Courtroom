import type { CourtroomArgument } from "@/lib/courtroom/types";
import type { EvidenceBundle } from "@/lib/evidence/types";

import type {
  CourtroomCaseResult,
  CourtroomEvaluation,
  CustomerCaseResult,
  CustomerEvaluation,
  EvidenceCaseResult,
  EvidenceEvaluation,
  JudgeCaseResult,
  JudgeEvaluation,
  RetrievalCaseResult,
  RetrievalEvaluation,
} from "../types";
import {
  actionEfficiency,
  allArgumentCitationLists,
  citationValidity,
  claimCitationCoverage,
  completionRate,
  correctnessCounts,
  mean,
  median,
  safeRatio,
  seenUnseenArgumentIntegrity,
} from "./core";

export function aggregateRetrieval(cases: readonly RetrievalCaseResult[]): RetrievalEvaluation {
  return {
    caseCount: cases.length,
    recallAt1: mean(cases.map((item) => item.recallAt1)),
    recallAt3: mean(cases.map((item) => item.recallAt3)),
    recallAt5: mean(cases.map((item) => item.recallAt5)),
    meanReciprocalRank: mean(cases.map((item) => item.firstRelevantRank ? 1 / item.firstRelevantRank : 0)),
    requiredSectionCoverageAt5: mean(cases.map((item) => item.requiredSectionCoverageAt5)),
    cases,
  };
}

export function aggregateCustomers(cases: readonly CustomerCaseResult[]): CustomerEvaluation {
  const counts = correctnessCounts(cases);
  const successfulCorrect = cases.filter((item) => item.completionStatus === "answer" && item.correctness === "fully-supported");
  return {
    runCount: cases.length,
    completionRate: completionRate(cases),
    correctness: counts,
    fullySupportedRate: safeRatio(counts["fully-supported"], cases.length),
    groundingFailureRate: safeRatio(cases.filter((item) => item.groundingFailure).length, cases.length),
    actionEfficiency: actionEfficiency(cases),
    medianSuccessfulActions: median(successfulCorrect.map((item) => item.successfulCustomerActions)),
    redundantActionRate: mean(cases.map((item) => item.redundantActionRate)),
    requiredEvidenceCoverage: mean(cases.map((item) => item.requiredEvidenceCoverage)),
    cases,
  };
}

export function aggregateEvidence(cases: readonly EvidenceCaseResult[]): EvidenceEvaluation {
  return {
    caseCount: cases.length,
    sourceIntegrity: mean(cases.map((item) => item.sourceIntegrity)),
    requiredRepresentationCoverage: mean(cases.map((item) => item.requiredRepresentationCoverage)),
    seenUnseenCorrectness: mean(cases.map((item) => item.seenUnseenCorrectness)),
    deduplicationIntegrity: mean(cases.map((item) => item.deduplicationIntegrity)),
    deterministicConsistency: mean(cases.map((item) => item.deterministicConsistency)),
    cases,
  };
}

export function courtroomCaseMetrics(
  fixtureId: string,
  bundle: EvidenceBundle,
  prosecutor: CourtroomArgument,
  defense: CourtroomArgument,
  sharedEvidenceIntegrity = 1,
): CourtroomCaseResult {
  const argumentsList = [prosecutor, defense];
  return {
    fixtureId,
    citationValidity: mean(argumentsList.map((argument) => citationValidity(allArgumentCitationLists(argument), bundle))),
    claimCitationCoverage: mean(argumentsList.map((argument) => claimCitationCoverage(argument, bundle))),
    seenUnseenIntegrity: mean(argumentsList.map((argument) => seenUnseenArgumentIntegrity(argument, bundle))),
    sharedEvidenceIntegrity,
  };
}

export function aggregateCourtroom(
  cases: readonly CourtroomCaseResult[],
  structuredOutputAttempts = 0,
  structuredOutputSuccesses = 0,
): CourtroomEvaluation {
  return {
    caseCount: cases.length,
    citationValidity: mean(cases.map((item) => item.citationValidity)),
    claimCitationCoverage: mean(cases.map((item) => item.claimCitationCoverage)),
    seenUnseenIntegrity: mean(cases.map((item) => item.seenUnseenIntegrity)),
    sharedEvidenceIntegrity: mean(cases.map((item) => item.sharedEvidenceIntegrity)),
    structuredOutputSuccessRate: structuredOutputAttempts
      ? safeRatio(structuredOutputSuccesses, structuredOutputAttempts)
      : null,
    cases,
  };
}

const confidenceValue = { low: 1, medium: 2, high: 3 } as const;

export function aggregateJudge(cases: readonly JudgeCaseResult[]): JudgeEvaluation {
  const successful = cases.filter((item) => item.actualVerdict !== null);
  const correct = successful.filter((item) => item.exactMatch);
  const incorrect = successful.filter((item) => !item.exactMatch);
  const confidenceMean = (items: readonly JudgeCaseResult[]) => items.length
    ? mean(items.flatMap((item) => item.confidence ? [confidenceValue[item.confidence]] : []))
    : null;
  return {
    caseCount: cases.length,
    attempted: cases.length,
    structuredOutputSuccessRate: safeRatio(successful.length, cases.length),
    exactVerdictAccuracy: safeRatio(correct.length, successful.length),
    citationValidity: mean(successful.map((item) => item.citationValidity)),
    recommendationGrounding: mean(successful.map((item) => item.recommendationGrounding)),
    averageConfidenceCorrect: confidenceMean(correct),
    averageConfidenceIncorrect: confidenceMean(incorrect),
    cases,
  };
}
