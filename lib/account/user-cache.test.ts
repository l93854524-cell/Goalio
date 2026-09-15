import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/storage/schema";
import { clearUserCache, readUserCache, writeUserCache } from "./user-cache";

describe("user cache", () => {
  beforeEach(() => localStorage.clear());

  it("keeps two users in separate cache entries", () => {
    const a = { ...createInitialState(), balance: 100 };
    const b = { ...createInitialState(), balance: 200 };
    writeUserCache(localStorage, "user-a", { state: a, savedAt: "2026-09-15T10:00:00.000Z", pendingSync: true });
    writeUserCache(localStorage, "user-b", { state: b, savedAt: "2026-09-15T10:01:00.000Z", pendingSync: false });

    expect(readUserCache(localStorage, "user-a")?.state.balance).toBe(100);
    expect(readUserCache(localStorage, "user-b")?.state.balance).toBe(200);
  });

  it("clears only the signed-out user's cache", () => {
    const envelope = { state: createInitialState(), savedAt: "2026-09-15T10:00:00.000Z", pendingSync: false };
    writeUserCache(localStorage, "user-a", envelope);
    writeUserCache(localStorage, "user-b", envelope);

    clearUserCache(localStorage, "user-a");

    expect(readUserCache(localStorage, "user-a")).toBeNull();
    expect(readUserCache(localStorage, "user-b")).toEqual(envelope);
  });

  it("ignores corrupt or structurally invalid cache data", () => {
    localStorage.setItem("goalio:user:user-a:v1", "{");
    expect(readUserCache(localStorage, "user-a")).toBeNull();

    localStorage.setItem("goalio:user:user-a:v1", JSON.stringify({
      state: { version: 1 },
      savedAt: "yesterday",
      pendingSync: "yes",
    }));
    expect(readUserCache(localStorage, "user-a")).toBeNull();
  });

  it("returns a save error without erasing an existing envelope", () => {
    const envelope = { state: createInitialState(), savedAt: "2026-09-15T10:00:00.000Z", pendingSync: false };
    const storage = {
      getItem: () => JSON.stringify(envelope),
      setItem: () => { throw new Error("quota"); },
      removeItem: () => undefined,
    } as unknown as Storage;

    expect(writeUserCache(storage, "user-a", { ...envelope, pendingSync: true })).toEqual({
      ok: false,
      message: "数据暂时没有保存在这台设备上，请检查浏览器存储空间。",
    });
    expect(readUserCache(storage, "user-a")).toEqual(envelope);
  });
});
