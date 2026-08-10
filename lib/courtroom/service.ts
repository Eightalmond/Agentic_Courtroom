import "server-only";

import { createSimulationProvider } from "@/lib/simulation/providers/factory";
import type { StructuredGenerationProvider } from "@/lib/simulation/provider";

import { validateCourtroomArgument } from "./citations";
import { revalidateCourtroomEvidence } from "./evidence";
import { CourtroomError } from "./errors";
import { buildCourtroomPrompt } from "./prompt";
import {
  COURTROOM_ARGUMENT_JSON_SCHEMA,
  CourtroomArgumentWireSchema,
  CourtroomArgumentRecordSchema,
  CourtroomArgumentRequestSchema,
  parseCourtroomArgumentWire,
} from "./schemas";
import type { CourtroomArgumentRecord } from "./types";

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
    role: request.data.role,
  });
}
