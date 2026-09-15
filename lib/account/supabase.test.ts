import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/lib/storage/schema";
import { createSupabaseGateways } from "./supabase";

type FakeOptions = {
  row?: unknown;
  user?: { id: string; email: string; identities?: unknown[] } | null;
  session?: object | null;
  onSignOut?: (options: { scope: "local" }) => void;
  onUpsert?: (payload: unknown) => void;
  unsubscribe?: () => void;
};

function fakeSupabase(options: FakeOptions = {}) {
  const user = options.user ?? null;
  const session = Object.prototype.hasOwnProperty.call(options, "session") ? options.session : {};
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
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      signUp: vi.fn(async () => ({ data: { user, session }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { user, session }, error: null })),
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

describe("Supabase account gateways", () => {
  it("signs out only the current device", async () => {
    const calls: unknown[] = [];
    const { auth } = createSupabaseGateways(fakeSupabase({ onSignOut: options => calls.push(options) }));

    await auth.signOutCurrentDevice();

    expect(calls).toEqual([{ scope: "local" }]);
  });

  it("unsubscribes from provider auth changes", () => {
    const unsubscribe = vi.fn();
    const { auth } = createSupabaseGateways(fakeSupabase({ unsubscribe }));

    const stop = auth.onChange(vi.fn());
    stop();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("requires registration to return an immediate session", async () => {
    const client = fakeSupabase({ user: { id: "user-a", email: "person@example.com", identities: [{}] }, session: null });
    const { auth } = createSupabaseGateways(client);

    await expect(auth.signUp({ email: "person@example.com", password: "safe-pass-123" }))
      .rejects.toMatchObject({ code: "EMAIL_CONFIRMATION_ENABLED" });
  });

  it("detects a duplicate registration response", async () => {
    const client = fakeSupabase({ user: { id: "user-a", email: "person@example.com", identities: [] } });
    const { auth } = createSupabaseGateways(client);

    await expect(auth.signUp({ email: "person@example.com", password: "safe-pass-123" }))
      .rejects.toMatchObject({ code: "user_already_exists" });
  });

  it("upserts only the signed-in user's versioned state", async () => {
    const payloads: unknown[] = [];
    const { cloud } = createSupabaseGateways(fakeSupabase({ onUpsert: payload => payloads.push(payload) }));

    await cloud.save("user-a", createInitialState());

    expect(payloads).toEqual([expect.objectContaining({ user_id: "user-a", state_version: 1 })]);
  });

  it("rejects malformed cloud state before the business UI sees it", async () => {
    const row = { user_id: "user-a", state_version: 1, state: { version: 1 }, updated_at: "2026-09-15T10:00:00.000Z" };
    const { cloud } = createSupabaseGateways(fakeSupabase({ row }));

    await expect(cloud.load("user-a")).rejects.toMatchObject({ code: "CLOUD_STATE_INVALID" });
  });
});
