"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GoalioApp } from "@/features/app/GoalioApp";
import type { GoalioState } from "@/lib/storage/schema";
import { loadGoalioState, saveGoalioState } from "@/lib/storage/storage";

const ACCESS_KEY = "goalio:invite-access:v1";
const INVITE_CODE = "GOALIO314";

export function GoalioInviteApp() {
  const [initialState, setInitialState] = useState<GoalioState | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      if (window.localStorage.getItem(ACCESS_KEY) === INVITE_CODE) {
        setInitialState(loadGoalioState(window.localStorage).state);
      }
      setReady(true);
    });
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized !== INVITE_CODE) {
      setError("邀请码不正确，请检查后再试。");
      return;
    }
    window.localStorage.setItem(ACCESS_KEY, INVITE_CODE);
    setError("");
    setInitialState(loadGoalioState(window.localStorage).state);
  };

  if (!ready) {
    return <main className="screen startup-screen" aria-label="正在打开 Goalio"><div className="startup-mark">goalio</div></main>;
  }

  if (!initialState) {
    return (
      <main className="screen invite-access-screen screen-enter">
        <header className="invite-access-brand" aria-label="Goalio">goalio</header>
        <section className="invite-access-copy">
          <p className="eyebrow">欢迎使用 Goalio</p>
          <h1>输入邀请码</h1>
          <p>邀请码会保存在当前设备。之后打开网页，可以直接继续上次的进度。</p>
        </section>
        <form className="invite-access-form" onSubmit={submit}>
          <label>
            <span>邀请码</span>
            <input
              aria-label="邀请码"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={event => setCode(event.target.value.toUpperCase())}
              placeholder="GOALIO314"
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="pressable-button" type="submit">开始使用</button>
        </form>
        <p className="invite-access-note">网页直接使用，无需下载 App。</p>
      </main>
    );
  }

  return (
    <GoalioApp
      initialState={initialState}
      onStateChange={state => saveGoalioState(window.localStorage, state)}
    />
  );
}
