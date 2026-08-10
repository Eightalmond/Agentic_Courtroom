import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import { POST } from "@/app/api/courtroom/argue/route";
import { collectEvidenceBundle } from "@/lib/evidence/collector";
import { executeCustomerAction } from "@/lib/simulation/tools";
import type { StructuredGenerationProvider } from "@/lib/simulation/provider";
import {
  applyCourtroomArgument,
  applyEvidenceBundle,
  applySimulationStep,
  createReadyRun,
  parseStoredRun,
  resetSimulationRun,
  toCourtroomArgumentRequest,
  toSimulationStepRequest,
} from "@/lib/test-runs";

import { validateCourtroomArgument } from "./citations";
import { revalidateCourtroomEvidence } from "./evidence";
import { fingerprintEvidenceBundle } from "./fingerprints";
import { buildCourtroomPrompt, formatCourtroomEvidence } from "./prompt";
import {
  COURTROOM_ARGUMENT_JSON_SCHEMA,
  CourtroomArgumentSchema,
  CourtroomArgumentWireSchema,
  parseCourtroomArgumentWire,
} from "./schemas";
import { generateCourtroomArgument } from "./service";
import type { CourtroomArgument, CourtroomArgumentRecord, CourtroomRole } from "./types";

const NOW = "2026-08-10T08:00:00.000Z";

function evidenceFixture() {
  let run = createReadyRun(
    { taskId: "trial-cancellation", personaId: "careful-researcher", maxActions: 3 },
    { id: "run-courtroom-test", createdAt: "2026-08-10T07:00:00.000Z" },
  );
  run = applySimulationStep(run, executeCustomerAction({
    action: "ANSWER",
    explanation: "Answer from the available journey.",
    answer: "Cancel before day 14 to prevent the first charge. Trial access remains until the trial ends.",
    confidence: "high",
  }, toSimulationStepRequest(run), { now: "2026-08-10T07:01:00.000Z", actionId: "action-courtroom-answer" }));
  return { run, bundle: collectEvidenceBundle(run, { now: "2026-08-10T07:02:00.000Z" }) };
}

function validArgument(role: CourtroomRole, evidenceId: string): CourtroomArgument {
  return {
    role,
    thesis: role === "prosecutor" ? "The journey did not expose the customer to the required sources." : "The customer reached a materially correct answer.",
    keyClaims: [{ id: "claim-1", claim: "The recorded outcome supports this side's position.", evidenceIds: [evidenceId], strength: "strong" }],
    strongestPoint: { claim: "The cited item is the strongest bounded evidence.", evidenceIds: [evidenceId] },
    acknowledges: [{ claim: "The opposing interpretation has a documented basis.", evidenceIds: [evidenceId] }],
    requestedVerdictDirection: role === "prosecutor" ? "pass_with_friction" : "pass",
    closingStatement: "The requested direction follows from the cited bundle only.",
  };
}

function validWireArgument(role: CourtroomRole, evidenceId: string) {
  return {
    role,
    thesis: role === "prosecutor" ? "The journey did not expose the customer to the required sources." : "The customer reached a materially correct answer.",
    keyClaims: [{ claim: "The recorded outcome supports this side's position.", evidenceIds: [evidenceId], strength: "strong" as const }],
    strongestPointClaim: "The cited item is the strongest bounded evidence.",
    strongestPointEvidenceIds: [evidenceId],
    acknowledgements: [{ point: "The opposing interpretation has a documented basis.", evidenceIds: [evidenceId] }],
    requestedVerdictDirection: role === "prosecutor" ? "pass_with_friction" as const : "pass" as const,
    closingStatement: "The requested direction follows from the cited bundle only.",
  };
}

function argumentRecord(role: CourtroomRole, bundle = evidenceFixture().bundle): CourtroomArgumentRecord {
  return {
    argument: validArgument(role, bundle.evidenceItems[0]!.evidenceId),
    createdAt: NOW,
    provider: "groq",
    evidenceBundleId: bundle.bundleId,
    evidenceBundleVersion: bundle.version,
    evidenceBundleFingerprint: fingerprintEvidenceBundle(bundle),
    role,
  };
}

function mockProvider(output: unknown, label: "groq" | "openai" = "groq") {
  const generateStructured = vi.fn().mockResolvedValue(output);
  const provider: StructuredGenerationProvider = {
    provider: label,
    generateStructured,
    decide: vi.fn(),
  };
  return { provider, generateStructured };
}

describe("courtroom argument schema", () => {
  it.each(["prosecutor", "defense"] as const)("accepts a complete %s argument", (role) => {
    const { bundle } = evidenceFixture();
    expect(CourtroomArgumentSchema.parse(validArgument(role, bundle.evidenceItems[0]!.evidenceId)).role).toBe(role);
  });

  it("rejects unknown properties and unsupported roles", () => {
    const { bundle } = evidenceFixture();
    const argument = validArgument("prosecutor", bundle.evidenceItems[0]!.evidenceId);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, privateReasoning: "hidden" }).success).toBe(false);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, role: "judge" }).success).toBe(false);
  });

  it("requires citations for every substantive point", () => {
    const { bundle } = evidenceFixture();
    const argument = validArgument("prosecutor", bundle.evidenceItems[0]!.evidenceId);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, keyClaims: [{ ...argument.keyClaims[0], evidenceIds: [] }] }).success).toBe(false);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, strongestPoint: { ...argument.strongestPoint, evidenceIds: [] } }).success).toBe(false);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, acknowledges: [{ claim: "A point", evidenceIds: [] }] }).success).toBe(false);
  });

  it("rejects duplicate citations, duplicate claim IDs, unbounded arrays, and invalid verdict directions", () => {
    const { bundle } = evidenceFixture();
    const id = bundle.evidenceItems[0]!.evidenceId;
    const argument = validArgument("defense", id);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, strongestPoint: { claim: "Point", evidenceIds: [id, id] } }).success).toBe(false);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, keyClaims: [argument.keyClaims[0], argument.keyClaims[0]] }).success).toBe(false);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, acknowledges: Array(4).fill(argument.strongestPoint) }).success).toBe(false);
    expect(CourtroomArgumentSchema.safeParse({ ...argument, requestedVerdictDirection: "acquit" }).success).toBe(false);
  });
});

describe("Groq-compatible courtroom wire schema", () => {
  it("transforms the provider wire object into the unchanged internal argument", () => {
    const { bundle } = evidenceFixture();
    const id = bundle.evidenceItems[0]!.evidenceId;
    const argument = parseCourtroomArgumentWire(validWireArgument("prosecutor", id));
    expect(argument).toEqual(validArgument("prosecutor", id));
    expect(argument.keyClaims[0]?.id).toBe("claim-1");
  });

  it("rejects unknown wire fields, wrong roles, and malformed evidence IDs", () => {
    const { bundle } = evidenceFixture();
    const wire = validWireArgument("defense", bundle.evidenceItems[0]!.evidenceId);
    expect(CourtroomArgumentWireSchema.safeParse({ ...wire, privateReasoning: "hidden" }).success).toBe(false);
    expect(CourtroomArgumentWireSchema.safeParse({ ...wire, role: "judge" }).success).toBe(false);
    expect(CourtroomArgumentWireSchema.safeParse({ ...wire, strongestPointEvidenceIds: ["INVALID ID"] }).success).toBe(false);
  });

  it("uses only Groq-compatible schema primitives and closes every object", () => {
    const serialized = JSON.stringify(COURTROOM_ARGUMENT_JSON_SCHEMA);
    expect(serialized).not.toContain('"anyOf"');
    expect(serialized).not.toContain('"oneOf"');
    expect(serialized).not.toContain('"pattern"');
    expect(serialized).not.toContain('"prefixItems"');

    function assertClosedObjects(value: unknown) {
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      if (record.type === "object") expect(record.additionalProperties).toBe(false);
      Object.values(record).forEach(assertClosedObjects);
    }
    assertClosedObjects(COURTROOM_ARGUMENT_JSON_SCHEMA);
  });
});

describe("shared evidence-only prompting", () => {
  it("gives both roles the exact same compact evidence input", () => {
    const { bundle } = evidenceFixture();
    expect(buildCourtroomPrompt("prosecutor", bundle).input).toBe(buildCourtroomPrompt("defense", bundle).input);
  });

  it("changes only the role assignment in otherwise shared instructions", () => {
    const { bundle } = evidenceFixture();
    const prosecutor = buildCourtroomPrompt("prosecutor", bundle).instructions.split("\n");
    const defense = buildCourtroomPrompt("defense", bundle).instructions.split("\n");
    expect(prosecutor.filter((_, index) => index !== 1)).toEqual(defense.filter((_, index) => index !== 1));
    expect(prosecutor[1]).toContain("prosecutor");
    expect(defense[1]).toContain("defense");
  });

  it("delimits untrusted content and labels seen versus unseen evidence", () => {
    const formatted = formatCourtroomEvidence(evidenceFixture().bundle);
    expect(formatted).toContain("<untrusted_evidence_bundle>");
    expect(formatted).toContain("</untrusted_evidence_bundle>");
    expect(formatted).toContain("[not-seen]");
    expect(formatted).toContain("Task:");
    expect(formatted).toContain("Persona:");
    expect(formatted).toContain("Coverage:");
  });

  it("does not expose internal evaluation rules, expected answers, or chain of thought", () => {
    const formatted = formatCourtroomEvidence(evidenceFixture().bundle);
    expect(formatted).not.toContain("requiredConceptGroups");
    expect(formatted).not.toContain("forbiddenClaims");
    expect(formatted).not.toContain("expectedAnswer");
    expect(formatted).not.toContain("chainOfThought");
  });
});

describe("courtroom evidence and citations", () => {
  it("accepts the original immutable bundle and valid citations", () => {
    const { bundle } = evidenceFixture();
    expect(revalidateCourtroomEvidence(bundle, bundle.runId)).toEqual(bundle);
    expect(validateCourtroomArgument(validArgument("prosecutor", bundle.evidenceItems[0]!.evidenceId), "prosecutor", bundle).role).toBe("prosecutor");
  });

  it("rejects fabricated citations and wrong-role output", () => {
    const { bundle } = evidenceFixture();
    expect(() => validateCourtroomArgument(validArgument("prosecutor", "evidence-fabricated"), "prosecutor", bundle)).toThrowError(expect.objectContaining({ code: "COURTROOM_INVALID_CITATION" }));
    expect(() => validateCourtroomArgument(validArgument("defense", bundle.evidenceItems[0]!.evidenceId), "prosecutor", bundle)).toThrowError(expect.objectContaining({ code: "COURTROOM_ROLE_MISMATCH" }));
  });

  it("rejects cross-run bundles and tampered trusted source text", () => {
    const { bundle } = evidenceFixture();
    expect(() => revalidateCourtroomEvidence(bundle, "run-another")).toThrowError(expect.objectContaining({ code: "COURTROOM_EVIDENCE_RUN_MISMATCH" }));
    const changed = { ...bundle, evidenceItems: bundle.evidenceItems.map((item, index) => index === 0 ? { ...item, exactSourceText: "Fabricated product content." } : item) };
    expect(() => revalidateCourtroomEvidence(changed, bundle.runId)).toThrowError(expect.objectContaining({ code: "COURTROOM_INVALID_EVIDENCE" }));
  });

  it("rejects tampered deterministic fact checks", () => {
    const { bundle } = evidenceFixture();
    const changed = { ...bundle, factChecks: bundle.factChecks.map((check) => ({ ...check, result: "contradicted" as const })) };
    expect(() => revalidateCourtroomEvidence(changed, bundle.runId)).toThrowError(expect.objectContaining({ code: "COURTROOM_INVALID_EVIDENCE" }));
  });
});

describe("one-call independent advocate service", () => {
  it.each(["prosecutor", "defense"] as const)("generates %s with exactly one configured-provider call", async (role) => {
    const { bundle } = evidenceFixture();
    const output = validWireArgument(role, bundle.evidenceItems[0]!.evidenceId);
    const mock = mockProvider(output, "openai");
    const record = await generateCourtroomArgument({ runId: bundle.runId, role, evidenceBundle: bundle }, {
      createProvider: () => mock.provider,
      now: () => NOW,
    });
    expect(mock.generateStructured).toHaveBeenCalledOnce();
    expect(record).toMatchObject({ role, provider: "openai", evidenceBundleId: bundle.bundleId, createdAt: NOW });
  });

  it("does not call the provider for malformed requests or invalid evidence", async () => {
    const { bundle } = evidenceFixture();
    const mock = mockProvider(validWireArgument("prosecutor", bundle.evidenceItems[0]!.evidenceId));
    await expect(generateCourtroomArgument({ runId: bundle.runId, role: "judge", evidenceBundle: bundle }, { createProvider: () => mock.provider })).rejects.toMatchObject({ code: "COURTROOM_INVALID_REQUEST" });
    await expect(generateCourtroomArgument({ runId: "run-other", role: "prosecutor", evidenceBundle: bundle }, { createProvider: () => mock.provider })).rejects.toMatchObject({ code: "COURTROOM_EVIDENCE_RUN_MISMATCH" });
    expect(mock.generateStructured).not.toHaveBeenCalled();
  });

  it("does not retry or repair invalid structured output", async () => {
    const { bundle } = evidenceFixture();
    const mock = mockProvider({ role: "prosecutor" });
    await expect(generateCourtroomArgument({ runId: bundle.runId, role: "prosecutor", evidenceBundle: bundle }, { createProvider: () => mock.provider })).rejects.toMatchObject({ code: "COURTROOM_INVALID_RESPONSE" });
    expect(mock.generateStructured).toHaveBeenCalledOnce();
  });

  it("still rejects wrong roles and fabricated citations after wire transformation", async () => {
    const { bundle } = evidenceFixture();
    const id = bundle.evidenceItems[0]!.evidenceId;
    const wrongRole = mockProvider(validWireArgument("defense", id));
    await expect(generateCourtroomArgument(
      { runId: bundle.runId, role: "prosecutor", evidenceBundle: bundle },
      { createProvider: () => wrongRole.provider },
    )).rejects.toMatchObject({ code: "COURTROOM_ROLE_MISMATCH" });
    expect(wrongRole.generateStructured).toHaveBeenCalledOnce();

    const fabricated = mockProvider(validWireArgument("prosecutor", "evidence-fabricated"));
    await expect(generateCourtroomArgument(
      { runId: bundle.runId, role: "prosecutor", evidenceBundle: bundle },
      { createProvider: () => fabricated.provider },
    )).rejects.toMatchObject({ code: "COURTROOM_INVALID_CITATION" });
    expect(fabricated.generateStructured).toHaveBeenCalledOnce();
  });

  it("does not share one side's argument with the other side", async () => {
    const { bundle } = evidenceFixture();
    const prosecutor = mockProvider(validWireArgument("prosecutor", bundle.evidenceItems[0]!.evidenceId));
    const defense = mockProvider(validWireArgument("defense", bundle.evidenceItems[0]!.evidenceId));
    await generateCourtroomArgument({ runId: bundle.runId, role: "prosecutor", evidenceBundle: bundle }, { createProvider: () => prosecutor.provider });
    await generateCourtroomArgument({ runId: bundle.runId, role: "defense", evidenceBundle: bundle }, { createProvider: () => defense.provider });
    expect(prosecutor.generateStructured.mock.calls[0]?.[0].input).toBe(defense.generateStructured.mock.calls[0]?.[0].input);
    expect(JSON.stringify(defense.generateStructured.mock.calls[0]?.[0])).not.toContain("case for failure");
  });
});

describe("courtroom persistence lifecycle", () => {
  it("stores either role first and preserves the opposite role on regeneration", () => {
    const fixture = evidenceFixture();
    let run = applyEvidenceBundle(fixture.run, fixture.bundle);
    run = applyCourtroomArgument(run, argumentRecord("defense", fixture.bundle));
    const defense = run.courtroom.defense;
    run = applyCourtroomArgument(run, argumentRecord("prosecutor", fixture.bundle));
    run = applyCourtroomArgument(run, { ...argumentRecord("prosecutor", fixture.bundle), createdAt: "2026-08-10T09:00:00.000Z" });
    expect(run.courtroom.defense).toEqual(defense);
    expect(run.courtroom.prosecutor?.createdAt).toBe("2026-08-10T09:00:00.000Z");
  });

  it("evidence rebuild and simulation reset invalidate both arguments", () => {
    const fixture = evidenceFixture();
    let run = applyEvidenceBundle(fixture.run, fixture.bundle);
    run = applyCourtroomArgument(run, argumentRecord("prosecutor", fixture.bundle));
    run = applyCourtroomArgument(run, argumentRecord("defense", fixture.bundle));
    expect(applyEvidenceBundle(run, fixture.bundle).courtroom).toEqual({ prosecutor: null, defense: null, judge: null });
    expect(resetSimulationRun(run, NOW).courtroom).toEqual({ prosecutor: null, defense: null, judge: null });
  });

  it("rejects records for another bundle and keeps arguments in browser-shaped storage", () => {
    const fixture = evidenceFixture();
    let run = applyEvidenceBundle(fixture.run, fixture.bundle);
    expect(() => applyCourtroomArgument(run, { ...argumentRecord("prosecutor", fixture.bundle), evidenceBundleId: "evidence-another-v1" })).toThrow();
    run = applyCourtroomArgument(run, argumentRecord("prosecutor", fixture.bundle));
    expect(parseStoredRun(JSON.parse(JSON.stringify(run)))?.courtroom.prosecutor).toEqual(run.courtroom.prosecutor);
  });

  it("migrates pre-courtroom runs with an empty courtroom state", () => {
    const legacy = evidenceFixture().run;
    const phaseSixRun = Object.fromEntries(Object.entries(legacy).filter(([key]) => key !== "courtroom"));
    expect(parseStoredRun(phaseSixRun)?.courtroom).toEqual({ prosecutor: null, defense: null, judge: null });
  });

  it("builds a request only when matching evidence exists", () => {
    const fixture = evidenceFixture();
    expect(() => toCourtroomArgumentRequest(fixture.run, "defense")).toThrow();
    expect(toCourtroomArgumentRequest(applyEvidenceBundle(fixture.run, fixture.bundle), "defense")).toEqual({ runId: fixture.run.id, role: "defense", evidenceBundle: fixture.bundle });
  });
});

describe("courtroom route validation", () => {
  it("returns a safe error before credentials are read for an invalid request", async () => {
    const response = await POST(new NextRequest("http://localhost/api/courtroom/argue", {
      method: "POST",
      body: JSON.stringify({ runId: "run-invalid", role: "judge" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "COURTROOM_INVALID_REQUEST", message: "A run, courtroom role, and valid evidence bundle are required.", retryable: false });
  });
});
