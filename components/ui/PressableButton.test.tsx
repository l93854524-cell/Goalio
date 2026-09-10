import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PressableButton } from "./PressableButton";

describe("PressableButton", () => {
  it("locks submission and announces progress while loading", () => {
    render(<PressableButton loading>继续</PressableButton>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("处理中");
  });

  it("exposes a success state without changing the touch target", () => {
    render(<PressableButton success>继续</PressableButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "success");
    expect(screen.getByText("已完成")).toBeVisible();
  });
});
