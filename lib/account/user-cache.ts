import { isGoalioState } from "@/lib/storage/schema";
import type { UserCacheEnvelope } from "./contracts";

export type CacheWriteResult = { ok: true } | { ok: false; message: string };

export function cacheKey(userId: string) {
  return `goalio:user:${userId}:v1`;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function isUserCacheEnvelope(value: unknown): value is UserCacheEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<UserCacheEnvelope>;
  return isGoalioState(envelope.state)
    && isIsoTimestamp(envelope.savedAt)
    && typeof envelope.pendingSync === "boolean";
}

export function readUserCache(storage: Storage, userId: string): UserCacheEnvelope | null {
  const raw = storage.getItem(cacheKey(userId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isUserCacheEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeUserCache(storage: Storage, userId: string, envelope: UserCacheEnvelope): CacheWriteResult {
  try {
    storage.setItem(cacheKey(userId), JSON.stringify(envelope));
    return { ok: true };
  } catch {
    return { ok: false, message: "数据暂时没有保存在这台设备上，请检查浏览器存储空间。" };
  }
}

export function clearUserCache(storage: Storage, userId: string) {
  storage.removeItem(cacheKey(userId));
}
