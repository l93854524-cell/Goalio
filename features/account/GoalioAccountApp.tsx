"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CloudArrowUp, WarningCircle } from "@phosphor-icons/react";
import type { AccountUser, AuthGateway, CloudStateGateway, Credentials, SyncStatus } from "@/lib/account/contracts";
import { authErrorMessage } from "@/lib/account/auth-errors";
import { createBrowserSupabaseGateways } from "@/lib/account/supabase";
import { GoalioSyncCoordinator } from "@/lib/account/sync";
import { clearUserCache } from "@/lib/account/user-cache";
import type { GoalioState } from "@/lib/storage/schema";
import { AuthScreen } from "./AuthScreen";

const GoalioApp = lazy(() => import("@/features/app/GoalioApp").then(module => ({ default: module.GoalioApp })));

export interface GoalioAccountServices {
  auth: AuthGateway;
  cloud: CloudStateGateway;
}

export interface GoalioAccountAppProps {
  services?: GoalioAccountServices | null;
  storage?: Storage;
}

type Phase = "loading" | "signed-out" | "opening-user" | "ready" | "load-error" | "configuration-error";

function StartupScreen({ error, retry }: { error?: "configuration" | "load"; retry?: () => void }) {
  if (error === "configuration") {
    return (
      <main className="screen startup-screen account-error">
        <div className="startup-mark">goalio</div>
        <h1>账号服务尚未配置</h1>
        <p>请先补充公开的 Supabase 项目地址和发布密钥，再重新构建网站。</p>
      </main>
    );
  }
  if (error === "load") {
    return (
      <main className="screen startup-screen account-error">
        <div className="startup-mark">goalio</div>
        <h1>暂时无法读取你的资料</h1>
        <p>请检查网络连接后重新读取。已有资料会继续安全保留。</p>
        <button className="pressable-button" onClick={retry}>重新读取</button>
      </main>
    );
  }
  return (
    <main className="screen startup-screen" aria-live="polite">
      <div className="startup-mark">goalio</div>
      <p>正在打开你的资料…</p>
    </main>
  );
}

function mappedAuthError(error: unknown) {
  return authErrorMessage(typeof error === "object" && error !== null ? error as { code?: string } : null);
}

export function GoalioAccountApp({ services, storage }: GoalioAccountAppProps) {
  const [resolvedServices] = useState<GoalioAccountServices | null>(() => services === undefined ? createBrowserSupabaseGateways() : services);
  const [phase, setPhase] = useState<Phase>(resolvedServices ? "loading" : "configuration-error");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [initialState, setInitialState] = useState<GoalioState | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [appStateRevision, setAppStateRevision] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [actionError, setActionError] = useState("");
  const coordinatorRef = useRef<GoalioSyncCoordinator | null>(null);
  const activeUserRef = useRef<AccountUser | null>(null);
  const remoteStateRef = useRef<GoalioState | null>(null);
  const requestRef = useRef(0);
  const deviceStorage = storage ?? (typeof window === "undefined" ? null : window.localStorage);

  const closeUser = useCallback(() => {
    requestRef.current += 1;
    const current = activeUserRef.current;
    coordinatorRef.current?.dispose();
    coordinatorRef.current = null;
    if (current && deviceStorage) clearUserCache(deviceStorage, current.id);
    activeUserRef.current = null;
    remoteStateRef.current = null;
    setUser(null);
    setInitialState(null);
    setAppStateRevision(0);
    setActionError("");
    setPhase("signed-out");
  }, [deviceStorage]);

  const openUser = useCallback(async (nextUser: AccountUser) => {
    if (!resolvedServices || !deviceStorage) return;
    const request = ++requestRef.current;
    coordinatorRef.current?.dispose();
    activeUserRef.current = nextUser;
    remoteStateRef.current = null;
    setUser(nextUser);
    setInitialState(null);
    setActionError("");
    setPhase("opening-user");

    const coordinator = new GoalioSyncCoordinator({
      cloud: resolvedServices.cloud,
      storage: deviceStorage,
      userId: nextUser.id,
      isOnline: () => navigator.onLine,
      onStatusChange: setSyncStatus,
      onRemoteState: state => {
        if (request !== requestRef.current) return;
        remoteStateRef.current = state;
        setInitialState(state);
        setAppStateRevision(revision => revision + 1);
      },
    });
    coordinatorRef.current = coordinator;
    try {
      const hydrated = await coordinator.hydrate();
      if (request !== requestRef.current) return;
      setSyncStatus(hydrated.status);
      setInitialState(remoteStateRef.current ?? hydrated.state);
      setPhase("ready");
    } catch {
      if (request !== requestRef.current) return;
      coordinator.dispose();
      coordinatorRef.current = null;
      setPhase("load-error");
    }
  }, [deviceStorage, resolvedServices]);

  useEffect(() => {
    if (!resolvedServices) return;
    let active = true;
    const unsubscribe = resolvedServices.auth.onChange(nextUser => {
      if (!active) return;
      if (!nextUser) {
        closeUser();
        return;
      }
      if (activeUserRef.current?.id !== nextUser.id) void openUser(nextUser);
    });
    return () => {
      active = false;
      requestRef.current += 1;
      unsubscribe();
      coordinatorRef.current?.dispose();
    };
  }, [closeUser, openUser, resolvedServices]);

  useEffect(() => {
    const retry = () => {
      const coordinator = coordinatorRef.current;
      if (coordinator && coordinator.status !== "synced") void coordinator.flush().catch(() => undefined);
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, []);

  if (phase === "configuration-error") return <StartupScreen error="configuration" />;
  if (phase === "loading" || phase === "opening-user") return <StartupScreen />;
  if (phase === "load-error") return <StartupScreen error="load" retry={() => activeUserRef.current ? void openUser(activeUserRef.current) : setPhase("loading")} />;
  if (phase === "signed-out" || !user || !initialState || !resolvedServices) {
    const authenticate = (action: (credentials: Credentials) => Promise<AccountUser>) => async (credentials: Credentials) => {
      try {
        await openUser(await action(credentials));
      } catch (error) {
        throw new Error(mappedAuthError(error));
      }
    };
    return <AuthScreen onSignUp={authenticate(resolvedServices!.auth.signUp)} onSignIn={authenticate(resolvedServices!.auth.signIn)} />;
  }

  const retrySync = () => {
    setActionError("");
    void coordinatorRef.current?.flush().catch(() => undefined);
  };
  const signOut = async () => {
    const coordinator = coordinatorRef.current;
    if (!coordinator || signingOut) return;
    setSigningOut(true);
    setActionError("");
    try {
      await coordinator.flush();
      if (coordinator.status !== "synced") throw new Error("UNSYNCED");
    } catch {
      setActionError("资料尚未同步，请联网后再退出。");
      setSigningOut(false);
      return;
    }
    try {
      await resolvedServices.auth.signOutCurrentDevice();
      closeUser();
    } catch {
      setActionError("暂时无法退出，请稍后再试。");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="account-app">
      {syncStatus !== "synced" && (
        <div className="sync-banner" data-status={syncStatus} role={syncStatus === "failed" ? "alert" : "status"} aria-live={syncStatus === "failed" ? "assertive" : "polite"}>
          {syncStatus === "pending" ? <CloudArrowUp size={16} weight="regular" aria-hidden="true" /> : <WarningCircle size={16} weight="fill" aria-hidden="true" />}
          <span>{syncStatus === "pending" ? "等待同步" : "同步失败"}</span>
        </div>
      )}
      {actionError && <p className="account-action-error" role="alert">{actionError}</p>}
      <Suspense fallback={<StartupScreen />}>
      <GoalioApp
        key={`${user.id}:${appStateRevision}`}
        initialState={initialState}
        onStateChange={state => coordinatorRef.current?.record(state)}
        account={{ email: user.email, syncStatus, signingOut, onRetrySync: retrySync, onSignOut: () => void signOut() }}
      />
      </Suspense>
    </div>
  );
}
