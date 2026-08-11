import { describe, expect, it, vi } from "vitest";

import { runSequentially } from "./auto-run";

type State = { status: "running" | "completed" | "failed"; actions: number; attempts: number; maximum: number };

const canContinue = (state: State) => state.status === "running" && state.actions < state.maximum;

describe("sequential auto-run", () => {
  it("never creates parallel customer requests and stops on completion", async () => {
    let active = 0;
    let maximumActive = 0;
    const takeStep = vi.fn(async (state: State) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      const actions = state.actions + 1;
      return { ...state, actions, attempts: state.attempts + 1, status: actions === 3 ? "completed" as const : "running" as const };
    });
    const result = await runSequentially<State>({ status: "running", actions: 0, attempts: 0, maximum: 6 }, { isActive: () => true, canContinue, takeStep });
    expect(result).toMatchObject({ status: "completed", actions: 3, attempts: 3 });
    expect(maximumActive).toBe(1);
  });

  it("stops immediately after failure", async () => {
    const takeStep = vi.fn(async (state: State) => ({ ...state, attempts: state.attempts + 1, status: "failed" as const }));
    const result = await runSequentially<State>({ status: "running", actions: 2, attempts: 4, maximum: 6 }, { isActive: () => true, canContinue, takeStep });
    expect(takeStep).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ status: "failed", actions: 2, attempts: 5 });
  });

  it("stops at budget exhaustion", async () => {
    const takeStep = vi.fn(async (state: State) => ({ ...state, actions: state.actions + 1, attempts: state.attempts + 1 }));
    const result = await runSequentially<State>({ status: "running", actions: 0, attempts: 0, maximum: 2 }, { isActive: () => true, canContinue, takeStep });
    expect(result?.actions).toBe(2);
    expect(takeStep).toHaveBeenCalledTimes(2);
  });

  it("honors a stop or reset signal before issuing another request", async () => {
    let active = true;
    const takeStep = vi.fn(async (state: State) => {
      active = false;
      return { ...state, actions: state.actions + 1, attempts: state.attempts + 1 };
    });
    await runSequentially<State>({ status: "running", actions: 0, attempts: 0, maximum: 6 }, { isActive: () => active, canContinue, takeStep });
    expect(takeStep).toHaveBeenCalledOnce();
  });
});
