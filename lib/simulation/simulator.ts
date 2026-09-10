import { addDays, addMonths } from "@/lib/domain/dates";
import { cents, clampCents, type Cents } from "@/lib/domain/money";
import type { Cadence, GoalioPlan, ScheduledAmount } from "@/lib/domain/types";

const RESERVE_HORIZON_DAYS = 365;

export interface SimulationInput {
  today: string;
  balance: Cents;
  plan: GoalioPlan;
  previous?: { date: string; effectiveSaved: Cents };
  scenarioPurchase?: { date: string; amount: Cents };
}

export type SimulationResult =
  | {
      status: "known";
      effectiveSaved: Cents;
      safeCapacity: Cents;
      change: Cents;
      completionDate: string | null;
      tomorrowFood: Cents;
      tomorrowMaxSpend: Cents;
      canMeetDeadline: boolean;
      requiredReserve: Cents;
    }
  | {
      status: "unknown";
      missing: string[];
      effectiveSaved: Cents;
      change: Cents;
    };

function advance(date: string, cadence: Cadence): string | null {
  if (cadence === "weekly") return addDays(date, 7);
  if (cadence === "monthly") return addMonths(date, 1);
  if (cadence === "quarterly") return addMonths(date, 3);
  if (cadence === "half-yearly") return addMonths(date, 6);
  return null;
}

function occursOn(rule: ScheduledAmount, date: string): boolean {
  if (date < rule.nextDate || (rule.endDate && date > rule.endDate)) return false;
  let cursor: string | null = rule.nextDate;
  while (cursor && cursor < date) cursor = advance(cursor, rule.cadence);
  return cursor === date;
}

function cashflowForDate(plan: GoalioPlan, date: string, purchase?: SimulationInput["scenarioPurchase"]): number {
  let flow = -plan.dailyFood;
  if (plan.income && occursOn(plan.income, date)) flow += plan.income.amount;
  for (const expense of plan.expenses) if (occursOn(expense, date)) flow -= expense.amount;
  if (purchase?.date === date) flow -= purchase.amount;
  return flow;
}

function requiredReserve(input: SimulationInput): Cents {
  let cumulative = 0;
  let lowest = 0;
  for (let offset = 1; offset <= RESERVE_HORIZON_DAYS; offset += 1) {
    const date = addDays(input.today, offset);
    cumulative += cashflowForDate(input.plan, date, input.scenarioPurchase);
    lowest = Math.min(lowest, cumulative);
  }
  return cents(Math.max(0, -lowest));
}

type KnownSimulation = Omit<Extract<SimulationResult, { status: "known" }>, "tomorrowFood" | "tomorrowMaxSpend" | "canMeetDeadline">;

function balanceAfterTodayPurchase(input: SimulationInput): Cents {
  return cents(input.scenarioPurchase?.date === input.today
    ? Math.max(0, input.balance - input.scenarioPurchase.amount)
    : input.balance);
}

function allocatedToGoal(balance: Cents, reserve: Cents, goalAmount: Cents): Cents {
  return clampCents(balance - reserve, 0, goalAmount);
}

function currentEnvelope(input: SimulationInput) {
  const reserve = requiredReserve(input);
  const adjustedBalance = balanceAfterTodayPurchase(input);
  const safeCapacity = allocatedToGoal(adjustedBalance, reserve, input.plan.goal.amount);
  return { reserve, adjustedBalance, safeCapacity };
}

function projectedCompletionDate(input: SimulationInput, currentSaved: Cents): string | null {
  if (currentSaved >= input.plan.goal.amount) return input.today;

  let projectedBalance = balanceAfterTodayPurchase(input);
  for (let offset = 1; offset <= 365; offset += 1) {
    const date = addDays(input.today, offset);
    projectedBalance = cents(Math.max(0, projectedBalance + cashflowForDate(input.plan, date, input.scenarioPurchase)));
    const projectedInput = { ...input, today: date, balance: projectedBalance };
    const reserve = requiredReserve(projectedInput);
    if (allocatedToGoal(projectedBalance, reserve, input.plan.goal.amount) >= input.plan.goal.amount) return date;
  }

  return null;
}

function simulateKnown(input: SimulationInput): KnownSimulation {
  const { reserve, safeCapacity } = currentEnvelope(input);
  const previousSaved = input.previous?.effectiveSaved ?? cents(0);
  const effectiveSaved = safeCapacity;
  const change = cents(effectiveSaved - previousSaved);
  const completionDate = projectedCompletionDate(input, effectiveSaved);

  return {
    status: "known",
    effectiveSaved,
    safeCapacity,
    change,
    completionDate,
    requiredReserve: reserve,
  };
}

function meetsDeadline(input: SimulationInput, result: KnownSimulation): boolean {
  const availableBalance = input.scenarioPurchase?.date === input.today
    ? Math.max(0, input.balance - input.scenarioPurchase.amount)
    : input.balance;
  return availableBalance >= result.requiredReserve
    && result.completionDate !== null
    && result.completionDate <= input.plan.goal.deadline;
}

function maxSpendTomorrow(input: SimulationInput, protectedSaved: Cents): Cents {
  const tomorrow = addDays(input.today, 1);
  const tomorrowFlow = cashflowForDate(input.plan, tomorrow);
  let low = 0;
  let high = Math.max(0, input.balance + Math.max(0, tomorrowFlow));

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const scenario = { ...input, scenarioPurchase: { date: tomorrow, amount: cents(mid) } };
    if (currentEnvelope(scenario).safeCapacity < protectedSaved) {
      high = mid - 1;
      continue;
    }
    const result = simulateKnown(scenario);
    if (meetsDeadline(scenario, result)) low = mid;
    else high = mid - 1;
  }

  return cents(low);
}

export function runSimulation(input: SimulationInput): SimulationResult {
  if (!input.plan.income) {
    const previousSaved = input.previous?.effectiveSaved ?? cents(0);
    return { status: "unknown", missing: ["未来收入"], effectiveSaved: previousSaved, change: cents(0) };
  }

  const result = simulateKnown(input);
  const canMeetDeadline = meetsDeadline(input, result);
  const tomorrowMaxSpend = !input.scenarioPurchase && canMeetDeadline ? maxSpendTomorrow(input, result.effectiveSaved) : cents(0);

  return {
    ...result,
    tomorrowFood: input.plan.dailyFood,
    tomorrowMaxSpend,
    canMeetDeadline,
  };
}
