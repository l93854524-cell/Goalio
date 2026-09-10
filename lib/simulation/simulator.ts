import { addDays, addMonths, daysBetween } from "@/lib/domain/dates";
import { cents, clampCents, type Cents } from "@/lib/domain/money";
import type { Cadence, GoalioPlan, ScheduledAmount } from "@/lib/domain/types";

const RESERVE_HORIZON_DAYS = 365;
const MIN_FORECAST_DAYS = 365;
export const MAX_FORECAST_DAYS = 3650;

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

export function forecastHorizonDays(input: SimulationInput): number {
  const deadlineDays = Math.max(0, daysBetween(input.today, input.plan.goal.deadline));
  return Math.min(MAX_FORECAST_DAYS, Math.max(MIN_FORECAST_DAYS, deadlineDays + 365));
}

function advance(date: string, cadence: Cadence): string | null {
  if (cadence === "weekly") return addDays(date, 7);
  if (cadence === "monthly") return addMonths(date, 1);
  if (cadence === "quarterly") return addMonths(date, 3);
  if (cadence === "half-yearly") return addMonths(date, 6);
  return null;
}

interface SimulationTimeline {
  dates: string[];
  flows: number[];
  reserves: Cents[];
}

function addScheduledFlows(flows: number[], dateOffsets: Map<string, number>, dates: string[], rule: ScheduledAmount, direction: 1 | -1) {
  const firstDate = dates[1];
  const lastDate = dates[dates.length - 1];
  if (rule.endDate && rule.endDate < firstDate) return;

  let cursor: string | null = rule.nextDate;
  while (cursor && cursor < firstDate) cursor = advance(cursor, rule.cadence);
  while (cursor && cursor <= lastDate && (!rule.endDate || cursor <= rule.endDate)) {
    const offset = dateOffsets.get(cursor);
    if (offset !== undefined) flows[offset] += direction * rule.amount;
    cursor = advance(cursor, rule.cadence);
  }
}

function reservesForFlows(flows: number[]): Cents[] {
  const prefix = [0];
  for (let index = 1; index < flows.length; index += 1) prefix.push(prefix[index - 1] + flows[index]);

  const reserves: Cents[] = [];
  const minimums: number[] = [];
  for (let end = 1; end <= RESERVE_HORIZON_DAYS; end += 1) {
    while (minimums.length && prefix[minimums[minimums.length - 1]] >= prefix[end]) minimums.pop();
    minimums.push(end);
  }
  const forecastDays = flows.length - RESERVE_HORIZON_DAYS - 1;
  for (let offset = 0; offset <= forecastDays; offset += 1) {
    const end = offset + RESERVE_HORIZON_DAYS;
    while (minimums.length && minimums[0] <= offset) minimums.shift();
    while (minimums.length && prefix[minimums[minimums.length - 1]] >= prefix[end]) minimums.pop();
    minimums.push(end);
    reserves.push(cents(Math.max(0, prefix[offset] - prefix[minimums[0]])));
  }
  return reserves;
}

function simulationTimeline(input: SimulationInput): SimulationTimeline {
  const forecastDays = forecastHorizonDays(input);
  const dates = Array.from({ length: forecastDays + RESERVE_HORIZON_DAYS + 1 }, (_, offset) => addDays(input.today, offset));
  const dateOffsets = new Map(dates.map((date, offset) => [date, offset]));
  const flows = Array.from({ length: dates.length }, (_, offset) => offset === 0 ? 0 : -input.plan.dailyFood);

  if (input.plan.income) addScheduledFlows(flows, dateOffsets, dates, input.plan.income, 1);
  for (const expense of input.plan.expenses) addScheduledFlows(flows, dateOffsets, dates, expense, -1);

  const purchaseOffset = input.scenarioPurchase ? dateOffsets.get(input.scenarioPurchase.date) : undefined;
  if (purchaseOffset !== undefined && purchaseOffset > 0 && input.scenarioPurchase) {
    flows[purchaseOffset] -= input.scenarioPurchase.amount;
  }

  return { dates, flows, reserves: reservesForFlows(flows) };
}

function timelineWithTomorrowPurchase(timeline: SimulationTimeline, amount: Cents): SimulationTimeline {
  const flows = timeline.flows.slice();
  flows[1] -= amount;
  return { dates: timeline.dates, flows, reserves: reservesForFlows(flows) };
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

function currentEnvelope(input: SimulationInput, timeline: SimulationTimeline) {
  const reserve = timeline.reserves[0] ?? cents(0);
  const adjustedBalance = balanceAfterTodayPurchase(input);
  const safeCapacity = allocatedToGoal(adjustedBalance, reserve, input.plan.goal.amount);
  return { reserve, adjustedBalance, safeCapacity };
}

function projectedCompletionDate(input: SimulationInput, currentSaved: Cents, timeline: SimulationTimeline): string | null {
  if (currentSaved >= input.plan.goal.amount) return input.today;

  let projectedBalance = balanceAfterTodayPurchase(input);
  for (let offset = 1; offset <= forecastHorizonDays(input); offset += 1) {
    projectedBalance = cents(Math.max(0, projectedBalance + timeline.flows[offset]));
    if (allocatedToGoal(projectedBalance, timeline.reserves[offset], input.plan.goal.amount) >= input.plan.goal.amount) {
      return timeline.dates[offset];
    }
  }

  return null;
}

function simulateKnown(input: SimulationInput, timeline: SimulationTimeline): KnownSimulation {
  const { reserve, safeCapacity } = currentEnvelope(input, timeline);
  const previousSaved = input.previous?.effectiveSaved ?? cents(0);
  const effectiveSaved = safeCapacity;
  const change = cents(effectiveSaved - previousSaved);
  const completionDate = projectedCompletionDate(input, effectiveSaved, timeline);

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

function maxSpendTomorrow(input: SimulationInput, protectedSaved: Cents, baseTimeline: SimulationTimeline): Cents {
  const tomorrow = baseTimeline.dates[1];
  const tomorrowFlow = baseTimeline.flows[1];
  let low = 0;
  let high = Math.max(0, input.balance + Math.max(0, tomorrowFlow));

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const scenario = { ...input, scenarioPurchase: { date: tomorrow, amount: cents(mid) } };
    const timeline = timelineWithTomorrowPurchase(baseTimeline, scenario.scenarioPurchase.amount);
    if (currentEnvelope(scenario, timeline).safeCapacity < protectedSaved) {
      high = mid - 1;
      continue;
    }
    const result = simulateKnown(scenario, timeline);
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

  const timeline = simulationTimeline(input);
  const result = simulateKnown(input, timeline);
  const canMeetDeadline = meetsDeadline(input, result);
  const tomorrowMaxSpend = !input.scenarioPurchase && canMeetDeadline
    ? maxSpendTomorrow(input, result.effectiveSaved, timeline)
    : cents(0);

  return {
    ...result,
    tomorrowFood: input.plan.dailyFood,
    tomorrowMaxSpend,
    canMeetDeadline,
  };
}
