import { createInitialState, type GoalioState } from "@/lib/storage/schema";
import type { CloudStateGateway, SyncStatus } from "./contracts";
import { readUserCache, writeUserCache } from "./user-cache";

export class AccountSyncError extends Error {
  constructor(public readonly code: "INITIAL_STATE_UNAVAILABLE") {
    super(code);
    this.name = "AccountSyncError";
  }
}

type SyncOptions = {
  cloud: CloudStateGateway;
  storage: Storage;
  userId: string;
  now?: () => string;
  isOnline?: () => boolean;
  debounceMs?: number;
  onStatusChange?: (status: SyncStatus) => void;
};

export class GoalioSyncCoordinator {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private generation = 0;
  private disposed = false;
  private statusValue: SyncStatus = "synced";

  constructor(private readonly options: SyncOptions) {}

  get status() {
    return this.statusValue;
  }

  async hydrate(): Promise<{ state: GoalioState; status: SyncStatus }> {
    const cached = readUserCache(this.options.storage, this.options.userId);
    let remote;

    try {
      remote = await this.options.cloud.load(this.options.userId);
    } catch {
      if (!cached) throw new AccountSyncError("INITIAL_STATE_UNAVAILABLE");
      this.writePending(cached.state, cached.savedAt);
      return { state: cached.state, status: this.status };
    }

    if (cached?.pendingSync && (!remote || cached.savedAt > remote.updatedAt)) {
      this.setStatus("pending");
      try {
        await this.flush();
      } catch {
        // The local copy remains usable and pending for a later retry.
      }
      return { state: cached.state, status: this.status };
    }

    if (remote) {
      this.writeSynced(remote.state, remote.updatedAt);
      return { state: remote.state, status: this.status };
    }

    if (cached) {
      this.writePending(cached.state, cached.savedAt);
      try {
        await this.flush();
      } catch {
        // The cache retains the state until connectivity recovers.
      }
      return { state: cached.state, status: this.status };
    }

    const state = createInitialState();
    this.generation += 1;
    this.writePending(state, this.now());
    try {
      await this.flush();
    } catch {
      // First-run data remains in the device cache for retry.
    }
    return { state, status: this.status };
  }

  record(state: GoalioState) {
    this.generation += 1;
    this.writePending(state, this.now());
    if (this.online()) this.schedule();
  }

  async flush(): Promise<void> {
    this.clearTimer();
    if (this.inFlight) return this.inFlight;

    const cached = readUserCache(this.options.storage, this.options.userId);
    if (!cached?.pendingSync) {
      this.setStatus("synced");
      return;
    }
    if (!this.online()) {
      this.setStatus("pending");
      return;
    }

    const generation = this.generation;
    const pending = this.options.cloud.save(this.options.userId, cached.state)
      .then(({ updatedAt }) => {
        if (generation === this.generation) {
          const latest = readUserCache(this.options.storage, this.options.userId);
          if (latest?.pendingSync) this.writeSynced(latest.state, updatedAt);
          return;
        }
        this.setStatus("pending");
        if (this.online()) this.schedule();
      })
      .catch((error: unknown) => {
        this.setStatus("failed");
        throw error;
      })
      .finally(() => {
        this.inFlight = null;
      });

    this.inFlight = pending;
    return pending;
  }

  dispose() {
    this.disposed = true;
    this.clearTimer();
  }

  private writePending(state: GoalioState, savedAt: string) {
    const result = writeUserCache(this.options.storage, this.options.userId, {
      state,
      savedAt,
      pendingSync: true,
    });
    this.setStatus(result.ok ? "pending" : "failed");
  }

  private writeSynced(state: GoalioState, savedAt: string) {
    const result = writeUserCache(this.options.storage, this.options.userId, {
      state,
      savedAt,
      pendingSync: false,
    });
    this.setStatus(result.ok ? "synced" : "failed");
  }

  private schedule() {
    this.clearTimer();
    if (this.disposed) return;
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, this.options.debounceMs ?? 500);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private online() {
    return this.options.isOnline?.() ?? true;
  }

  private now() {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private setStatus(status: SyncStatus) {
    if (this.statusValue === status) return;
    this.statusValue = status;
    this.options.onStatusChange?.(status);
  }
}
