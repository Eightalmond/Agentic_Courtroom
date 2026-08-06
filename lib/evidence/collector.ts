import "server-only";

import { flowPilotProduct, getProductPage } from "@/lib/product";
import { getSectionById, productSearchIndex, searchProductKnowledge, type SearchRecord } from "@/lib/retrieval";
import { getCustomerPersona, getCustomerTask } from "@/lib/test-runs";
import type { SimulationActionEntry } from "@/lib/simulation/types";

import { EvidenceCollectionError } from "./errors";
import { getTaskEvaluationSpec } from "./evaluation-specs";
import { evaluateMechanicalFactCheck } from "./fact-checks";
import { EvidenceBundleSchema, EvidenceCollectionRequestSchema } from "./schemas";
import {
  EVIDENCE_BUNDLE_VERSION,
  MAX_CONTEXT_EVIDENCE,
  type CustomerOutcome,
  type EvidenceBundle,
  type EvidenceCategory,
  type EvidenceItem,
  type MechanicalFactCheck,
} from "./types";

type CollectorOptions = { now?: string };

type Mutable<T> = { -readonly [Property in keyof T]: T[Property] };

type EvidenceDraft = Omit<Mutable<EvidenceItem>, "evidenceId" | "orderingIndex" | "exposureActionNumbers"> & {
  key: string;
  exposureActionNumbers: number[];
};

function uniqueInOrder(values: readonly string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function excerpt(value: string, maximum = 280) {
  if (value.length <= maximum) {
    return value;
  }
  const candidate = value.slice(0, maximum - 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > maximum * 0.6 ? boundary : candidate.length).trimEnd()}…`;
}

function relatedFactChecks(sectionId: string, factChecks: readonly MechanicalFactCheck[]) {
  return factChecks.filter((check) => check.sourceSectionIds.includes(sectionId)).map((check) => check.id);
}

function assertObservationKind(action: SimulationActionEntry, expected: SimulationActionEntry["observation"]["kind"]) {
  if (action.observation.kind !== expected) {
    throw new EvidenceCollectionError(
      "MALFORMED_ACTION_HISTORY",
      "The customer journey contains an inconsistent action observation.",
    );
  }
}

function assertSearchObservation(action: SimulationActionEntry) {
  assertObservationKind(action, "search");
  if (action.observation.kind !== "search") {
    return [];
  }
  if (action.input.query !== action.observation.query) {
    throw new EvidenceCollectionError("MALFORMED_ACTION_HISTORY", "The recorded search query is inconsistent.");
  }

  const trustedResults = searchProductKnowledge(action.observation.query, { limit: 3 });
  const trustedSnapshots = trustedResults.map((result) => ({
    sectionId: result.sectionId,
    pageSlug: result.pageSlug,
    pageTitle: result.pageTitle,
    sectionTitle: result.sectionTitle,
    excerpt: result.excerpt,
  }));

  if (JSON.stringify(trustedSnapshots) !== JSON.stringify(action.observation.results)) {
    throw new EvidenceCollectionError(
      "INVALID_SOURCE_REFERENCE",
      "A recorded search result does not match trusted FlowPilot content.",
    );
  }

  return trustedResults;
}

function assertOpenedPageObservation(action: SimulationActionEntry) {
  assertObservationKind(action, "page");
  if (action.observation.kind !== "page") {
    return undefined;
  }
  const page = getProductPage(action.observation.pageSlug);
  if (!page || action.input.pageSlug !== page.slug || action.observation.pageTitle !== page.title) {
    throw new EvidenceCollectionError("INVALID_SOURCE_REFERENCE", "A recorded page does not match trusted FlowPilot content.");
  }
  const trustedObservation = {
    kind: "page",
    pageSlug: page.slug,
    pageTitle: page.title,
    summary: page.summary,
    sections: productSearchIndex
      .filter((record) => record.pageSlug === page.slug)
      .map((record) => ({ id: record.sectionId, title: record.sectionTitle })),
    callouts: (page.callouts ?? []).map((callout) => `${callout.title}: ${callout.content}`),
    relatedPages: page.relatedSlugs.flatMap((slug) => {
      const related = getProductPage(slug);
      return related ? [{ slug: related.slug, title: related.title }] : [];
    }),
  };
  if (JSON.stringify(action.observation) !== JSON.stringify(trustedObservation)) {
    throw new EvidenceCollectionError("INVALID_SOURCE_REFERENCE", "A recorded page observation was not produced by the trusted tool.");
  }
  return page;
}

function assertInspectedSectionObservation(action: SimulationActionEntry) {
  assertObservationKind(action, "section");
  if (action.observation.kind !== "section") {
    return undefined;
  }
  const section = getSectionById(action.observation.sectionId);
  if (
    !section ||
    action.input.sectionId !== section.sectionId ||
    action.observation.pageSlug !== section.pageSlug ||
    action.observation.pageTitle !== section.pageTitle ||
    action.observation.sectionTitle !== section.sectionTitle
  ) {
    throw new EvidenceCollectionError("INVALID_SOURCE_REFERENCE", "A recorded section does not match trusted FlowPilot content.");
  }
  const page = getProductPage(section.pageSlug);
  const trustedObservation = {
    kind: "section",
    sectionId: section.sectionId,
    pageSlug: section.pageSlug,
    pageTitle: section.pageTitle,
    sectionTitle: section.sectionTitle,
    content: section.sectionBody,
    callouts: (page?.callouts ?? []).map((callout) => `${callout.title}: ${callout.content}`),
  };
  if (JSON.stringify(action.observation) !== JSON.stringify(trustedObservation)) {
    throw new EvidenceCollectionError("INVALID_SOURCE_REFERENCE", "A recorded section observation was not produced by the trusted tool.");
  }
  return section;
}

function outcomeFor(completionReason: NonNullable<EvidenceBundle["completionReason"]>): CustomerOutcome {
  if (completionReason === "answer") return "answered";
  if (completionReason === "gave_up") return "gave-up";
  return "budget-exhausted";
}

function freezeBundle(bundle: EvidenceBundle) {
  bundle.evidenceItems.forEach((item) => {
    Object.freeze(item.exposureActionNumbers);
    Object.freeze(item.relatedFactCheckIds);
    Object.freeze(item);
  });
  bundle.factChecks.forEach((check) => {
    Object.freeze(check.sourceSectionIds);
    Object.freeze(check);
  });
  Object.freeze(bundle.evidenceItems);
  Object.freeze(bundle.factChecks);
  Object.freeze(bundle.coverage);
  Object.freeze(bundle.missingRequiredEvidence);
  Object.freeze(bundle.pagesVisited);
  Object.freeze(bundle.sectionsInspected);
  Object.freeze(bundle.searchQueries);
  Object.freeze(bundle.integrity);
  return Object.freeze(bundle);
}

export function collectEvidenceBundle(input: unknown, options: CollectorOptions = {}): EvidenceBundle {
  const parsed = EvidenceCollectionRequestSchema.safeParse(input);
  if (!parsed.success) {
    const productIssue = parsed.error.issues.some((issue) => issue.path[0] === "productId");
    throw new EvidenceCollectionError(
      productIssue ? "INVALID_PRODUCT" : "MALFORMED_ACTION_HISTORY",
      productIssue
        ? "Evidence can only be collected for the controlled FlowPilot product."
        : "The completed customer journey is malformed and cannot be collected safely.",
    );
  }
  const run = parsed.data;

  if (run.evidenceBundle) {
    throw new EvidenceCollectionError(
      "EVIDENCE_ALREADY_EXISTS",
      "This run already has an evidence bundle. Use the explicit rebuild action to replace it.",
      409,
    );
  }

  if (run.status === "ready" || run.actions.length === 0) {
    throw new EvidenceCollectionError("RUN_NOT_STARTED", "Start and complete the customer journey before preparing evidence.");
  }
  if (run.status === "running") {
    throw new EvidenceCollectionError("RUN_STILL_RUNNING", "Complete the customer journey before preparing evidence.");
  }
  if (run.status !== "completed" || !run.completionReason || !run.completedAt) {
    throw new EvidenceCollectionError("RUN_NOT_COMPLETED", "Only a completed customer journey can become evidence.");
  }

  const task = getCustomerTask(run.taskId);
  if (!task) {
    throw new EvidenceCollectionError("UNKNOWN_TASK", "The evidence request references an unknown customer task.");
  }
  if (!getCustomerPersona(run.personaId)) {
    throw new EvidenceCollectionError("UNKNOWN_PERSONA", "The evidence request references an unknown customer persona.");
  }
  const specification = getTaskEvaluationSpec(run.taskId);
  if (!specification) {
    throw new EvidenceCollectionError("EVALUATION_SPEC_MISSING", "No trusted evidence specification exists for this task.", 500);
  }

  if (run.completionReason === "answer" && (!run.finalAnswer || !run.finalConfidence)) {
    throw new EvidenceCollectionError("MALFORMED_ACTION_HISTORY", "The completed answer outcome is inconsistent.");
  }
  if (run.completionReason === "gave_up" && !run.giveUpReason) {
    throw new EvidenceCollectionError("MALFORMED_ACTION_HISTORY", "The completed give-up outcome is inconsistent.");
  }

  for (const sectionId of [
    ...specification.requiredSectionIds,
    ...specification.optionalSupportingSectionIds,
    ...specification.qualificationSectionIds,
    ...specification.factChecks.flatMap((check) => check.sourceSectionIds),
  ]) {
    if (!getSectionById(sectionId)) {
      throw new EvidenceCollectionError("MISSING_PRODUCT_SOURCE", "A trusted evidence source is unavailable.", 500);
    }
  }

  const factChecks = specification.factChecks.map((rule) => evaluateMechanicalFactCheck(rule, run.finalAnswer));
  const drafts: EvidenceDraft[] = [];
  const draftsByKey = new Map<string, EvidenceDraft>();
  const pagesVisited: string[] = [];
  const sectionsInspected: string[] = [];
  const searchQueries: string[] = [];
  let successfulToolObservations = 0;
  let failedToolActions = 0;

  function addDraft(draft: EvidenceDraft) {
    drafts.push(draft);
    draftsByKey.set(draft.key, draft);
  }

  function addJourneySection(
    section: SearchRecord,
    sourceType: "search-result" | "inspected-section",
    sourceText: string,
    actionNumber: number,
  ) {
    const key = `section:${section.sectionId}`;
    const existing = draftsByKey.get(key);
    if (existing) {
      if (!existing.exposureActionNumbers.includes(actionNumber)) existing.exposureActionNumbers.push(actionNumber);
      if (sourceType === "inspected-section") {
        existing.sourceType = sourceType;
        existing.exactSourceText = sourceText;
        existing.excerpt = excerpt(sourceText);
      }
      return;
    }
    addDraft({
      key,
      category: "journey",
      sourceType,
      productId: flowPilotProduct.id,
      pageSlug: section.pageSlug,
      pageTitle: section.pageTitle,
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      exactSourceText: sourceText,
      excerpt: excerpt(sourceText),
      sourceLocation: `${section.pageTitle} / ${section.sectionTitle}`,
      customerSaw: true,
      firstExposedByAction: actionNumber,
      exposureActionNumbers: [actionNumber],
      relevanceReason: `The customer encountered this source during action ${actionNumber}.`,
      relatedFactCheckIds: relatedFactChecks(section.sectionId, factChecks),
      collectionMethod: "journey-observation",
    });
  }

  function addPageCallouts(page: NonNullable<ReturnType<typeof getProductPage>>, actionNumber: number) {
    page.callouts?.forEach((callout, calloutIndex) => {
      const key = `callout:${page.slug}:${calloutIndex}`;
      const existing = draftsByKey.get(key);
      if (existing) {
        if (!existing.exposureActionNumbers.includes(actionNumber)) existing.exposureActionNumbers.push(actionNumber);
        return;
      }
      const sourceText = `${callout.title}: ${callout.content}`;
      addDraft({
        key,
        category: "journey",
        sourceType: "page-callout",
        productId: flowPilotProduct.id,
        pageSlug: page.slug,
        pageTitle: page.title,
        sectionId: null,
        sectionTitle: null,
        exactSourceText: sourceText,
        excerpt: excerpt(sourceText),
        sourceLocation: `${page.title} / Callout: ${callout.title}`,
        customerSaw: true,
        firstExposedByAction: actionNumber,
        exposureActionNumbers: [actionNumber],
        relevanceReason: `This callout was shown with product content during action ${actionNumber}.`,
        relatedFactCheckIds: [],
        collectionMethod: "journey-observation",
      });
    });
  }

  for (const action of run.actions) {
    if (!action.success) {
      failedToolActions += 1;
      if (action.observation.kind !== "tool_error") {
        throw new EvidenceCollectionError("MALFORMED_ACTION_HISTORY", "A failed action has an invalid observation.");
      }
      continue;
    }

    switch (action.type) {
      case "SEARCH": {
        const results = assertSearchObservation(action);
        successfulToolObservations += 1;
        if (action.observation.kind === "search") searchQueries.push(action.observation.query);
        results.forEach((result) => {
          const section = getSectionById(result.sectionId);
          if (!section) throw new EvidenceCollectionError("INVALID_SOURCE_REFERENCE", "A search source is unavailable.");
          addJourneySection(section, "search-result", result.excerpt, action.number);
        });
        break;
      }
      case "OPEN_PAGE": {
        const page = assertOpenedPageObservation(action);
        if (!page) break;
        successfulToolObservations += 1;
        pagesVisited.push(page.slug);
        const key = `page:${page.slug}`;
        const existing = draftsByKey.get(key);
        if (existing) {
          if (!existing.exposureActionNumbers.includes(action.number)) existing.exposureActionNumbers.push(action.number);
        } else {
          addDraft({
            key,
            category: "journey",
            sourceType: "opened-page",
            productId: flowPilotProduct.id,
            pageSlug: page.slug,
            pageTitle: page.title,
            sectionId: null,
            sectionTitle: null,
            exactSourceText: page.summary,
            excerpt: page.summary,
            sourceLocation: `${page.title} / Page summary`,
            customerSaw: true,
            firstExposedByAction: action.number,
            exposureActionNumbers: [action.number],
            relevanceReason: `The customer opened this page during action ${action.number}.`,
            relatedFactCheckIds: [],
            collectionMethod: "journey-observation",
          });
        }
        addPageCallouts(page, action.number);
        break;
      }
      case "INSPECT_SECTION": {
        const section = assertInspectedSectionObservation(action);
        if (!section) break;
        successfulToolObservations += 1;
        pagesVisited.push(section.pageSlug);
        sectionsInspected.push(section.sectionId);
        addJourneySection(section, "inspected-section", section.sectionBody, action.number);
        const page = getProductPage(section.pageSlug);
        if (page) addPageCallouts(page, action.number);
        break;
      }
      case "ANSWER":
        assertObservationKind(action, "answer");
        if (
          action.observation.kind !== "answer" ||
          action.observation.answer !== run.finalAnswer ||
          action.observation.confidence !== run.finalConfidence
        ) {
          throw new EvidenceCollectionError("MALFORMED_ACTION_HISTORY", "The final answer does not match the journey.");
        }
        break;
      case "GIVE_UP":
        assertObservationKind(action, "give_up");
        if (action.observation.kind !== "give_up" || action.observation.reason !== run.giveUpReason) {
          throw new EvidenceCollectionError("MALFORMED_ACTION_HISTORY", "The give-up outcome does not match the journey.");
        }
        break;
    }
  }

  const finalAction = run.actions.at(-1);
  if (
    (run.completionReason === "answer" && finalAction?.type !== "ANSWER") ||
    (run.completionReason === "gave_up" && finalAction?.type !== "GIVE_UP") ||
    (run.completionReason === "budget_exhausted" && (finalAction?.type === "ANSWER" || finalAction?.type === "GIVE_UP"))
  ) {
    throw new EvidenceCollectionError("MALFORMED_ACTION_HISTORY", "The final journey action does not match the completion outcome.");
  }

  const seenSectionIds = new Set(
    drafts.filter((draft) => draft.customerSaw && draft.sectionId).map((draft) => draft.sectionId as string),
  );
  const missingRequiredEvidence = specification.requiredSectionIds.filter((sectionId) => !seenSectionIds.has(sectionId));

  missingRequiredEvidence.forEach((sectionId) => {
    const section = getSectionById(sectionId)!;
    addDraft({
      key: `missing:${section.sectionId}`,
      category: "missing",
      sourceType: "missing-section",
      productId: flowPilotProduct.id,
      pageSlug: section.pageSlug,
      pageTitle: section.pageTitle,
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      exactSourceText: section.sectionBody,
      excerpt: excerpt(section.sectionBody),
      sourceLocation: `${section.pageTitle} / ${section.sectionTitle}`,
      customerSaw: false,
      firstExposedByAction: null,
      exposureActionNumbers: [],
      relevanceReason: "The trusted task specification marks this source as required, but the customer did not encounter it.",
      relatedFactCheckIds: relatedFactChecks(section.sectionId, factChecks),
      collectionMethod: "task-evaluation-spec",
    });
  });

  const excludedContextIds = new Set([...seenSectionIds, ...missingRequiredEvidence]);
  const taskDefinedContext = uniqueInOrder([
    ...specification.qualificationSectionIds,
    ...specification.optionalSupportingSectionIds,
  ]);
  const retrievalContext = searchProductKnowledge(task.question, { limit: 10 }).map((result) => result.sectionId);
  const contextCandidates = uniqueInOrder([...taskDefinedContext, ...retrievalContext]);

  for (const sectionId of contextCandidates) {
    if (drafts.filter((draft) => draft.category === "context").length >= MAX_CONTEXT_EVIDENCE) break;
    if (excludedContextIds.has(sectionId)) continue;
    const section = getSectionById(sectionId);
    if (!section) continue;
    const taskDefined = taskDefinedContext.includes(sectionId);
    addDraft({
      key: `context:${section.sectionId}`,
      category: "context",
      sourceType: "context-section",
      productId: flowPilotProduct.id,
      pageSlug: section.pageSlug,
      pageTitle: section.pageTitle,
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      exactSourceText: section.sectionBody,
      excerpt: excerpt(section.sectionBody),
      sourceLocation: `${section.pageTitle} / ${section.sectionTitle}`,
      customerSaw: false,
      firstExposedByAction: null,
      exposureActionNumbers: [],
      relevanceReason: taskDefined
        ? "The trusted task specification identifies this unseen source as useful qualification or support."
        : "Bounded deterministic retrieval selected this unseen source as additional task context.",
      relatedFactCheckIds: relatedFactChecks(section.sectionId, factChecks),
      collectionMethod: taskDefined ? "task-evaluation-spec" : "deterministic-retrieval",
    });
    excludedContextIds.add(sectionId);
  }

  for (const draft of drafts) {
    if (!draft.customerSaw || !draft.sectionId) continue;
    const relatedResults = factChecks.filter((check) => draft.relatedFactCheckIds.includes(check.id));
    let category: EvidenceCategory = "journey";
    if (relatedResults.some((check) => check.result === "contradicted")) category = "contradicting";
    else if (relatedResults.some((check) => check.result === "supported")) category = "supporting";
    draft.category = category;
    if (category === "supporting") {
      draft.relevanceReason = "This customer-seen source supports a concept detected by the bounded mechanical fact check.";
    } else if (category === "contradicting") {
      draft.relevanceReason = "This customer-seen source conflicts with an affirmative claim detected by the bounded mechanical fact check.";
    }
  }

  const bundleId = `evidence-${run.id}-v${EVIDENCE_BUNDLE_VERSION}`;
  const evidenceItems = drafts.map((draft, orderingIndex) => {
    const { key, ...item } = draft;
    return {
      ...item,
      evidenceId: `${bundleId}-${key.replaceAll(":", "-")}`,
      exposureActionNumbers: [...draft.exposureActionNumbers],
      relatedFactCheckIds: [...draft.relatedFactCheckIds],
      orderingIndex,
    };
  });
  const countCategory = (category: EvidenceCategory) => evidenceItems.filter((item) => item.category === category).length;
  const requiredEvidenceSeen = specification.requiredSectionIds.length - missingRequiredEvidence.length;
  const customerOutcome = outcomeFor(run.completionReason);
  const uniquePages = uniqueInOrder(pagesVisited);
  const uniqueSections = uniqueInOrder(sectionsInspected);
  const uniqueQueries = uniqueInOrder(searchQueries);
  const coverage = {
    journey: countCategory("journey"),
    supporting: countCategory("supporting"),
    contradicting: countCategory("contradicting"),
    context: countCategory("context"),
    missing: countCategory("missing"),
    requiredEvidenceTotal: specification.requiredSectionIds.length,
    requiredEvidenceSeen,
    requiredEvidenceMissing: missingRequiredEvidence.length,
  };
  const journeySummary = `Processed ${run.actions.length} customer actions. The customer ${
    customerOutcome === "answered" ? "provided an answer" : customerOutcome === "gave-up" ? "gave up" : "used the full action budget"
  }, visited ${uniquePages.length} page${uniquePages.length === 1 ? "" : "s"}, and inspected ${uniqueSections.length} section${
    uniqueSections.length === 1 ? "" : "s"
  }.`;

  const candidate = {
    version: EVIDENCE_BUNDLE_VERSION,
    bundleId,
    runId: run.id,
    productId: run.productId,
    taskId: run.taskId,
    personaId: run.personaId,
    createdAt: options.now ?? new Date().toISOString(),
    customerOutcome,
    customerFinalAnswer: run.finalAnswer,
    customerConfidence: run.finalConfidence,
    giveUpReason: run.giveUpReason,
    completionReason: run.completionReason,
    journeySummary,
    evidenceItems,
    factChecks,
    coverage,
    missingRequiredEvidence,
    pagesVisited: uniquePages,
    sectionsInspected: uniqueSections,
    searchQueries: uniqueQueries,
    integrity: {
      actionsProcessed: run.actions.length,
      successfulToolObservations,
      failedToolActions,
      simulationCompletedNormally: run.completionReason !== "budget_exhausted",
      actionBudgetExhausted: run.completionReason === "budget_exhausted",
      finalAnswerExists: Boolean(run.finalAnswer),
      requiredEvidenceSeen: missingRequiredEvidence.length === 0,
      journeyEvidenceCount: evidenceItems.filter((item) => item.customerSaw).length,
      contextualEvidenceCount: countCategory("context"),
      missingEvidenceCount: countCategory("missing"),
    },
  };

  const validated = EvidenceBundleSchema.safeParse(candidate);
  if (!validated.success) {
    throw new EvidenceCollectionError("EVIDENCE_INTEGRITY_FAILURE", "The evidence bundle failed its integrity check.", 500);
  }
  return freezeBundle(validated.data as EvidenceBundle);
}
