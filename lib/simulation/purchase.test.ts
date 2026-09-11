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

describe("evaluatePurchase envelope protection", () => {
  it("reports a shortfall when a purchase exceeds the current balance", () => {
    const result = evaluatePurchase({ today: "2026-01-01", balance: cents(5000), plan: plan(), name: "耳机", amount: cents(6000) });

    expect(result.kind).toBe("shortfall");
    if (result.kind === "shortfall") expect(result.amount).toBe(cents(1000));
  });

  it("keeps required living reserves ahead of a purchase", () => {
    const reservePlan = plan({
      dailyFood: cents(100),
      goal: { name: "目标", amount: cents(1000), deadline: "2026-01-31" },
    });
    const result = evaluatePurchase({ today: "2026-01-01", balance: cents(5000), plan: reservePlan, name: "鞋子", amount: cents(2500) });

    expect(result.kind).toBe("shortfall");
    if (result.kind === "shortfall") expect(result.amount).toBe(cents(500));
  });

  it("excludes a fully funded goal from the maximum no-delay purchase", () => {
    const result = evaluatePurchase({
      today: "2026-01-01",
      balance: cents(2300000),
      plan: plan({ goal: { name: "旅行", amount: cents(180000), deadline: "2026-01-01" } }),
      name: "电脑",
      amount: cents(100000),
    });

    expect(result.kind).toBe("no-impact");
    expect(result.maxNoDelayAmount).toBe(cents(2120000));
  });

  it("delays a purchase until it preserves both current allocation and completion date", () => {
    const result = evaluatePurchase({
      today: "2026-01-01",
      balance: cents(5000),
      plan: plan({
        income: { cadence: "once", amount: cents(6000), nextDate: "2026-01-10" },
        goal: { name: "目标", amount: cents(10000), deadline: "2026-01-31" },
      }),
      name: "小物件",
      amount: cents(1000),
    });

    expect(result.kind).toBe("progress-reduced");
    expect(result.earliestNoDelayDate).toBe("2026-01-10");
  });
});
