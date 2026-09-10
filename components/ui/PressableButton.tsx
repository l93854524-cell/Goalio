"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type PressableButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  success?: boolean;
  loadingLabel?: string;
  successLabel?: string;
  children: ReactNode;
};

export function PressableButton({
  loading = false,
  success = false,
  loadingLabel = "处理中",
  successLabel = "已完成",
  children,
  className = "",
  disabled,
  ...props
}: PressableButtonProps) {
  const state = loading ? "loading" : success ? "success" : "ready";

  return (
    <button
      {...props}
      type={props.type ?? "button"}
      disabled={disabled || loading || success}
      aria-busy={loading || undefined}
      data-state={state}
      className={`pressable-button ${className}`.trim()}
    >
      <span className="button-content" aria-live="polite">
        {loading && <span className="button-spinner" aria-hidden="true" />}
        {success && <span className="button-check" aria-hidden="true">✓</span>}
        <span>{loading ? loadingLabel : success ? successLabel : children}</span>
      </span>
    </button>
  );
}
