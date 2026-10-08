# Source Map：资料结论 → 原始证据

| 结论 | 原始文件/证据 | 代码/位置 | 验证方式 |
| --- | --- | --- | --- |
| 当前产品名为 Goalio | `package.json`、页面 | `package.json:2`、Logo | 代码/页面确认 |
| 线上 URL | `auto-delivery.txt` | 3-4 行 | 文档 + 2026-09-27 页面打开 |
| 产品是目标储蓄与消费规划网页 | `README.md`、`product-copy.txt` | README 3 行；商品文案 4-12 行 | 文档确认 |
| 当前入口先输入统一邀请码 | `features/access/GoalioInviteApp.tsx` | 6-68 行 | 代码确认 |
| 邀请码在前端校验 | 同上 | 6-7、24-34 行 | 代码确认 |
| 邀请授权保存到 localStorage | 同上 | 15-21、31 行 | 代码确认 |
| 邀请后进入账号体系 | `app/page.tsx`、`GoalioInviteApp.tsx` | page 1-5；Invite 68 | 代码确认 |
| 支持邮箱密码注册登录 | `AuthScreen.tsx`、`supabase.ts` | Auth 61-115；Supabase 25-60 | 代码确认 |
| 密码至少 8 位 | `AuthScreen.tsx` | 75-103 行 | 代码确认 |
| 没有自助找回密码 | `AuthScreen.tsx`、`README.md` | Auth 全文；README 25 行 | 代码/文档确认 |
| 当前完整业务流程 | `features/app/GoalioApp.tsx` | 140-205、237-399、412-588、643-677 | 代码确认 |
| 当前输入项 | `GoalioApp.tsx` | Income/Food/Expenses/Goal/Balance/Purchase 组件 | 代码确认 |
| 真实余额 B 定义 | `GoalioApp.tsx`、`schema.ts` | 391-395；schema 22-32 | 页面/代码确认 |
| 金额使用整数分 | `lib/domain/money.ts` | 1-25 行 | 代码确认 |
| 未来现金流从明天开始 | `simulator.ts` | 90-104 行 | 代码确认 |
| 收入支持五种周期 | `types.ts`、`GoalioApp.tsx` | types 3；App 14-20 | 代码确认 |
| 固定支出 UI 只保存月度 | `GoalioApp.tsx` | 268-276 行 | 代码确认 |
| RequiredReserve 存在 | `simulator.ts` | 69-87、125-129、185-199 | 代码确认 |
| SafeGoalCapacity 存在 | `simulator.ts` | 121-129 行 | 代码确认 |
| EffectiveGoalSaved 存在 | `simulator.ts` | 132-162 行 | 代码确认 |
| 目标按日释放 | `simulator.ts` | 132-150 行 | 代码确认 |
| 同日不会重复释放 | `GoalioApp.tsx`、`simulator.ts` | App 227-235；simulator 138-150 | 代码 + 测试确认 |
| 完成日期逐日模拟 | `simulator.ts` | 164-183 行 | 代码确认 |
| 预测上限 3650 天 | `simulator.ts` | 5-7、36-39 行 | 代码确认 |
| TomorrowSafeToSpend 当前名 tomorrowMaxSpend | `simulator.ts`、首页 | 24-25、209-245；App 440-445 | 代码/页面确认 |
| 明日可花保护当前目标金额 | `simulator.ts` | 209-223 行 | 代码 + 测试确认 |
| 明日可花与旧文档冲突 | `GOALIO_DIRECTION.md`、`simulator.ts` | 方向 145 行；代码 212 行 | 对照确认 |
| RawCapacityCompletionDate 不存在 | 全仓库 | 名称与同义实现搜索 | 代码确认 |
| PaceEndDate 不存在独立字段 | `simulator.ts` | 132-160 行 | 代码确认 |
| MinSmoothDays 不存在 | 全仓库 | 名称与平滑规则搜索 | 代码确认 |
| 消费评估分类 | `purchase.ts` | 17-29、66-138 行 | 代码确认 |
| 降低预算方案 | `purchase.ts` | 45-55、83-87 行 | 代码确认 |
| 延后购买最多搜索 365 天 | `purchase.ts` | 6、57-64 行 | 代码确认 |
| 消费模拟不会自动扣款 | `GoalioApp.tsx` | 508-538、578-583 | 代码确认 |
| 目标历史按日保存 | `types.ts`、`GoalioApp.tsx` | types 30-34；App 209-235、369-384 | 代码确认 |
| 没有自由额度机械结转 | `schema.ts`、模拟模块 | 状态字段与计算全量 | 代码确认 |
| 用户级 localStorage 缓存 | `user-cache.ts` | 6-45 行 | 代码确认 |
| 当前生产路径同步云端 | `GoalioAccountApp.tsx`、`sync.ts` | Account 84-161、213-217；sync 全文 | 代码确认 |
| 云端为每用户一行 JSONB | migration、`supabase.ts` | migration 1-6；supabase 64-92 | 代码确认 |
| RLS 限制用户自己的数据 | migration | 8-23 行 | 迁移代码确认；线上待核验 |
| 退出清除当前用户缓存 | `GoalioAccountApp.tsx`、`user-cache.ts` | Account 71-82；cache 44-46 | 代码确认 |
| 旧 `goalio:v1` 不在生产入口 | `storage.ts`、引用搜索 | storage 全文 | 代码确认 |
| 未使用 IndexedDB | 全仓库 | API/依赖搜索 | 代码确认 |
| 没有自建 Next API | 文件清单 | 无 route.ts/API/Server Action | 代码确认 |
| 没有支付与订单 | 依赖、源码、migration | 全仓库搜索 | 代码确认 |
| 没有分析埋点 | 依赖与源码 | analytics 相关搜索 | 代码确认 |
| 没有错误监控 | 依赖与源码 | Sentry 等搜索 | 代码确认 |
| GitHub Pages 静态部署 | `next.config.ts`、workflows | config 3-10；workflow 全文 | 配置确认 |
| 存在两套重复 Pages workflow | `.github/workflows/` | 两份 YAML | 配置确认 |
| 当前 URL 可访问 | 本次浏览器 | `screenshots/01-online-daily-balance.jpg` | 页面确认 |
| 本地缺 Supabase 配置 | `.env.example`、文件清单 | 根目录无 `.env.local` | 文件/运行确认 |
| 132 项测试通过 | 本次命令 | `npm test` 输出 | 运行确认 |
| lint 通过 | 本次命令 | `npm run lint` 输出 | 运行确认 |
| build 成功 | 本次命令 | `npm run build` 输出 | 运行确认 |
| test:e2e 缺少测试资产 | `package.json`、文件清单 | script 12，未发现 config/spec | 代码确认 |
| 当前标价 ¥3.14 | `product-copy.txt`、`note-copy.txt` | 17 行；28 行 | 项目文档确认 |
| 当前渠道材料为小红书 | `launch-001/README.txt` | 1-13 行 | 项目文档确认 |
| 交付文案为 URL + 邀请码 | `product-copy.txt`、`auto-delivery.txt` | 商品 14-17；交付 1-11 | 项目文档确认 |
| 没有真实销售数据 | 全仓库 | 订单、付款、销售、收入搜索 | 当前未知 |
| 没有真实用户反馈 | 全仓库 | 访谈、评论、issue、feedback 搜索 | 当前未知 |
| 内部 QA 曾发现短视口 P2 | `design-qa.md` | 39-43 行 | 历史文档确认 |
| 营销金额属于演示 | `note-copy.txt` | 15-24 行 | 项目文档确认 |
| 营销素材当前有未提交变更 | `git status --short` | `marketing/xiaohongshu/` | Git 工作树确认 |
| 早期隐私文案已过时 | `GOALIO_COPY_GUIDE.md`、当前账号代码 | 指南 491-499；account/sync | 对照确认 |
| 历史算法与页面修复 | Git commits | `1e4c140`、`b9ac948`、`e2a0c91`、`7c63d37`、`22b74f8`、`34649e9`、`d6919a9`、`3325315` 等 | Git 历史确认 |

## 截图来源映射

| 截图 | 来源 | 性质 |
| --- | --- | --- |
| `screenshots/01-online-daily-balance.jpg` | 2026-09-27 已打开的线上 URL | 本次页面实测 |
| `screenshots/02-project-existing-initial-balance.png` | `marketing/xiaohongshu/source-screens/balance-input-hi.png` | 项目已有材料副本 |
| `screenshots/03-project-existing-income-setting.png` | `source-screens/income-frequency.png` | 项目已有材料副本 |
| `screenshots/04-project-existing-home-progress.png` | `source-screens/home-progress.png` | 项目已有、当前工作树未提交材料副本 |
| `screenshots/05-project-existing-purchase-input.png` | `source-screens/purchase-input-hi.png` | 项目已有材料副本 |
| `screenshots/06-project-existing-purchase-safe.png` | `source-screens/purchase-safe.png` | 项目已有、当前工作树未提交材料副本 |
| `screenshots/07-project-existing-purchase-impact.png` | `source-screens/purchase-impact.png` | 项目已有、当前工作树未提交材料副本 |
| `screenshots/08-project-existing-settings.png` | `source-screens/settings-hi.png` | 项目已有材料副本 |
