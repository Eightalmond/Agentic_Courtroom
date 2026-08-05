import { describe, expect, it } from "vitest";

import { foundationChecks, getFoundationProgress, workflowSteps } from "./foundation";

describe("project foundation configuration", () => {
  it("describes the four workflow stages in a stable order", () => {
    expect(workflowSteps.map((step) => step.number)).toEqual(["01", "02", "03", "04"]);
    expect(new Set(workflowSteps.map((step) => step.title)).size).toBe(4);
  });

  it("reports the completed foundation accurately", () => {
    expect(getFoundationProgress(foundationChecks)).toEqual({
      completed: 6,
      total: 6,
      percentage: 100,
    });
  });

  it("handles an empty checklist without dividing by zero", () => {
    expect(getFoundationProgress([])).toEqual({ completed: 0, total: 0, percentage: 0 });
  });
});
