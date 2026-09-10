"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarBlank, CheckCircle, Wallet, Warning } from "@phosphor-icons/react";
import { PressableButton } from "@/components/ui/PressableButton";
import { addDays, formatChineseDate, formatChineseFullDate, todayISO } from "@/lib/domain/dates";
import { cents, formatYuan, parseYuan, type Cents } from "@/lib/domain/money";
import type { BalanceSnapshot, Cadence, FixedExpense } from "@/lib/domain/types";
import { evaluatePurchase, type PurchaseEvaluation } from "@/lib/simulation/purchase";
import { runSimulation } from "@/lib/simulation/simulator";
import { createInitialState, type GoalioState, type ScreenName } from "@/lib/storage/schema";
import { loadGoalioState, saveGoalioState } from "@/lib/storage/storage";

const CADENCES: { value: Cadence; label: string }[] = [
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "quarterly", label: "每季度" },
  { value: "half-yearly", label: "每半年" },
  { value: "once", label: "一次性" },
];

function Logo() {
  return <div className="logo" aria-label="Goalio">Goalio</div>;
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return <button className="icon-button" aria-label={label} onClick={onClick}>{children}</button>;
}

function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`screen screen-enter ${className}`.trim()}>{children}</main>;
}

function TopBar({ right, center, back, backLabel = "返回", onBack }: { right?: ReactNode; center?: ReactNode; back?: boolean; backLabel?: string; onBack?: () => void }) {
  return (
    <header className="topbar">
      {back ? <IconButton label={backLabel} onClick={onBack!}><span className="chevron-left" /></IconButton> : <Logo />}
      {back && <Logo />}
      {!back && center && <div className="topbar-center">{center}</div>}
      <div className="topbar-right">{right}</div>
    </header>
  );
}

function StepMark({ step }: { step: number }) {
  return (
    <div className="step-mark" aria-label={`第 ${step} 步，共 4 步`}>
      <span>{String(step).padStart(2, "0")} <em>/ 04</em></span>
      <div className="step-lines">{[1, 2, 3, 4].map(item => <i className={item <= step ? "active" : ""} key={item} />)}</div>
    </div>
  );
}

function DailyDate({ date }: { date: string }) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = formatChineseFullDate(date).split(" · ")[1];
  return (
    <time className="daily-date" dateTime={date} aria-label={`${year} 年 ${month} 月 ${day} 日，${weekday}`}>
      <span className="daily-date-day">{day}<small>日</small></span>
      <span className="daily-date-context"><b>{month}月</b><em>{weekday}</em></span>
    </time>
  );
}

function AmountInput({ value, onChange, onValidityChange, label, allowZero = true, autoFocus = false, selectOnFocus = false }: { value: Cents; onChange: (value: Cents) => void; onValidityChange?: (valid: boolean) => void; label: string; allowZero?: boolean; autoFocus?: boolean; selectOnFocus?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      autoFocus={autoFocus}
      inputMode="decimal"
      value={draft ?? String(value / 100)}
      aria-label={label}
      onFocus={selectOnFocus ? event => event.currentTarget.select() : undefined}
      onBlur={() => setDraft(null)}
      onChange={event => {
        const nextText = event.target.value;
        setDraft(nextText);
        const parsed = parseYuan(nextText);
        const valid = parsed !== null && (allowZero || parsed > 0);
        onValidityChange?.(valid);
        if (valid) onChange(parsed);
      }}
    />
  );
}

function MoneyField({ value, onChange, onValidityChange, label, large = false, autoFocus = false }: { value: Cents; onChange: (value: Cents) => void; onValidityChange?: (valid: boolean) => void; label: string; large?: boolean; autoFocus?: boolean }) {
  return (
    <label className={`money-field ${large ? "money-field-large" : ""}`}>
      <span className="sr-only">{label}</span>
      <span className="currency">¥</span>
      <AmountInput value={value} onChange={onChange} onValidityChange={onValidityChange} label={label} autoFocus={autoFocus} selectOnFocus />
    </label>
  );
}

function FeedbackButton({ children, onDone, loadingLabel, successLabel, className = "", disabled = false }: { children: ReactNode; onDone: () => void; loadingLabel?: string; successLabel?: string; className?: string; disabled?: boolean }) {
  const [phase, setPhase] = useState<"ready" | "loading" | "success">("ready");
  function act() {
    if (phase !== "ready" || disabled) return;
    setPhase("loading");
    window.setTimeout(() => {
      setPhase("success");
      window.setTimeout(onDone, 180);
    }, 260);
  }
  return (
    <PressableButton className={className} disabled={disabled} loading={phase === "loading"} success={phase === "success"} loadingLabel={loadingLabel} successLabel={successLabel} onClick={act}>
      {children}
    </PressableButton>
  );
}

function BottomActions({ primary, onPrimary, secondary, onSecondary, loadingLabel, successLabel, disabled = false }: { primary: string; onPrimary: () => void; secondary?: string; onSecondary?: () => void; loadingLabel?: string; successLabel?: string; disabled?: boolean }) {
  return (
    <div className="bottom-actions">
      <FeedbackButton disabled={disabled} onDone={onPrimary} loadingLabel={loadingLabel} successLabel={successLabel}>{primary}</FeedbackButton>
      {secondary && <button className="text-button" onClick={onSecondary}>{secondary}</button>}
    </div>
  );
}

function WelcomeScreen({ go }: { go: (screen: ScreenName) => void }) {
  return (
    <Screen className="welcome-screen">
      <div className="welcome-logo"><Logo /></div>
      <section className="welcome-panel">
        <h1>把今天的余额，<br />变成更安心的决定。</h1>
        <p>每天更新一次，Goalio 会告诉你已经安全攒下多少，以及一笔消费会让目标延后多久。</p>
        <FeedbackButton onDone={() => go("income")}>开始设置</FeedbackButton>
        <button className="text-button" onClick={() => go("invite")}>已有邀请码？</button>
      </section>
    </Screen>
  );
}

function InviteScreen({ go }: { go: (screen: ScreenName) => void }) {
  const [code, setCode] = useState("GOALIO");
  return (
    <Screen>
      <TopBar back onBack={() => go("welcome")} right={<span />} />
      <div className="content intro-content">
        <p className="eyebrow">内部体验</p>
        <h1>欢迎来到 Goalio</h1>
        <p className="lead">输入邀请码后，我会帮你照看每天的生活开销，也陪你慢慢靠近想要的目标。</p>
        <label className="field-card">
          <span>邀请码</span>
          <input value={code} onChange={event => setCode(event.target.value.toUpperCase())} aria-label="邀请码" />
        </label>
        <p className="privacy-note">邀请码会与当前设备绑定。你的余额、收入和支出只保存在这台设备上。</p>
      </div>
      <BottomActions primary="开始使用" onPrimary={() => code.trim() && go("income")} />
    </Screen>
  );
}

function IncomeScreen({ state, update, go }: ScreenProps) {
  const income = state.plan.income;
  const selected = income?.cadence ?? "monthly";
  const [amountValid, setAmountValid] = useState(income !== null);
  return (
    <Screen>
      <TopBar right={<StepMark step={1} />} />
      <div className="content">
        <h1>生活费通常<br />什么时候到账？</h1>
        <p className="lead">告诉我已经确定的收入安排，<br />我会据此照看之后的日常开销。</p>
        <div className="panel choice-panel">
          {CADENCES.map(option => (
            <button
              key={option.value}
              className={`choice-row ${selected === option.value ? "selected" : ""}`}
              onClick={() => {
                setAmountValid(true);
                update(draft => ({ ...draft, plan: { ...draft.plan, income: { cadence: option.value, amount: income?.amount ?? cents(250000), nextDate: income?.nextDate ?? "2026-09-10" } } }));
              }}
            >
              <span>{option.label}</span>
            </button>
          ))}
          {income && (
            <div className="detail-group">
              <label><span>每次到账金额</span><AmountInput value={income.amount} label="每次到账金额" onValidityChange={setAmountValid} onChange={amount => update(draft => ({ ...draft, plan: { ...draft.plan, income: { ...income, amount } } }))} /></label>
              <label><span>下一次到账</span><input aria-label="下一次到账" type="date" value={income.nextDate} onChange={event => update(draft => ({ ...draft, plan: { ...draft.plan, income: { ...income, nextDate: event.target.value } } }))} /></label>
            </div>
          )}
        </div>
      </div>
      <BottomActions primary="继续" disabled={!income || !amountValid || !income.nextDate} onPrimary={() => go("food")} secondary="暂时没有确定收入" onSecondary={() => { update(draft => ({ ...draft, plan: { ...draft.plan, income: null } })); go("food"); }} />
    </Screen>
  );
}

function FoodScreen({ state, update, go }: ScreenProps) {
  const [amountValid, setAmountValid] = useState(true);
  return (
    <Screen>
      <TopBar right={<StepMark step={2} />} />
      <div className="content">
        <h1>每天需要为吃饭留出多少？</h1>
        <p className="lead">填写一个适合日常生活的金额。<br />我会每天优先把这部分照顾好。</p>
        <MoneyField large value={state.plan.dailyFood} label="每日基本饮食金额" onValidityChange={setAmountValid} onChange={dailyFood => update(draft => ({ ...draft, plan: { ...draft.plan, dailyFood } }))} />
        <div className="quick-options">
          {[3000, 4000, 5000].map(value => <button className={state.plan.dailyFood === value ? "active" : ""} key={value} onClick={() => { setAmountValid(true); update(draft => ({ ...draft, plan: { ...draft.plan, dailyFood: cents(value) } })); }}>¥{value / 100}</button>)}
        </div>
        <p className="hint">偶尔聚餐或额外消费，可以之后单独评估。</p>
      </div>
      <BottomActions primary="继续" disabled={!amountValid} onPrimary={() => go("expenses")} />
    </Screen>
  );
}

function previousSnapshot(state: GoalioState, today: string): BalanceSnapshot | undefined {
  const candidates = [
    ...state.history,
    ...(state.lastResult ? [state.lastResult] : []),
  ].filter(snapshot => snapshot.date < today);
  return candidates.sort((a, b) => b.date.localeCompare(a.date))[0];
}

function applyPlanChange(state: GoalioState, plan: GoalioState["plan"], today: string): GoalioState {
  if (!state.onboarded || !state.lastResult) return { ...state, plan };
  const result = runSimulation({
    today,
    balance: state.balance,
    plan,
    previous: previousSnapshot(state, today),
  });
  const snapshot = { date: today, balance: state.balance, effectiveSaved: result.effectiveSaved };
  return {
    ...state,
    plan,
    lastResult: snapshot,
    lastChange: result.change,
    history: [...state.history.filter(item => item.date !== today), snapshot],
  };
}

function ExpensesScreen({ state, update, go, today }: ScreenProps & { today: string }) {
  const [editingId, setEditingId] = useState<string | null>();
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [nextDate, setNextDate] = useState("2026-09-28");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editing = editingId !== undefined;
  const amount = parseYuan(amountText);
  const canSave = !!name.trim() && amount !== null && amount > 0 && !!nextDate;

  function startExpense() {
    setName("");
    setAmountText("");
    setNextDate("2026-09-28");
    setConfirmingDelete(false);
    setEditingId(null);
  }

  function startEditing(expense: FixedExpense) {
    setName(expense.name);
    setAmountText(String(expense.amount / 100));
    setNextDate(expense.nextDate);
    setConfirmingDelete(false);
    setEditingId(expense.id);
  }

  function stopEditing() {
    setConfirmingDelete(false);
    setEditingId(undefined);
  }

  function saveExpense() {
    if (!canSave || amount === null) return;
    const id = typeof editingId === "string" ? editingId : crypto.randomUUID();
    const next: FixedExpense = { id, name: name.trim(), amount, cadence: "monthly", nextDate };
    update(draft => {
      const expenses = typeof editingId === "string"
        ? draft.plan.expenses.map(expense => expense.id === editingId ? next : expense)
        : [...draft.plan.expenses, next];
      return applyPlanChange(draft, { ...draft.plan, expenses }, today);
    });
    stopEditing();
  }

  function deleteExpense() {
    if (typeof editingId !== "string") return;
    update(draft => applyPlanChange(
      draft,
      { ...draft.plan, expenses: draft.plan.expenses.filter(expense => expense.id !== editingId) },
      today,
    ));
    stopEditing();
  }

  function renderEditor() {
    const isExisting = typeof editingId === "string";
    return (
      <div className="expense-editor">
        <label><span>名称</span><input autoFocus aria-label="支出名称" placeholder="例如：手机话费" value={name} onChange={event => setName(event.target.value)} /></label>
        <label><span>金额</span><input aria-label="支出金额" inputMode="decimal" placeholder="0" value={amountText} onChange={event => setAmountText(event.target.value)} /></label>
        <label><span>下次扣款</span><input aria-label="下次扣款日期" type="date" value={nextDate} onChange={event => setNextDate(event.target.value)} /></label>
        {confirmingDelete ? (
          <div className="expense-delete-confirm" role="group" aria-label="删除固定支出确认">
            <p>确定删除“{name}”吗？</p>
            <button className="text-button" onClick={() => setConfirmingDelete(false)}>保留这笔</button>
            <button className="expense-delete-confirm-button" onClick={deleteExpense}>确认删除</button>
          </div>
        ) : (
          <div className={`expense-editor-actions ${isExisting ? "editing-existing" : ""}`}>
            {isExisting && <button className="expense-delete" onClick={() => setConfirmingDelete(true)}>删除这笔</button>}
            <button className="text-button" onClick={stopEditing}>取消</button>
            <button className="expense-save" disabled={!canSave} onClick={saveExpense}>{isExisting ? "保存修改" : "保存这笔支出"}</button>
          </div>
        )}
      </div>
    );
  }

  const fromSettings = state.screen === "settings-expenses";
  return (
    <Screen>
      {fromSettings
        ? <TopBar back onBack={() => go("settings")} right={<span />} />
        : <TopBar right={<StepMark step={3} />} />}
      <div className="content">
        <h1>还有哪些已经确定的开销？</h1>
        <p className="lead">比如房租、会员订阅、学费，或者已经决定要支付的费用。我会提前为它们留好位置。</p>
        <div className="panel expense-panel">
          {state.plan.expenses.length === 0 && !editing && (
            <button className="expense-examples" aria-label="填写自己的固定支出" onClick={startExpense}>
              <span className="summary-row"><strong>房租</strong><span>¥1,800 · 每月 5 日</span></span>
              <span className="summary-row"><strong>视频会员</strong><span>¥25 · 每月 18 日</span></span>
              <small>示例 · 点击后填写自己的开销</small>
            </button>
          )}
          {state.plan.expenses.map(expense => editingId === expense.id
            ? <div key={expense.id}>{renderEditor()}</div>
            : <button className="summary-row expense-row" aria-label={`编辑${expense.name}`} onClick={() => startEditing(expense)} key={expense.id}><strong>{expense.name}</strong><span>{formatYuan(expense.amount)} · 每月 {Number(expense.nextDate.slice(-2))} 日</span><b>›</b></button>
          )}
          {editingId === null && renderEditor()}
          {!editing && state.plan.expenses.length > 0 && <button className="add-row" onClick={startExpense}><span>＋</span> 添加一笔</button>}
        </div>
      </div>
      {!fromSettings && <BottomActions primary="继续" onPrimary={() => go("goal")} secondary="暂时没有" onSecondary={() => { update(draft => ({ ...draft, plan: { ...draft.plan, expenses: [] } })); go("goal"); }} />}
    </Screen>
  );
}

function GoalScreen({ state, update, go, today }: ScreenProps & { today: string }) {
  const goal = state.plan.goal;
  const [amountValid, setAmountValid] = useState(goal.amount > 0);
  const canContinue = !!goal.name.trim() && amountValid && !!goal.deadline;
  return (
    <Screen>
      <TopBar back onBack={() => go("expenses")} right={<StepMark step={4} />} />
      <div className="content">
        <h1>最近想为哪件事慢慢攒钱？</h1>
        <p className="lead">一次专注一个目标，会更容易看清每天的进展。</p>
        <div className="panel detail-group goal-fields">
          <label><span>目标名称</span><input aria-label="目标名称" value={goal.name} onChange={event => update(draft => ({ ...draft, plan: { ...draft.plan, goal: { ...goal, name: event.target.value } } }))} /><i>✓</i></label>
          <label><span>目标金额</span><AmountInput allowZero={false} value={goal.amount} label="目标金额" onValidityChange={setAmountValid} onChange={amount => update(draft => ({ ...draft, plan: { ...draft.plan, goal: { ...goal, amount } } }))} /><i>✓</i></label>
          <label><span>希望什么时候准备好</span><input aria-label="目标日期" type="date" value={goal.deadline} onChange={event => update(draft => ({ ...draft, plan: { ...draft.plan, goal: { ...goal, deadline: event.target.value } } }))} /><i>✓</i></label>
        </div>
        <p className="hint centered">我会照顾好日常开销，再帮你判断这个时间是否合适。</p>
      </div>
      <BottomActions primary="安排好了" disabled={!canContinue} onPrimary={() => {
        update(draft => applyPlanChange(draft, draft.plan, today));
        go("initial-balance");
      }} />
    </Screen>
  );
}

function BalanceScreen({ state, update, daily = false, today }: ScreenProps & { daily?: boolean; today: string }) {
  const afterPurchase = state.screen === "post-purchase";
  const dailyCheckIn = daily && !afterPurchase;
  const [amountValid, setAmountValid] = useState(true);
  function submit() {
    const previous = previousSnapshot(state, today);
    const result = runSimulation({ today, balance: state.balance, plan: state.plan, previous });
    const snapshot = { date: today, balance: state.balance, effectiveSaved: result.effectiveSaved };
    update(draft => ({
      ...draft,
      onboarded: true,
      lastResult: snapshot,
      lastChange: result.change,
      history: [...draft.history.filter(item => item.date !== today), snapshot],
      screen: draft.screen === "post-purchase" ? "finished" : "home",
    }));
  }
  return (
    <Screen className={dailyCheckIn ? "daily-checkin-screen" : ""}>
      <TopBar right={daily ? <DailyDate date={today} /> : <span className="date-label">最后一步</span>} />
      <div className={`content balance-content ${dailyCheckIn ? "daily-checkin-content" : ""}`}>
        {dailyCheckIn && <p className="daily-kicker"><span />每日更新</p>}
        <h1>{afterPurchase ? "购买完成后的余额是多少？" : dailyCheckIn ? "今天手上还有多少？" : "最后，告诉我现在有多少钱"}</h1>
        <p className="lead">{afterPurchase ? "请填写购买完成后的最新真实余额，消费金额已经包含在这个数字里。" : dailyCheckIn ? "昨天的余额已经放好了。确认一下今天的数字，我会重新照看接下来的安排。" : "请填写此刻可以用于日常生活和这个目标的真实余额。今天已经发生的收入和支出，都算在这个数字里。"}</p>
        <MoneyField autoFocus={dailyCheckIn} large value={state.balance} label="当前真实余额" onValidityChange={setAmountValid} onChange={balance => update(draft => ({ ...draft, balance }))} />
        {dailyCheckIn && <p className="prefill-note">已带入上次余额，输入时会自动全选</p>}
        <div className="privacy-lock"><span aria-hidden="true">▣</span><p>余额、收入和支出只保存在这台设备上。<br />我不会从余额中实际转走任何钱。</p></div>
      </div>
      <BottomActions primary={afterPurchase ? "完成" : dailyCheckIn ? "更新余额" : "看看现在的安排"} disabled={!amountValid} loadingLabel={dailyCheckIn ? "正在更新今天的安排…" : "正在帮你照看接下来的日子…"} successLabel={dailyCheckIn ? "余额已更新" : undefined} onPrimary={submit} />
    </Screen>
  );
}

function canStartDailyCheckIn(state: GoalioState) {
  if (!state.onboarded || state.screen === "post-purchase" || state.screen === "finished") return false;
  return true;
}

function needsDailyCheckIn(state: GoalioState, today: string) {
  if (!canStartDailyCheckIn(state)) return false;
  return !state.lastResult || state.lastResult.date < today;
}

function HomeScreen({ state, go, today }: ScreenProps & { today: string }) {
  const previous = previousSnapshot(state, today);
  const result = runSimulation({ today, balance: state.balance, plan: state.plan, previous });
  const saved = result.effectiveSaved;
  const progress = Math.min(100, Math.round((saved / state.plan.goal.amount) * 1000) / 10);
  const change = state.lastChange ?? result.change;
  return (
    <Screen>
      <TopBar
        center={<time className="home-date" dateTime={today}>{formatChineseFullDate(today)}</time>}
        right={<div className="home-actions"><button onClick={() => go("daily-balance")}>更新余额</button><button aria-label="设置" onClick={() => go("settings")}>•••</button></div>}
      />
      <div className="content home-content">
        <h1>正在为「{state.plan.goal.name}」准备</h1>
        <p className="metric-label">已为目标留好</p>
        <div className="hero-amount">{formatYuan(saved)}</div>
        <div className="progress-track" data-trend={change < 0 ? "down" : "up"} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(2, progress)}%` }} /></div>
        <p className="progress-copy">目标 {formatYuan(state.plan.goal.amount)} · 已完成 {progress}%</p>
        <section className="change-block reveal-1">
          <strong>{change < 0 ? `今天的目标进度减少了 ${formatYuan(cents(Math.abs(change)))}` : change > 0 ? `今天多留了 ${formatYuan(change)}` : "今天的目标进度保持不变"}</strong>
          <p>{change < 0 ? "最近的余额发生了变化，我先把接下来的生活和固定支出照顾好。" : change > 0 ? "当前余额照顾好未来生活和固定支出后，又有更多可以安心留给目标。" : "目前的余额刚好适合维持现在的安排。"}</p>
        </section>
        {result.status === "known" ? (
          <div className="reveal-2">
            <div className="result-list">
              <div><span>预计准备好</span><strong>{result.completionDate ? formatChineseDate(result.completionDate) : "暂时未知"}</strong></div>
              <div><span>明天的基本开销</span><strong>{formatYuan(result.tomorrowFood)}</strong></div>
              {result.canMeetDeadline && <div><span>明天额外最多可花</span><strong>{formatYuan(result.tomorrowMaxSpend)}</strong></div>}
            </div>
            {result.canMeetDeadline ? (
              <p className="spend-note">这个金额不包含明天的基本开销，也不会动用已为目标留好的钱。实际余额或计划变化后会重新计算。</p>
            ) : (
              <div className="deadline-adjustment">
                <strong>当前的安排还需要一点调整</strong>
                <p>按现在的余额和开销，目标时间可能会晚一些。</p>
              </div>
            )}
          </div>
        ) : <div className="unknown-box">还缺少{result.missing.join("、")}，暂时无法可靠判断完成日期。</div>}
        <button className="purchase-entry reveal-3" onClick={() => go("purchase-input")}><span>帮我看看能不能买</span><b>→</b></button>
      </div>
    </Screen>
  );
}

function PurchaseInputScreen({ state, update, go }: ScreenProps) {
  const purchase = state.purchase ?? { name: "耳机", amount: cents(119900) };
  const [amountValid, setAmountValid] = useState(purchase.amount > 0);
  const canEvaluate = !!purchase.name.trim() && amountValid;
  return (
    <Screen>
      <TopBar back onBack={() => go("home")} right={<span className="goal-mini">{state.plan.goal.name}</span>} />
      <div className="content purchase-content">
        <h1>最近有想买的东西吗？</h1>
        <p className="lead centered">告诉我金额，<br />我帮你看看它会不会影响现在的生活和目标。</p>
        <div className="panel detail-group purchase-fields">
          <label><span>想买什么</span><input aria-label="想买什么" value={purchase.name} onChange={event => update(draft => ({ ...draft, purchase: { ...purchase, name: event.target.value } }))} /></label>
          <label><span>需要多少钱</span><AmountInput allowZero={false} value={purchase.amount} label="需要多少钱" onValidityChange={setAmountValid} onChange={amount => update(draft => ({ ...draft, purchase: { ...purchase, amount } }))} /></label>
        </div>
        <p className="hint centered">我会把这笔消费放进未来的安排里重新计算。</p>
      </div>
      <BottomActions primary="帮我看看能不能买" disabled={!canEvaluate} loadingLabel="正在把这笔消费放进未来的安排里…" onPrimary={() => { if (!state.purchase) update(draft => ({ ...draft, purchase })); go("purchase-result"); }} />
    </Screen>
  );
}

function resultCopy(result: PurchaseEvaluation) {
  if (result.kind === "shortfall") return { title: "这笔消费会影响安排", kicker: `未来可能缺少 ${formatYuan(result.amount)}`, body: "建议降低预算，或等余额更充足时再购买。" };
  if (result.kind === "unknown") return { title: "现在还无法放心判断", kicker: "还缺少一些信息", body: `目前缺少${result.missing.join("、")}，暂时无法可靠计算这笔消费会带来多少影响。` };
  if (result.kind === "unreachable") return { title: "这笔消费会影响目标", kicker: "完成时间将无法确定", body: "按当前余额和计划，暂时无法可靠预测目标的完成日期。" };
  if (result.kind === "progress-reduced") {
    const dateCopy = result.delayDays > 0
      ? `预计完成日期会从 ${formatChineseDate(result.baselineDate)} 调整到 ${formatChineseDate(result.scenarioDate)}，预计晚 ${result.delayDays} 天完成。`
      : `预计完成日期仍是 ${formatChineseDate(result.scenarioDate)}。`;
    return {
      title: "这笔消费会影响目标",
      kicker: `目标进度减少 ${formatYuan(result.amount)}`,
      body: `购买后，已留金额将从 ${formatYuan(result.baselineSaved)} 变为 ${formatYuan(result.scenarioSaved)}。${dateCopy}`,
    };
  }
  if (result.kind === "no-impact") return { title: "可以安心购买", kicker: "这笔消费不会影响目标进度", body: "预计完成时间保持不变" };
  return { title: "这笔消费会影响目标", kicker: `预计晚 ${result.delayDays} 天完成`, body: `完成时间将从 ${formatChineseDate(result.baselineDate)} 调整到 ${formatChineseDate(result.scenarioDate)}。` };
}

function PurchaseResultScreen({ state, go, today }: ScreenProps & { today: string }) {
  const purchase = state.purchase ?? { name: "耳机", amount: cents(119900) };
  const previous = previousSnapshot(state, today);
  const result = evaluatePurchase({ today, balance: state.balance, plan: state.plan, previous, ...purchase });
  const copy = resultCopy(result);
  const noImpact = result.kind === "no-impact";
  const showAlternatives = result.kind === "progress-reduced" || result.kind === "delayed-in-time" || result.kind === "delayed";
  return (
    <Screen className="purchase-result-screen">
      <TopBar back backLabel="返回主页" onBack={() => go("home")} right={<span />} />
      <div className={`content result-content ${noImpact ? "result-safe" : "result-impact"}`}>
        <div className="result-status-icon" aria-hidden="true">
          {noImpact ? <CheckCircle size={72} weight="fill" /> : <Warning size={72} weight="fill" />}
        </div>
        <h1>{copy.title}</h1>
        <p className="result-kicker">{copy.kicker}</p>
        {!noImpact && <p className="result-body">{copy.body}</p>}
        <div className="panel purchase-result-summary">
          <strong>{purchase.name} · {formatYuan(purchase.amount)}</strong>
          {noImpact && <span>{copy.body}</span>}
        </div>
        {showAlternatives && (
          <div className="panel alternatives">
            <div className="alternative-row"><span className="alternative-icon" aria-hidden="true"><Wallet size={28} weight="regular" /></span><div><span>降低预算</span><strong>今天最多花 {formatYuan(result.maxNoDelayAmount)}</strong><small>保持原来的完成时间</small></div></div>
            <div className="alternative-row"><span className="alternative-icon" aria-hidden="true"><CalendarBlank size={28} weight="regular" /></span><div><span>延后购买</span><strong>{result.earliestNoDelayDate === null ? "当前预测期内暂无安全购买日期" : `${formatChineseDate(result.earliestNoDelayDate)}后购买`}</strong><small>保持原来的完成时间</small></div></div>
          </div>
        )}
        {noImpact && <PressableButton onClick={() => go("home")}>返回首页</PressableButton>}
        <button className="text-button standalone" onClick={() => go("purchase-input")}>修改商品或金额</button>
      </div>
    </Screen>
  );
}

function SettingsScreen({ state, go }: ScreenProps) {
  const income = state.plan.income;
  return (
    <Screen>
      <header className="modal-header"><IconButton label="关闭设置" onClick={() => go("home")}>×</IconButton><h1>设置</h1><span /></header>
      <div className="content settings-content">
        <div className="settings-list">
          <button onClick={() => go("income")}><strong>未来收入</strong><span>{income ? `每月 ${formatYuan(income.amount)} · ${Number(income.nextDate.slice(-2))} 日到账` : "尚未填写"}</span><b>›</b></button>
          <button onClick={() => go("food")}><strong>每天的基本饮食</strong><span>{formatYuan(state.plan.dailyFood)}</span><b>›</b></button>
          <button onClick={() => go("settings-expenses")}><strong>固定支出</strong><span>{state.plan.expenses.length} 笔 · 每月 {formatYuan(cents(state.plan.expenses.reduce((sum, item) => sum + item.amount, 0)))}</span><b>›</b></button>
          <button onClick={() => go("goal")}><strong>当前目标</strong><span>{state.plan.goal.name} · {formatYuan(state.plan.goal.amount)} · {formatChineseDate(state.plan.goal.deadline)}</span><b>›</b></button>
        </div>
        <button className="text-button standalone" onClick={() => go("income")}>重新安排</button>
        <div className="data-note"><h2>你的数据</h2><p>余额、收入、支出和目标只保存在这台设备上。</p></div>
      </div>
    </Screen>
  );
}

function CompleteScreen({ state, go }: ScreenProps) {
  return (
    <Screen className="complete-screen">
      <section className="complete-hero"><Logo /><p>{state.plan.goal.name}</p><h1>已经为目标留好</h1><strong>{formatYuan(state.plan.goal.amount)}</strong><span>100%</span></section>
      <section className="complete-body"><h2>已经准备好了</h2><p>在你确认购买前，我会继续帮你<br />把这笔钱留在当前安排里。</p><PressableButton onClick={() => go("post-purchase")}>我已经购买</PressableButton><button className="text-button" onClick={() => go("home")}>暂时继续保留</button><small>确认购买后，只需要填写购买后的最新真实余额。</small></section>
    </Screen>
  );
}

function FinishedScreen({ state }: { state: GoalioState }) {
  return <Screen className="finished-screen"><Logo /><div><span className="big-check">✓</span><h1>「{state.plan.goal.name}」完成了。</h1><p>愿下一件想做的事，也能一步一步变得清楚。</p></div></Screen>;
}

type ScreenProps = {
  state: GoalioState;
  update: (producer: (state: GoalioState) => GoalioState) => void;
  go: (screen: ScreenName) => void;
};

export function GoalioApp() {
  const [state, setState] = useState<GoalioState>(createInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [demoDate, setDemoDate] = useState("2026-09-06");
  const demo = process.env.NEXT_PUBLIC_GOALIO_DEMO_DATE === "true" || process.env.NODE_ENV === "development";
  const today = demo ? demoDate : todayISO();
  const [launchDate] = useState(today);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const loaded = loadGoalioState(window.localStorage).state;
      setState(needsDailyCheckIn(loaded, launchDate) ? { ...loaded, screen: "daily-balance" } : loaded);
      setHydrated(true);
    });
    return () => { active = false; };
  }, [launchDate]);
  useEffect(() => {
    if (hydrated) saveGoalioState(window.localStorage, state);
  }, [hydrated, state]);
  const update = (producer: (draft: GoalioState) => GoalioState) => setState(current => producer(current));
  const go = useMemo(() => (screen: ScreenName) => setState(current => ({ ...current, screen })), []);
  const moveDemoDate = (days: number) => {
    const nextDate = addDays(demoDate, days);
    setDemoDate(nextDate);
    if (days > 0) {
      setState(current => canStartDailyCheckIn(current) ? { ...current, screen: "daily-balance" } : current);
    }
  };
  const props = { state, update, go };

  let view: ReactNode;
  switch (state.screen) {
    case "welcome": view = <WelcomeScreen go={go} />; break;
    case "invite": view = <InviteScreen go={go} />; break;
    case "income": view = <IncomeScreen {...props} />; break;
    case "food": view = <FoodScreen {...props} />; break;
    case "expenses": view = <ExpensesScreen {...props} today={today} />; break;
    case "settings-expenses": view = <ExpensesScreen {...props} today={today} />; break;
    case "goal": view = <GoalScreen {...props} today={today} />; break;
    case "initial-balance": view = <BalanceScreen {...props} today={today} />; break;
    case "daily-balance": view = <BalanceScreen {...props} daily today={today} />; break;
    case "home": {
      const previous = previousSnapshot(state, today);
      const result = runSimulation({ today, balance: state.balance, plan: state.plan, previous });
      view = result.status === "known" && result.effectiveSaved >= state.plan.goal.amount
        ? <CompleteScreen {...props} />
        : <HomeScreen {...props} today={today} />;
      break;
    }
    case "purchase-input": view = <PurchaseInputScreen {...props} />; break;
    case "purchase-result": view = <PurchaseResultScreen {...props} today={today} />; break;
    case "settings": view = <SettingsScreen {...props} />; break;
    case "complete": view = <CompleteScreen {...props} />; break;
    case "post-purchase": view = <BalanceScreen {...props} daily today={today} />; break;
    case "finished": view = <FinishedScreen state={state} />; break;
    default: view = <WelcomeScreen go={go} />;
  }

  return (
    <div className="app-shell">
      {view}
      {demo && state.onboarded && <aside className="demo-control" aria-label="演示日期控制台"><span>演示日期 · {formatChineseDate(demoDate)}</span><button aria-label="前一天" onClick={() => moveDemoDate(-1)}>−</button><button aria-label="后一天" onClick={() => moveDemoDate(1)}>＋</button></aside>}
    </div>
  );
}
