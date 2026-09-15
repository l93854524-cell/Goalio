import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";

describe("AuthScreen", () => {
  it("submits a valid new account", async () => {
    const user = userEvent.setup();
    const onSignUp = vi.fn().mockResolvedValue(undefined);
    render(<AuthScreen onSignUp={onSignUp} onSignIn={vi.fn()} />);

    await user.type(screen.getByLabelText("邮箱"), " Person@Example.com ");
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

  it("keeps the email and clears passwords after an account error", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockRejectedValue(new Error("邮箱或密码有误。"));
    render(<AuthScreen onSignUp={vi.fn()} onSignIn={onSignIn} />);
    await user.click(screen.getByRole("button", { name: "已有账号，直接登录" }));

    await user.type(screen.getByLabelText("邮箱"), "person@example.com");
    await user.type(screen.getByLabelText("密码"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("邮箱或密码有误。");
    expect(screen.getByLabelText("邮箱")).toHaveValue("person@example.com");
    expect(screen.getByLabelText("密码")).toHaveValue("");
  });
});
