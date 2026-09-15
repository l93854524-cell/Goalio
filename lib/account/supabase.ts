import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { isGoalioState, type GoalioState } from "@/lib/storage/schema";
import type { AccountUser, AuthGateway, CloudStateGateway } from "./contracts";

export class AccountServiceError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AccountServiceError";
  }
}

function fail(error: { code?: string } | null, fallback: string): never {
  throw new AccountServiceError(error?.code ?? fallback);
}

function accountUser(user: User): AccountUser {
  if (!user.email) throw new AccountServiceError("ACCOUNT_EMAIL_MISSING");
  return { id: user.id, email: user.email };
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function createSupabaseGateways(client: SupabaseClient): { auth: AuthGateway; cloud: CloudStateGateway } {
  const auth: AuthGateway = {
    async currentUser() {
      const { data, error } = await client.auth.getUser();
      if (error?.name === "AuthSessionMissingError") return null;
      if (error) fail(error, "AUTH_SESSION_FAILED");
      return data.user ? accountUser(data.user) : null;
    },

    async signUp(credentials) {
      const { data, error } = await client.auth.signUp(credentials);
      if (error) fail(error, "AUTH_SIGNUP_FAILED");
      if (data.user?.identities?.length === 0) throw new AccountServiceError("user_already_exists");
      if (!data.session) throw new AccountServiceError("EMAIL_CONFIRMATION_ENABLED");
      if (!data.user) throw new AccountServiceError("AUTH_SIGNUP_FAILED");
      return accountUser(data.user);
    },

    async signIn(credentials) {
      const { data, error } = await client.auth.signInWithPassword(credentials);
      if (error) fail(error, "AUTH_SIGNIN_FAILED");
      if (!data.user) throw new AccountServiceError("AUTH_SIGNIN_FAILED");
      return accountUser(data.user);
    },

    async signOutCurrentDevice() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) fail(error, "AUTH_SIGNOUT_FAILED");
    },

    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        const user = session?.user;
        listener(user?.email ? { id: user.id, email: user.email } : null);
      });
      return () => data.subscription.unsubscribe();
    },
  };

  const cloud: CloudStateGateway = {
    async load(userId) {
      const { data, error } = await client
        .from("goalio_states")
        .select("state_version,state,updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) fail(error, "CLOUD_LOAD_FAILED");
      if (!data) return null;
      if (data.state_version !== 1 || !isGoalioState(data.state) || !isTimestamp(data.updated_at)) {
        throw new AccountServiceError("CLOUD_STATE_INVALID");
      }
      return { state: data.state, updatedAt: data.updated_at };
    },

    async save(userId, state: GoalioState) {
      const { data, error } = await client
        .from("goalio_states")
        .upsert({
          user_id: userId,
          state_version: state.version,
          state,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" })
        .select("updated_at")
        .single();
      if (error) fail(error, "CLOUD_SAVE_FAILED");
      if (!data || !isTimestamp(data.updated_at)) throw new AccountServiceError("CLOUD_SAVE_FAILED");
      return { updatedAt: data.updated_at };
    },
  };

  return { auth, cloud };
}

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function createBrowserSupabaseGateways() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  const client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return createSupabaseGateways(client);
}
