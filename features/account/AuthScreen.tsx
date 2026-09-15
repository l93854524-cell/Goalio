"use client";

import { useState, type FormEvent } from "react";
import { PressableButton } from "@/components/ui/PressableButton";
import type { Credentials } from "@/lib/account/contracts";

type AuthScreenProps = {
  onSignUp: (credentials: Credentials) => Promise<void>;
  onSignIn: (credentials: Credentials) => Promise<void>;
};

export function AuthScreen({ onSignUp, onSignIn }: AuthScreenProps) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (mode === "signup" && password !== confirmation) {
      setError("两次输入的密码不一致。");
      return;
    }

    setPending(true);
    try {
      const credentials = { email: email.trim().toLowerCase(), password };
      await (mode === "signup" ? onSignUp(credentials) : onSignIn(credentials));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法完成，请稍后再试。");
      setPassword("");
      setConfirmation("");
    } finally {
      setPending(false);
    }
  };

  const switchMode = () => {
    setMode(current => current === "signup" ? "signin" : "signup");
    setPassword("");
    setConfirmation("");
    setError("");
  };

  const signingUp = mode === "signup";
  const passwordType = passwordVisible ? "text" : "password";

  return (
    <main className="screen auth-screen screen-enter">
      <header className="auth-brand" aria-label="Goalio">goalio</header>
      <section className="auth-copy">
        <p className="eyebrow">每天更新一次，就能一直看见目标</p>
        <h1>{signingUp ? "创建你的账号" : "欢迎回来"}</h1>
        <p>登录状态会保留在这台设备上，你的进度也会同步保存。</p>
      </section>

      <form className="auth-form" onSubmit={submit}>
        <fieldset disabled={pending}>
          <label className="auth-field">
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>

          <label className="auth-field">
            <span>密码</span>
            <span className="password-control">
              <input
                type={passwordType}
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete={signingUp ? "new-password" : "current-password"}
                minLength={8}
                required
              />
              <button type="button" onClick={() => setPasswordVisible(value => !value)}>
                {passwordVisible ? "隐藏密码" : "显示密码"}
              </button>
            </span>
          </label>

          {signingUp && (
            <label className="auth-field">
              <span>确认密码</span>
              <input
                type={passwordType}
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          )}
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}

        <PressableButton type="submit" loading={pending} loadingLabel={signingUp ? "正在创建" : "正在登录"}>
          {signingUp ? "创建账号" : "登录"}
        </PressableButton>
        <button className="auth-switch" type="button" onClick={switchMode} disabled={pending}>
          {signingUp ? "已有账号，直接登录" : "还没有账号，立即创建"}
        </button>
      </form>
    </main>
  );
}
