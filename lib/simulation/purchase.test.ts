import { describe, expect, it } from "vitest";
import { cents } from "@/lib/domain/money";
import type { GoalioPlan } from "@/lib/domain/types";
import { evaluatePurchase } from "./purchase";

function plan(overrides: Partial<GoalioPlan> = {}): GoalioPlan {
  return {
    income: { cadence: "once", amount: cents(0), nextDate: "2026-01-02" },
    dailyFood: cents(0),
    expenses: [],
    goal: { name: "目标", amount: cents(10000), deadline: "2026-01-31" },
    ...overrides,
  };
}

describe("evaluatePurchase cash-flow scenarios", () => {
  it("reports a shortfall when a purchase exceeds the current balance", () => {
    const result = evaluatePurchase({ today: "2026-01-01", balance: cents(5000), plan: plan(), name: "耳机", amount: cents(6000) });

    expect(result.kind).toBe("shortfall");
    if (result.kind === "shortfall") expect(result.amount).toBe(cents(1000));
  });

  it("keeps required living reserves ahead of a purchase", () => {
    const reservePlan = plan({
      expenses: [{ id: "rent", name: "房租", amount: cents(36500), cadence: "once", nextDate: "2026-01-02" }],
      goal: { name: "目标", amount: cents(1000), deadline: "2026-01-31" },
    });
    const result = evaluatePurchase({ today: "2026-01-01", balance: cents(40000), plan: reservePlan, name: "鞋子", amount: cents(4000) });

    expect(result.kind).toBe("shortfall");
    if (result.kind === "shortfall") expect(result.amount).toBe(cents(500));
  });

  it("does not turn a 100 yuan purchase into an automatic 100 yuan goal loss", () => {
    const result = evaluatePurchase({
      today: "2026-01-01",
      balance: cents(30000),
      plan: plan({
        income: { cadence: "monthly", amount: cents(10000), nextDate: "2026-01-20" },
        goal: { name: "旅行", amount: cents(30000), deadline: "2026-01-30" },
      }),
      name: "小物件",
      amount: cents(10000),
    });

    expect(result.kind).toBe("no-impact");
  });

  it("re-simulates different purchase amounts into different impact levels", () => {
    const testPlan = plan({
      income: { cadence: "monthly", amount: cents(10000), nextDate: "2026-01-20" },
      goal: { name: "目标", amount: cents(30000), deadline: "2026-01-30" },
    });
    const small = evaluatePurchase({
      today: "2026-01-01",
      balance: cents(30000),
      plan: testPlan,
      name: "小物件",
      amount: cents(5000),
    });
    const large = evaluatePurchase({
      today: "2026-01-01",
      balance: cents(30000),
      plan: testPlan,
      name: "大件",
      amount: cents(15000),
    });

    expect(small.kind).toBe("no-impact");
    expect(large.kind).toBe("delayed");
    if (large.kind === "delayed") {
      expect(large.baselineDate).toBe("2026-01-30");
      expect(large.scenarioDate).toBe("2026-02-20");
      expect(large.delayDays).toBe(21);
      expect(large.deadlineLateDays).toBe(21);
    }
  });

  it("reports a delay that still finishes within the chosen deadline", () => {
    const result = evaluatePurchase({
      today: "2026-01-01",
      balance: cents(40000),
      plan: plan({
        income: { cadence: "monthly", amount: cents(15000), nextDate: "2026-01-20" },
        goal: { name: "目标", amount: cents(30000), deadline: "2026-01-30" },
      }),
      previous: { date: "2026-01-01", effectiveSaved: cents(30000) },
      name: "大件",
      amount: cents(15000),
    });

    expect(result.kind).toBe("delayed-in-time");
    if (result.kind === "delayed-in-time") {
      expect(result.baselineDate).toBe("2026-01-01");
      expect(result.scenarioDate).toBe("2026-01-30");
      expect(result.delayDays).toBe(29);
    }
  });
});
