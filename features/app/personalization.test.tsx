import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoalioApp } from "./GoalioApp";
import { createInitialState } from "@/lib/storage/schema";
import { todayISO } from "@/lib/domain/dates";
import { cents } from "@/lib/domain/money";

const key = "goalio:appearance:v1";
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5z8AAAAASUVORK5CYII=";

function readyState() {
  const initial = createInitialState();
  return {
    ...initial, screen: "home" as const, onboarded: true, balance: cents(300000),
    plan: { ...initial.plan,
      income: { amount: cents(500000), cadence: "monthly" as const, nextDate: todayISO() }, dailyFood: cents(3500),
      goal: { name: "旅行", amount: cents(180000), deadline: "2026-12-20" } },
    lastResult: { date: todayISO(), balance: cents(300000), effectiveSaved: cents(60000) },
  };
}

describe("local personalization", () => {
  beforeEach(() => localStorage.clear());

  it("offers five colors and restores the selection after remount without changing business data", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const props = { initialState: { ...readyState(), screen: "settings" as const }, onStateChange };
    const first = render(<GoalioApp {...props} />);
    const region = screen.getByRole("region", { name: "个性化" });
    for (const name of ["奶油", "粉色", "淡紫", "抹茶绿", "淡蓝"]) {
      expect(within(region).getByRole("button", { name })).toBeVisible();
    }
    await user.click(within(region).getByRole("button", { name: "粉色" }));
    expect(screen.getByRole("button", { name: "粉色" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ theme: "pink" });
    expect(onStateChange).not.toHaveBeenCalled();
    first.unmount();
    const second = render(<GoalioApp {...props} />);
    expect(screen.getByRole("button", { name: "粉色" })).toHaveAttribute("aria-pressed", "true");
    expect(second.container.querySelector(".app-shell")).toHaveAttribute("data-theme", "pink");
  });

  it("restores a local home background and resets only appearance", async () => {
    const user = userEvent.setup();
    localStorage.setItem(key, JSON.stringify({ theme: "matcha", background: image }));
    localStorage.setItem("goalio:v1", "business-data");
    const view = render(<GoalioApp initialState={readyState()} onStateChange={vi.fn()} />);
    const amount = view.container.querySelector(".hero-amount")?.textContent;
    expect(view.container.querySelector(".home-background")).toHaveStyle({ backgroundImage: `url("${image}")` });
    await user.click(screen.getByRole("button", { name: "设置" }));
    expect(view.container.querySelector(".home-background")).toBeNull();
    await user.click(screen.getByRole("button", { name: "恢复默认" }));
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem("goalio:v1")).toBe("business-data");
    expect(view.container.querySelector(".app-shell")).toHaveAttribute("data-theme", "default");
    await user.click(screen.getByRole("button", { name: "关闭设置" }));
    expect(view.container.querySelector(".home-background")).toBeNull();
    expect(view.container.querySelector(".hero-amount")?.textContent).toBe(amount);
  });

  it("reports a storage failure and keeps the last saved theme", async () => {
    const user = userEvent.setup();
    localStorage.setItem(key, JSON.stringify({ theme: "pink", background: null }));
    render(<GoalioApp initialState={{ ...readyState(), screen: "settings" }} onStateChange={vi.fn()} />);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    try {
      await user.click(screen.getByRole("button", { name: "淡蓝" }));
      expect(screen.getByRole("alert")).toHaveTextContent("存储空间");
      expect(screen.getByRole("button", { name: "粉色" })).toHaveAttribute("aria-pressed", "true");
    } finally { write.mockRestore(); }
  });

  it("ignores corrupt preferences and remote background URLs", () => {
    localStorage.setItem(key, JSON.stringify({ theme: "pink", background: "https://example.com/private.jpg" }));
    const view = render(<GoalioApp initialState={readyState()} onStateChange={vi.fn()} />);
    expect(view.container.querySelector(".home-background")).toBeNull();
    view.unmount();
    localStorage.setItem(key, "{broken");
    const recovered = render(<GoalioApp initialState={readyState()} onStateChange={vi.fn()} />);
    expect(recovered.container.querySelector(".app-shell")).toHaveAttribute("data-theme", "default");
  });

  it("rejects non-images without replacing the current local background", async () => {
    localStorage.setItem(key, JSON.stringify({ theme: "pink", background: image }));
    render(<GoalioApp initialState={{ ...readyState(), screen: "settings" }} onStateChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("选择首页背景图片"), { target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("图片");
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ background: image });
  });

  it("restores independent card images and removes only the selected card image", async () => {
    const user = userEvent.setup();
    localStorage.setItem(key, JSON.stringify({ theme: "pink", background: null, blocks: { goal: image, progress: image } }));
    const props = { initialState: readyState(), onStateChange: vi.fn() };
    const first = render(<GoalioApp {...props} />);
    const amount = first.container.querySelector(".hero-amount")?.textContent;
    expect(first.container.querySelector('[data-home-block="goal"] .card-background')).toHaveStyle({ backgroundImage: `url("${image}")` });
    expect(first.container.querySelector('[data-home-block="progress"] .card-background')).toHaveStyle({ backgroundImage: `url("${image}")` });
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "移除目标概览图片" }));
    first.unmount();
    const second = render(<GoalioApp {...props} />);
    expect(second.container.querySelector('[data-home-block="goal"] .card-background')).toBeNull();
    expect(second.container.querySelector('[data-home-block="progress"] .card-background')).toHaveStyle({ backgroundImage: `url("${image}")` });
    expect(second.container.querySelector(".hero-amount")?.textContent).toBe(amount);
    expect(props.onStateChange).toHaveBeenCalledTimes(1); // Opening settings is the only business-state change.
  });

  it("applies the five Hello Kitty backgrounds, retains financial values, and resets all appearance", async () => {
    const user = userEvent.setup();
    const view = render(<GoalioApp initialState={readyState()} onStateChange={vi.fn()} />);
    const amount = view.container.querySelector(".hero-amount")?.textContent;
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "使用 Hello Kitty 示例" }));
    const stored = JSON.parse(localStorage.getItem(key)!);
    expect(stored.theme).toBe("pink");
    expect(Object.keys(stored.blocks)).toHaveLength(5);
    expect(stored.blocks.goal).toBe("/themes/hello-kitty/goal.png");
    await user.click(screen.getByRole("button", { name: "关闭设置" }));
    expect(view.container.querySelectorAll(".card-background")).toHaveLength(5);
    expect(view.container.querySelector(".hero-amount")?.textContent).toBe(amount);
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "恢复默认" }));
    await user.click(screen.getByRole("button", { name: "关闭设置" }));
    expect(view.container.querySelectorAll(".card-background")).toHaveLength(0);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("rejects unsafe card sources without dropping other valid card images", () => {
    localStorage.setItem(key, JSON.stringify({ theme: "pink", blocks: {
      goal: "https://example.com/image.jpg", progress: image, completion: "data:image/svg+xml;base64,PHN2Zz4=", daily: "/unexpected.png",
    } }));
    const view = render(<GoalioApp initialState={readyState()} onStateChange={vi.fn()} />);
    expect(view.container.querySelectorAll(".card-background")).toHaveLength(1);
    expect(view.container.querySelector('[data-home-block="progress"] .card-background')).toHaveStyle({ backgroundImage: `url("${image}")` });
  });

  it("keeps saved card backgrounds when local storage cannot save a replacement", async () => {
    const user = userEvent.setup();
    localStorage.setItem(key, JSON.stringify({ theme: "matcha", blocks: { goal: image } }));
    const view = render(<GoalioApp initialState={{ ...readyState(), screen: "settings" }} onStateChange={vi.fn()} />);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    try {
      await user.click(screen.getByRole("button", { name: "使用 Hello Kitty 示例" }));
      expect(screen.getByRole("alert")).toHaveTextContent("存储空间");
      await user.click(screen.getByRole("button", { name: "关闭设置" }));
      expect(view.container.querySelector('[data-home-block="goal"] .card-background')).toHaveStyle({ backgroundImage: `url("${image}")` });
      expect(view.container.querySelectorAll(".card-background")).toHaveLength(1);
      expect(view.container.querySelector(".app-shell")).toHaveAttribute("data-theme", "matcha");
    } finally { write.mockRestore(); }
  });
});
