# Goalio Account and Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free email/password accounts so each new Goalio user stays signed in on the current device and can restore all Goalio data after signing in on another device.

**Architecture:** Keep the Next.js app as a GitHub Pages static export and use the browser Supabase client for authentication and row-protected cloud storage. A sync coordinator writes every change to a user-scoped local cache first, then debounces cloud writes and recovers pending offline changes without allowing an older cloud copy to overwrite them. The existing Goalio business UI becomes persistence-agnostic and receives initial state, save notifications, account identity, sync status, retry, and sign-out callbacks from an account gate.

**Tech Stack:** Next.js 16.3.4 static export, React 19.2.8, TypeScript 5.9, Supabase JavaScript 2.116, Postgres Row Level Security, Vitest 3.2, Testing Library 16.3, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-15-account-cloud-sync-design.md`

## Global Constraints

- Login uses email and a password of at least 8 characters.
- Registration signs the user in immediately; email confirmation and self-service password recovery stay disabled in this release.
- The current device keeps the session until the user signs out.
- A different device restores the complete cloud state after login.
- Only new-user account flows are supported; do not migrate `goalio:v1` data into an account.
- Local business caches are scoped by Supabase user ID and cleared for that user after successful sign-out.
- Every local change is saved before a cloud write is attempted.
- A pending local cache newer than the cloud record wins during startup and is uploaded again.
- Cloud access uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in browser code.
- `service_role`, database passwords, access tokens, user passwords, and financial values must never be logged.
- Row Level Security must restrict every row to `(select auth.uid()) = user_id`.
- Preserve the existing GitHub Pages static export and all current Goalio business behavior.
- Follow `AGENTS.md`: avoid the prohibited contrast sentence pattern in source copy, documentation, and commit messages.

---

## File Structure

- `lib/storage/schema.ts`: perform complete runtime validation of cloud and cache state.
- `lib/storage/schema.test.ts`: prove malformed nested state is rejected.
- `lib/account/contracts.ts`: define account, cloud record, cache, and sync interfaces shared by adapters and UI.
- `lib/account/user-cache.ts`: read, write, mark, and clear user-scoped local cache envelopes.
- `lib/account/user-cache.test.ts`: verify isolation, corruption recovery, pending state, and targeted removal.
- `lib/account/auth-errors.ts`: translate Supabase auth failures into safe Chinese product messages.
- `lib/account/auth-errors.test.ts`: verify stable error-code mapping without exposing provider details.
- `lib/account/supabase.ts`: create the configured browser client and adapt Auth/Data APIs to Goalio contracts.
- `lib/account/supabase.test.ts`: verify Goalio's boundary payloads and session scope with an external-client fake.
- `lib/account/sync.ts`: own startup conflict selection, local-first writes, debounced cloud saves, retries, and stale-write protection.
- `lib/account/sync.test.ts`: verify cloud/cache recovery and red-green sync behavior with real cache code.
- `features/account/AuthScreen.tsx`: render accessible registration and login forms.
- `features/account/AuthScreen.test.tsx`: cover validation, mode switching, submission state, and errors.
- `features/account/GoalioAccountApp.tsx`: restore auth, bootstrap a user's state, own the sync coordinator, and select auth/error/business screens.
- `features/account/GoalioAccountApp.test.tsx`: cover registration, persistent session, cross-device restore, offline fallback, retry, and sign-out.
- `features/app/GoalioApp.tsx`: accept state persistence and account controls from the account gate; show account and sync controls in settings.
- `features/app/GoalioApp.test.tsx`: adapt existing tests to injected persistence and add account-setting behavior.
- `app/page.tsx`: mount `GoalioAccountApp` as the production entry point.
- `app/globals.css`: style auth, startup, error, account, and sync-status UI within the existing visual system.
- `supabase/migrations/20260915000000_create_goalio_states.sql`: create the user-owned state table, grants, RLS policies, and timestamp trigger.
- `supabase/tests/goalio_states_rls.test.sql`: exercise anonymous denial and cross-user isolation against local Supabase.
- `.env.example`: document the two publishable build variables.
- `.gitignore`: keep local environment-value files out of version control.
- `.github/workflows/deploy-pages.yml`: inject both public Supabase values into the canonical Pages build.
- `.github/workflows/nextjs.yml`: inject the same values into the existing secondary Pages workflow so either build has identical behavior.
- `README.md`: document free Supabase setup, email-confirmation limitation, secrets, migration, and verification.
- `package.json`, `package-lock.json`: add `@supabase/supabase-js`.

---

### Task 1: Validate Remote State and Add User-Scoped Cache

**Files:**
- Create: `lib/storage/schema.test.ts`
- Modify: `lib/storage/schema.ts`
- Create: `lib/account/contracts.ts`
- Create: `lib/account/user-cache.ts`
- Create: `lib/account/user-cache.test.ts`

**Interfaces:**
- Produces: `AccountUser`, `AuthGateway`, `CloudStateRecord`, `CloudStateGateway`, `SyncStatus`, and `UserCacheEnvelope` types.
- Produces: `cacheKey(userId)`, `readUserCache(storage, userId)`, `writeUserCache(storage, userId, envelope)`, and `clearUserCache(storage, userId)`.
- Consumes: existing `GoalioState`, `createInitialState`, and `isGoalioState`.

- [ ] **Step 1: Write failing nested-state validation tests**

```ts
import { describe, expect, it } from "vitest";
import { createInitialState, isGoalioState } from "./schema";

describe("isGoalioState", () => {
  it("rejects a cloud state whose nested plan is malformed", () => {
    const state = createInitialState();
    expect(isGoalioState({ ...state, plan: { ...state.plan, expenses: "all" } })).toBe(false);
  });

  it("rejects a cloud state with an unknown screen", () => {
    expect(isGoalioState({ ...createInitialState(), screen: "admin" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the validation tests and confirm RED**

Run: `npm test -- lib/storage/schema.test.ts`

Expected: both tests fail because the current guard accepts any string screen and does not validate nested plan fields.

- [ ] **Step 3: Implement a complete `GoalioState` runtime guard**

Add focused helpers for records, integer-cent values, ISO date strings, cadences, scheduled amounts, fixed expenses, goals, balance snapshots, purchases, and the finite screen-name set. `isGoalioState` must validate every persisted field while continuing to accept the optional `lastChange` field from version 1.

```ts
const SCREENS = new Set<ScreenName>([
  "welcome", "invite", "income", "food", "expenses", "settings-expenses",
  "goal", "initial-balance", "daily-balance", "home", "purchase-input",
  "purchase-result", "settings", "complete", "post-purchase", "finished",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIntegerCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNonNegativeCents(value: unknown): value is Cents {
  return isIntegerCents(value) && value >= 0;
}
```

- [ ] **Step 4: Re-run validation tests and confirm GREEN**

Run: `npm test -- lib/storage/schema.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Write failing cache isolation tests**

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/storage/schema";
import { clearUserCache, readUserCache, writeUserCache } from "./user-cache";

describe("user cache", () => {
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
  });
});
```

- [ ] **Step 6: Run cache tests and confirm RED**

Run: `npm test -- lib/account/user-cache.test.ts`

Expected: the module cannot be resolved.

- [ ] **Step 7: Add account contracts and minimal cache implementation**

```ts
export type AccountUser = { id: string; email: string };
export type SyncStatus = "synced" | "pending" | "failed";
export type Credentials = { email: string; password: string };

export interface AuthGateway {
  currentUser(): Promise<AccountUser | null>;
  signUp(credentials: Credentials): Promise<AccountUser>;
  signIn(credentials: Credentials): Promise<AccountUser>;
  signOutCurrentDevice(): Promise<void>;
  onChange(listener: (user: AccountUser | null) => void): () => void;
}

export interface CloudStateRecord {
  state: GoalioState;
  updatedAt: string;
}

export interface CloudStateGateway {
  load(userId: string): Promise<CloudStateRecord | null>;
  save(userId: string, state: GoalioState): Promise<{ updatedAt: string }>;
}

export interface UserCacheEnvelope {
  state: GoalioState;
  savedAt: string;
  pendingSync: boolean;
}
```

Implement cache serialization with `try/catch`, the complete runtime guard, exact `savedAt` string validation, and a key based on the supplied user ID. Return `null` for corrupt values without touching any other storage key.

- [ ] **Step 8: Run the focused storage suite**

Run: `npm test -- lib/storage/schema.test.ts lib/storage/storage.test.ts lib/account/user-cache.test.ts`

Expected: all focused tests pass with no warnings.

- [ ] **Step 9: Commit**

```bash
git add lib/storage/schema.ts lib/storage/schema.test.ts lib/account/contracts.ts lib/account/user-cache.ts lib/account/user-cache.test.ts
git commit -m "feat: add user-scoped state cache"
```

---

### Task 2: Add Supabase Auth and Cloud-State Adapters

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/account/auth-errors.ts`
- Create: `lib/account/auth-errors.test.ts`
- Create: `lib/account/supabase.ts`
- Create: `lib/account/supabase.test.ts`

**Interfaces:**
- Consumes: `AuthGateway`, `CloudStateGateway`, `Credentials`, `AccountUser`, and `GoalioState`.
- Produces: `authErrorMessage(error)`, `hasSupabaseConfig()`, and `createSupabaseGateways()` returning `{ auth, cloud }`.

- [ ] **Step 1: Install the browser SDK**

Run: `npm install @supabase/supabase-js@^2.116.0`

Expected: dependency and lockfile update without peer-dependency warnings.

- [ ] **Step 2: Write failing safe-error mapping tests**

```ts
import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("maps duplicate registration to a login action", () => {
    expect(authErrorMessage({ code: "user_already_exists", message: "provider detail" }))
      .toBe("这个邮箱已经注册，请直接登录。");
  });

  it("uses one safe message for invalid login credentials", () => {
    expect(authErrorMessage({ code: "invalid_credentials", message: "user missing" }))
      .toBe("邮箱或密码不正确，请重新输入。");
  });

  it("does not expose an unknown provider message", () => {
    expect(authErrorMessage({ code: "unknown", message: "secret upstream text" }))
      .toBe("暂时无法连接账号服务，请稍后再试。");
  });
});
```

- [ ] **Step 3: Run error tests and confirm RED**

Run: `npm test -- lib/account/auth-errors.test.ts`

Expected: module cannot be resolved.

- [ ] **Step 4: Implement safe auth error mapping**

Map `user_already_exists`, `weak_password`, `invalid_credentials`, `over_request_rate_limit`, and `request_timeout` to fixed Chinese messages. Never concatenate the provider message into user-visible output or logs.

- [ ] **Step 5: Write failing adapter boundary tests**

Create this fake containing every Supabase method the adapter calls, then verify observable boundary behavior:

```ts
type FakeSupabaseOptions = {
  row?: unknown;
  onSignOut?: (options: { scope: "local" }) => void;
  onUpsert?: (payload: unknown) => void;
  unsubscribe?: () => void;
};

function fakeSupabase(options: FakeSupabaseOptions = {}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: options.row ?? null, error: null })),
    single: vi.fn(async () => ({ data: { updated_at: "2026-09-15T10:00:00.000Z" }, error: null })),
    upsert: vi.fn((payload: unknown) => {
      options.onUpsert?.(payload);
      return query;
    }),
  };
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      signOut: vi.fn(async (signOutOptions: { scope: "local" }) => {
        options.onSignOut?.(signOutOptions);
        return { error: null };
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: options.unsubscribe ?? vi.fn() } },
      })),
    },
    from: vi.fn(() => query),
  } as unknown as SupabaseClient;
}
```

```ts
it("signs out only the current device", async () => {
  const calls: unknown[] = [];
  const client = fakeSupabase({ onSignOut: options => calls.push(options) });
  const { auth } = createSupabaseGateways(client);
  await auth.signOutCurrentDevice();
  expect(calls).toEqual([{ scope: "local" }]);
});

it("unsubscribes from provider auth changes", () => {
  const unsubscribe = vi.fn();
  const client = fakeSupabase({ unsubscribe });
  const { auth } = createSupabaseGateways(client);
  const stop = auth.onChange(vi.fn());
  stop();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("upserts only the signed-in user's versioned state", async () => {
  const payloads: unknown[] = [];
  const client = fakeSupabase({ onUpsert: payload => payloads.push(payload) });
  const { cloud } = createSupabaseGateways(client);
  await cloud.save("user-a", createInitialState());
  expect(payloads).toEqual([expect.objectContaining({ user_id: "user-a", state_version: 1 })]);
});

it("rejects malformed cloud state before the business UI sees it", async () => {
  const client = fakeSupabase({ row: { user_id: "user-a", state_version: 1, state: { version: 1 }, updated_at: "2026-09-15T10:00:00.000Z" } });
  const { cloud } = createSupabaseGateways(client);
  await expect(cloud.load("user-a")).rejects.toThrow("CLOUD_STATE_INVALID");
});
```

- [ ] **Step 6: Run adapter tests and confirm RED**

Run: `npm test -- lib/account/supabase.test.ts`

Expected: missing adapter exports.

- [ ] **Step 7: Implement the browser client and adapters**

Use `createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })`. Read configuration lazily so `next build` can prerender without browser globals. `currentUser()` must call `auth.getUser()`. `signUp()` must require a returned session and throw a stable `EMAIL_CONFIRMATION_ENABLED` configuration error when the Supabase project still requires confirmation; also detect an empty `identities` array as an already-registered address. `onChange()` wraps `auth.onAuthStateChange`, converts Supabase users to `AccountUser`, and returns the subscription's unsubscribe callback.

Cloud reads must request `state_version,state,updated_at`, filter by the supplied `user_id`, and use `maybeSingle()`. Cloud saves must upsert `user_id`, `state_version`, `state`, and an ISO `updated_at`, then select the server-returned `updated_at`. Convert provider failures to typed internal errors without logging payloads.

- [ ] **Step 8: Run the adapter suite**

Run: `npm test -- lib/account/auth-errors.test.ts lib/account/supabase.test.ts`

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json lib/account/auth-errors.ts lib/account/auth-errors.test.ts lib/account/supabase.ts lib/account/supabase.test.ts
git commit -m "feat: connect account services to supabase"
```

---

### Task 3: Implement Local-First Sync Coordination

**Files:**
- Create: `lib/account/sync.ts`
- Create: `lib/account/sync.test.ts`

**Interfaces:**
- Consumes: `CloudStateGateway`, `GoalioState`, `SyncStatus`, and user-cache functions.
- Produces: `GoalioSyncCoordinator.status`, `.hydrate()`, `.record(state)`, `.flush()`, and `.dispose()`.

Use this exact public shape:

```ts
export interface GoalioSyncCoordinatorOptions {
  cloud: CloudStateGateway;
  storage: Storage;
  userId: string;
  now?: () => string;
  isOnline?: () => boolean;
  debounceMs?: number;
  onStatusChange?: (status: SyncStatus) => void;
}

export class GoalioSyncCoordinator {
  get status(): SyncStatus;
  hydrate(): Promise<{ state: GoalioState; status: SyncStatus }>;
  record(state: GoalioState): void;
  flush(): Promise<void>;
  dispose(): void;
}
```

- [ ] **Step 1: Write failing startup recovery tests**

Add these test-only gateways above the tests:

```ts
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
```

```ts
it("uses a newer pending local state and uploads it", async () => {
  const local = { ...createInitialState(), balance: 200 };
  writeUserCache(localStorage, "user-a", { state: local, savedAt: "2026-09-15T10:01:00.000Z", pendingSync: true });
  const cloud = memoryCloud({ state: { ...createInitialState(), balance: 100 }, updatedAt: "2026-09-15T10:00:00.000Z" });
  const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });
  expect((await coordinator.hydrate()).state.balance).toBe(200);
  expect(cloud.savedStates.at(-1)?.balance).toBe(200);
});

it("uses valid local data when cloud loading fails", async () => {
  writeUserCache(localStorage, "user-a", { state: createInitialState(), savedAt: "2026-09-15T10:00:00.000Z", pendingSync: false });
  const coordinator = new GoalioSyncCoordinator({ cloud: failingCloud(), storage: localStorage, userId: "user-a", now: fixedClock });
  expect((await coordinator.hydrate()).status).toBe("pending");
});

it("fails safely when cloud loading fails and no cache exists", async () => {
  const coordinator = new GoalioSyncCoordinator({ cloud: failingCloud(), storage: localStorage, userId: "user-a", now: fixedClock });
  await expect(coordinator.hydrate()).rejects.toThrow("INITIAL_STATE_UNAVAILABLE");
});

it("keeps a newer cloud record when a pending cache is older", async () => {
  writeUserCache(localStorage, "user-a", { state: { ...createInitialState(), balance: 100 }, savedAt: "2026-09-15T09:00:00.000Z", pendingSync: true });
  const cloud = memoryCloud({ state: { ...createInitialState(), balance: 200 }, updatedAt: "2026-09-15T10:00:00.000Z" });
  const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });
  expect((await coordinator.hydrate()).state.balance).toBe(200);
});

it("creates an initial state when the account has no cloud row or cache", async () => {
  const cloud = memoryCloud(null);
  const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });
  expect((await coordinator.hydrate()).state.screen).toBe("welcome");
  expect(cloud.savedStates).toHaveLength(1);
});
```

- [ ] **Step 2: Run startup tests and confirm RED**

Run: `npm test -- lib/account/sync.test.ts`

Expected: sync module cannot be resolved.

- [ ] **Step 3: Implement minimal hydrate behavior**

Return `{ state, status }`. Compare valid ISO timestamps only when `pendingSync` is true. Create and save `createInitialState()` when both sources are empty. Preserve cache and throw a stable error when neither source can be read.

- [ ] **Step 4: Re-run startup tests and confirm GREEN**

Run: `npm test -- lib/account/sync.test.ts`

Expected: startup cases pass.

- [ ] **Step 5: Add failing local-first, debounce, and stale-save tests**

```ts
it("writes cache before starting the cloud save", async () => {
  const cloud = memoryCloud({ state: createInitialState(), updatedAt: "2026-09-15T10:00:00.000Z" });
  const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });
  await coordinator.hydrate();
  coordinator.record({ ...createInitialState(), balance: 300 });
  expect(readUserCache(localStorage, "user-a")?.state.balance).toBe(300);
  expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(true);
  expect(cloud.save).not.toHaveBeenCalled();
  await coordinator.flush();
  expect(cloud.save).toHaveBeenCalledOnce();
});

it("keeps a newer edit pending when an older request completes", async () => {
  const deferred = deferredCloud({ state: createInitialState(), updatedAt: "2026-09-15T10:00:00.000Z" });
  const coordinator = new GoalioSyncCoordinator({ cloud: deferred.cloud, storage: localStorage, userId: "user-a", now: fixedClock });
  await coordinator.hydrate();
  coordinator.record({ ...createInitialState(), balance: 300 });
  const first = coordinator.flush();
  coordinator.record({ ...createInitialState(), balance: 400 });
  deferred.resolveFirst("2026-09-15T10:02:00.000Z");
  await first;
  expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(true);
  expect(readUserCache(localStorage, "user-a")?.state.balance).toBe(400);
});

it("marks the matching latest state synced after retry", async () => {
  const cloud = memoryCloud({ state: createInitialState(), updatedAt: "2026-09-15T10:00:00.000Z" }, 1);
  const coordinator = new GoalioSyncCoordinator({ cloud, storage: localStorage, userId: "user-a", now: fixedClock });
  await coordinator.hydrate();
  coordinator.record({ ...createInitialState(), balance: 500 });
  await expect(coordinator.flush()).rejects.toThrow();
  expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(true);
  await coordinator.flush();
  expect(readUserCache(localStorage, "user-a")?.pendingSync).toBe(false);
});
```

- [ ] **Step 6: Run the new sync tests and confirm RED**

Run: `npm test -- lib/account/sync.test.ts`

Expected: missing record/flush behavior or incorrect stale-write handling.

- [ ] **Step 7: Implement debounced sync with generation protection**

`record()` must write an envelope synchronously, update status to `pending`, increment a generation number, and reset a 500 ms timer when `isOnline()` is true. Offline edits remain pending without starting a request. `flush()` captures the generation and state; on success it clears `pendingSync` only when the current cache still matches the captured generation. A newer edit schedules another flush. On failure, keep the cache intact, set `failed`, and rethrow. `dispose()` clears timers without deleting data.

- [ ] **Step 8: Run the full coordinator suite**

Run: `npm test -- lib/account/sync.test.ts lib/account/user-cache.test.ts`

Expected: all tests pass with fake timers restored after every test.

- [ ] **Step 9: Commit**

```bash
git add lib/account/sync.ts lib/account/sync.test.ts
git commit -m "feat: add resilient goalio cloud sync"
```

---

### Task 4: Build the Registration and Login Screen

**Files:**
- Create: `features/account/AuthScreen.tsx`
- Create: `features/account/AuthScreen.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `Credentials` and a submit callback returning `Promise<void>`.
- Produces: `AuthScreen({ onSignUp, onSignIn })` with internal `signup | signin` mode.

- [ ] **Step 1: Write failing form behavior tests**

```tsx
it("submits a valid new account", async () => {
  const user = userEvent.setup();
  const onSignUp = vi.fn().mockResolvedValue(undefined);
  render(<AuthScreen onSignUp={onSignUp} onSignIn={vi.fn()} />);
  await user.type(screen.getByLabelText("邮箱"), "person@example.com");
  await user.type(screen.getByLabelText("密码"), "safe-pass-123");
  await user.type(screen.getByLabelText("确认密码"), "safe-pass-123");
  await user.click(screen.getByRole("button", { name: "创建账号" }));
  expect(onSignUp).toHaveBeenCalledWith({ email: "person@example.com", password: "safe-pass-123" });
});

it("blocks mismatched passwords without calling the account service", async () => {
  const user = userEvent.setup();
  const onSignUp = vi.fn();
  render(<AuthScreen onSignUp={onSignUp} onSignIn={vi.fn()} />);
  await user.type(screen.getByLabelText("邮箱"), "person@example.com");
  await user.type(screen.getByLabelText("密码"), "safe-pass-123");
  await user.type(screen.getByLabelText("确认密码"), "different-pass-456");
  await user.click(screen.getByRole("button", { name: "创建账号" }));
  expect(await screen.findByText("两次输入的密码不一致。")).toBeVisible();
  expect(onSignUp).not.toHaveBeenCalled();
});

it("switches to login and removes the confirmation field", async () => {
  const user = userEvent.setup();
  render(<AuthScreen onSignUp={vi.fn()} onSignIn={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "已有账号，直接登录" }));
  expect(screen.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  expect(screen.queryByLabelText("确认密码")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the auth-screen tests and confirm RED**

Run: `npm test -- features/account/AuthScreen.test.tsx`

Expected: module cannot be resolved.

- [ ] **Step 3: Implement the minimal accessible auth screen**

Use native `form`, `type="email"`, `type="password"`, `autoComplete="email"`, `autoComplete="new-password"` or `current-password`, inline `role="alert"`, and the existing `PressableButton`. Normalize email with `trim().toLowerCase()`. Keep the email after provider failure, clear both password fields, and disable all submission controls while pending. Include an accessible show/hide password button without changing the entered value.

- [ ] **Step 4: Add account-screen styling**

Add `.auth-screen`, `.auth-brand`, `.auth-form`, `.auth-field`, `.password-control`, `.form-error`, and `.auth-switch` rules. Match the existing 430 px column, system font, Apple blue, 44 px control minimum, reduced-motion behavior, and visible keyboard focus.

- [ ] **Step 5: Run component tests and lint the files**

Run: `npm test -- features/account/AuthScreen.test.tsx && npx eslint features/account/AuthScreen.tsx features/account/AuthScreen.test.tsx`

Expected: tests pass and lint reports zero errors.

- [ ] **Step 6: Commit**

```bash
git add features/account/AuthScreen.tsx features/account/AuthScreen.test.tsx app/globals.css
git commit -m "feat: add goalio account forms"
```

---

### Task 5: Make the Goalio Business UI Persistence-Agnostic

**Files:**
- Modify: `features/app/GoalioApp.tsx`
- Modify: `features/app/GoalioApp.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `initialState: GoalioState`, `onStateChange(state)`, and optional `account` controls.
- Produces: `GoalioAppProps` and settings UI for email, sync status, retry, and sign-out.

- [ ] **Step 1: Add a failing controlled-persistence test**

```tsx
it("reports business state changes to the account owner", async () => {
  const user = userEvent.setup();
  const onStateChange = vi.fn();
  render(<GoalioApp initialState={createInitialState()} onStateChange={onStateChange} />);
  await user.click(screen.getByRole("button", { name: "开始设置" }));
  await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ screen: "income" })));
});
```

Also add a test that the initial render does not immediately call `onStateChange`, preventing an empty startup write.

- [ ] **Step 2: Run the focused app tests and confirm RED**

Run: `npm test -- features/app/GoalioApp.test.tsx -t "reports business state changes|initial render"`

Expected: TypeScript/component failure because `GoalioApp` does not accept the new props.

- [ ] **Step 3: Convert `GoalioApp` to injected persistence**

```ts
export interface GoalioAccountControls {
  email: string;
  syncStatus: SyncStatus;
  signingOut: boolean;
  onRetrySync: () => void;
  onSignOut: () => void;
}

export interface GoalioAppProps {
  initialState: GoalioState;
  onStateChange: (state: GoalioState) => void;
  account?: GoalioAccountControls;
}
```

Initialize React state from `initialState`. Centralize all state transitions through one commit helper that updates React state and calls `onStateChange` with the exact next state. Remove browser storage reads/writes and hydration effects from production `GoalioApp`. Keep `needsDailyCheckIn` application on startup, but notify persistence only if it changes the screen.

- [ ] **Step 4: Adapt existing business tests without adding a production migration path**

Create a test-only renderer in `GoalioApp.test.tsx` that reads the existing `goalio:v1` fixtures, supplies them as `initialState`, and writes callback results back to the same test storage key. Mechanically replace direct `render(<GoalioApp />)` calls with the helper. This preserves the current test fixtures while the production entry point never reads `goalio:v1`.

- [ ] **Step 5: Add failing account-settings tests**

```tsx
it("shows the signed-in email and retries a failed sync", async () => {
  const user = userEvent.setup();
  const onRetrySync = vi.fn();
  renderReadyGoalio({ account: { email: "person@example.com", syncStatus: "failed", signingOut: false, onRetrySync, onSignOut: vi.fn() } });
  await user.click(screen.getByRole("button", { name: "设置" }));
  expect(screen.getByText("person@example.com")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "同步失败，点击重试" }));
  expect(onRetrySync).toHaveBeenCalledOnce();
});

it("requests sign-out from settings", async () => {
  const user = userEvent.setup();
  const onSignOut = vi.fn();
  renderReadyGoalio({ account: { email: "person@example.com", syncStatus: "synced", signingOut: false, onRetrySync: vi.fn(), onSignOut } });
  await user.click(screen.getByRole("button", { name: "设置" }));
  await user.click(screen.getByRole("button", { name: "退出登录" }));
  expect(onSignOut).toHaveBeenCalledOnce();
});
```

- [ ] **Step 6: Run account-settings tests and confirm RED**

Run: `npm test -- features/app/GoalioApp.test.tsx -t "signed-in email|sign-out"`

Expected: account controls are absent.

- [ ] **Step 7: Implement account settings and privacy copy**

Add an account section under the current settings list. Show fixed status labels: `已同步`, `等待同步`, and a retry button labeled `同步失败，点击重试`. Disable exit while its promise is pending. Update both balance and settings privacy copy to say that data is encrypted in transit, saved to the user's Goalio account, and cached on the current device.

- [ ] **Step 8: Run the complete existing Goalio component suite**

Run: `npm test -- features/app/GoalioApp.test.tsx`

Expected: all prior business tests plus new persistence/account tests pass.

- [ ] **Step 9: Commit**

```bash
git add features/app/GoalioApp.tsx features/app/GoalioApp.test.tsx app/globals.css
git commit -m "feat: connect goalio ui to account persistence"
```

---

### Task 6: Add the Account Gate and End-to-End Client Flow

**Files:**
- Create: `features/account/GoalioAccountApp.tsx`
- Create: `features/account/GoalioAccountApp.test.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `AuthGateway`, `CloudStateGateway`, `GoalioSyncCoordinator`, `AuthScreen`, and `GoalioApp`.
- Produces: the production `GoalioAccountApp` root and injectable `GoalioAccountAppProps` for tests.

```ts
export interface GoalioAccountServices {
  auth: AuthGateway;
  cloud: CloudStateGateway;
}

export interface GoalioAccountAppProps {
  services?: GoalioAccountServices | null;
  storage?: Storage;
}
```

An omitted `services` value creates the production Supabase gateways. An explicit `null` represents missing build configuration in tests.

- [ ] **Step 1: Write failing startup and registration integration tests**

Add these exact test helpers at the top of the file:

```tsx
const userA: AccountUser = { id: "user-a", email: "person@example.com" };

function readyState(screen: ScreenName = "home"): GoalioState {
  const state = createInitialState();
  state.screen = screen;
  state.onboarded = true;
  state.plan.goal = { name: "旅行", amount: 100000, deadline: "2026-12-31" };
  state.lastResult = { date: "2026-09-15", balance: state.balance, effectiveSaved: 10000 };
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
```

```tsx
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
  render(<GoalioAccountApp services={fakeServices({ signUpUser: { id: "user-a", email: "person@example.com" }, cloudState: null })} storage={localStorage} />);
  await user.type(await screen.findByLabelText("邮箱"), "person@example.com");
  await user.type(screen.getByLabelText("密码"), "safe-pass-123");
  await user.type(screen.getByLabelText("确认密码"), "safe-pass-123");
  await user.click(screen.getByRole("button", { name: "创建账号" }));
  expect(await screen.findByRole("button", { name: "开始设置" })).toBeVisible();
  expect(readUserCache(localStorage, "user-a")?.state.screen).toBe("welcome");
});

it("restores a returning user's cloud state without showing auth", async () => {
  const state = readyState();
  render(<GoalioAccountApp services={fakeServices({ currentUser: { id: "user-a", email: "person@example.com" }, cloudState: { state, updatedAt: "2026-09-15T10:00:00.000Z" } })} storage={localStorage} />);
  expect(await screen.findByText(/正在为/)).toBeVisible();
  expect(screen.queryByRole("heading", { name: "建立你的 Goalio 账号" })).not.toBeInTheDocument();
});

it("offers retry when cloud and cache are both unavailable", async () => {
  const services = fakeServices({ currentUser: userA });
  services.cloud.load.mockRejectedValueOnce(new Error("offline"));
  render(<GoalioAccountApp services={services} storage={localStorage} />);
  expect(await screen.findByRole("heading", { name: "暂时无法读取你的资料" })).toBeVisible();
  expect(screen.getByRole("button", { name: "重新读取" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "开始设置" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run startup tests and confirm RED**

Run: `npm test -- features/account/GoalioAccountApp.test.tsx`

Expected: account gate module cannot be resolved.

- [ ] **Step 3: Implement identity and startup phases**

Use explicit phase variants for `loading`, `signed-out`, `opening-user`, `ready`, `load-error`, and `configuration-error`. Never render `GoalioApp` until identity and user state are resolved. Registration and login pass the returned user into the same `openUser(user)` path. Subscribe through `auth.onChange`; a null user after token-refresh failure disposes the coordinator, clears that user's device cache, and returns to auth. Mount `GoalioApp` with `key={user.id}` so switching accounts cannot retain another user's React state.

- [ ] **Step 4: Add failing offline retry and safe sign-out tests**

```tsx
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
  expect(await screen.findByText("已同步")).toBeVisible();
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
```

- [ ] **Step 5: Run offline/sign-out tests and confirm RED**

Run: `npm test -- features/account/GoalioAccountApp.test.tsx -t "offline edits|does not sign out|clears only"`

Expected: retry listeners and safe sign-out behavior are missing.

- [ ] **Step 6: Complete synchronization lifecycle**

While `navigator.onLine` is false, keep edits pending and skip the debounce network call. On `online` and `focus`, retry only when the current coordinator reports pending or failed. Before sign-out, call `flush()`; if it fails, keep the user signed in and show the fixed warning. After a successful flush, call `signOutCurrentDevice()`, dispose the coordinator, clear that user's cache, and return to auth. Remove listeners and timers on unmount and account changes.

- [ ] **Step 7: Add startup and error-state styling**

Add `.startup-screen`, `.startup-mark`, `.account-error`, `.sync-banner`, and `.account-action-error` styles. Ensure status feedback uses text as well as color and remains readable at 320 px width.

- [ ] **Step 8: Switch the production page entry**

```tsx
import { GoalioAccountApp } from "@/features/account/GoalioAccountApp";

export default function HomePage() {
  return <GoalioAccountApp />;
}
```

- [ ] **Step 9: Run account and business component suites together**

Run: `npm test -- features/account/GoalioAccountApp.test.tsx features/account/AuthScreen.test.tsx features/app/GoalioApp.test.tsx`

Expected: all tests pass and no async state-update warnings appear.

- [ ] **Step 10: Commit**

```bash
git add features/account/GoalioAccountApp.tsx features/account/GoalioAccountApp.test.tsx app/page.tsx app/globals.css
git commit -m "feat: gate goalio behind persistent accounts"
```

---

### Task 7: Create the User-Owned Database Schema and RLS Tests

**Files:**
- Create: `supabase/migrations/20260915000000_create_goalio_states.sql`
- Create: `supabase/tests/goalio_states_rls.test.sql`

**Interfaces:**
- Consumes: Supabase Auth JWT `sub` through `auth.uid()`.
- Produces: authenticated-only `select`, `insert`, and `update` access to `public.goalio_states`.

- [ ] **Step 1: Write the pgTAP policy test first**

The SQL test creates two transaction-scoped auth users, sets `request.jwt.claim.sub`, switches roles, and proves the policies with literal user IDs:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

insert into public.goalio_states (user_id, state_version, state) values
  ('00000000-0000-0000-0000-00000000000a', 1, '{"owner":"a"}'::jsonb),
  ('00000000-0000-0000-0000-00000000000b', 1, '{"owner":"b"}'::jsonb);

set local role anon;
select throws_ok(
  $$ select count(*) from public.goalio_states $$,
  '42501',
  null,
  'anonymous visitors cannot read goalio state'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is((select count(*)::integer from public.goalio_states), 1, 'user A sees one row');
select is((select user_id::text from public.goalio_states), '00000000-0000-0000-0000-00000000000a', 'user A sees only its row');
select throws_ok(
  $$ insert into public.goalio_states (user_id, state_version, state) values ('00000000-0000-0000-0000-00000000000b', 1, '{}'::jsonb) $$,
  '42501',
  null,
  'user A cannot insert for user B'
);
select is(
  (with changed as (
    update public.goalio_states set state = '{"owner":"changed"}'::jsonb
    where user_id = '00000000-0000-0000-0000-00000000000b'
    returning 1
  ) select count(*)::integer from changed),
  0,
  'user A updates no user B rows'
);
select is(
  (with changed as (
    update public.goalio_states set state = '{"owner":"a-updated"}'::jsonb
    where user_id = '00000000-0000-0000-0000-00000000000a'
    returning 1
  ) select count(*)::integer from changed),
  1,
  'user A can update its own row'
);

reset role;
select is(
  (select state->>'owner' from public.goalio_states where user_id = '00000000-0000-0000-0000-00000000000b'),
  'b',
  'user B row stayed unchanged'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the policy test and confirm RED**

Run: `npx supabase@latest start && npx supabase@latest test db supabase/tests/goalio_states_rls.test.sql`

Expected: test fails because `public.goalio_states` does not exist. If Docker is unavailable, record that external prerequisite and continue writing the test without claiming it ran.

- [ ] **Step 3: Implement the minimal schema and policies**

```sql
create table public.goalio_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_version integer not null check (state_version > 0),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.goalio_states enable row level security;
revoke all on table public.goalio_states from anon, authenticated;
grant select, insert, update on table public.goalio_states to authenticated;

create policy "users_select_own_goalio_state"
on public.goalio_states for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_insert_own_goalio_state"
on public.goalio_states for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_update_own_goalio_state"
on public.goalio_states for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

Add a `before update` trigger that sets `updated_at = now()` with a function whose `search_path` is explicitly empty. Do not grant delete access in this release.

- [ ] **Step 4: Re-run the pgTAP policy test and confirm GREEN**

Run: `npx supabase@latest test db supabase/tests/goalio_states_rls.test.sql`

Expected: 6 assertions pass. Stop the local stack with `npx supabase@latest stop` after the test.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915000000_create_goalio_states.sql supabase/tests/goalio_states_rls.test.sql
git commit -m "feat: protect goalio state by user"
```

---

### Task 8: Configure GitHub Pages and Document Account Setup

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `.github/workflows/nextjs.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: GitHub repository secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Produces: a static bundle configured to call the public Supabase project.

- [ ] **Step 1: Add the exact environment example**

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Add `.env*.local` to `.gitignore` so local Supabase values cannot be committed accidentally.

- [ ] **Step 2: Inject configuration into both existing Pages build jobs**

Add these entries to each Next.js build step:

```yaml
env:
  PAGES_BASE_PATH: /Goalio
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
```

Preserve the current static artifact and deployment actions. Ensure the secondary workflow also receives `PAGES_BASE_PATH` so both workflows build the same URL shape.

- [ ] **Step 3: Update README setup and privacy documentation**

Document these exact operator steps: create a free Supabase project; run the committed migration; enable email/password; disable Confirm Email; add the GitHub Pages URL; create both repository secrets; deploy; test with two accounts. Explain the free-project inactivity pause and the lack of self-service password recovery. Replace the old local-only data statement with account cloud storage plus a user-scoped local cache.

- [ ] **Step 4: Verify no privileged secrets or old production storage path remain**

Run: `rg -n "service_role|SUPABASE_SERVICE|goalio:v1|只保存在这台设备" app features lib .github README.md .env.example`

Expected: `service_role` and `SUPABASE_SERVICE` have no matches; `goalio:v1` appears only in legacy storage tests/test helpers and never in `app/page.tsx` or `features/account`; old privacy copy has no production match.

- [ ] **Step 5: Run complete verification**

Run: `npm test`

Expected: all Vitest files pass with zero failures and no React act warnings.

Run: `npm run lint`

Expected: ESLint exits 0 with zero errors.

Run: `npm run build`

Expected: Next.js 16.3.4 static export exits 0 and writes `out/`.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 6: Perform the requirement checklist**

Confirm each item against the spec: new registration; persistent same-device session; cloud restore; account isolation; local-first save; offline retry; safe startup; local-only sign-out; updated privacy copy; zero-cost limitations; static export; environment documentation. Record any external Supabase or Docker checks that could not run and do not describe them as passing.

- [ ] **Step 7: Commit**

```bash
git add .env.example .gitignore .github/workflows/deploy-pages.yml .github/workflows/nextjs.yml README.md
git commit -m "docs: configure goalio account deployment"
```
