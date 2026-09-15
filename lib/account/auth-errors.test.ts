import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("maps duplicate registration to a login action", () => {
    expect(authErrorMessage({ code: "user_already_exists", message: "provider detail" }))
      .toBe("这个邮箱已经注册，请直接登录。");
  });

  it("uses one safe message for invalid login credentials", () => {
    expect(authErrorMessage({ code: "invalid_credentials", message: "user missing" }))
      .toBe("邮箱或密码不正确，请重新输入。");
  });

  it("explains password and rate-limit failures", () => {
    expect(authErrorMessage({ code: "weak_password" })).toBe("密码至少需要 8 位。");
    expect(authErrorMessage({ code: "over_request_rate_limit" })).toBe("尝试次数太多，请稍后再试。");
  });

  it("explains a project that still requires email confirmation", () => {
    expect(authErrorMessage({ code: "EMAIL_CONFIRMATION_ENABLED" }))
      .toBe("账号服务仍要求邮箱确认，请联系维护者完成配置。");
  });

  it("does not expose an unknown provider message", () => {
    expect(authErrorMessage({ code: "unknown", message: "secret upstream text" }))
      .toBe("暂时无法连接账号服务，请稍后再试。");
  });
});
