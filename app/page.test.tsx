import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import HomePage from "./page";

describe("Goalio invite access", () => {
  beforeEach(() => localStorage.clear());

  it("asks for the unified invite code before opening Goalio", async () => {
    render(<HomePage />);

    expect(await screen.findByRole("heading", { name: "输入邀请码" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "开始设置" })).not.toBeInTheDocument();
  });

  it("opens Goalio only after the correct invite code", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = await screen.findByRole("textbox", { name: "邀请码" });
    await user.type(input, "WRONG");
    await user.click(screen.getByRole("button", { name: "开始使用" }));
    expect(screen.getByRole("alert")).toHaveTextContent("邀请码不正确");

    await user.clear(input);
    await user.type(input, "goalio314");
    await user.click(screen.getByRole("button", { name: "开始使用" }));
    expect(await screen.findByRole("button", { name: "开始设置" })).toBeVisible();
  });

  it("remembers invite access on the same device", async () => {
    localStorage.setItem("goalio:invite-access:v1", "GOALIO314");
    render(<HomePage />);

    expect(await screen.findByRole("button", { name: "开始设置" })).toBeVisible();
  });
});
