import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { collectEvidenceBundle } from "@/lib/evidence/collector";
import type { StructuredGenerationProvider } from "@/lib/simulation/provider";
import { executeCustomerAction } from "@/lib/simulation/tools";
import {
  applyCourtroomArgument,
  applyEvidenceBundle,
  applyJudgeVerdict,
  applySimulationStep,
  createReadyRun,
  listLocalRuns,
  parseStoredRun,
  PHASE_SEVEN_RUN_STORAGE_KEY,
  resetSimulationRun,
  toJudgeVerdictRequest,
  toSimulationStepRequest,
  type StorageLike,
} from "@/lib/test-runs";

import { validateJudgeVerdict } from "./citations";
import { fingerprintCourtroomArgument, fingerprintEvidenceBundle } from "./fingerprints";
import { buildJudgePrompt } from "./prompt";
import {
  JUDGE_VERDICT_JSON_SCHEMA,
  JudgeVerdictSchema,
  JudgeVerdictWireSchema,
  parseJudgeVerdictWire,
} from "./schemas";
import { generateJudgeVerdict } from "./service";
import type {
  CourtroomArgument,
  CourtroomArgumentRecord,
  CourtroomRole,
  JudgeVerdictRecord,
} from "./types";
import { isFinalReportAvailable, VERDICT_LABELS } from "./verdict";

const NOW = "2026-08-10T10:00:00.000Z";

function completedFixture() {
  let run = createReadyRun(
    { taskId: "trial-cancellation", personaId: "careful-researcher", maxActions: 3 },
    { id: "run-judge-test", createdAt: "2026-08-10T07:00:00.000Z" },
  );
  run = applySimulationStep(run, executeCustomerAction({
    action: "ANSWER",
    explanation: "Answer from the available journey.",
    answer: "Cancel before day 14 to prevent the first charge. Trial access remains until the trial ends.",
    confidence: "high",
  }, toSimulationStepRequest(run), { now: "2026-08-10T07:01:00.000Z", actionId: "action-judge-answer" }));
  const bundle = collectEvidenceBundle(run, { now: "2026-08-10T07:02:00.000Z" });
  return { run, bundle };
}

function argument(role: CourtroomRole, evidenceId: string): CourtroomArgument {
  return {
    role,
    thesis: role === "prosecutor" ? "The correct answer required avoidable effort." : "The customer reached a supported answer.",
    keyClaims: [{ id: "claim-1", claim: "The cited record supports this position.", evidenceIds: [evidenceId], strength: "strong" }],
    strongestPoint: { claim: "This is the strongest supported point.", evidenceIds: [evidenceId] },
    acknowledges: [{ claim: "The opposing side has one supported consideration.", evidenceIds: [evidenceId] }],
    requestedVerdictDirection: role === "prosecutor" ? "pass_with_friction" : "pass",
    closingStatement: "The requested direction follows only from the evidence.",
  };
}

function argumentRecord(role: CourtroomRole, bundle = completedFixture().bundle): CourtroomArgumentRecord {
  return {
    argument: argument(role, bundle.evidenceItems[0]!.evidenceId),
    createdAt: role === "prosecutor" ? "2026-08-10T08:00:00.000Z" : "2026-08-10T08:01:00.000Z",
    provider: "groq",
    evidenceBundleId: bundle.bundleId,
    evidenceBundleVersion: bundle.version,
    evidenceBundleFingerprint: fingerprintEvidenceBundle(bundle),
    role,
  };
}

function eligibleRequest() {
  const { run, bundle } = completedFixture();
  return {
    run,
    bundle,
    request: {
      runId: run.id,
      maxActions: run.maxActions,
      evidenceBundle: bundle,
      prosecutor: argumentRecord("prosecutor", bundle),
      defense: argumentRecord("defense", bundle),
    },
  };
}

function verdictWire(evidenceId: string) {
  return {
    verdict: "pass_with_friction" as const,
    summary: "The answer was supported, but important cancellation detail was not surfaced at the initial decision point.",
    findings: [{
      title: "Supported outcome with friction",
      finding: "The customer reached a correct conclusion while relying on product evidence that was not immediately prominent.",
      evidenceIds: [evidenceId],
      weight: "major" as const,
    }],
    prosecutorAssessment: {
      strongestSupportedPoint: "Required policy detail was not initially visible.",
      evidenceIds: [evidenceId],
      overreachOrWeakness: "The journey was not blocked because the customer ultimately answered.",
    },
    defenseAssessment: {
      strongestSupportedPoint: "The final answer matches the cited cancellation policy.",
      evidenceIds: [evidenceId],
      overreachOrWeakness: "Correctness alone understates the effort required to find the policy.",
    },
    customerAnswerStatus: "supported" as const,
    customerOutcomeExplanation: "The customer conclusion is supported by the cited product policy.",
    customerOutcomeEvidenceIds: [evidenceId],
    primaryFrictionPresent: true,
    primaryFrictionTitle: "Decision-point disclosure",
    primaryFrictionExplanation: "The relevant cancellation detail was not prominent where the customer evaluated the trial.",
    primaryFrictionEvidenceIds: [evidenceId],
    recommendationTitle: "Surface the deadline beside the trial action",
    recommendationAction: "Add the cancellation deadline directly beside the free-trial call to action.",
    recommendationRationale: "This places the cited billing condition at the decision point and reduces avoidable searching.",
    recommendationEvidenceIds: [evidenceId],
    confidence: "high" as const,
  };
}

function provider(output: unknown, label: "groq" | "openai" = "groq") {
  const generateStructured = vi.fn().mockResolvedValue(output);
  const selected: StructuredGenerationProvider = { provider: label, generateStructured, decide: vi.fn() };
  return { selected, generateStructured };
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("judge structured verdict", () => {
  it("accepts a complete verdict and transforms the simple wire shape", () => {
    const { bundle } = completedFixture();
    const parsed = parseJudgeVerdictWire(verdictWire(bundle.evidenceItems[0]!.evidenceId));
    expect(JudgeVerdictSchema.parse(parsed)).toMatchObject({ verdict: "pass_with_friction", confidence: "high" });
    expect(parsed.primaryFriction?.title).toBe("Decision-point disclosure");
  });

  it("rejects unknown verdict categories and unknown properties", () => {
    const { bundle } = completedFixture();
    const wire = verdictWire(bundle.evidenceItems[0]!.evidenceId);
    expect(JudgeVerdictWireSchema.safeParse({ ...wire, verdict: "mixed" }).success).toBe(false);
    expect(JudgeVerdictWireSchema.safeParse({ ...wire, privateReasoning: "hidden" }).success).toBe(false);
  });

  it("requires citations for findings and the recommendation", () => {
    const { bundle } = completedFixture();
    const wire = verdictWire(bundle.evidenceItems[0]!.evidenceId);
    expect(JudgeVerdictWireSchema.safeParse({ ...wire, findings: [{ ...wire.findings[0], evidenceIds: [] }] }).success).toBe(false);
    expect(JudgeVerdictWireSchema.safeParse({ ...wire, recommendationEvidenceIds: [] }).success).toBe(false);
  });

  it("rejects duplicate and fabricated evidence IDs", () => {
    const { bundle } = completedFixture();
    const id = bundle.evidenceItems[0]!.evidenceId;
    const duplicate = { ...verdictWire(id), customerOutcomeEvidenceIds: [id, id] };
    expect(JudgeVerdictWireSchema.safeParse(duplicate).success).toBe(false);
    expect(() => validateJudgeVerdict(parseJudgeVerdictWire(verdictWire("evidence-fabricated")), bundle)).toThrowError(
      expect.objectContaining({ code: "COURTROOM_INVALID_CITATION", retryable: true }),
    );
  });

  it("allows null primary friction only through an explicit citation-free wire state", () => {
    const { bundle } = completedFixture();
    const wire = {
      ...verdictWire(bundle.evidenceItems[0]!.evidenceId),
      verdict: "pass" as const,
      primaryFrictionPresent: false,
      primaryFrictionTitle: "Not applicable",
      primaryFrictionExplanation: "No material product friction was established.",
      primaryFrictionEvidenceIds: [],
    };
    expect(parseJudgeVerdictWire(wire).primaryFriction).toBeNull();
  });

  it("uses a closed Groq-compatible JSON Schema", () => {
    const serialized = JSON.stringify(JUDGE_VERDICT_JSON_SCHEMA);
    expect(serialized).not.toContain('"anyOf"');
    expect(serialized).not.toContain('"oneOf"');
    function assertClosed(value: unknown) {
      if (!value || typeof value !== "object") return;
      const object = value as Record<string, unknown>;
      if (object.type === "object") expect(object.additionalProperties).toBe(false);
      Object.values(object).forEach(assertClosed);
    }
    assertClosed(JUDGE_VERDICT_JSON_SCHEMA);
  });
});

describe("judge prompt fairness and isolation", () => {
  it("includes both structured sides, the customer outcome, persona, action budget, and seen distinction", () => {
    const { request } = eligibleRequest();
    const prompt = buildJudgePrompt(request.evidenceBundle, request.prosecutor, request.defense, request.maxActions);
    expect(prompt.input).toContain('"role":"prosecutor"');
    expect(prompt.input).toContain('"role":"defense"');
    expect(prompt.input).toContain("Customer conclusion:");
    expect(prompt.input).toContain("Persona: Careful researcher");
    expect(prompt.input).toContain("Actions used versus maximum: 1/3");
    expect(prompt.input).toContain("[not-seen]");
  });

  it("treats evidence as untrusted, mechanical checks as non-binding, and arguments as interpretation", () => {
    const { request } = eligibleRequest();
    const prompt = buildJudgePrompt(request.evidenceBundle, request.prosecutor, request.defense, request.maxActions);
    expect(prompt.input).toContain("<untrusted_case_record>");
    expect(prompt.instructions).toContain("supporting signals, not binding verdicts");
    expect(prompt.instructions).toContain("arguments are interpretations, never evidence");
    expect(prompt.instructions).toContain("customer-seen evidence from unseen context");
  });

  it("does not expose internal evaluation specs, hidden expected answers, tools, or chain of thought", () => {
    const { request } = eligibleRequest();
    const prompt = buildJudgePrompt(request.evidenceBundle, request.prosecutor, request.defense, request.maxActions);
    const serialized = JSON.stringify(prompt);
    expect(serialized).not.toContain("requiredConceptGroups");
    expect(serialized).not.toContain("expectedAnswer");
    expect(prompt.instructions).toContain("Do not invent product facts, retrieve new material, browse, request tools");
    expect(prompt.instructions).toContain("chain of thought");
  });
});

describe("judge eligibility and one-call service", () => {
  it.each([
    ["evidence", (request: Record<string, unknown>) => { delete request.evidenceBundle; }],
    ["prosecutor", (request: Record<string, unknown>) => { delete request.prosecutor; }],
    ["defense", (request: Record<string, unknown>) => { delete request.defense; }],
  ])("rejects missing %s before provider creation", async (_label, mutate) => {
    const fixture = eligibleRequest();
    const request = structuredClone(fixture.request) as unknown as Record<string, unknown>;
    mutate(request);
    const createProvider = vi.fn(() => provider(verdictWire(fixture.bundle.evidenceItems[0]!.evidenceId)).selected);
    await expect(generateJudgeVerdict(request, { createProvider })).rejects.toMatchObject({ code: "JUDGE_INVALID_REQUEST" });
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("rejects stale arguments and bundle mismatches before a provider call", async () => {
    const fixture = eligibleRequest();
    const createProvider = vi.fn(() => provider(verdictWire(fixture.bundle.evidenceItems[0]!.evidenceId)).selected);
    await expect(generateJudgeVerdict({
      ...fixture.request,
      prosecutor: { ...fixture.request.prosecutor, evidenceBundleFingerprint: null },
    }, { createProvider })).rejects.toMatchObject({ code: "JUDGE_STALE_ARGUMENT" });
    await expect(generateJudgeVerdict({
      ...fixture.request,
      defense: { ...fixture.request.defense, evidenceBundleId: "evidence-another-v1" },
    }, { createProvider })).rejects.toMatchObject({ code: "JUDGE_ARGUMENT_BUNDLE_MISMATCH" });
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("rejects wrong role placement before provider access", async () => {
    const fixture = eligibleRequest();
    const createProvider = vi.fn(() => provider(verdictWire(fixture.bundle.evidenceItems[0]!.evidenceId)).selected);
    await expect(generateJudgeVerdict({ ...fixture.request, prosecutor: fixture.request.defense }, { createProvider })).rejects.toMatchObject({ code: "JUDGE_WRONG_ARGUMENT_ROLE" });
    expect(createProvider).not.toHaveBeenCalled();
  });

  it.each(["groq", "openai"] as const)("generates through the %s provider interface with exactly one call", async (label) => {
    const fixture = eligibleRequest();
    const mock = provider(verdictWire(fixture.bundle.evidenceItems[0]!.evidenceId), label);
    const before = JSON.stringify(fixture.request);
    const record = await generateJudgeVerdict(fixture.request, { createProvider: () => mock.selected, now: () => NOW });
    expect(mock.generateStructured).toHaveBeenCalledOnce();
    expect(mock.generateStructured).toHaveBeenCalledWith(expect.objectContaining({ useCase: "courtroom-judge", schemaName: "courtroom_judge_verdict" }));
    expect(record).toMatchObject({ provider: label, createdAt: NOW, evidenceBundleId: fixture.bundle.bundleId });
    expect(JSON.stringify(fixture.request)).toBe(before);
  });

  it("does not retry, repair, or fall back after invalid provider JSON", async () => {
    const fixture = eligibleRequest();
    const mock = provider({ verdict: "pass" });
    await expect(generateJudgeVerdict(fixture.request, { createProvider: () => mock.selected })).rejects.toMatchObject({ code: "JUDGE_INVALID_RESPONSE", retryable: true });
    expect(mock.generateStructured).toHaveBeenCalledOnce();
  });

  it("maps invalid judge citations to a safe retryable error after one call", async () => {
    const fixture = eligibleRequest();
    const mock = provider(verdictWire("evidence-fabricated"));
    await expect(generateJudgeVerdict(fixture.request, { createProvider: () => mock.selected })).rejects.toMatchObject({ code: "COURTROOM_INVALID_CITATION", retryable: true });
    expect(mock.generateStructured).toHaveBeenCalledOnce();
  });
});

describe("judge persistence and invalidation", () => {
  function judgedRun() {
    const fixture = eligibleRequest();
    let run = applyEvidenceBundle(fixture.run, fixture.bundle);
    run = applyCourtroomArgument(run, fixture.request.prosecutor);
    run = applyCourtroomArgument(run, fixture.request.defense);
    const verdict = parseJudgeVerdictWire(verdictWire(fixture.bundle.evidenceItems[0]!.evidenceId));
    const record: JudgeVerdictRecord = {
      verdict,
      createdAt: NOW,
      provider: "groq",
      evidenceBundleId: fixture.bundle.bundleId,
      evidenceBundleVersion: fixture.bundle.version,
      evidenceBundleFingerprint: fingerprintEvidenceBundle(fixture.bundle),
      prosecutorArgumentFingerprint: fingerprintCourtroomArgument(run.courtroom.prosecutor!),
      defenseArgumentFingerprint: fingerprintCourtroomArgument(run.courtroom.defense!),
    };
    return applyJudgeVerdict(run, record);
  }

  it("persists a judge without mutating the journey, evidence, or arguments", () => {
    const run = judgedRun();
    expect(run.courtroom.judge?.verdict.verdict).toBe("pass_with_friction");
    expect(run.currentActionCount).toBe(1);
    expect(run.evidenceBundle).toBeTruthy();
    expect(run.courtroom.prosecutor?.argument.role).toBe("prosecutor");
    expect(run.courtroom.defense?.argument.role).toBe("defense");
    expect(parseStoredRun(JSON.parse(JSON.stringify(run)))?.courtroom.judge).toEqual(run.courtroom.judge);
  });

  it("reset and evidence rebuild clear the judge", () => {
    const run = judgedRun();
    expect(resetSimulationRun(run, NOW).courtroom.judge).toBeNull();
    expect(applyEvidenceBundle(run, run.evidenceBundle!).courtroom).toEqual({ prosecutor: null, defense: null, judge: null });
  });

  it.each(["prosecutor", "defense"] as const)("successful %s regeneration invalidates the judge and preserves the other side", (role) => {
    const run = judgedRun();
    const otherRole = role === "prosecutor" ? "defense" : "prosecutor";
    const other = run.courtroom[otherRole];
    const replacement = { ...argumentRecord(role, run.evidenceBundle!), createdAt: "2026-08-10T11:00:00.000Z" };
    const updated = applyCourtroomArgument(run, replacement);
    expect(updated.courtroom.judge).toBeNull();
    expect(updated.courtroom[otherRole]).toEqual(other);
  });

  it("a failed judge regeneration preserves the prior verdict", async () => {
    const run = judgedRun();
    const previous = run.courtroom.judge;
    const mock = provider({ verdict: "invalid" });
    await expect(generateJudgeVerdict(toJudgeVerdictRequest(run), { createProvider: () => mock.selected })).rejects.toBeTruthy();
    expect(run.courtroom.judge).toEqual(previous);
  });

  it("keeps legacy Phase 7 runs readable but marks old advocates as freshness-unverifiable", () => {
    const current = judgedRun();
    const legacy = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    const courtroom = legacy.courtroom as Record<string, unknown>;
    delete courtroom.judge;
    for (const role of ["prosecutor", "defense"]) {
      delete (courtroom[role] as Record<string, unknown>).evidenceBundleFingerprint;
    }
    const parsed = parseStoredRun(legacy);
    expect(parsed?.courtroom.judge).toBeNull();
    expect(parsed?.courtroom.prosecutor?.evidenceBundleFingerprint).toBeNull();
    expect(() => toJudgeVerdictRequest(parsed!)).not.toThrow();
  });

  it("migrates the v4 storage key into readable browser state", () => {
    const storage = memoryStorage();
    const current = judgedRun();
    const phaseSeven = { ...current, courtroom: { prosecutor: current.courtroom.prosecutor, defense: current.courtroom.defense } };
    storage.setItem(PHASE_SEVEN_RUN_STORAGE_KEY, JSON.stringify([phaseSeven]));
    expect(listLocalRuns(storage)[0]?.courtroom.judge).toBeNull();
  });

  it("stores no prompt, raw model response, or hidden reasoning", () => {
    const stored = JSON.stringify(judgedRun());
    expect(stored).not.toContain("untrusted_case_record");
    expect(stored).not.toContain("rawResponse");
    expect(stored).not.toContain("chainOfThought");
  });

  it("exposes the final report only after a judge exists and maps all verdict labels", () => {
    const run = judgedRun();
    expect(isFinalReportAvailable({ ...run.courtroom, judge: null })).toBe(false);
    expect(isFinalReportAvailable(run.courtroom)).toBe(true);
    expect(VERDICT_LABELS).toEqual({
      pass: "Pass",
      pass_with_friction: "Pass with friction",
      misleading: "Misleading",
      blocked: "Blocked",
      insufficient_evidence: "Insufficient evidence",
    });
  });
});
