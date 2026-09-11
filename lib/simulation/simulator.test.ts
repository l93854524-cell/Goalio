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

describe("runSimulation paced allocation", () => {
  it("limits a newly created goal to its first daily release even when the balance is high", () => {
    const result = known(runSimulation({
      today: "2026-01-01",
      balance: cents(100000),
      plan: plan({ goal: { name: "旅行", amount: cents(30000), deadline: "2026-01-30" } }),
    }));

    expect(result.requiredReserve).toBe(cents(0));
    expect(result.safeCapacity).toBe(cents(30000));
    expect(result.effectiveSaved).toBe(cents(1000));
    expect(result.change).toBe(cents(1000));
    expect(result.completionDate).toBe("2026-01-30");
    expect(result.canMeetDeadline).toBe(true);
    expect(result.tomorrowMaxSpend).toBe(cents(70000));
  });

  it("releases one additional paced amount on the next natural day", () => {
    const testPlan = plan({ goal: { name: "旅行", amount: cents(30000), deadline: "2026-01-30" } });
    const dayOne = known(runSimulation({ today: "2026-01-01", balance: cents(100000), plan: testPlan }));
    const dayTwo = known(runSimulation({
      today: "2026-01-02",
      balance: cents(100000),
      plan: testPlan,
      previous: { date: "2026-01-01", effectiveSaved: dayOne.effectiveSaved },
    }));

    expect(dayOne.effectiveSaved).toBe(cents(1000));
    expect(dayTwo.effectiveSaved).toBe(cents(2000));
    expect(dayTwo.change).toBe(cents(1000));
  });

  it("uses the latest same-day balance without granting a second daily release", () => {
    const testPlan = plan({ goal: { name: "旅行", amount: cents(30000), deadline: "2026-01-30" } });
    const previous = { date: "2026-01-01", effectiveSaved: cents(1000) };
    const high = known(runSimulation({ today: "2026-01-02", balance: cents(100000), plan: testPlan, previous }));
    const low = known(runSimulation({ today: "2026-01-02", balance: cents(1500), plan: testPlan, previous }));
    const recovered = known(runSimulation({ today: "2026-01-02", balance: cents(100000), plan: testPlan, previous }));

    expect(high.effectiveSaved).toBe(cents(2000));
    expect(low.effectiveSaved).toBe(cents(1500));
    expect(recovered.effectiveSaved).toBe(cents(2000));
  });

  it("returns a positive tomorrow extra-spend amount when the balance has room", () => {
    const result = known(runSimulation({
      today: "2026-01-01",
      balance: cents(10000),
      plan: plan({
        income: { cadence: "monthly", amount: cents(25000), nextDate: "2026-01-20" },
        goal: { name: "旅行", amount: cents(30000), deadline: "2026-01-30" },
      }),
    }));

    expect(result.tomorrowMaxSpend).toBe(cents(5000));
  });

  it("returns zero tomorrow extra-spend when all available cash is needed for the goal", () => {
    const result = known(runSimulation({
      today: "2026-01-01",
      balance: cents(30000),
      plan: plan({ goal: { name: "旅行", amount: cents(30000), deadline: "2026-01-30" } }),
    }));

    expect(result.tomorrowMaxSpend).toBe(cents(0));
  });

  it("changes the projected completion date when fixed expenses change", () => {
    const basePlan = plan({
      income: { cadence: "monthly", amount: cents(10000), nextDate: "2026-01-05" },
      goal: { name: "旅行", amount: cents(10000), deadline: "2026-01-10" },
    });
    const withoutExpense = known(runSimulation({ today: "2026-01-01", balance: cents(0), plan: basePlan }));
    const withExpense = known(runSimulation({
      today: "2026-01-01",
      balance: cents(0),
      plan: {
        ...basePlan,
        expenses: [{ id: "bill", name: "账单", amount: cents(5000), cadence: "once", nextDate: "2026-01-06" }],
      },
    }));

    expect(withoutExpense.completionDate).toBe("2026-01-10");
    expect(withExpense.completionDate).toBe("2026-02-05");
  });

  it("changes the projected completion date when future income amounts change", () => {
    const goal = { name: "旅行", amount: cents(10000), deadline: "2026-01-10" };
    const fullIncome = known(runSimulation({
      today: "2026-01-01",
      balance: cents(0),
      plan: plan({ income: { cadence: "monthly", amount: cents(10000), nextDate: "2026-01-05" }, goal }),
    }));
    const halfIncome = known(runSimulation({
      today: "2026-01-01",
      balance: cents(0),
      plan: plan({ income: { cadence: "monthly", amount: cents(5000), nextDate: "2026-01-05" }, goal }),
    }));

    expect(fullIncome.completionDate).toBe("2026-01-10");
    expect(halfIncome.completionDate).toBe("2026-02-05");
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
