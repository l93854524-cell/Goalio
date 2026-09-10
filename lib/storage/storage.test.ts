import { describe, expect, it } from "vitest";
import { cents } from "@/lib/domain/money";
import { createInitialState } from "./schema";
import { loadGoalioState, saveGoalioState } from "./storage";

describe("Goalio storage", () => {
  it("returns a welcome state when storage is empty", () => {
    localStorage.clear();
    expect(loadGoalioState(localStorage).state.screen).toBe("welcome");
  });

  it("round-trips a versioned state", () => {
    const state = createInitialState();
    state.balance = cents(126000);
    expect(saveGoalioState(localStorage, state).ok).toBe(true);
    expect(loadGoalioState(localStorage).state.balance).toBe(cents(126000));
  });

  it("recovers safely from corrupt JSON", () => {
    localStorage.setItem("goalio:v1", "{");
    const result = loadGoalioState(localStorage);
    expect(result.recovered).toBe(true);
    expect(result.state.screen).toBe("welcome");
  });

  it("removes legacy tutorial expenses so they no longer affect calculations", () => {
    const state = createInitialState();
    state.plan.expenses = [
      { id: "rent", name: "房租", amount: cents(180000), cadence: "monthly", nextDate: "2026-10-05" },
      { id: "video", name: "视频会员", amount: cents(2500), cadence: "monthly", nextDate: "2026-09-18" },
      { id: "user-expense", name: "保险", amount: cents(30000), cadence: "monthly", nextDate: "2026-09-22" },
    ];
    localStorage.setItem("goalio:v1", JSON.stringify(state));

    const result = loadGoalioState(localStorage);

    expect(result.state.plan.expenses).toEqual([expect.objectContaining({ id: "user-expense" })]);
    expect(result.recovered).toBe(true);
  });
});
