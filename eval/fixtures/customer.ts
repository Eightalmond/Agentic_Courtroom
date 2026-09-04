import { collectEvidenceBundle } from "@/lib/evidence/collector";
import { executeCustomerAction } from "@/lib/simulation/tools";
import type { CustomerDecision } from "@/lib/simulation/types";
import {
  applySimulationStep,
  createReadyRun,
  toEvidenceCollectionRequest,
  toSimulationStepRequest,
  type TestRun,
} from "@/lib/test-runs";

const FIXED_TIME = "2026-01-01T00:00:00.000Z";

export function buildFixtureRun(input: {
  runId: string;
  taskId: string;
  personaId: string;
  maxActions: number;
  decisions: readonly CustomerDecision[];
}) {
  let run: TestRun = createReadyRun(
    { taskId: input.taskId, personaId: input.personaId, maxActions: input.maxActions },
    { id: input.runId, createdAt: FIXED_TIME },
  );
  input.decisions.forEach((decision, index) => {
    if (run.status === "completed") throw new Error(`Fixture ${input.runId} has decisions after completion.`);
    const response = executeCustomerAction(decision, toSimulationStepRequest(run), {
      now: FIXED_TIME,
      actionId: `action-${input.runId}-${index + 1}`,
    });
    run = applySimulationStep(run, response);
  });
  if (run.status !== "completed") throw new Error(`Fixture ${input.runId} does not complete.`);
  return run;
}

export function buildFixtureEvidence(run: TestRun) {
  return collectEvidenceBundle(toEvidenceCollectionRequest(run), { now: FIXED_TIME });
}

export { FIXED_TIME };
