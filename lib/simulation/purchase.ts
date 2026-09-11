import { addDays, daysBetween } from "@/lib/domain/dates";
import { cents, type Cents } from "@/lib/domain/money";
import type { GoalioPlan } from "@/lib/domain/types";
import { runSimulation } from "./simulator";

export const SAFE_PURCHASE_SEARCH_DAYS = 365;

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
  | { kind: "delayed-in-time"; baselineDate: string; scenarioDate: string; delayDays: number; deadline: string }
  | { kind: "delayed"; baselineDate: string; scenarioDate: string; delayDays: number; deadlineLateDays: number }
  | { kind: "shortfall"; amount: Cents }
  | { kind: "unknown"; missing: string[] }
  | { kind: "unreachable" };

export type PurchaseEvaluation = PurchaseKind & {
  maxNoDelayAmount: Cents;
  earliestNoDelayDate: string | null;
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

function earliestNoDelay(input: PurchaseInput, baselineDate: string, baselineSaved: Cents): string | null {
  for (let offset = 0; offset <= SAFE_PURCHASE_SEARCH_DAYS; offset += 1) {
    const date = addDays(input.today, offset);
    const result = projectedResult(input, input.amount, date);
    if (result?.status === "known" && result.completionDate !== null && result.completionDate <= baselineDate && result.effectiveSaved >= baselineSaved) return date;
  }
  return null;
}

export function evaluatePurchase(input: PurchaseInput): PurchaseEvaluation {
  const fallback = { maxNoDelayAmount: cents(0), earliestNoDelayDate: null };
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
  if (!projected || !projected.completionDate) return { kind: "unreachable", ...alternatives };
  const scenarioDate = projected.completionDate;

  const delayDays = Math.max(0, daysBetween(baseline.completionDate, scenarioDate));

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
  return {
    kind: "delayed",
    baselineDate: baseline.completionDate,
    scenarioDate,
    delayDays,
    deadlineLateDays: Math.max(0, daysBetween(input.plan.goal.deadline, scenarioDate)),
    ...alternatives,
  };
}
