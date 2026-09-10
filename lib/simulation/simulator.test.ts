import { describe, expect, it } from "vitest";
import { cents } from "@/lib/domain/money";
import type { GoalioPlan } from "@/lib/domain/types";
import { runSimulation } from "./simulator";

function plan(overrides: Partial<GoalioPlan> = {}): GoalioPlan {
  return {
    income: { cadence: "once", amount: cents(0), nextDate: "2026-09-11" },
    dailyFood: cents(0),
    expenses: [],
    goal: { name: "旅行", amount: cents(180000), deadline: "2026-10-09" },
    ...overrides,
  };
}

function known(result: ReturnType<typeof runSimulation>) {
  expect(result.status).toBe("known");
  if (result.status !== "known") throw new Error("Expected a known simulation");
  return result;
}

describe("runSimulation envelope allocation", () => {
  it("immediately funds a goal when current cash covers reserves and the full target", () => {
    const result = known(runSimulation({
      today: "2026-09-10",
      balance: cents(2300000),
      plan: plan({ goal: { name: "旅行", amount: cents(180000), deadline: "2026-09-10" } }),
      previous: { date: "2026-09-10", effectiveSaved: cents(18500) },
    }));

    expect(result.requiredReserve).toBe(cents(0));
    expect(result.safeCapacity).toBe(cents(180000));
    expect(result.effectiveSaved).toBe(cents(180000));
    expect(result.change).toBe(cents(161500));
    expect(result.completionDate).toBe("2026-09-10");
    expect(result.canMeetDeadline).toBe(true);
    expect(result.tomorrowMaxSpend).toBe(cents(2120000));
  });

  it("recalculates a same-day balance increase instead of freezing old progress", () => {
    const result = known(runSimulation({
      today: "2026-09-10",
      balance: cents(90000),
      plan: plan({ goal: { name: "旅行", amount: cents(100000), deadline: "2026-10-09" } }),
      previous: { date: "2026-09-10", effectiveSaved: cents(10000) },
    }));

    expect(result.effectiveSaved).toBe(cents(90000));
    expect(result.change).toBe(cents(80000));
  });

  it("derives allocation and completion from current inputs regardless of history", () => {
    const current = {
      today: "2026-09-10",
      balance: cents(75000),
      plan: plan({ goal: { name: "旅行", amount: cents(100000), deadline: "2026-10-09" } }),
    };
    const lowHistory = known(runSimulation({ ...current, previous: { date: "2026-09-10", effectiveSaved: cents(1000) } }));
    const highHistory = known(runSimulation({ ...current, previous: { date: "2026-09-09", effectiveSaved: cents(95000) } }));

    expect(lowHistory.effectiveSaved).toBe(cents(75000));
    expect(highHistory.effectiveSaved).toBe(cents(75000));
    expect(lowHistory.completionDate).toBe(highHistory.completionDate);
    expect(lowHistory.requiredReserve).toBe(highHistory.requiredReserve);
  });

  it("projects completion to the first future date that fully funds the goal", () => {
    const result = known(runSimulation({
      today: "2026-09-10",
      balance: cents(50000),
      plan: plan({
        income: { cadence: "once", amount: cents(50000), nextDate: "2026-09-20" },
        goal: { name: "旅行", amount: cents(100000), deadline: "2026-09-30" },
      }),
    }));

    expect(result.effectiveSaved).toBe(cents(50000));
    expect(result.completionDate).toBe("2026-09-20");
    expect(result.canMeetDeadline).toBe(true);
  });

  it("returns a future completion date while suppressing spending when the deadline is earlier", () => {
    const result = known(runSimulation({
      today: "2026-09-10",
      balance: cents(50000),
      plan: plan({
        income: { cadence: "once", amount: cents(50000), nextDate: "2026-09-20" },
        goal: { name: "旅行", amount: cents(100000), deadline: "2026-09-15" },
      }),
    }));

    expect(result.completionDate).toBe("2026-09-20");
    expect(result.canMeetDeadline).toBe(false);
    expect(result.tomorrowMaxSpend).toBe(cents(0));
  });

  it("预测一年以后到达的确定收入", () => {
    const result = known(runSimulation({
      today: "2026-01-01",
      balance: cents(0),
      plan: plan({
        income: { cadence: "once", amount: cents(100000), nextDate: "2027-02-05" },
        goal: { name: "长期目标", amount: cents(100000), deadline: "2027-02-05" },
      }),
    }));

    expect(result.completionDate).toBe("2027-02-05");
    expect(result.canMeetDeadline).toBe(true);
  });

  it("为每个长期预测日期保留完整的一年储备观察窗", () => {
    const result = known(runSimulation({
      today: "2026-01-01",
      balance: cents(0),
      plan: plan({
        income: { cadence: "once", amount: cents(100000), nextDate: "2028-01-31" },
        expenses: [{ cadence: "once", amount: cents(50000), nextDate: "2028-06-19" }],
        goal: { name: "长期目标", amount: cents(100000), deadline: "2027-02-05" },
      }),
    }));

    expect(result.completionDate).toBeNull();
    expect(result.canMeetDeadline).toBe(false);
  });

  it("keeps future data gaps explicit", () => {
    const result = runSimulation({
      today: "2026-09-10",
      balance: cents(126000),
      plan: plan({ income: null }),
      previous: { date: "2026-09-09", effectiveSaved: cents(12000) },
    });

    expect(result).toEqual({ status: "unknown", missing: ["未来收入"], effectiveSaved: cents(12000), change: cents(0) });
  });
});
