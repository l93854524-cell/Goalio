import type { GoalioState } from "@/lib/storage/schema";

export type AccountUser = { id: string; email: string };
export type Credentials = { email: string; password: string };
export type SyncStatus = "synced" | "pending" | "failed";

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
