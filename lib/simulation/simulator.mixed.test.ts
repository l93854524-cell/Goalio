import { describe, expect, it } from "vitest";
import { cents } from "@/lib/domain/money";
import type { Cadence, GoalioPlan } from "@/lib/domain/types";
import { runSimulation, type SimulationResult } from "./simulator";

function isoAt(start: string, offset: number): string {
  const [year, month, day] = start.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

function plan(overrides: Partial<GoalioPlan> = {}): GoalioPlan {
  return {
    income: { cadence: "once", amount: cents(0), nextDate: "2026-01-02" },
    dailyFood: cents(0),
    expenses: [],
    goal: { name: "标准目标", amount: cents(100000), deadline: "2026-04-11" },
    ...overrides,
  };
}

function known(result: SimulationResult) {
  expect(result.status).toBe("known");
  if (result.status !== "known") throw new Error(`Expected known result: ${result.missing.join(", ")}`);
  return result;
}

describe("资金优先级", () => {
  it("截止日期提前不会通过缩短预留窗口提高消费上限", () => {
    const makePlan = (deadline: string): GoalioPlan => ({
      income: { cadence: "once", amount: cents(0), nextDate: "2026-01-02" },
      dailyFood: cents(1000),
      expenses: [],
      goal: { name: "目标", amount: cents(10000), deadline },
    });
    const relaxed = known(runSimulation({ today: "2026-01-01", balance: cents(100000), plan: makePlan("2026-02-15") }));
    const tight = known(runSimulation({ today: "2026-01-01", balance: cents(100000), plan: makePlan("2026-01-31") }));

    expect(tight.requiredReserve).toBe(relaxed.requiredReserve);
    expect(tight.tomorrowMaxSpend).toBeLessThanOrEqual(relaxed.tomorrowMaxSpend);
  });

  it("今天截止时仍保护未来四十五天内的确定支出", () => {
    const result = known(runSimulation({
      today: "2026-01-01",
      balance: cents(200000),
      plan: {
        income: { cadence: "once", amount: cents(0), nextDate: "2026-01-02" },
        dailyFood: cents(0),
        expenses: [{ id: "fixed", name: "确定支出", amount: cents(50000), cadence: "once", nextDate: "2026-02-10" }],
        goal: { name: "目标", amount: cents(180000), deadline: "2026-01-01" },
      },
    }));

    expect(result.requiredReserve).toBe(cents(50000));
    expect(result.effectiveSaved).toBe(cents(150000));
    expect(result.canMeetDeadline).toBe(false);
  });

  it("先保护未来必要支出，再把全部安全容量归入目标", () => {
    const result = known(runSimulation({
      today: "2026-01-01",
      balance: cents(5000),
      plan: plan({ dailyFood: cents(100), goal: { name: "短期目标", amount: cents(10000), deadline: "2026-01-31" } }),
    }));

    expect(result.requiredReserve).toBe(cents(36500));
    expect(result.safeCapacity).toBe(cents(0));
    expect(result.effectiveSaved).toBe(cents(0));
  });

  it("余额增加不会减少目标分配或推迟完成日期", () => {
    const testPlan = plan({
      income: { cadence: "once", amount: cents(5000), nextDate: "2026-01-10" },
      goal: { name: "目标", amount: cents(10000), deadline: "2026-01-31" },
    });
    const low = known(runSimulation({ today: "2026-01-01", balance: cents(5000), plan: testPlan }));
    const high = known(runSimulation({ today: "2026-01-01", balance: cents(10000), plan: testPlan }));

    expect(high.effectiveSaved).toBeGreaterThanOrEqual(low.effectiveSaved);
    expect(high.completionDate).toBe("2026-01-01");
    expect(low.completionDate).toBe("2026-01-10");
  });

  it("明日消费上限完整保护当前目标分配", () => {
    const testPlan = plan({ goal: { name: "目标", amount: cents(180000), deadline: "2026-01-01" } });
    const current = known(runSimulation({ today: "2026-01-01", balance: cents(2300000), plan: testPlan }));
    const atLimit = known(runSimulation({ today: "2026-01-01", balance: cents(2300000), plan: testPlan, scenarioPurchase: { date: "2026-01-02", amount: current.tomorrowMaxSpend } }));
    const overLimit = known(runSimulation({ today: "2026-01-01", balance: cents(2300000), plan: testPlan, scenarioPurchase: { date: "2026-01-02", amount: cents(current.tomorrowMaxSpend + 1) } }));

    expect(current.tomorrowMaxSpend).toBe(cents(2120000));
    expect(atLimit.effectiveSaved).toBe(current.effectiveSaved);
    expect(overLimit.effectiveSaved).toBe(cents(current.effectiveSaved - 1));
  });

  it("更紧的截止日期不会提高自由消费上限", () => {
    const base = {
      today: "2026-01-01",
      balance: cents(20000),
      plan: plan({ income: { cadence: "once", amount: cents(5000), nextDate: "2026-01-10" }, goal: { name: "目标", amount: cents(10000), deadline: "2026-01-31" } }),
    };
    const relaxed = known(runSimulation(base));
    const tight = known(runSimulation({ ...base, plan: { ...base.plan, goal: { ...base.plan.goal, deadline: "2026-01-05" } } }));

    expect(tight.tomorrowMaxSpend).toBeLessThanOrEqual(relaxed.tomorrowMaxSpend);
  });
});

describe("日期与现金流边界", () => {
  it("月底月度账单在观察期内逐月计入", () => {
    const result = known(runSimulation({
      today: "2026-01-30",
      balance: cents(50000),
      plan: plan({
        income: { cadence: "once", amount: cents(0), nextDate: "2026-01-31" },
        expenses: [{ id: "month-end", name: "月底账单", amount: cents(7000), cadence: "monthly", nextDate: "2026-01-31", endDate: "2026-02-28" }],
        goal: { name: "边界目标", amount: cents(100000), deadline: "2026-03-31" },
      }),
    }));
    expect(result.requiredReserve).toBe(cents(14000));
  });

  it("闰年二月的月末账单落在二月二十九日", () => {
    const before = known(runSimulation({
      today: "2024-02-28",
      balance: cents(50000),
      plan: plan({ income: { cadence: "once", amount: cents(0), nextDate: "2024-02-29" }, expenses: [{ id: "leap", name: "月末账单", amount: cents(7000), cadence: "monthly", nextDate: "2024-01-31", endDate: "2024-02-29" }], goal: { name: "闰年目标", amount: cents(100000), deadline: "2024-03-29" } }),
    }));
    const after = known(runSimulation({
      today: "2024-02-29",
      balance: cents(50000),
      plan: plan({ income: { cadence: "once", amount: cents(0), nextDate: "2024-03-01" }, expenses: [{ id: "leap", name: "月末账单", amount: cents(7000), cadence: "monthly", nextDate: "2024-01-31", endDate: "2024-02-29" }], goal: { name: "闰年目标", amount: cents(100000), deadline: "2024-03-30" } }),
    }));

    expect(before.requiredReserve).toBe(cents(7000));
    expect(after.requiredReserve).toBe(cents(0));
  });

  it("未来现金不足时保留未知完成日期", () => {
    const result = known(runSimulation({ today: "2026-01-01", balance: cents(1000), plan: plan({ goal: { name: "目标", amount: cents(10000), deadline: "2026-01-31" } }) }));

    expect(result.completionDate).toBeNull();
    expect(result.canMeetDeadline).toBe(false);
    expect(result.tomorrowMaxSpend).toBe(cents(0));
  });
});

describe("随机不变量", () => {
  it("固定种子的输入始终满足金额和截止日期不变量", () => {
    let state = 0x5eed2026;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const integer = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
    const cadences: Cadence[] = ["weekly", "monthly", "quarterly", "half-yearly", "once"];

    for (let index = 0; index < 120; index += 1) {
      const today = isoAt("2024-01-01", integer(0, 1095));
      const goalAmount = cents(integer(1, 5000000));
      const testPlan = plan({
        income: { cadence: cadences[integer(0, cadences.length - 1)], amount: cents(integer(0, 1000000)), nextDate: isoAt(today, integer(1, 45)) },
        dailyFood: cents(integer(0, 20000)),
        expenses: Array.from({ length: integer(0, 3) }, (_, expenseIndex) => ({ id: `${index}-${expenseIndex}`, name: `账单 ${expenseIndex}`, amount: cents(integer(0, 300000)), cadence: cadences[integer(0, cadences.length - 1)], nextDate: isoAt(today, integer(1, 45)) })),
        goal: { name: "压力目标", amount: goalAmount, deadline: isoAt(today, integer(-3, 365)) },
      });
      const previousSaved = cents(integer(0, goalAmount));
      const result = known(runSimulation({ today, balance: cents(integer(0, 10000000)), plan: testPlan, previous: { date: isoAt(today, -integer(0, 7)), effectiveSaved: previousSaved } }));

      expect(Number.isInteger(result.requiredReserve)).toBe(true);
      expect(Number.isInteger(result.effectiveSaved)).toBe(true);
      expect(result.effectiveSaved).toBeGreaterThanOrEqual(0);
      expect(result.effectiveSaved).toBeLessThanOrEqual(result.safeCapacity);
      expect(result.safeCapacity).toBeLessThanOrEqual(goalAmount);
      expect(result.change).toBe(result.effectiveSaved - previousSaved);
      expect(result.canMeetDeadline).toBe(result.completionDate !== null && result.completionDate <= testPlan.goal.deadline);
      if (!result.canMeetDeadline) expect(result.tomorrowMaxSpend).toBe(cents(0));
    }
  }, 180000);
});
