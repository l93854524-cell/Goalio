# Goalio 12 张 UI 参考图提示词｜Apple 黑白蓝

## 使用方法

将下面的「通用视觉锁定段」与任意一个「页面提示词」合并成一次完整提示词。每张图单独生成，保持 390 × 844 的手机画布比例。整套画面只使用黑、白、灰和苹果蓝，不引用此前的彩色渐变参考图。

---

## 通用视觉锁定段

```text
Create a realistic, production-quality mobile web app UI for Goalio, a gentle savings decision system for university students.

Target: 390 × 844 portrait mobile app content only. No phone frame, device bezel, notch, Dynamic Island, OS status bar, clock, signal icons, browser chrome, or home indicator.

Product tone: calm, clear, gentle, trustworthy, emotionally light, suitable for university students. Progressive disclosure: show one primary task at a time. The user should understand the next action immediately.

Color system, based on Apple web styling:
- primary page background: pure white #FFFFFF
- secondary grouped surface: soft gray-white #F5F5F7
- primary text and Goalio wordmark: near-black #1D1D1F
- secondary text: Apple gray #6E6E73
- tertiary text: medium gray #86868B
- dividers and quiet borders: light gray #D2D2D7
- primary action and interactive accent: Apple blue #0071E3 with white text
- dark completion surface: black #000000
- never introduce purple, cyan, mint, pink, orange, multicolor lighting, or colored gradients

Material and lighting: clean flat white and soft-gray surfaces. Use mild system-style translucency only for a temporary sheet or floating control; keep it neutral with no colored tint. Use extremely subtle neutral shadows and hairline gray borders. No colored glow, aurora, luminous ribbon, glossy plastic, or decorative light field.

Typography: premium modern Chinese sans-serif similar to SF Pro and PingFang SC; precise optical alignment; no more than three weights; large concise headlines; body text equivalent to 15–16 px; comfortable line length; accurate Chinese punctuation.

Layout rules: generous negative space, 24 px minimum horizontal safe margin, controls sized for one-handed use, one dominant blue primary action, at most one quiet secondary action. Use spacing and typography before borders or shadows. Avoid nested cards, dense dashboards, decorative icons, feature inventories, tiny text, gradients, heavy shadows, and generic SaaS styling.

Text rendering: Render every supplied Chinese string verbatim, sharply and legibly. Do not translate, paraphrase, duplicate, omit, or invent UI copy. Do not add a watermark.
```

---

## 01｜首次进入与邀请码

```text
Screen: Goalio first-entry welcome screen.

User goal: Understand Goalio in a few seconds and begin setup.

Composition: Place a centered Goalio wordmark in the upper-middle with abundant white space. Below it, use one clean soft-gray sheet containing a clear headline, a brief explanation, one wide Apple-blue primary button, and one quiet invitation-code action. Keep the surrounding background pure white and visually silent.

Exact text:
- wordmark: “Goalio”
- headline: “把今天的余额，变成更安心的决定。”
- body: “每天更新一次，Goalio 会告诉你已经安全攒下多少，以及一笔消费会让目标延后多久。”
- primary button: “开始设置”
- secondary action: “已有邀请码？”

Interaction state: resting state before the user taps the primary button.

Constraints: one contained sheet only; no navigation; no illustrations; no metrics; no extra explanatory copy; no colored gradient.
```

## 02｜未来收入

```text
Screen: First-time setup, step 1 of 4 — future income.

User goal: Tell Goalio when confirmed living-expense income usually arrives.

Composition: Small Goalio wordmark at the top-left and “01 / 04” at the top-right. Use a large question as the central visual anchor. Place one compact soft-gray grouped sheet in the lower half. Inside it, show a frequency selector with five clear choices. “每月” is selected in Apple blue. After selection, reveal one amount field and one next-arrival date field with a subtle upward fade, conveying progressive disclosure. Place one wide Apple-blue button at the bottom. Keep the rest of the page pure white.

Exact text:
- progress: “01 / 04”
- headline: “生活费通常什么时候到账？”
- supporting text: “告诉我已经确定的收入安排，我会据此照看之后的日常开销。”
- frequency choices: “每周” “每月” “每季度” “每半年” “一次性”
- amount label: “每次到账金额”
- amount value: “¥2,500”
- date label: “下一次到账”
- date value: “9 月 10 日”
- primary button: “继续”
- quiet action: “暂时没有确定收入”

Interaction state: “每月” has just been selected; the newly revealed fields are visible and ready to edit.

Constraints: show one income rule only; no bank account imagery; no charts; no multiple income cards.
```

## 03｜每日基础饮食

```text
Screen: First-time setup, step 2 of 4 — daily basic food cost.

User goal: Enter a realistic daily amount reserved for basic meals.

Composition: Small Goalio wordmark at top-left and “02 / 04” at top-right. Use a centered large numeric input as the visual focus, with a small currency symbol and an elegant blinking Apple-blue caret. Place the question above it and one short explanation below. In the lower third, use a soft-gray control surface containing three quiet preset chips “¥30” “¥40” “¥50”; “¥40” is selected in Apple blue. A wide Apple-blue button sits near the bottom. Keep the background pure white with no decoration.

Exact text:
- progress: “02 / 04”
- headline: “每天需要为吃饭留出多少？”
- supporting text: “填写一个适合日常生活的金额。我会每天优先把这部分照顾好。”
- input value: “¥40”
- preset values: “¥30” “¥40” “¥50”
- helper text: “偶尔聚餐或额外消费，可以之后单独评估。”
- primary button: “继续”

Interaction state: the amount field is active and “¥40” is selected.

Constraints: avoid budgeting charts, nutrition imagery, food illustrations, sliders with tiny labels, or judgmental language.
```

## 04｜固定支出

```text
Screen: First-time setup, step 3 of 4 — confirmed fixed expenses.

User goal: Add expenses that Goalio should reserve in advance.

Composition: Small Goalio wordmark at top-left and “03 / 04” at top-right. Use the headline and explanation in the upper half. Below, show one soft-gray grouped list surface with two clean rows separated by hairline gray dividers: “房租” and “视频会员”. Each row displays amount and schedule with excellent hierarchy. Add a quiet circular Apple-blue plus control labeled “添加一笔”. At the bottom, show one wide Apple-blue button and one low-emphasis skip action. Keep the background pure white.

Exact text:
- progress: “03 / 04”
- headline: “还有哪些已经确定的开销？”
- supporting text: “比如房租、会员订阅、学费，或者已经决定要支付的费用。我会提前为它们留好位置。”
- row 1 title: “房租”
- row 1 detail: “¥1,800 · 每月 5 日”
- row 2 title: “视频会员”
- row 2 detail: “¥25 · 每月 18 日”
- add action: “添加一笔”
- primary button: “继续”
- secondary action: “暂时没有”

Interaction state: two expenses have been added; the user can continue or add another.

Constraints: use one grouped list surface; avoid individual cards for every expense; no category pie chart; no colorful category icons.
```

## 05｜攒钱目标

```text
Screen: First-time setup, step 4 of 4 — one savings goal.

User goal: Define the single item or experience they want to prepare money for.

Composition: Small Goalio wordmark at top-left and “04 / 04” at top-right. Use the question as a large editorial headline. In the middle, place a clean soft-gray grouped form surface with three vertically spaced fields: goal name, target amount, and desired date. Show filled example values. Use a small Apple-blue checkmark beside completed fields as the only accent. Place one wide Apple-blue completion button at the bottom. Keep the background pure white.

Exact text:
- progress: “04 / 04”
- headline: “最近想为哪件事慢慢攒钱？”
- supporting text: “一次专注一个目标，会更容易看清每天的进展。”
- field label 1: “目标名称”
- field value 1: “一台新电脑”
- field label 2: “目标金额”
- field value 2: “¥8,000”
- field label 3: “希望什么时候准备好”
- field value 3: “12 月 20 日”
- helper text: “我会照顾好日常开销，再帮你判断这个时间是否合适。”
- primary button: “安排好了”

Interaction state: all three fields are complete and ready to submit.

Constraints: show one goal only; no goal gallery; no shopping photography; no confetti.
```

## 06｜首次真实余额

```text
Screen: Final first-time setup step — current real balance.

User goal: Enter the current balance that contains all income and spending already completed today.

Composition: Keep the page exceptionally simple. Small Goalio wordmark at top-left and a quiet label “最后一步” at top-right. Center a large amount input “¥1,260” with an Apple-blue caret. Place the headline above and two short explanatory blocks below, separated with spacing only. Use one small near-black lock icon from a standard rounded icon family beside the privacy note. Place one wide Apple-blue button near the bottom. Keep all remaining space pure white.

Exact text:
- progress label: “最后一步”
- headline: “最后，告诉我现在有多少钱”
- supporting text: “请填写此刻可以用于日常生活和这个目标的真实余额。今天已经发生的收入和支出，都算在这个数字里。”
- input value: “¥1,260”
- privacy note: “余额、收入和支出只保存在这台设备上。”
- important note: “我不会从余额中实际转走任何钱，只会帮你计算目前有多少可以安心留给目标。”
- primary button: “看看现在的安排”

Interaction state: numeric field filled and ready to submit.

Constraints: no bank logo, account number, wallet illustration, balance chart, or secondary action.
```

## 07｜等待更新今日余额

```text
Screen: Daily home before today's balance has been updated.

User goal: Enter today's current real balance in a few seconds.

Composition: Small Goalio wordmark at top-left and today label “9 月 6 日 · 星期日” at top-right. Use a spacious headline in the upper-middle. Center one large amount input with placeholder “¥0” inside a clean soft-gray field. Under it, show one brief instruction. Place one wide Apple-blue button near the lower-middle, leaving the bottom area calm and empty. A tiny goal label “一台新电脑” can appear quietly near the bottom as context.

Exact text:
- date: “9 月 6 日 · 星期日”
- headline: “今天的余额是多少？”
- supporting text: “填写此刻的真实余额，今天已经发生的收支都包含在里面。”
- input placeholder: “¥0”
- primary button: “更新今天的安排”
- helper text: “同一天再次更新，会以最新余额为准。”
- goal context: “正在为「一台新电脑」准备”

Interaction state: today's update is pending and the amount field is focused.

Constraints: keep result metrics hidden until submission; no full dashboard behind the input; no bottom navigation.
```

## 08｜更新后的每日首页

```text
Screen: Daily home immediately after a successful balance update.

User goal: Understand the goal progress, today's change, expected completion date, and tomorrow's safe spending room at a glance.

Composition: Full pure-white page. Small Goalio wordmark at top-left and date at top-right. The dominant content is a large amount “¥620” with label “已为目标留好” and goal name “一台新电脑”. Beneath it, use one thin elegant Apple-blue progress line showing 7.8% of ¥8,000. Present “今天多留了 ¥48” as a small Apple-blue status line. Use lightweight gray dividers to create two compact information rows for expected date and tomorrow's arrangement. Put the purchase-evaluation entry near the bottom as a restrained Apple-blue text action with a small arrow. Avoid a grid of cards.

Exact text:
- date: “9 月 6 日 · 星期日”
- goal label: “正在为「一台新电脑」准备”
- amount label: “已为目标留好”
- main amount: “¥620”
- progress detail: “目标 ¥8,000 · 已完成 7.8%”
- daily change: “今天多留了 ¥48”
- change explanation: “时间往前走了一天，需要预留的未来生活费也少了一些。”
- expected date label: “预计准备好”
- expected date value: “12 月 12 日”
- tomorrow basic label: “明天的基本开销”
- tomorrow basic value: “¥40”
- tomorrow free label: “明天额外最多可花”
- tomorrow free value: “¥72”
- tomorrow free note: “这个金额不包含明天的基本开销，也不会动用已为目标留好的钱。实际余额或计划变化后会重新计算。”
- purchase action: “帮我看看能不能买”

Interaction state: success state after calculation; use subtle light expansion to imply the progress has just updated.

Constraints: one continuous page surface; no card grid; no financial candlestick chart; no gamified streaks; no confetti.
```

## 09｜输入一笔想买的东西

```text
Screen: Large-purchase evaluation input.

User goal: Enter an item and amount to understand its impact on the current plan.

Composition: Small back control at top-left, “Goalio” centered in the compact header, and a quiet goal context at top-right. Use a large headline and short explanation in the upper half. Below, place one soft-gray grouped form with two large fields: item name and amount. Show completed realistic values. Under the form, display one quiet privacy/calculation note. Place one wide Apple-blue button at the bottom. Keep the background pure white.

Exact text:
- header context: “一台新电脑”
- headline: “最近有想买的东西吗？”
- supporting text: “告诉我金额，我帮你看看它会不会影响现在的生活和目标。”
- field label 1: “想买什么”
- field value 1: “耳机”
- field label 2: “需要多少钱”
- field value 2: “¥1,199”
- note: “我会把这笔消费放进未来的安排里重新计算。”
- primary button: “帮我看看能不能买”

Interaction state: both fields filled and ready for evaluation.

Constraints: no product photo, shopping cart, payment UI, product recommendation, or moral judgment.
```

## 10｜消费评估结果与替代方案

```text
Screen: Purchase-evaluation result where the purchase causes a moderate delay.

User goal: Understand the impact first, then compare a lower budget and a later purchase date.

Composition: Use a full pure-white surface. At the top, show a compact back control and Goalio wordmark. Make “晚约 7 天” the dominant near-black typographic number and use a small Apple-blue status label to indicate that the plan changed. Directly beneath, explain the date change in two lines. Use one soft-gray grouped surface in the lower half containing exactly two solution rows with lightweight separation: lower the budget, or delay the purchase. Give each row a clear large value and one Apple-blue action arrow. Place one quiet Apple-blue text action at the bottom to revise the item.

Exact text:
- headline: “可以买，目标会晚一点准备好”
- dominant impact: “晚约 7 天”
- explanation: “如果今天花 ¥1,199，预计准备好的时间会从 12 月 12 日调整到 12 月 19 日。”
- reassurance: “仍然可以赶在你设定的 12 月 20 日前完成。”
- solution 1 label: “降低预算”
- solution 1 value: “今天最多花 ¥860”
- solution 1 detail: “可以保持原来的预计完成时间”
- solution 2 label: “延后购买”
- solution 2 value: “最早 9 月 20 日购买”
- solution 2 detail: “可以保持原来的预计完成时间”
- secondary action: “修改商品或金额”

Interaction state: completed calculation result; both alternatives are actionable.

Constraints: keep the tone calm; communicate impact through typography, labels, and spacing; no red, orange, purple, cyan, gauge, chart, recommendation carousel, or celebratory graphics.
```

## 11｜设置与重新安排

```text
Screen: Settings and plan overview.

User goal: Review the current assumptions and edit one part without feeling overwhelmed.

Composition: Compact header with “设置” as the title and a close control. Use one continuous soft-gray grouped list on the pure-white surface with lightweight row dividers. Organize four clear sections: future income, daily food, fixed expenses, and current goal. Each row shows the current value and a small chevron. Place privacy and device-storage information in a quiet footer area. Use Apple blue only for actionable text and the selected row. Show a restrained gray outline button for resetting the invitation device only if space allows.

Exact text:
- title: “设置”
- section 1 label: “未来收入”
- section 1 value: “每月 ¥2,500 · 10 日到账”
- section 2 label: “每天的基本饮食”
- section 2 value: “¥40”
- section 3 label: “固定支出”
- section 3 value: “2 笔 · 每月 ¥1,825”
- section 4 label: “当前目标”
- section 4 value: “一台新电脑 · ¥8,000 · 12 月 20 日”
- action: “重新安排”
- privacy heading: “你的数据”
- privacy body: “余额、收入、支出和目标只保存在这台设备上。”

Interaction state: overview state before selecting a section.

Constraints: no bottom tab bar; no account profile, cloud sync, social settings, notification marketing, or dense preference toggles.
```

## 12｜目标准备完成

```text
Screen: Goal completion and purchase confirmation.

User goal: Understand that the full goal amount is ready and choose whether the purchase has already happened.

Composition: Create an emotionally satisfying yet restrained completion screen. Use a solid black #000000 upper field transitioning through a clean horizontal boundary into white #FFFFFF. Place the Goalio wordmark near the top. Make “¥8,000” the dominant number in white inside the black field, with one thin complete Apple-blue progress ring or line. In the lower white area, show a concise completion message and one wide Apple-blue button. Add one quiet secondary action below. Keep the composition graphic, flat, and calm with no glow or confetti.

Exact text:
- wordmark: “Goalio”
- goal context: “一台新电脑”
- amount label: “已经为目标留好”
- main amount: “¥8,000”
- progress: “100%”
- headline: “已经准备好了”
- supporting text: “在你确认购买前，我会继续帮你把这笔钱留在当前安排里。”
- primary button: “我已经购买”
- secondary action: “暂时继续保留”
- purchase helper: “确认购买后，只需要填写购买后的最新真实余额。”

Interaction state: goal has reached 100%; the user has not confirmed the purchase yet.

Constraints: no coins, trophies, badges, fireworks, shopping photography, bank-transfer language, or exaggerated celebration.
```

---

## 连续生成时的额外要求

```text
Treat all 12 outputs as one coherent Goalio product family. Keep the same wordmark, font character, control radii, spacing scale, Apple blue, neutral surface hierarchy, and minimal shadow treatment across the series. Use only white, black, Apple gray, and Apple blue. Create motion through page transitions, scale, blur, and position changes rather than decorative color effects. Maintain consistent touch-target sizes and mobile safe margins. Generate each screen as a separate image; never combine several screens into one board or phone mockup.
```
