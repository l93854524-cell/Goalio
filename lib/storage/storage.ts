import { createInitialState, isGoalioState, type GoalioState } from "./schema";

const STORAGE_KEY = "goalio:v1";

export type LoadResult = { state: GoalioState; recovered: boolean };
export type SaveResult = { ok: true } | { ok: false; message: string };

const LEGACY_TUTORIAL_EXPENSES = [
  { name: "房租", amount: 180000, nextDate: "2026-10-05" },
  { name: "视频会员", amount: 2500, nextDate: "2026-09-18" },
  { name: "健身会员", amount: 9900, nextDate: "2026-09-28" },
];

function isLegacyTutorialExpense(expense: GoalioState["plan"]["expenses"][number]) {
  return LEGACY_TUTORIAL_EXPENSES.some(example =>
    expense.name === example.name && expense.amount === example.amount && expense.nextDate === example.nextDate
  );
}

export function loadGoalioState(storage: Storage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { state: createInitialState(), recovered: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isGoalioState(parsed)) return { state: createInitialState(), recovered: true };
    const expenses = parsed.plan.expenses.filter(expense => !isLegacyTutorialExpense(expense));
    if (expenses.length !== parsed.plan.expenses.length) {
      return { state: { ...parsed, plan: { ...parsed.plan, expenses } }, recovered: true };
    }
    return { state: parsed, recovered: false };
  } catch {
    return { state: createInitialState(), recovered: true };
  }
}

export function saveGoalioState(storage: Storage, state: GoalioState): SaveResult {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, message: "数据暂时没有保存，请检查浏览器存储空间后再试。" };
  }
}
