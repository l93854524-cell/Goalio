"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GoalioAccountApp } from "@/features/account/GoalioAccountApp";

const ACCESS_KEY = "goalio:invite-access:v1";
const INVITE_CODE = "rrclyby943";

export function GoalioInviteApp() {
  const [accessGranted, setAccessGranted] = useState(false);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      if (window.localStorage.getItem(ACCESS_KEY) === INVITE_CODE) {
        setAccessGranted(true);
      }
      setReady(true);
    });
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = code.trim().toLowerCase();
    if (normalized !== INVITE_CODE) {
      setError("邀请码不正确，请检查后再试。");
      return;
    }
    window.localStorage.setItem(ACCESS_KEY, INVITE_CODE);
    setError("");
    setAccessGranted(true);
  };

  if (!ready) {
    return <main className="screen startup-screen" aria-label="正在打开 Goalio"><div className="startup-mark">goalio</div></main>;
  }

  if (!accessGranted) {
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
              autoCapitalize="none"
              autoComplete="off"
              value={code}
              onChange={event => setCode(event.target.value)}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="pressable-button" type="submit">开始使用</button>
        </form>
        <p className="invite-access-note">网页直接使用，无需下载 App。</p>
      </main>
    );
  }

  return <GoalioAccountApp />;
}
