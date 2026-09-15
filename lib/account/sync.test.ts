import { beforeEach, describe, expect, it, vi } from "vitest";
import { cents } from "@/lib/domain/money";
import { createInitialState, type GoalioState } from "@/lib/storage/schema";
import type { CloudStateGateway, CloudStateRecord, SyncStatus } from "./contracts";
import { GoalioSyncCoordinator } from "./sync";
import { readUserCache, writeUserCache } from "./user-cache";

const fixedClock = () => "2026-09-15T10:03:00.000Z";

function memoryCloud(initial: CloudStateRecord | null, failSaves = 0) {
  let remainingFailures = failSaves;
  const savedStates: GoalioState[] = [];
  return {
    savedStates,
    load: vi.fn(async () => initial),
    save: vi.fn(async (_userId: string, state: GoalioState) => {
      if (remainingFailures-- > 0) throw new Error("CLOUD_SAVE_FAILED");
      savedStates.push(state);
      return { updatedAt: fixedClock() };
    }),
  } satisfies CloudStateGateway & { savedStates: GoalioState[] };
}

function failingCloud(): CloudStateGateway {
  return {
    load: vi.fn(async () => { throw new Error("CLOUD_LOAD_FAILED"); }),
    save: vi.fn(async () => { throw new Error("CLOUD_SAVE_FAILED"); }),
  };
}

function deferredCloud(initial: CloudStateRecord) {
  let resolveFirst: ((value: { updatedAt: string }) => void) | undefined;
  const cloud: CloudStateGateway = {
    load: vi.fn(async () => initial),
    save: vi.fn(async () => new Promise<{ updatedAt: string }>(resolve => { resolveFirst = resolve; })),
  };
  return {
    cloud,
    resolveFirst(updatedAt: string) {
      if (!resolveFirst) throw new Error("save has not started");
      resolveFirst({ updatedAt });
    },
  };
}

describe("GoalioSyncCoordinator", () => {
  beforeEach(() => localStorage.clear());

  it("uses a newer pending local state and uploads it", async () => {
    const local = { ...createInitialState(), balance: cents(200) };
    writeUserCache(localStorage, "user-a", { state: local, savedAt: "2026-09-15T10:01:00.000Z", pendingSync: true });
    const cloud = memoryCloud({ state: { ...createInitialState(), balance: cents(100) }, updatedAt: "2026-09-15T10:00:00.000Z" });
    const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });

    expect((await coordinator.hydrate()).state.balance).toBe(cents(200));
    expect(cloud.savedStates.at(-1)?.balance).toBe(cents(200));
  });

  it("uses valid local data when cloud loading fails", async () => {
    writeUserCache(localStorage, "user-a", { state: createInitialState(), savedAt: "2026-09-15T10:00:00.000Z", pendingSync: false });
    const coordinator = new GoalioSyncCoordinator({ cloud: failingCloud(), storage: localStorage, userId: "user-a", now: fixedClock });

    expect((await coordinator.hydrate()).status).toBe("pending");
  });

  it("fails safely when cloud loading fails and no cache exists", async () => {
    const coordinator = new GoalioSyncCoordinator({ cloud: failingCloud(), storage: localStorage, userId: "user-a", now: fixedClock });

    await expect(coordinator.hydrate()).rejects.toMatchObject({ code: "INITIAL_STATE_UNAVAILABLE" });
  });

  it("keeps a newer cloud record when a pending cache is older", async () => {
    writeUserCache(localStorage, "user-a", { state: { ...createInitialState(), balance: cents(100) }, savedAt: "2026-09-15T09:00:00.000Z", pendingSync: true });
    const cloud = memoryCloud({ state: { ...createInitialState(), balance: cents(200) }, updatedAt: "2026-09-15T10:00:00.000Z" });
    const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });

    expect((await coordinator.hydrate()).state.balance).toBe(cents(200));
    expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(false);
  });

  it("creates an initial state when the account has no cloud row or cache", async () => {
    const cloud = memoryCloud(null);
    const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });

    expect((await coordinator.hydrate()).state.screen).toBe("welcome");
    expect(cloud.savedStates).toHaveLength(1);
  });

  it("writes cache before starting the cloud save", async () => {
    const cloud = memoryCloud({ state: createInitialState(), updatedAt: "2026-09-15T10:00:00.000Z" });
    const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });
    await coordinator.hydrate();

    coordinator.record({ ...createInitialState(), balance: cents(300) });

    expect(readUserCache(localStorage, "user-a")?.state.balance).toBe(cents(300));
    expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(true);
    expect(cloud.save).not.toHaveBeenCalled();
    await coordinator.flush();
    expect(cloud.save).toHaveBeenCalledOnce();
  });

  it("keeps a newer edit pending when an older request completes", async () => {
    const deferred = deferredCloud({ state: createInitialState(), updatedAt: "2026-09-15T10:00:00.000Z" });
    const coordinator = new GoalioSyncCoordinator({ cloud: deferred.cloud, storage: localStorage, userId: "user-a", now: fixedClock });
    await coordinator.hydrate();
    coordinator.record({ ...createInitialState(), balance: cents(300) });
    const first = coordinator.flush();

    coordinator.record({ ...createInitialState(), balance: cents(400) });
    deferred.resolveFirst("2026-09-15T10:02:00.000Z");
    await first;

    expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(true);
    expect(readUserCache(localStorage, "user-a")?.state.balance).toBe(cents(400));
    coordinator.dispose();
  });

  it("marks the matching latest state synced after retry", async () => {
    const statuses: SyncStatus[] = [];
    const cloud = memoryCloud({ state: createInitialState(), updatedAt: "2026-09-15T10:00:00.000Z" }, 1);
    const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock, onStatusChange: status => statuses.push(status) });
    await coordinator.hydrate();
    coordinator.record({ ...createInitialState(), balance: cents(500) });

    await expect(coordinator.flush()).rejects.toThrow();
    expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(true);
    await coordinator.flush();

    expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(false);
    expect(statuses).toContain("failed");
    expect(coordinator.status).toBe("synced");
  });

  it("keeps offline edits pending without starting a request", async () => {
    const cloud = memoryCloud({ state: createInitialState(), updatedAt: "2026-09-15T10:00:00.000Z" });
    const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock, isOnline: () => false });
    await coordinator.hydrate();

    coordinator.record({ ...createInitialState(), balance: cents(600) });
    await new Promise(resolve => window.setTimeout(resolve, 20));

    expect(coordinator.status).toBe("pending");
    expect(cloud.save).not.toHaveBeenCalled();
  });
});
