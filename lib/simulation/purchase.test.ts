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
    const result = evaluatePurchase({ today: "2026-01-01", balance: cents(40000), plan: reservePlan, name: "鞋子", amount: cents(4000) });

    expect(result.kind).toBe("shortfall");
    if (result.kind === "shortfall") expect(result.amount).toBe(cents(500));
  });

  it("returns no safe date when a purchase cannot preserve the goal within the forecast", () => {
    const result = evaluatePurchase({
      today: "2026-01-01",
      balance: cents(40000),
      plan: plan({
        dailyFood: cents(100),
        goal: { name: "目标", amount: cents(1000), deadline: "2026-01-31" },
      }),
      name: "鞋子",
      amount: cents(4000),
    });

    expect(result.earliestNoDelayDate).toBeNull();
  });

  it("安全日期在第 365 天后时保持空值", () => {
    const result = evaluatePurchase({
      today: "2026-01-01",
      balance: cents(10000),
      plan: plan({
        income: { cadence: "monthly", amount: cents(90000), nextDate: "2027-02-05" },
        goal: { name: "长期目标", amount: cents(100000), deadline: "2027-02-05" },
      }),
      name: "小物件",
      amount: cents(1000),
    });

    expect(result.earliestNoDelayDate).toBeNull();
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

  it("目标进度减少时仍返回延期天数", () => {
    const result = evaluatePurchase({
      today: "2026-09-10",
      balance: cents(150000),
      plan: {
        income: { cadence: "monthly", amount: cents(250000), nextDate: "2026-10-01" },
        dailyFood: cents(3000),
        expenses: [],
        goal: { name: "目标", amount: cents(500000), deadline: "2027-01-08" },
      },
      name: "消费",
      amount: cents(80000),
    });

    expect(result.kind).toBe("progress-reduced");
    if (result.kind === "progress-reduced") expect(result.delayDays).toBeGreaterThan(0);
  });
});
