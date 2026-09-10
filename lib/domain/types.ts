import type { Cents } from "./money";

export type Cadence = "weekly" | "monthly" | "quarterly" | "half-yearly" | "once";

export interface ScheduledAmount {
  amount: Cents;
  cadence: Cadence;
  nextDate: string;
  endDate?: string;
}

export interface FixedExpense extends ScheduledAmount {
  id: string;
  name: string;
}

export interface SavingsGoal {
  name: string;
  amount: Cents;
  deadline: string;
}

export interface GoalioPlan {
  income: ScheduledAmount | null;
  dailyFood: Cents;
  expenses: FixedExpense[];
  goal: SavingsGoal;
}

export interface BalanceSnapshot {
  date: string;
  balance: Cents;
  effectiveSaved: Cents;
}
