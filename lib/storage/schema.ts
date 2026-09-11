import { cents, type Cents } from "@/lib/domain/money";
import type { BalanceSnapshot, GoalioPlan } from "@/lib/domain/types";

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
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GoalioState>;
  return state.version === 1 && typeof state.screen === "string" && typeof state.balance === "number" && !!state.plan;
}
