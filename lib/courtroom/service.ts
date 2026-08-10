import "server-only";

import { createSimulationProvider } from "@/lib/simulation/providers/factory";
import type { StructuredGenerationProvider } from "@/lib/simulation/provider";

import { validateCourtroomArgument, validateJudgeVerdict } from "./citations";
import { revalidateCourtroomEvidence } from "./evidence";
import { CourtroomError } from "./errors";
import { fingerprintCourtroomArgument, fingerprintEvidenceBundle } from "./fingerprints";
import { buildCourtroomPrompt, buildJudgePrompt } from "./prompt";
import {
  COURTROOM_ARGUMENT_JSON_SCHEMA,
  CourtroomArgumentWireSchema,
  CourtroomArgumentRecordSchema,
  CourtroomArgumentRequestSchema,
  JUDGE_VERDICT_JSON_SCHEMA,
  JudgeVerdictRecordSchema,
  JudgeVerdictRequestSchema,
  JudgeVerdictWireSchema,
  parseCourtroomArgumentWire,
  parseJudgeVerdictWire,
} from "./schemas";
import type { CourtroomArgumentRecord, JudgeVerdictRecord } from "./types";

type CourtroomServiceDependencies = {
  createProvider?: () => StructuredGenerationProvider;
  now?: () => string;
};

export async function generateCourtroomArgument(
  value: unknown,
  dependencies: CourtroomServiceDependencies = {},
): Promise<CourtroomArgumentRecord> {
  const request = CourtroomArgumentRequestSchema.safeParse(value);
  if (!request.success) {
    throw new CourtroomError(
      "COURTROOM_INVALID_REQUEST",
      "A run, courtroom role, and valid evidence bundle are required.",
      400,
    );
  }

  const evidenceBundle = revalidateCourtroomEvidence(request.data.evidenceBundle, request.data.runId);
  const provider = (dependencies.createProvider ?? createSimulationProvider)();
  const prompt = buildCourtroomPrompt(request.data.role, evidenceBundle);
  const output = await provider.generateStructured({
    useCase: "courtroom-argument",
    ...prompt,
    schemaName: `courtroom_${request.data.role}_argument`,
    jsonSchema: COURTROOM_ARGUMENT_JSON_SCHEMA,
    zodSchema: CourtroomArgumentWireSchema,
    maxOutputTokens: 1_400,
  });
  const wireResult = CourtroomArgumentWireSchema.safeParse(output);
  if (!wireResult.success) {
    if (process.env.NODE_ENV === "development") {
      console.error("[courtroom] safe wire validation diagnostic", wireResult.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      })));
    }
    throw new CourtroomError(
      "COURTROOM_INVALID_RESPONSE",
      "The advocate returned invalid structured output. Try generating this side again.",
      502,
      true,
    );
  }
  const argument = validateCourtroomArgument(
    parseCourtroomArgumentWire(wireResult.data),
    request.data.role,
    evidenceBundle,
  );

  return CourtroomArgumentRecordSchema.parse({
    argument,
    createdAt: (dependencies.now ?? (() => new Date().toISOString()))(),
    provider: provider.provider,
    evidenceBundleId: evidenceBundle.bundleId,
    evidenceBundleVersion: evidenceBundle.version,
    evidenceBundleFingerprint: fingerprintEvidenceBundle(evidenceBundle),
    role: request.data.role,
  });
}

function validateJudgeEligibility(value: unknown) {
  const request = JudgeVerdictRequestSchema.safeParse(value);
  if (!request.success) {
    throw new CourtroomError(
      "JUDGE_INVALID_REQUEST",
      "A completed run, evidence bundle, and both courtroom arguments are required.",
      400,
    );
  }

  const { runId, maxActions, prosecutor, defense } = request.data;
  const bundle = revalidateCourtroomEvidence(request.data.evidenceBundle, runId);
  if (bundle.integrity.actionsProcessed > maxActions || (bundle.completionReason === "budget_exhausted" && bundle.integrity.actionsProcessed !== maxActions)) {
    throw new CourtroomError("JUDGE_UNSUPPORTED_RUN_STATE", "The completed journey does not match its action budget.", 400);
  }
  if (prosecutor.role !== "prosecutor" || prosecutor.argument.role !== "prosecutor") {
    throw new CourtroomError("JUDGE_WRONG_ARGUMENT_ROLE", "The prosecutor argument has the wrong courtroom role.", 400);
  }
  if (defense.role !== "defense" || defense.argument.role !== "defense") {
    throw new CourtroomError("JUDGE_WRONG_ARGUMENT_ROLE", "The defense argument has the wrong courtroom role.", 400);
  }
  if (
    prosecutor.evidenceBundleId !== defense.evidenceBundleId ||
    prosecutor.evidenceBundleVersion !== defense.evidenceBundleVersion
  ) {
    throw new CourtroomError("JUDGE_ARGUMENT_BUNDLE_MISMATCH", "Both arguments must reference the same evidence bundle.", 400);
  }
  if (
    prosecutor.evidenceBundleId !== bundle.bundleId ||
    defense.evidenceBundleId !== bundle.bundleId ||
    prosecutor.evidenceBundleVersion !== bundle.version ||
    defense.evidenceBundleVersion !== bundle.version
  ) {
    throw new CourtroomError("JUDGE_STALE_ARGUMENT", "One or both arguments are stale. Regenerate them from the current evidence.", 400);
  }

  const bundleFingerprint = fingerprintEvidenceBundle(bundle);
  if (
    prosecutor.evidenceBundleFingerprint !== bundleFingerprint ||
    defense.evidenceBundleFingerprint !== bundleFingerprint
  ) {
    throw new CourtroomError("JUDGE_STALE_ARGUMENT", "One or both arguments are stale. Regenerate them from the current evidence.", 400);
  }

  validateCourtroomArgument(prosecutor.argument, "prosecutor", bundle);
  validateCourtroomArgument(defense.argument, "defense", bundle);
  return { runId, maxActions, bundle, prosecutor, defense, bundleFingerprint };
}

export async function generateJudgeVerdict(
  value: unknown,
  dependencies: CourtroomServiceDependencies = {},
): Promise<JudgeVerdictRecord> {
  const eligible = validateJudgeEligibility(value);
  const provider = (dependencies.createProvider ?? createSimulationProvider)();
  const prompt = buildJudgePrompt(eligible.bundle, eligible.prosecutor, eligible.defense, eligible.maxActions);
  const output = await provider.generateStructured({
    useCase: "courtroom-judge",
    ...prompt,
    schemaName: "courtroom_judge_verdict",
    jsonSchema: JUDGE_VERDICT_JSON_SCHEMA,
    zodSchema: JudgeVerdictWireSchema,
    maxOutputTokens: 2_400,
  });
  const wire = JudgeVerdictWireSchema.safeParse(output);
  if (!wire.success) {
    throw new CourtroomError(
      "JUDGE_INVALID_RESPONSE",
      "The judge returned invalid structured output. Try running the judge again.",
      502,
      true,
    );
  }
  const verdict = validateJudgeVerdict(parseJudgeVerdictWire(wire.data), eligible.bundle);

  return JudgeVerdictRecordSchema.parse({
    verdict,
    createdAt: (dependencies.now ?? (() => new Date().toISOString()))(),
    provider: provider.provider,
    evidenceBundleId: eligible.bundle.bundleId,
    evidenceBundleVersion: eligible.bundle.version,
    evidenceBundleFingerprint: eligible.bundleFingerprint,
    prosecutorArgumentFingerprint: fingerprintCourtroomArgument(eligible.prosecutor),
    defenseArgumentFingerprint: fingerprintCourtroomArgument(eligible.defense),
  });
}
