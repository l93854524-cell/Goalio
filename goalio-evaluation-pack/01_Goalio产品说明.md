# Goalio 产品说明

> 核查基准：当前工作树、`main` 分支 HEAD `99aa3bc`、2026-09-27 的本地构建与线上页面。代码和实际页面优先于旧方向文档。

## 1. 当前产品是什么

Goalio 是一个手机优先的目标储蓄与消费规划网页。用户录入确定的未来收入、每日基本饮食、固定支出、一个储蓄目标和当前真实余额后，系统会：

- 为未来必要生活与固定支出计算预留金额；
- 计算当前余额中可安全归入目标的容量；
- 按目标日期逐日释放目标进度；
- 预测目标准备完成日期；
- 计算明天额外最多可花的金额；
- 模拟一笔额外消费对资金缺口、当前目标进度和完成日期的影响。

来源：`README.md:1-3`、`features/app/GoalioApp.tsx`、`lib/simulation/simulator.ts`、`lib/simulation/purchase.ts`。

当前产品不会代用户转账、扣款、托管资金，也不会连接银行卡读取流水。所有“已为目标留好”的金额都属于计算结果。来源：`features/app/GoalioApp.tsx:391-395`、`marketing/xiaohongshu/launch-001/product-copy.txt:19`。

## 2. 当前适用场景

项目材料明确面向“为旅行、数码产品或其他具体目标存钱，同时希望安排日常消费”的人。当前只支持同时维护一个目标，币种显示固定为人民币。来源：`marketing/xiaohongshu/launch-001/product-copy.txt:4-19`、`lib/domain/types.ts:17-28`、`lib/domain/money.ts:17-25`。

项目中没有经用户研究验证的细分人群数据。“大学生存钱”等标签出现在小红书文案中，属于推广标签，不能据此确认实际用户构成。来源：`marketing/xiaohongshu/launch-001/note-copy.txt:30`。

## 3. 完整使用流程

当前实际入口链路如下：

1. 输入统一邀请码。当前邀请码在前端代码中校验，通过后写入本机 `localStorage`。
2. 创建邮箱账号或登录现有账号。密码至少 8 位，注册时需再次确认密码。
3. 欢迎页点击“开始设置”。
4. 设置未来收入：周期、每次金额、下一次到账日期；也可选择暂时没有确定收入。
5. 设置每天基本饮食金额。
6. 添加零笔或多笔固定支出。
7. 设置一个目标：名称、金额、希望准备好的日期。
8. 输入当前真实余额。
9. 查看首页：目标进度、今日变化、预计日期、明天基本开销、符合条件时的明日额外可花金额。
10. 之后每个自然日再次打开时，系统引导更新真实余额。
11. 可从首页进入额外消费模拟，填写商品名称和金额。
12. 可在设置中修改收入、饮食、固定支出和目标，修改后重新计算。
13. 目标达到 100% 后，系统继续保护目标金额；用户确认购买后输入购买完成后的最新余额，进入完成页。

入口与页面分派：`app/page.tsx:1-5`、`features/access/GoalioInviteApp.tsx:6-68`、`features/account/AuthScreen.tsx:12-118`、`features/app/GoalioApp.tsx:140-205,237-399,412-588,643-677`。

## 4. 用户输入项

| 输入项 | 当前含义与规则 | 代码证据 |
| --- | --- | --- |
| 邀请码 | 统一邀请码，前端本地校验，成功后保存到当前浏览器 | `features/access/GoalioInviteApp.tsx:6-34` |
| 邮箱、密码、确认密码 | 用于 Supabase 邮箱密码账号；密码输入框最少 8 位 | `features/account/AuthScreen.tsx:61-104` |
| 收入周期 | 每周、每月、每季度、每半年、一次性 | `features/app/GoalioApp.tsx:14-20,153-185` |
| 每次收入金额 | 以人民币元输入，内部转成整数分；界面允许输入 0 | 同上；`lib/domain/money.ts:1-15` |
| 下一次到账日期 | 未来收入规则的起点 | `GoalioApp.tsx:179-180` |
| 收入结束日期 | 数据类型支持 `endDate?`，当前界面没有输入入口 | `lib/domain/types.ts:5-10` |
| 每日基本饮食 | 每个未来自然日都会计入的基础支出；界面允许 0 | `GoalioApp.tsx:190-205` |
| 固定支出 | 名称、金额、下一次扣款日期；金额必须大于 0 | `GoalioApp.tsx:237-340` |
| 固定支出周期 | 当前 UI 保存时固定为每月；数据结构本身支持多种周期 | `GoalioApp.tsx:268-276`、`lib/domain/types.ts:3-15` |
| 目标 | 名称、金额、截止日期；金额必须大于 0 | `GoalioApp.tsx:344-365` |
| 当前真实余额 B | 此刻可用于日常生活和当前目标的真实余额；今天已发生的收入和支出都包含其中；允许 0 | `GoalioApp.tsx:369-398` |
| 额外消费 | 名称、金额；金额必须大于 0 | `GoalioApp.tsx:465-482` |

目标日期当前只检查“非空”，界面没有限制其必须晚于今天。来源：`GoalioApp.tsx:344-365`。

## 5. 真实余额 B

真实余额 B 对应 `GoalioState.balance`。它是当天现实资金的输入基准。当前日已经发生的收入和支出不会再由预测器重复处理；预测时间线从明天开始加入未来收入、每日饮食和固定支出。

- 状态字段：`lib/storage/schema.ts:22-32`
- 页面定义：`features/app/GoalioApp.tsx:391-395`
- 时间线从 offset 1 开始：`lib/simulation/simulator.ts:90-104`

Goalio 不会自动从银行获取 B，也不会根据预测现金流自动改写 B。用户下一次输入的新余额才代表新的现实状态。

## 6. 核心计算链

统一入口为 `runSimulation(input)`，位于 `lib/simulation/simulator.ts:226-245`。输入包括今天日期、余额 B、计划、上一个自然日快照和可选模拟消费。

### 6.1 未来现金流

未来每一天的净现金流可理解为：

`当日确定收入 - 每日基本饮食 - 当日固定支出 - 当日模拟消费`

今天的净现金流固定为 0，因为今天发生的收支已经包含在 B 中。周期推进规则位于 `simulator.ts:41-67`。月度日期通过 `addMonths` 处理，月末超出的日期会压到该月最后一天，来源：`lib/domain/dates.ts:30-37`。

### 6.2 RequiredReserve

当前运行时字段名为 `requiredReserve`。

含义：从某一天开始，为覆盖之后 365 天内最深的累计现金缺口，至少需要先留在余额里的金额。

普通语言示例：如果未来先有房租和每天吃饭支出，下一笔收入较晚到账，系统会找出中间最缺钱的时点，并把足以撑到该时点的金额列为必要预留。

等价公式：设未来净现金流前缀和为 `P`，则第 t 天：

`RequiredReserve_t = max(0, P_t - min(P_(t+1) ... P_(t+365)))`

实现：`lib/simulation/simulator.ts:5-7,69-87,90-105`。

### 6.3 SafeGoalCapacity

当前运行时字段名为 `safeCapacity`。

`SafeGoalCapacity = clamp(B - RequiredReserve, 0, GoalAmount)`

含义：当前余额先扣除必要预留，剩余金额最多有多少可安全归入目标；结果不会低于 0，也不会超过目标金额。今日模拟消费时，系统先从 B 扣除该消费。实现：`simulator.ts:115-129`。

### 6.4 DailyPacedCeiling 与 EffectiveGoalSaved

当前代码没有把“余额足够”直接等同于“目标当天全部完成”。目标进度会按剩余目标金额和剩余计划天数逐日释放。

单日释放量：

`DailyRelease = ceil((GoalAmount - Saved) / max(1, 距目标日期含当天的剩余天数))`

当日节奏上限从最近一个自然日的有效进度出发累加每日释放量。同一天重复计算不会再次增加释放量。

`EffectiveGoalSaved = min(DailyPacedCeiling, SafeGoalCapacity)`

实现：`simulator.ts:132-162`。

这保证当前代码中的关系：

`0 ≤ effectiveSaved ≤ safeCapacity ≤ goalAmount`

余额下降导致安全容量不足时，目标进度会回撤；同日余额恢复后，进度最多恢复到当日节奏上限。

### 6.5 目标进度与今日变化

首页进度金额使用 `effectiveSaved`。进度百分比按 `effectiveSaved / goalAmount` 计算并四舍五入到 0.1%。今日变化为：

`change = effectiveSaved - previousEffectiveSaved`

实现：`simulator.ts:185-199`、`features/app/GoalioApp.tsx:412-435`。

### 6.6 预计完成日期

当前代码的唯一基线完成日期字段为 `completionDate`。预测器从明天起逐日执行：

1. 将当天未来净现金流加入预测余额；
2. 计算该日的 RequiredReserve；
3. 计算该日 SafeGoalCapacity；
4. 按节奏释放目标金额；
5. 取节奏上限与安全容量中的较小值；
6. 第一次达到目标金额的日期即完成日期。

实现：`simulator.ts:164-183`。

预测天数为：

`min(3650, max(365, 距截止日天数 + 365))`

返回 `null` 只表示有限预测范围内没有达到目标，不能证明永远无法完成。实现：`simulator.ts:36-39`。

`canMeetDeadline` 同时要求当前余额覆盖必要预留、存在完成日期、完成日期不晚于目标截止日。实现：`simulator.ts:202-207`。

## 7. TomorrowSafeToSpend

旧说明中的 `TomorrowSafeToSpend` 在当前代码中对应 `tomorrowMaxSpend`，页面文案为“明天额外最多可花”。

计算条件：当前基线计划必须可以按目标日期完成，且当前模拟本身没有额外消费。否则运行时值为 0，首页也不会显示金额。

当前搜索上界：

`max(0, B - EffectiveGoalSaved - RequiredReserve)`

系统在 0 到该上界之间以“分”为单位进行整数二分搜索。每个候选金额都会作为明天发生的消费重新跑完整模拟；只有必要预留不出现缺口，并且完成日期不晚于目标截止日，才通过。

实现：`simulator.ts:209-223,226-245`；展示：`GoalioApp.tsx:437-456`。

明日基本饮食已经包含在 RequiredReserve 中，页面另外显示 `tomorrowFood` 用于解释。当前实现还保护已经计入目标的 `effectiveSaved`。

项目当前实现与旧说明存在差异：`GOALIO_DIRECTION.md:145` 写明当前 EffectiveGoalSaved 不作为明日上限硬约束；当前运行代码 `simulator.ts:212` 明确从搜索上界扣除了它，相关测试也以保护该金额为准。

## 8. 额外消费模拟

统一入口为 `evaluatePurchase(input)`，位于 `lib/simulation/purchase.ts:66-138`。模拟只输出影响，不会真的扣减余额，也不会记录成交易流水。

当前分类：

| 分类 | 条件与含义 |
| --- | --- |
| `shortfall` | 消费超过当前余额，或消费后余额低于未来必要预留 |
| `unknown` | 缺少未来收入等必要信息 |
| `unreachable` | 有限预测范围内没有完成日期 |
| `progress-reduced` | 完成日期不变，但当前已留目标金额减少 |
| `no-impact` | 当前进度和完成日期均未变差 |
| `delayed-in-time` | 比基线晚，但仍不晚于目标截止日 |
| `delayed` | 完成日期晚于目标截止日 |

消费金额超过 B 时，缺口为 `purchaseAmount - B`。其余场景会先跑基线，再将消费放到今天重新模拟。

替代方案：

- `maxNoDelayAmount`：今天在不降低当前已留金额、且不晚于基线完成日期的条件下，最多可花多少；搜索上限为 `B - RequiredReserve - EffectiveGoalSaved`。
- `earliestNoDelayDate`：坚持原金额时，从今天开始最多向后扫描 365 天，找到第一个既不降低当前进度、也不晚于基线完成日期的购买日。

实现：`purchase.ts:31-64,72-137`；结果页：`GoalioApp.tsx:486-536`。

## 9. 旧命名与当前实现的对应关系

| 旧名称 | 当前实现 | 结论 |
| --- | --- | --- |
| RequiredReserve | `requiredReserve` | 存在 |
| SafeGoalCapacity | `safeCapacity` | 存在 |
| EffectiveGoalSaved | `effectiveSaved` | 存在 |
| TomorrowSafeToSpend | `tomorrowMaxSpend` | 改名后存在 |
| BaselineCompletionDate | 基线 `completionDate`；消费模块中为 `baselineDate` | 名称变化 |
| RawCapacityCompletionDate | 未发现独立字段或独立计算 | 当前实现不存在 |
| PaceEndDate | 无独立字段；`goal.deadline` 直接作为节奏计算的日期基准 | 当前实现不存在独立值 |
| MinSmoothDays | 未发现该字段或平滑天数下限 | 当前实现不存在 |

## 10. 数据结转与历史

每次提交余额会保存 `{date, balance, effectiveSaved}` 快照。同一天再次提交会替换同日快照。重新规划时也会以完整当前计划重新计算当日结果。来源：`lib/domain/types.ts:30-34`、`GoalioApp.tsx:209-235,369-384`。

系统只选择严格早于今天的最近快照作为新一天的节奏基线，同日更新不会重复释放。来源：`GoalioApp.tsx:227-235`。

产品没有“自由消费额度余额”字段，也没有把未花额度机械累加到下一天。未花的钱会通过下一次较高的真实余额重新进入计算。

## 11. 数据保存、账号、服务器与设备变化

当前生产链路具备账号体系，并依赖 Supabase：

- 邮箱密码注册、登录和本设备退出；
- 整份 `GoalioState` 保存到 `goalio_states.state` JSONB；
- 数据库迁移启用行级访问策略，用户只能读写自己的 `user_id`；
- 每台设备保存按用户隔离的 localStorage 缓存：`goalio:user:<userId>:v1`；
- 本地修改先标记待同步，默认约 500ms 后上传；网络恢复或页面重新获得焦点时重试；
- 退出前强制同步，失败时阻止退出；退出成功会清除当前设备中该用户的缓存。

来源：`lib/account/supabase.ts`、`lib/account/sync.ts`、`lib/account/user-cache.ts`、`features/account/GoalioAccountApp.tsx`、`supabase/migrations/20260915000000_create_goalio_states.sql`。

刷新页面：登录会话和本地缓存存在时，数据可恢复。

换浏览器或清除浏览器数据：邀请码授权和本地缓存会消失，需要重新输入邀请码并登录；云端已同步数据可在登录后重新读取。

换设备：需要输入邀请码并登录同一账号；云端已同步数据可读取。离线且新设备没有缓存时无法打开资料。

当前不使用 IndexedDB。`lib/storage/storage.ts` 中旧键 `goalio:v1` 仍存在并有测试，但生产入口已不调用该适配器。

项目当前实现与旧文档存在明显差异：`GOALIO_DIRECTION.md` 和 `GOALIO_COPY_GUIDE.md` 的早期段落仍写财务数据仅留设备、账号同步暂缓；当前代码和 README 已采用账号云同步。

## 12. 当前真实支持与不支持

### 已支持

- 统一邀请码入口；
- 邮箱密码注册和登录；
- 一个目标；
- 五种未来收入周期；
- 每日基本饮食；
- 多笔月度固定支出；
- 当前真实余额每日更新；
- 必要预留、安全目标容量、节奏进度、预计日期；
- 明日基本开销与符合条件时的额外可花金额；
- 单笔额外消费影响与两个替代方案；
- 目标完成确认；
- 本地缓存、断网后继续填写、恢复联网后同步；
- GitHub Pages 静态部署配置。

### 当前未发现支持

- 多个并行目标；
- 多币种；
- 银行卡或支付平台自动同步；
- 交易流水、分类账和消费记录；
- 支付、订单、订阅计费；
- 短信或第三方登录；
- 找回密码、账号删除、修改邮箱/密码；
- 多设备冲突合并；
- 数据导入导出；
- 分析埋点、错误监控和远程日志；
- 原生 App、小程序、社交与分享；
- 项目内完整的浏览器 E2E 测试套件。

## 13. 与传统记账工具的客观机制差异

根据当前代码可直接确认：

- Goalio 的输入核心是“当前真实余额 + 未来确定现金流 + 单一目标”，没有逐笔记账模型。
- 输出核心是未来必要预留、目标安全容量、按日释放的目标进度、预计完成时间与消费情景影响。
- 它不会生成分类账、月度支出分类或历史交易报表。
- 每日真实余额是现实状态锚点，未来预测用于辅助分配与情景模拟。

以上属于产品机制事实，不构成竞品优劣或商业价值判断。
