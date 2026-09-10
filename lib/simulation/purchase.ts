import { addDays, daysBetween } from "@/lib/domain/dates";
import { cents, type Cents } from "@/lib/domain/money";
import type { GoalioPlan } from "@/lib/domain/types";
import { runSimulation } from "./simulator";

export interface PurchaseInput {
  today: string;
  balance: Cents;
  plan: GoalioPlan;
  name: string;
  amount: Cents;
  previous?: { date: string; effectiveSaved: Cents };
}

type PurchaseKind =
  | { kind: "no-impact"; completionDate: string }
  | { kind: "progress-reduced"; amount: Cents; baselineSaved: Cents; scenarioSaved: Cents; baselineDate: string; scenarioDate: string }
  | { kind: "delayed-in-time"; baselineDate: string; scenarioDate: string; delayDays: number; deadline: string }
  | { kind: "delayed"; baselineDate: string; scenarioDate: string; delayDays: number }
  | { kind: "shortfall"; amount: Cents }
  | { kind: "unknown"; missing: string[] }
  | { kind: "unreachable" };

export type PurchaseEvaluation = PurchaseKind & {
  maxNoDelayAmount: Cents;
  earliestNoDelayDate: string;
};

function projectedResult(input: PurchaseInput, amount: Cents, date: string) {
  const result = runSimulation({
    today: input.today,
    balance: input.balance,
    plan: input.plan,
    previous: input.previous,
    scenarioPurchase: { amount, date },
  });
  if (result.status === "unknown") return result;
  const availableBalance = date === input.today ? input.balance - amount : input.balance;
  if (availableBalance < result.requiredReserve) return null;
  return result;
}

function maxNoDelay(input: PurchaseInput, baselineDate: string, baselineSaved: Cents, safeLimit: Cents): Cents {
  let low = 0;
  let high = Math.max(0, safeLimit);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const result = projectedResult(input, cents(mid), input.today);
    if (result?.status === "known" && result.completionDate !== null && result.completionDate <= baselineDate && result.effectiveSaved >= baselineSaved) low = mid;
    else high = mid - 1;
  }
  return cents(low);
}

function earliestNoDelay(input: PurchaseInput, baselineDate: string, baselineSaved: Cents): string {
  for (let offset = 0; offset <= 365; offset += 1) {
    const date = addDays(input.today, offset);
    const result = projectedResult(input, input.amount, date);
    if (result?.status === "known" && result.completionDate !== null && result.completionDate <= baselineDate && result.effectiveSaved >= baselineSaved) return date;
  }
  return addDays(input.today, 365);
}

export function evaluatePurchase(input: PurchaseInput): PurchaseEvaluation {
  const fallback = { maxNoDelayAmount: cents(0), earliestNoDelayDate: input.today };
  if (input.amount > input.balance) {
    return { kind: "shortfall", amount: cents(input.amount - input.balance), ...fallback };
  }

  const baseline = runSimulation({
    today: input.today,
    balance: input.balance,
    plan: input.plan,
    previous: input.previous,
  });
  if (baseline.status === "unknown") {
    return { kind: "unknown", missing: baseline.missing, ...fallback };
  }
  if (!baseline.completionDate) return { kind: "unreachable", ...fallback };

  const safeLimit = cents(Math.max(0, input.balance - baseline.requiredReserve - baseline.effectiveSaved));
  const alternatives = {
    maxNoDelayAmount: maxNoDelay(input, baseline.completionDate, baseline.effectiveSaved, safeLimit),
    earliestNoDelayDate: earliestNoDelay(input, baseline.completionDate, baseline.effectiveSaved),
  };
  const scenario = runSimulation({
    today: input.today,
    balance: input.balance,
    plan: input.plan,
    previous: input.previous,
    scenarioPurchase: { amount: input.amount, date: input.today },
  });
  if (scenario.status === "unknown") return { kind: "unknown", missing: scenario.missing, ...alternatives };
  const remainingBalance = input.balance - input.amount;
  if (remainingBalance < scenario.requiredReserve) {
    return { kind: "shortfall", amount: cents(scenario.requiredReserve - remainingBalance), ...alternatives };
  }

  const projected = projectedResult(input, input.amount, input.today);
  if (projected?.status === "unknown") return { kind: "unknown", missing: projected.missing, ...fallback };
  if (!projected || !projected.completionDate) return { kind: "unreachable", ...fallback };
  const scenarioDate = projected.completionDate;

  const delayDays = Math.max(0, daysBetween(baseline.completionDate, scenarioDate));

  if (scenario.effectiveSaved < baseline.effectiveSaved) {
    return {
      kind: "progress-reduced",
      amount: cents(baseline.effectiveSaved - scenario.effectiveSaved),
      baselineSaved: baseline.effectiveSaved,
      scenarioSaved: scenario.effectiveSaved,
      baselineDate: baseline.completionDate,
      scenarioDate,
      ...alternatives,
    };
  }
  if (delayDays === 0) return { kind: "no-impact", completionDate: baseline.completionDate, ...alternatives };
  if (scenarioDate <= input.plan.goal.deadline) {
    return {
      kind: "delayed-in-time",
      baselineDate: baseline.completionDate,
      scenarioDate,
      delayDays,
      deadline: input.plan.goal.deadline,
      ...alternatives,
    };
  }
  return { kind: "delayed", baselineDate: baseline.completionDate, scenarioDate, delayDays, ...alternatives };
}
