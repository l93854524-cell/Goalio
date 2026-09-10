import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as purchaseSimulation from "@/lib/simulation/purchase";
import { cents } from "@/lib/domain/money";
import { GoalioApp } from "./GoalioApp";

describe("GoalioApp", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("immediately completes a fully funded goal after same-day goal and balance changes", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "goal",
      onboarded: true,
      plan: {
        income: { cadence: "once", amount: 0, nextDate: "2026-09-07" },
        dailyFood: 0,
        expenses: [],
        goal: { name: "旅行", amount: 277500, deadline: "2026-10-07" },
      },
      balance: 80000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 80000, effectiveSaved: 18500 },
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    const amount = await screen.findByRole("textbox", { name: "目标金额" });
    await user.clear(amount);
    await user.type(amount, "1800");
    fireEvent.change(screen.getByLabelText("目标日期"), { target: { value: "2026-09-06" } });
    await user.click(screen.getByRole("button", { name: "安排好了" }));

    const balance = await screen.findByRole("textbox", { name: "当前真实余额" });
    await user.clear(balance);
    await user.type(balance, "23000");
    await user.click(screen.getByRole("button", { name: "看看现在的安排" }));

    expect(await screen.findByRole("heading", { name: "已经准备好了" })).toBeVisible();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("goalio:v1") ?? "{}");
      expect(saved.lastResult.effectiveSaved).toBe(180000);
    });
  });

  it("derives completion from persisted current inputs without waiting for another check-in", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "once", amount: 0, nextDate: "2026-09-07" },
        dailyFood: 0,
        expenses: [],
        goal: { name: "旅行", amount: 180000, deadline: "2026-09-06" },
      },
      balance: 2300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 2300000, effectiveSaved: 18500 },
      purchase: null,
    }));

    render(<GoalioApp />);

    expect(await screen.findByRole("heading", { name: "已经准备好了" })).toBeVisible();
  });

  it("completes the setup journey and shows a calculated goal result", async () => {
    const user = userEvent.setup();
    render(<GoalioApp />);

    expect(screen.getByRole("heading", { name: /把今天的余额/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "开始设置" }));
    expect(await screen.findByRole("heading", { name: /生活费通常/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByRole("heading", { name: /每天需要为吃饭/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByRole("heading", { name: /已经确定的开销/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "继续" }));
    expect(await screen.findByRole("heading", { name: /慢慢攒钱/ })).toBeVisible();
    const goalAmount = screen.getByRole("textbox", { name: "目标金额" });
    await user.clear(goalAmount);
    await user.type(goalAmount, "1000");
    await user.click(screen.getByRole("button", { name: "安排好了" }));
    expect(await screen.findByRole("heading", { name: /告诉我现在有多少钱/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "看看现在的安排" }));

    expect(await screen.findByText("已为目标留好", { selector: ".metric-label" })).toBeVisible();
    expect(screen.getByText(/今天多留了/)).toBeVisible();
    expect(screen.getByText("明天额外最多可花")).toBeVisible();
    expect(screen.getByText(/不会动用已为目标留好的钱/)).toBeVisible();
  });

  it("opens purchase evaluation from the home result", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);
    await user.click(await screen.findByRole("button", { name: /帮我看看能不能买/ }));
    expect(await screen.findByRole("heading", { name: /最近有想买的东西吗/ })).toBeVisible();
  });

  it("asks for the post-purchase balance after goal completion", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "complete",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 900000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 900000, effectiveSaved: 800000 },
      lastChange: 2000,
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);
    await user.click(await screen.findByRole("button", { name: "我已经购买" }));
    expect(await screen.findByRole("heading", { name: /购买完成后的余额/ })).toBeVisible();
  });

  it("treats the sample expenses as placeholders and saves the user's own expense", async () => {
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "expenses",
      onboarded: false,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 126000,
      history: [],
      lastResult: null,
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    expect(await screen.findByText("房租")).toBeVisible();
    expect(screen.getByText("视频会员")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "填写自己的固定支出" }));

    expect(screen.queryByText("房租")).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "支出名称" }), "手机话费");
    await user.clear(screen.getByRole("textbox", { name: "支出金额" }));
    await user.type(screen.getByRole("textbox", { name: "支出金额" }), "88");
    await user.click(screen.getByRole("button", { name: "保存这笔支出" }));

    expect(screen.getByText("手机话费")).toBeVisible();
    expect(screen.getByText(/¥88/)).toBeVisible();
  });

  it("returns from the goal step to fixed expenses", async () => {
    const state = {
      version: 1,
      screen: "goal",
      onboarded: false,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 126000,
      history: [],
      lastResult: null,
      purchase: null,
    };
    localStorage.setItem("goalio:v1", JSON.stringify(state));
    const user = userEvent.setup();
    render(<GoalioApp />);

    await user.click(await screen.findByRole("button", { name: "返回" }));
    expect(await screen.findByRole("heading", { name: /已经确定的开销/ })).toBeVisible();
  });

  it("returns directly home from a purchase result", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "purchase-result",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 1000000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 1000000, effectiveSaved: 800000 },
      purchase: { name: "耳机", amount: 90000 },
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    expect(await screen.findByRole("heading", { name: "可以安心购买" })).toBeVisible();
    expect(screen.getByText("这笔消费不会影响目标进度")).toBeVisible();
    expect(screen.getByText("耳机 · ¥900")).toBeVisible();
    expect(screen.queryByText("降低预算")).not.toBeInTheDocument();
    expect(screen.queryByText("延后购买")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "返回主页" }));
    expect(await screen.findByRole("heading", { name: "已经准备好了" })).toBeVisible();
  });

  it("states the unchanged completion date when the existing plan is already late", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "purchase-result",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-09-05" },
      },
      balance: 1000000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 1000000, effectiveSaved: 800000 },
      purchase: { name: "手机壳", amount: 5200 },
    }));
    render(<GoalioApp />);

    expect(await screen.findByRole("heading", { name: "可以安心购买" })).toBeVisible();
    expect(screen.getByText("这笔消费不会影响目标进度")).toBeVisible();
    expect(screen.getByText("手机壳 · ¥52")).toBeVisible();
    expect(screen.getByText("预计完成时间保持不变")).toBeVisible();
    expect(screen.queryByText("降低预算")).not.toBeInTheDocument();
  });

  it("warns when a purchase uses money already saved for the goal", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "purchase-result",
      onboarded: true,
      plan: {
        income: { cadence: "once", amount: 200000, nextDate: "2026-09-28" },
        dailyFood: 0,
        expenses: [],
        goal: { name: "apple watch S11", amount: 188800, deadline: "2026-10-06" },
      },
      balance: 100000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 100000, effectiveSaved: 100000 },
      purchase: { name: "手机壳", amount: 45600 },
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    const heading = await screen.findByRole("heading", { name: "这笔消费会影响目标" });
    expect(heading).toBeVisible();
    expect(heading.closest("main")).toHaveClass("purchase-result-screen");
    expect(screen.getByText("目标进度减少 ¥456")).toBeVisible();
    expect(screen.getByText("手机壳 · ¥456")).toBeVisible();
    expect(screen.getByText("购买后，已留金额将从 ¥1,000 变为 ¥544。预计完成日期仍是 9 月 28 日。")).toBeVisible();
    expect(screen.getByText("降低预算")).toBeVisible();
    expect(screen.getByText("延后购买")).toBeVisible();
    expect(screen.queryByText("›")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "修改商品或金额" }));
    expect(await screen.findByRole("heading", { name: /最近有想买的东西吗/ })).toBeVisible();
  });

  it("reports both reduced progress and the resulting completion delay", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "purchase-result",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-10-01" },
        dailyFood: 3000,
        expenses: [],
        goal: { name: "目标", amount: 500000, deadline: "2027-01-08" },
      },
      balance: 160000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 160000, effectiveSaved: 88000 },
      purchase: { name: "消费", amount: 80000 },
    }));
    render(<GoalioApp />);

    expect(await screen.findByText("目标进度减少 ¥800")).toBeVisible();
    expect(screen.getByText(/预计晚 31 天完成/)).toBeVisible();
  });

  it("states when the forecast has no safe purchase date", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    vi.spyOn(purchaseSimulation, "evaluatePurchase").mockReturnValue({
      kind: "delayed",
      baselineDate: "2026-10-01",
      scenarioDate: "2026-11-01",
      delayDays: 31,
      maxNoDelayAmount: cents(0),
      earliestNoDelayDate: null,
    });
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "purchase-result",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-10-01" },
        dailyFood: 3000,
        expenses: [],
        goal: { name: "目标", amount: 500000, deadline: "2027-01-08" },
      },
      balance: 160000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 160000, effectiveSaved: 88000 },
      purchase: { name: "消费", amount: 80000 },
    }));
    render(<GoalioApp />);

    expect(await screen.findByText("当前预测期内暂无安全购买日期")).toBeVisible();
  });

  it("shows the current date in the home top bar", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    render(<GoalioApp />);

    const topBar = await screen.findByRole("banner");
    expect(within(topBar).getByText("9 月 6 日 · 星期日")).toBeVisible();
  });

  it("labels a decrease in goal progress and marks the progress bar as down", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 50000, nextDate: "2026-09-14" },
        dailyFood: 2000,
        expenses: [
          { id: "gpt", name: "GPT订阅", amount: 13700, cadence: "monthly", nextDate: "2026-09-11" },
          { id: "phone", name: "手机话费", amount: 10900, cadence: "monthly", nextDate: "2026-09-30" },
          { id: "subscription", name: "订阅费", amount: 5000, cadence: "monthly", nextDate: "2026-10-02" },
        ],
        goal: { name: "apple watch S11", amount: 188800, deadline: "2026-10-08" },
      },
      balance: 43500,
      history: [],
      lastResult: { date: "2026-09-07", balance: 43500, effectiveSaved: 1900 },
      lastChange: -30400,
      purchase: null,
    }));
    render(<GoalioApp />);

    expect(await screen.findByText("今天的目标进度减少了 ¥304")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-trend", "down");
  });

  it("asks to adjust the plan instead of offering a spend amount when the deadline cannot be met", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-09-05" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    render(<GoalioApp />);

    expect(await screen.findByText("当前的安排还需要一点调整")).toBeVisible();
    expect(screen.getByText(/目标时间可能会晚一些/)).toBeVisible();
    expect(screen.queryByText("明天额外最多可花")).not.toBeInTheDocument();
  });

  it("shows date controls in demo mode and moves the simulated day", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    expect(await screen.findByText(/演示日期.*9 月 6 日/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "后一天" }));
    expect(screen.getByText(/演示日期.*9 月 7 日/)).toBeVisible();
    expect(await screen.findByRole("heading", { name: "今天手上还有多少？" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "前一天" }));
    expect(screen.getByText(/演示日期.*9 月 6 日/)).toBeVisible();
  });

  it("opens the daily balance check-in whenever the demo console advances a day", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-07", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    expect(await screen.findByRole("heading", { name: /正在为「一台新电脑」准备/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "后一天" }));
    expect(await screen.findByRole("heading", { name: "今天手上还有多少？" })).toBeVisible();
    expect(screen.getByText(/演示日期.*9 月 7 日/)).toBeVisible();
  });

  it("opens the daily balance check-in on the first launch of a new day", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-05", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    render(<GoalioApp />);

    expect(await screen.findByRole("heading", { name: "今天手上还有多少？" })).toBeVisible();
    const balance = screen.getByRole("textbox", { name: "当前真实余额" }) as HTMLInputElement;
    expect(balance).toHaveValue("3000");
    await waitFor(() => expect(balance).toHaveFocus());
    expect(balance.selectionStart).toBe(0);
    expect(balance.selectionEnd).toBe(balance.value.length);
  });

  it("shows the daily date with the day emphasized before the month and weekday", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "daily-balance",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-05", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    render(<GoalioApp />);

    const date = await screen.findByLabelText("2026 年 9 月 6 日，星期日");
    expect(date.children[0]).toHaveTextContent(/^6日$/);
    expect(date.children[1]).toHaveTextContent(/^9月星期日$/);
  });

  it("saves today's balance before entering home and does not ask again that day", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "home",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-05", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    const app = render(<GoalioApp />);

    const balance = await screen.findByRole("textbox", { name: "当前真实余额" });
    await user.clear(balance);
    await user.type(balance, "3200");
    await user.click(screen.getByRole("button", { name: "更新余额" }));

    expect(await screen.findByRole("heading", { name: /正在为「一台新电脑」准备/ })).toBeVisible();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("goalio:v1") ?? "{}");
      expect(saved.balance).toBe(320000);
      expect(saved.lastResult.date).toBe("2026-09-06");
    });

    app.unmount();
    render(<GoalioApp />);
    expect(await screen.findByRole("heading", { name: /正在为「一台新电脑」准备/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "今天手上还有多少？" })).not.toBeInTheDocument();
  });

  it("同日重复提交相同余额时保持当天变化文案稳定，刷新后也一致", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "daily-balance",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [{ date: "2026-09-05", balance: 300000, effectiveSaved: 62000 }],
      lastResult: { date: "2026-09-05", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    const app = render(<GoalioApp />);

    const balance = await screen.findByRole("textbox", { name: "当前真实余额" });
    await user.clear(balance);
    await user.type(balance, "3200");
    await user.click(screen.getByRole("button", { name: "更新余额" }));

    const firstChange = (await screen.findByText(/今天多留了/)).textContent;
    await user.click(screen.getByRole("button", { name: "更新余额" }));
    await user.click(screen.getByRole("button", { name: "更新余额" }));
    expect(await screen.findByText(/今天多留了/)).toHaveTextContent(firstChange ?? "");

    app.unmount();
    render(<GoalioApp />);
    expect(await screen.findByText(/今天多留了/)).toHaveTextContent(firstChange ?? "");
  });

  it("edits an existing fixed expense in place and saves it immediately", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "settings-expenses",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [{ id: "phone", name: "手机话费", amount: 8800, cadence: "monthly", nextDate: "2026-09-16" }],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    await user.click(await screen.findByRole("button", { name: "编辑手机话费" }));
    expect(screen.getByRole("textbox", { name: "支出名称" })).toHaveValue("手机话费");
    const amount = screen.getByRole("textbox", { name: "支出金额" });
    expect(amount).toHaveValue("88");
    await user.clear(amount);
    expect(amount).toHaveValue("");
    await user.type(amount, "0");
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, "99");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(screen.getByText(/¥99/)).toBeVisible();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("goalio:v1") ?? "{}");
      expect(saved.plan.expenses).toEqual([
        { id: "phone", name: "手机话费", amount: 9900, cadence: "monthly", nextDate: "2026-09-16" },
      ]);
    });
  });

  it("asks for confirmation before deleting a fixed expense and applies deletion immediately", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "settings-expenses",
      onboarded: true,
      plan: {
        income: null,
        dailyFood: 4000,
        expenses: [
          { id: "phone", name: "手机话费", amount: 8800, cadence: "monthly", nextDate: "2026-09-16" },
          { id: "gym", name: "健身房", amount: 12800, cadence: "monthly", nextDate: "2026-09-28" },
        ],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    await user.click(await screen.findByRole("button", { name: "编辑手机话费" }));
    await user.click(screen.getByRole("button", { name: "删除这笔" }));
    expect(screen.getByText("确定删除“手机话费”吗？")).toBeVisible();
    expect(screen.getByText("健身房")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "确认删除" }));

    expect(screen.queryByText("手机话费")).not.toBeInTheDocument();
    expect(screen.getByText("健身房")).toBeVisible();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("goalio:v1") ?? "{}");
      expect(saved.plan.expenses.map((expense: { id: string }) => expense.id)).toEqual(["gym"]);
    });
  });

  it("returns to settings after editing fixed expenses from settings", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "settings",
      onboarded: true,
      plan: {
        income: null,
        dailyFood: 4000,
        expenses: [{ id: "phone", name: "手机话费", amount: 8800, cadence: "monthly", nextDate: "2026-09-16" }],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    await user.click(await screen.findByRole("button", { name: /固定支出/ }));
    expect(await screen.findByRole("heading", { name: /已经确定的开销/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "返回" }));
    expect(await screen.findByRole("heading", { name: "设置" })).toBeVisible();
  });

  it("keeps the setup progress and continue action when rearranging an existing plan", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "settings",
      onboarded: true,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [{ id: "gpt", name: "GPT订阅", amount: 13700, cadence: "monthly", nextDate: "2026-09-11" }],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    await user.click(await screen.findByRole("button", { name: "重新安排" }));
    await user.click(await screen.findByRole("button", { name: "继续" }));
    await user.click(await screen.findByRole("button", { name: "继续" }));

    expect(await screen.findByRole("heading", { name: /已经确定的开销/ })).toBeVisible();
    expect(screen.getByLabelText("第 3 步，共 4 步")).toBeVisible();
    expect(screen.getByRole("button", { name: "继续" })).toBeVisible();
  });

  it("allows zero for income, daily food, and the current balance", async () => {
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "income",
      onboarded: false,
      plan: {
        income: { cadence: "monthly", amount: 250000, nextDate: "2026-09-10" },
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 126000,
      history: [],
      lastResult: null,
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    const income = await screen.findByRole("textbox", { name: "每次到账金额" });
    await user.clear(income);
    expect(income).toHaveValue("");
    await user.type(income, "0");
    await user.click(screen.getByRole("button", { name: "继续" }));

    const food = await screen.findByRole("textbox", { name: "每日基本饮食金额" });
    await user.clear(food);
    await user.type(food, "0");
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(await screen.findByRole("button", { name: "暂时没有" }));
    await user.click(await screen.findByRole("button", { name: "安排好了" }));

    const balance = await screen.findByRole("textbox", { name: "当前真实余额" });
    await user.clear(balance);
    await user.type(balance, "0");
    await user.click(screen.getByRole("button", { name: "看看现在的安排" }));
    expect(await screen.findByRole("heading", { name: /正在为「一台新电脑」准备/ })).toBeVisible();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("goalio:v1") ?? "{}");
      expect(saved.plan.income.amount).toBe(0);
      expect(saved.plan.dailyFood).toBe(0);
      expect(saved.balance).toBe(0);
    });
  });

  it("requires a positive goal amount while allowing the field to be cleared and retyped", async () => {
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "goal",
      onboarded: false,
      plan: {
        income: null,
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 126000,
      history: [],
      lastResult: null,
      purchase: null,
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    const amount = await screen.findByRole("textbox", { name: "目标金额" });
    await user.clear(amount);
    expect(amount).toHaveValue("");
    expect(screen.getByRole("button", { name: "安排好了" })).toBeDisabled();
    await user.type(amount, "0");
    expect(screen.getByRole("button", { name: "安排好了" })).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, "8000");
    expect(screen.getByRole("button", { name: "安排好了" })).toBeEnabled();
  });

  it("requires a positive purchase amount while allowing the field to be cleared and retyped", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOALIO_DEMO_DATE", "true");
    localStorage.setItem("goalio:v1", JSON.stringify({
      version: 1,
      screen: "purchase-input",
      onboarded: true,
      plan: {
        income: null,
        dailyFood: 4000,
        expenses: [],
        goal: { name: "一台新电脑", amount: 800000, deadline: "2026-12-20" },
      },
      balance: 300000,
      history: [],
      lastResult: { date: "2026-09-06", balance: 300000, effectiveSaved: 62000 },
      purchase: { name: "耳机", amount: 119900 },
    }));
    const user = userEvent.setup();
    render(<GoalioApp />);

    const amount = await screen.findByRole("textbox", { name: "需要多少钱" });
    await user.clear(amount);
    expect(amount).toHaveValue("");
    expect(screen.getByRole("button", { name: "帮我看看能不能买" })).toBeDisabled();
    await user.type(amount, "0");
    expect(screen.getByRole("button", { name: "帮我看看能不能买" })).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, "999");
    expect(screen.getByRole("button", { name: "帮我看看能不能买" })).toBeEnabled();
  });
});
