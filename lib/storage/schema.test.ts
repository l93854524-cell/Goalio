import { describe, expect, it } from "vitest";
import { createInitialState, isGoalioState } from "./schema";

describe("isGoalioState", () => {
  it("creates a new user without demo financial data", () => {
    const state = createInitialState();

    expect(state.plan.income).toBeNull();
    expect(state.plan.dailyFood).toBe(0);
    expect(state.plan.goal).toEqual({ name: "", amount: 0, deadline: "" });
    expect(state.balance).toBe(0);
  });

  it("rejects a cloud state whose nested plan is malformed", () => {
    const state = createInitialState();

    expect(isGoalioState({ ...state, plan: { ...state.plan, expenses: "all" } })).toBe(false);
  });

  it("rejects a cloud state with an unknown screen", () => {
    expect(isGoalioState({ ...createInitialState(), screen: "admin" })).toBe(false);
  });

  it("accepts a valid state with a negative daily change", () => {
    expect(isGoalioState({ ...createInitialState(), lastChange: -100 })).toBe(true);
  });
});
