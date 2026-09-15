import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cents } from "@/lib/domain/money";
import { createInitialState, type GoalioState, type ScreenName } from "@/lib/storage/schema";
import type { AccountUser, AuthGateway, CloudStateGateway, CloudStateRecord } from "@/lib/account/contracts";
import { readUserCache, writeUserCache } from "@/lib/account/user-cache";
import { GoalioAccountApp } from "./GoalioAccountApp";

const userA: AccountUser = { id: "user-a", email: "person@example.com" };

function readyState(screen: ScreenName = "home"): GoalioState {
  const state = createInitialState();
  state.screen = screen;
  state.onboarded = true;
  state.plan.goal = { name: "旅行", amount: cents(100000), deadline: "2026-12-31" };
  state.lastResult = { date: "2026-09-15", balance: state.balance, effectiveSaved: cents(10000) };
  return state;
}

type FakeServiceOptions = {
  currentUser?: AccountUser | null;
  signUpUser?: AccountUser;
  cloudState?: CloudStateRecord | null;
  failSaves?: number;
  saveAlwaysFails?: boolean;
};

function fakeServices(options: FakeServiceOptions = {}) {
  let remainingFailures = options.failSaves ?? 0;
  const auth = {
    currentUser: vi.fn(async () => options.currentUser ?? null),
    signUp: vi.fn(async () => options.signUpUser ?? userA),
    signIn: vi.fn(async () => options.signUpUser ?? userA),
    signOutCurrentDevice: vi.fn(async () => undefined),
    onChange: vi.fn(() => () => undefined),
  } satisfies AuthGateway;
  const cloud = {
    load: vi.fn(async () => options.cloudState ?? null),
    save: vi.fn(async () => {
      if (options.saveAlwaysFails || remainingFailures-- > 0) throw new Error("CLOUD_SAVE_FAILED");
      return { updatedAt: "2026-09-15T10:05:00.000Z" };
    }),
  } satisfies CloudStateGateway;
  return { auth, cloud };
}

describe("GoalioAccountApp", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("shows login when no persistent session exists", async () => {
    render(<GoalioAccountApp services={fakeServices({ currentUser: null })} storage={localStorage} />);
    expect(await screen.findByRole("heading", { name: "建立你的 Goalio 账号" })).toBeVisible();
  });

  it("shows a configuration error without starting the business UI", async () => {
    render(<GoalioAccountApp services={null} storage={localStorage} />);
    expect(await screen.findByRole("heading", { name: "账号服务尚未配置" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "开始设置" })).not.toBeInTheDocument();
  });

  it("registers a new user and opens first setup", async () => {
    const user = userEvent.setup();
    render(<GoalioAccountApp services={fakeServices({ signUpUser: userA, cloudState: null })} storage={localStorage} />);
    await user.type(await screen.findByLabelText("邮箱"), "person@example.com");
    await user.type(screen.getByLabelText("密码"), "safe-pass-123");
    await user.type(screen.getByLabelText("确认密码"), "safe-pass-123");
    await user.click(screen.getByRole("button", { name: "创建账号" }));

    expect(await screen.findByRole("button", { name: "开始设置" })).toBeVisible();
    expect(readUserCache(localStorage, "user-a")?.state.screen).toBe("welcome");
  });

  it("restores a returning user's cloud state without showing auth", async () => {
    const state = readyState();
    render(<GoalioAccountApp services={fakeServices({ currentUser: userA, cloudState: { state, updatedAt: "2026-09-15T10:00:00.000Z" } })} storage={localStorage} />);

    expect(await screen.findByText(/正在为/)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "建立你的 Goalio 账号" })).not.toBeInTheDocument();
    expect(screen.queryByText("已同步")).not.toBeInTheDocument();
  });

  it("offers retry when cloud and cache are both unavailable", async () => {
    const services = fakeServices({ currentUser: userA });
    services.cloud.load.mockRejectedValueOnce(new Error("offline"));
    render(<GoalioAccountApp services={services} storage={localStorage} />);

    expect(await screen.findByRole("heading", { name: "暂时无法读取你的资料" })).toBeVisible();
    expect(screen.getByRole("button", { name: "重新读取" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "开始设置" })).not.toBeInTheDocument();
  });

  it("keeps offline edits and retries when the browser returns online", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const state = readyState();
    const services = fakeServices({ currentUser: userA, cloudState: { state, updatedAt: "2026-09-15T10:00:00.000Z" } });
    render(<GoalioAccountApp services={services} storage={localStorage} />);

    await user.click(await screen.findByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "重新安排" }));
    expect(await screen.findByText("等待同步")).toBeVisible();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(services.cloud.save).toHaveBeenCalled());
    expect(screen.queryByText("等待同步")).not.toBeInTheDocument();
    expect(screen.queryByText("已同步")).not.toBeInTheDocument();
  });

  it("does not sign out while the latest local change cannot sync", async () => {
    const user = userEvent.setup();
    const state = readyState("settings");
    writeUserCache(localStorage, "user-a", { state, savedAt: "2026-09-15T10:01:00.000Z", pendingSync: true });
    const services = fakeServices({ currentUser: userA, cloudState: { state, updatedAt: "2026-09-15T10:00:00.000Z" }, saveAlwaysFails: true });
    render(<GoalioAccountApp services={services} storage={localStorage} />);

    await user.click(await screen.findByRole("button", { name: "退出登录" }));

    expect(await screen.findByText("资料尚未同步，请联网后再退出。")).toBeVisible();
    expect(services.auth.signOutCurrentDevice).not.toHaveBeenCalled();
    expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(true);
  });

  it("clears only the current user's cache after successful local sign-out", async () => {
    const user = userEvent.setup();
    const state = readyState("settings");
    const userBCache = { state: createInitialState(), savedAt: "2026-09-15T09:00:00.000Z", pendingSync: false };
    writeUserCache(localStorage, "user-b", userBCache);
    const services = fakeServices({ currentUser: userA, cloudState: { state, updatedAt: "2026-09-15T10:00:00.000Z" } });
    render(<GoalioAccountApp services={services} storage={localStorage} />);

    await user.click(await screen.findByRole("button", { name: "退出登录" }));

    expect(await screen.findByRole("heading", { name: "建立你的 Goalio 账号" })).toBeVisible();
    expect(readUserCache(localStorage, "user-a")).toBeNull();
    expect(readUserCache(localStorage, "user-b")).toEqual(userBCache);
  });
});
