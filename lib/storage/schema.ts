import { cents, type Cents } from "@/lib/domain/money";
import type { BalanceSnapshot, Cadence, FixedExpense, GoalioPlan, ScheduledAmount, SavingsGoal } from "@/lib/domain/types";

export type ScreenName =
  | "welcome"
  | "invite"
  | "income"
  | "food"
  | "expenses"
  | "settings-expenses"
  | "goal"
  | "initial-balance"
  | "daily-balance"
  | "home"
  | "purchase-input"
  | "purchase-result"
  | "settings"
  | "complete"
  | "post-purchase"
  | "finished";

export interface GoalioState {
  version: 1;
  screen: ScreenName;
  onboarded: boolean;
  plan: GoalioPlan;
  balance: Cents;
  history: BalanceSnapshot[];
  lastResult: BalanceSnapshot | null;
  lastChange?: Cents;
  purchase: { name: string; amount: Cents } | null;
}

const SCREENS = new Set<ScreenName>([
  "welcome",
  "invite",
  "income",
  "food",
  "expenses",
  "settings-expenses",
  "goal",
  "initial-balance",
  "daily-balance",
  "home",
  "purchase-input",
  "purchase-result",
  "settings",
  "complete",
  "post-purchase",
  "finished",
]);

const CADENCES = new Set<Cadence>(["weekly", "monthly", "quarterly", "half-yearly", "once"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIntegerCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNonNegativeCents(value: unknown): value is Cents {
  return isIntegerCents(value) && value >= 0;
}

function isDate(value: unknown) {
  return typeof value === "string" && (value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isScheduledAmount(value: unknown): value is ScheduledAmount {
  if (!isRecord(value)) return false;
  return isNonNegativeCents(value.amount)
    && typeof value.cadence === "string"
    && CADENCES.has(value.cadence as Cadence)
    && isDate(value.nextDate)
    && (value.endDate === undefined || isDate(value.endDate));
}

function isFixedExpense(value: unknown): value is FixedExpense {
  return isScheduledAmount(value)
    && typeof value.id === "string"
    && typeof value.name === "string";
}

function isSavingsGoal(value: unknown): value is SavingsGoal {
  if (!isRecord(value)) return false;
  return typeof value.name === "string"
    && isNonNegativeCents(value.amount)
    && isDate(value.deadline);
}

function isGoalioPlan(value: unknown): value is GoalioPlan {
  if (!isRecord(value)) return false;
  return (value.income === null || isScheduledAmount(value.income))
    && isNonNegativeCents(value.dailyFood)
    && Array.isArray(value.expenses)
    && value.expenses.every(isFixedExpense)
    && isSavingsGoal(value.goal);
}

function isBalanceSnapshot(value: unknown): value is BalanceSnapshot {
  if (!isRecord(value)) return false;
  return isDate(value.date)
    && isNonNegativeCents(value.balance)
    && isNonNegativeCents(value.effectiveSaved);
}

function isPurchase(value: unknown): value is GoalioState["purchase"] {
  if (value === null) return true;
  return isRecord(value)
    && typeof value.name === "string"
    && isNonNegativeCents(value.amount);
}

export function createInitialState(): GoalioState {
  return {
    version: 1,
    screen: "welcome",
    onboarded: false,
    plan: {
      income: { cadence: "monthly", amount: cents(250000), nextDate: "2026-09-10" },
      dailyFood: cents(4000),
      expenses: [],
      goal: { name: "", amount: cents(0), deadline: "" },
    },
    balance: cents(126000),
    history: [],
    lastResult: null,
    lastChange: cents(0),
    purchase: null,
  };
}

export function isGoalioState(value: unknown): value is GoalioState {
  if (!isRecord(value)) return false;
  return value.version === 1
    && typeof value.screen === "string"
    && SCREENS.has(value.screen as ScreenName)
    && typeof value.onboarded === "boolean"
    && isGoalioPlan(value.plan)
    && isNonNegativeCents(value.balance)
    && Array.isArray(value.history)
    && value.history.every(isBalanceSnapshot)
    && (value.lastResult === null || isBalanceSnapshot(value.lastResult))
    && (value.lastChange === undefined || isIntegerCents(value.lastChange))
    && isPurchase(value.purchase);
}
