# Goalio

Goalio 是一个手机优先的生活与攒钱目标规划网页。它会优先为未来的基础生活和固定支出留出空间，再计算当前可以安心留给目标的金额，并评估一笔额外消费对目标日期的影响。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

在 `.env.local` 中填入 Supabase 项目地址和 Publishable Key，然后打开 `http://localhost:3000`。

## 免费账号服务配置

1. 创建一个 Supabase 免费项目。
2. 在 Supabase SQL Editor 中运行 `supabase/migrations/20260915000000_create_goalio_states.sql`。
3. 在 Authentication 的 Providers 中启用 Email / Password。
4. 在 Email 登录设置中关闭 Confirm Email。当前注册流程会在创建账号后直接登录。
5. 将 GitHub Pages 地址加入 Supabase 的允许访问地址。
6. 在 GitHub 仓库的 Actions secrets 中创建 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
7. 重新部署 GitHub Pages，并分别用两个账号登录，确认双方只能读取各自资料。

这套方案可以先使用 Supabase 免费额度。免费项目长期没有活动时可能暂停，恢复后才能继续同步。首个版本暂未提供用户自行找回密码的入口，忘记密码时由维护者在 Supabase 后台协助处理。

## 验证

```bash
npm test
npm run lint
npm run build
```

## Demo 日期控制

需要验证跨日进度时，以以下方式启动：

```bash
NEXT_PUBLIC_GOALIO_DEMO_DATE=true npm run dev
```

日期控制仅在显式启用后显示。生产构建未设置该变量时无法修改业务日期。

## 数据与账号

余额、收入、支出、目标和历史记录会加密传输并保存到登录用户的 Goalio 账号。每台设备还会保留一份按用户隔离的本地缓存，方便断网时继续填写；恢复联网后会自动重试同步。退出登录会清除当前用户在这台设备上的缓存，其他用户的缓存不会受到影响。

数据库已启用行级访问策略，每个登录用户只能访问自己的记录。客户端仅使用可公开的 Publishable Key，仓库和构建配置都不需要高权限密钥。

当前邀请码页面保留为演示入口，账号注册和登录是正式的数据入口。

## 资料

- `GOALIO_DIRECTION.md`：产品与计算原则
- `GOALIO_COPY_GUIDE.md`：文案规则
- `final-design-reference/`：12 个页面的最终视觉参考
- `docs/superpowers/specs/2026-09-06-goalio-mvp-design.md`：设计说明
- `docs/superpowers/plans/2026-09-06-goalio-mvp.md`：实施计划
