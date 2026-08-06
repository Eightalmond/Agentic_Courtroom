import "server-only";

import { normalizeText } from "@/lib/retrieval";

import type { MechanicalFactRule } from "./evaluation-specs";
import type { MechanicalFactCheck, MechanicalFactCheckResult } from "./types";

const LIMITATION = "Keyword and phrase rules are bounded mechanical checks, not semantic evaluation or a courtroom verdict.";
const NEGATION_TERMS = ["not", "no", "never", "without", "does not", "cannot", "can not", "will not", "wont", "doesnt"];

function includesConcept(answer: string, alternatives: readonly string[]) {
  return alternatives.some((alternative) => answer.includes(normalizeText(alternative)));
}

function includesAffirmativeForbiddenClaim(answer: string, claim: string) {
  const normalizedClaim = normalizeText(claim);
  let offset = answer.indexOf(normalizedClaim);

  while (offset >= 0) {
    const prefix = answer.slice(Math.max(0, offset - 32), offset);
    if (!NEGATION_TERMS.some((negation) => prefix.includes(negation))) {
      return true;
    }
    offset = answer.indexOf(normalizedClaim, offset + normalizedClaim.length);
  }

  return false;
}

function resultExplanation(result: MechanicalFactCheckResult) {
  switch (result) {
    case "supported":
      return "The answer contains every bounded concept required by this mechanical check.";
    case "unsupported":
      return "The answer does not contain every bounded concept required by this mechanical check.";
    case "contradicted":
      return "The answer contains a bounded affirmative claim that conflicts with the trusted source rule.";
    case "not-assessable":
      return "The customer did not provide a final answer, so this answer-level check cannot be assessed.";
  }
}

export function evaluateMechanicalFactCheck(
  rule: MechanicalFactRule,
  finalAnswer: string | null,
): MechanicalFactCheck {
  let result: MechanicalFactCheckResult;

  if (!finalAnswer) {
    result = "not-assessable";
  } else {
    const normalizedAnswer = normalizeText(finalAnswer);
    const contradicted = rule.forbiddenClaims.some((claim) => includesAffirmativeForbiddenClaim(normalizedAnswer, claim));
    const supported = rule.requiredConceptGroups.every((group) => includesConcept(normalizedAnswer, group));
    result = contradicted ? "contradicted" : supported ? "supported" : "unsupported";
  }

  return {
    id: rule.id,
    name: rule.name,
    result,
    sourceSectionIds: [...rule.sourceSectionIds],
    explanation: resultExplanation(result),
    limitation: LIMITATION,
  };
}
