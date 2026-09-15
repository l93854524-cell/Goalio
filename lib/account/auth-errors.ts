type AuthErrorLike = { code?: string; message?: string } | null | undefined;

const AUTH_MESSAGES: Record<string, string> = {
  user_already_exists: "这个邮箱已经注册，请直接登录。",
  weak_password: "密码至少需要 8 位。",
  invalid_credentials: "邮箱或密码不正确，请重新输入。",
  over_request_rate_limit: "尝试次数太多，请稍后再试。",
  request_timeout: "连接超时，请检查网络后再试。",
  EMAIL_CONFIRMATION_ENABLED: "账号服务仍要求邮箱确认，请联系维护者完成配置。",
};

export function authErrorMessage(error: AuthErrorLike) {
  return error?.code && AUTH_MESSAGES[error.code]
    ? AUTH_MESSAGES[error.code]
    : "暂时无法连接账号服务，请稍后再试。";
}
