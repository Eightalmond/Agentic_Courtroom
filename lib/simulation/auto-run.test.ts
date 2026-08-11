import { describe, expect, it, vi } from "vitest";

import { runSequentially } from "./auto-run";

type State = { status: "running" | "completed" | "failed"; calls: number; maximum: number };

const canContinue = (state: State) => state.status === "running" && state.calls < state.maximum;

describe("sequential auto-run", () => {
  it("never creates parallel customer requests and stops on completion", async () => {
    let active = 0;
    let maximumActive = 0;
    const takeStep = vi.fn(async (state: State) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      const calls = state.calls + 1;
      return { ...state, calls, status: calls === 3 ? "completed" as const : "running" as const };
    });
    const result = await runSequentially<State>({ status: "running", calls: 0, maximum: 6 }, { isActive: () => true, canContinue, takeStep });
    expect(result).toMatchObject({ status: "completed", calls: 3 });
    expect(maximumActive).toBe(1);
  });

  it("stops immediately after failure", async () => {
    const takeStep = vi.fn(async (state: State) => ({ ...state, calls: state.calls + 1, status: "failed" as const }));
    await runSequentially<State>({ status: "running", calls: 0, maximum: 6 }, { isActive: () => true, canContinue, takeStep });
    expect(takeStep).toHaveBeenCalledOnce();
  });

  it("stops at budget exhaustion", async () => {
    const takeStep = vi.fn(async (state: State) => ({ ...state, calls: state.calls + 1 }));
    const result = await runSequentially<State>({ status: "running", calls: 0, maximum: 2 }, { isActive: () => true, canContinue, takeStep });
    expect(result?.calls).toBe(2);
    expect(takeStep).toHaveBeenCalledTimes(2);
  });

  it("honors a stop or reset signal before issuing another request", async () => {
    let active = true;
    const takeStep = vi.fn(async (state: State) => {
      active = false;
      return { ...state, calls: state.calls + 1 };
    });
    await runSequentially<State>({ status: "running", calls: 0, maximum: 6 }, { isActive: () => active, canContinue, takeStep });
    expect(takeStep).toHaveBeenCalledOnce();
  });
});
