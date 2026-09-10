# Goalio MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first Goalio web application that implements onboarding, daily balance updates, goal projections, purchase evaluation, settings, completion, local persistence, and tactile interaction feedback.

**Architecture:** A single Next.js App Router project renders a client-side state machine backed by versioned local storage. Pure TypeScript modules own money, date, and simulation rules so the UI and tests share one calculation path. A small service interface isolates demo invitation validation and leaves a clean seam for a future server implementation.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript, CSS Modules/global CSS, Vitest 5, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-06-goalio-mvp-design.md`

## Global Constraints

- Mobile-first layout with a 430px maximum content column.
- Financial values use integer cents throughout the domain layer.
- Production dates come from the system clock; Demo dates require an explicit development flag.
- Financial data stays in browser local storage.
- Copy follows `GOALIO_COPY_GUIDE.md`.
- Visual structure follows the 12 images in `final-design-reference`.
- Every interactive target is at least 44×44px and has press, focus, disabled, loading, success, and error feedback where applicable.
- `prefers-reduced-motion` removes scale, movement, and number tweening.

---

### Task 1: Project shell and visual tokens

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `components/ui/PressableButton.tsx`
- Create: `components/ui/PressableButton.test.tsx`
- Create: `test/setup.ts`

**Interfaces:**
- Produces: `PressableButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; success?: boolean })`
- Produces: global classes for screen layout, typography, fields, panels, transitions, and reduced motion.

- [ ] **Step 1: Create the package manifest and test configuration**

Use scripts `dev`, `build`, `start`, `lint`, `test`, `test:watch`, and `test:e2e`. Configure Vitest with `jsdom`, React plugin support, and `test/setup.ts`.

- [ ] **Step 2: Write the failing button behavior test**

```tsx
it('locks submission and announces progress while loading', () => {
  render(<PressableButton loading>继续</PressableButton>);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(button).toHaveTextContent('处理中');
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npm test -- components/ui/PressableButton.test.tsx`

Expected: FAIL because `PressableButton` does not exist.

- [ ] **Step 4: Implement the shell, tokens, and button**

The button renders a spinner while loading, a check mark while successful, forwards native attributes, and exposes `data-state`. CSS supplies `transform: scale(.975)` on `:active`, a 90ms press transition, 180ms release, `focus-visible` outline, disabled opacity, and a reduced-motion override.

- [ ] **Step 5: Run tests and production build**

Run: `npm test -- components/ui/PressableButton.test.tsx && npm run build`

Expected: test PASS and build exit code 0.

### Task 2: Money, dates, and validation primitives

**Files:**
- Create: `lib/domain/types.ts`
- Create: `lib/domain/money.ts`
- Create: `lib/domain/money.test.ts`
- Create: `lib/domain/dates.ts`
- Create: `lib/domain/dates.test.ts`
- Create: `lib/domain/validation.ts`
- Create: `lib/domain/validation.test.ts`

**Interfaces:**
- Produces: `type Cents = number & { readonly __brand: 'Cents' }`
- Produces: `parseYuan(input: string): Cents | null`
- Produces: `formatYuan(cents: Cents, options?: { decimals?: boolean }): string`
- Produces: `toLocalISO(date: Date): string`
- Produces: `addDays(iso: string, days: number): string`
- Produces: `daysBetween(start: string, end: string): number`

- [ ] **Step 1: Write failing money tests**

```ts
it.each([
  ['0', 0],
  ['40', 4000],
  ['1199.50', 119950],
  ['1,260', 126000],
])('parses %s into integer cents', (input, expected) => {
  expect(parseYuan(input)).toBe(expected);
});

it.each(['', '-1', '1.001', 'abc'])('rejects invalid money %s', input => {
  expect(parseYuan(input)).toBeNull();
});
```

- [ ] **Step 2: Verify money tests fail, implement minimal functions, verify GREEN**

Run RED and GREEN with: `npm test -- lib/domain/money.test.ts`

- [ ] **Step 3: Write failing local-date tests across month boundaries**

```ts
it('adds calendar days without millisecond arithmetic', () => {
  expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  expect(daysBetween('2026-09-30', '2026-10-02')).toBe(2);
});
```

- [ ] **Step 4: Implement calendar helpers and field validators**

Validation returns `{ valid: true, value } | { valid: false, message }` and uses the exact user-facing messages from the copy guide.

- [ ] **Step 5: Run the domain primitive suite**

Run: `npm test -- lib/domain`

Expected: all primitive tests PASS.

### Task 3: Unified daily simulation engine

**Files:**
- Create: `lib/simulation/cashflow.ts`
- Create: `lib/simulation/reserve.ts`
- Create: `lib/simulation/simulator.ts`
- Create: `lib/simulation/simulator.test.ts`
- Create: `lib/simulation/fixtures.ts`

**Interfaces:**
- Consumes: `Cents`, `addDays`, `daysBetween`
- Produces: `runSimulation(input: SimulationInput): SimulationResult`
- Produces: `calculateRequiredReserve(input: ReserveInput): ReserveResult`
- Produces: `expandCashflows(rules: FinancialRules, start: ISODate, end: ISODate): DailyCashflow[]`

```ts
export interface SimulationInput {
  today: string;
  balance: Cents;
  previous?: { date: string; effectiveSaved: Cents };
  rules: FinancialRules;
  goal: SavingsGoal;
  scenarioPurchase?: { date: string; amount: Cents };
}

export type SimulationResult =
  | { status: 'known'; effectiveSaved: Cents; safeCapacity: Cents; change: Cents; completionDate: string | null; tomorrowFood: Cents; tomorrowMaxSpend: Cents; canMeetDeadline: boolean }
  | { status: 'unknown'; missing: string[]; effectiveSaved: Cents; change: Cents };
```

- [ ] **Step 1: Write failing cashflow expansion tests**

Cover weekly, monthly, quarterly, half-yearly, one-time income, fixed expenses, start/end dates, and month-end clamping.

- [ ] **Step 2: Verify RED, implement cashflow expansion, verify GREEN**

Run: `npm test -- lib/simulation/simulator.test.ts -t cashflow`

- [ ] **Step 3: Write failing reserve and safe-capacity tests**

```ts
it('reserves future essentials before exposing goal capacity', () => {
  const result = runSimulation(fixture({ balance: cents(100000), dailyFood: cents(4000) }));
  expect(result.status).toBe('known');
  if (result.status === 'known') expect(result.safeCapacity).toBeLessThanOrEqual(cents(100000));
});
```

- [ ] **Step 4: Implement backward reserve calculation and safe capacity**

For each future day, apply confirmed income, food, and fixed expenses. Compute the minimum cash needed today to keep the projected balance non-negative across the reliable horizon. Clamp safe capacity to `[0, goal.amount]`.

- [ ] **Step 5: Write failing release and rollback tests**

Cover initial progress from zero, one positive release per natural day, multi-day catch-up, same-day update with no second positive change, immediate rollback after balance deterioration, and goal cap.

- [ ] **Step 6: Implement paced effective progress**

Positive change is limited by elapsed natural days and the daily release cap. Negative change immediately clamps to safe capacity. Return explicit `unknown` when required future information is absent.

- [ ] **Step 7: Write failing completion-date and tomorrow-free-spend tests**

Completion date must use daily simulation. Tomorrow free spend must preserve essentials, fixed expenses, and the current goal plan.

- [ ] **Step 8: Implement projection outputs and run full simulation suite**

Run: `npm test -- lib/simulation`

Expected: all simulation tests PASS with integer outputs.

### Task 4: Purchase evaluation

**Files:**
- Create: `lib/simulation/purchase.ts`
- Create: `lib/simulation/purchase.test.ts`

**Interfaces:**
- Consumes: `runSimulation(input)`
- Produces: `evaluatePurchase(input: PurchaseInput): PurchaseEvaluation`
- Produces: `findMaxNoDelayAmount(input: PurchaseInput): Cents`
- Produces: `findEarliestNoDelayDate(input: PurchaseInput): string | null`

```ts
export type PurchaseEvaluation =
  | { kind: 'no-impact'; completionDate: string }
  | { kind: 'delayed-in-time'; baselineDate: string; scenarioDate: string; delayDays: number; deadline: string }
  | { kind: 'delayed'; baselineDate: string; scenarioDate: string; delayDays: number }
  | { kind: 'shortfall'; amount: Cents }
  | { kind: 'unknown'; missing: string[] }
  | { kind: 'unreachable' };
```

- [ ] **Step 1: Write failing classification tests**

Add one fixture for every union variant and assert the exact kind plus relevant dates or amount.

- [ ] **Step 2: Verify RED, implement classification through `runSimulation`, verify GREEN**

Run: `npm test -- lib/simulation/purchase.test.ts -t classification`

- [ ] **Step 3: Write failing alternative-solution tests**

Assert integer binary search returns the highest amount with the baseline completion date and daily scanning returns the first no-delay purchase date.

- [ ] **Step 4: Implement both searches and run the suite**

Run: `npm test -- lib/simulation/purchase.test.ts`

Expected: every purchase case PASS.

### Task 5: Versioned local state and time service

**Files:**
- Create: `lib/storage/schema.ts`
- Create: `lib/storage/storage.ts`
- Create: `lib/storage/storage.test.ts`
- Create: `lib/time/time.ts`
- Create: `lib/time/time.test.ts`
- Create: `features/app/AppProvider.tsx`

**Interfaces:**
- Produces: `loadGoalioState(storage: Storage): LoadResult`
- Produces: `saveGoalioState(storage: Storage, state: GoalioState): SaveResult`
- Produces: `createTimeService(options: { demo: boolean; initialDate?: string }): TimeService`
- Produces: `useGoalio(): GoalioContextValue`

- [ ] **Step 1: Write failing storage tests**

Cover empty storage, valid v1 state, corrupt JSON, schema mismatch, successful save, and quota failure. A failed load must preserve the raw value for recovery.

- [ ] **Step 2: Implement storage codec and verify GREEN**

Run: `npm test -- lib/storage`

- [ ] **Step 3: Write failing time isolation tests**

```ts
it('rejects date mutation when demo mode is disabled', () => {
  const time = createTimeService({ demo: false, initialDate: '2026-09-06' });
  expect(() => time.setDate('2026-09-07')).toThrow('Demo date control is disabled');
});
```

- [ ] **Step 4: Implement time service and application provider**

The provider exposes actions for onboarding updates, daily balance submission, purchase evaluation, settings updates, completion, reset, and Demo date change.

- [ ] **Step 5: Run storage and time tests**

Run: `npm test -- lib/storage lib/time`

### Task 6: Shared form and motion components

**Files:**
- Create: `components/ui/AppHeader.tsx`
- Create: `components/ui/MoneyInput.tsx`
- Create: `components/ui/ChoiceList.tsx`
- Create: `components/ui/FormField.tsx`
- Create: `components/ui/ScreenTransition.tsx`
- Create: `components/ui/AnimatedNumber.tsx`
- Create: `components/ui/ProgressBar.tsx`
- Create: `components/ui/ui.test.tsx`

**Interfaces:**
- Consumes: money parsing and formatting
- Produces reusable accessible components for every feature screen.

- [ ] **Step 1: Write failing interaction tests**

Tests cover 44px targets, error association through `aria-describedby`, option selection, numeric input normalization, progress semantics, loading state, and reduced-motion classes.

- [ ] **Step 2: Verify RED, implement components, verify GREEN**

Run: `npm test -- components/ui`

- [ ] **Step 3: Add shared interaction CSS**

Implement press feedback, list-row feedback, arrow travel, focus rings, page direction transitions, staggered result reveal, numeric transitions, bottom-sheet motion, and reduced-motion overrides.

- [ ] **Step 4: Run component tests and build**

Run: `npm test -- components/ui && npm run build`

### Task 7: Welcome and four-step onboarding

**Files:**
- Create: `features/welcome/WelcomeScreen.tsx`
- Create: `features/welcome/InviteScreen.tsx`
- Create: `lib/invitation/service.ts`
- Create: `features/onboarding/IncomeScreen.tsx`
- Create: `features/onboarding/FoodScreen.tsx`
- Create: `features/onboarding/ExpensesScreen.tsx`
- Create: `features/onboarding/GoalScreen.tsx`
- Create: `features/onboarding/CurrentBalanceScreen.tsx`
- Create: `features/onboarding/onboarding.test.tsx`

**Interfaces:**
- Consumes: application provider, shared form components, invitation service.
- Produces: persisted `FinancialRules`, `SavingsGoal`, and initial balance record.

- [ ] **Step 1: Write the failing onboarding journey test**

Render the app, enter a Demo invitation, choose monthly income, enter ¥2,500 and the next date, enter ¥40 food, add two expenses, create an ¥8,000 goal, enter ¥1,260 balance, and assert that the result screen appears.

- [ ] **Step 2: Verify RED**

Run: `npm test -- features/onboarding/onboarding.test.tsx`

- [ ] **Step 3: Implement welcome, invitation, and onboarding screens**

Use exact guide copy, preserve values on back navigation, show inline errors, and display loading/success button states before transitions.

- [ ] **Step 4: Verify GREEN and test keyboard navigation**

Run: `npm test -- features/onboarding/onboarding.test.tsx`

### Task 8: Daily balance and home result

**Files:**
- Create: `features/dashboard/DailyBalanceScreen.tsx`
- Create: `features/dashboard/HomeResultScreen.tsx`
- Create: `features/dashboard/DemoDateControl.tsx`
- Create: `features/dashboard/dashboard.test.tsx`

**Interfaces:**
- Consumes: `runSimulation`, application provider, shared display components.
- Produces: balance history and displayed daily result.

- [ ] **Step 1: Write failing daily-update tests**

Cover first result, one-day positive change, repeated same-day update, multi-day update label, immediate rollback, known completion date, unknown state, and zero free-spend copy.

- [ ] **Step 2: Verify RED, implement both screens, verify GREEN**

Run: `npm test -- features/dashboard/dashboard.test.tsx`

- [ ] **Step 3: Implement visual result sequencing**

Animate amount, progress bar, today change, result rows, and purchase entry in visual order. Reduced-motion users see immediate values with a short opacity transition.

- [ ] **Step 4: Add and test Demo date control isolation**

The control renders only when `NEXT_PUBLIC_GOALIO_DEMO_DATE=true`; production builds contain no interactive date mutation entry.

### Task 9: Purchase input and result flow

**Files:**
- Create: `features/purchase/PurchaseInputScreen.tsx`
- Create: `features/purchase/PurchaseResultScreen.tsx`
- Create: `features/purchase/purchase-ui.test.tsx`

**Interfaces:**
- Consumes: `evaluatePurchase`, `findMaxNoDelayAmount`, `findEarliestNoDelayDate`.
- Produces: neutral purchase result copy and two actionable alternatives.

- [ ] **Step 1: Write failing UI tests for all result kinds**

Assert the title and explanation from the copy guide for no impact, delay within deadline, added delay, cash shortfall, unknown information, and unreachable projection.

- [ ] **Step 2: Verify RED, implement purchase flow, verify GREEN**

Run: `npm test -- features/purchase/purchase-ui.test.tsx`

- [ ] **Step 3: Verify press and loading feedback**

Use pointer events to assert one submission, `aria-busy`, disabled state during calculation, and preserved fields after a validation or calculation error.

### Task 10: Settings and goal completion

**Files:**
- Create: `features/settings/SettingsScreen.tsx`
- Create: `features/settings/settings.test.tsx`
- Create: `features/completion/GoalCompleteScreen.tsx`
- Create: `features/completion/completion.test.tsx`

**Interfaces:**
- Consumes: application provider actions and persisted state.
- Produces: replan state and purchase-completion state.

- [ ] **Step 1: Write failing settings tests**

Assert all four summary rows, edit navigation, replan confirmation, preservation of the current balance, and progress recalculation without a fabricated positive daily change.

- [ ] **Step 2: Implement settings and verify GREEN**

Run: `npm test -- features/settings/settings.test.tsx`

- [ ] **Step 3: Write failing completion tests**

Assert protected 100% state, continue-preserving action, purchase confirmation, post-purchase balance entry, and completed message.

- [ ] **Step 4: Implement completion and verify GREEN**

Run: `npm test -- features/completion/completion.test.tsx`

### Task 11: App state router and complete journey

**Files:**
- Modify: `app/page.tsx`
- Create: `features/app/GoalioApp.tsx`
- Create: `features/app/goalio-app.test.tsx`
- Create: `e2e/goalio.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes every feature screen and provider.
- Produces the complete runnable application.

- [ ] **Step 1: Write failing state-router tests**

Assert welcome → invite/onboarding → initial balance → home → purchase → result → home → settings → home, plus browser refresh recovery.

- [ ] **Step 2: Implement the typed screen state router**

Use a discriminated union for route state and directional navigation metadata. Keep feature screens unaware of storage details.

- [ ] **Step 3: Run component journey tests**

Run: `npm test -- features/app/goalio-app.test.tsx`

- [ ] **Step 4: Write and run the mobile browser journey**

Playwright uses a 390×844 viewport, clicks each primary control, checks pressed/loading affordances, completes the full flow, reloads, and confirms the persisted result.

Run: `npm run test:e2e`

### Task 12: Visual parity, accessibility, and final verification

**Files:**
- Modify: `app/globals.css`
- Modify feature components where visual comparison reveals drift.
- Create: `README.md`

**Interfaces:**
- Produces the release-ready local MVP and usage instructions.

- [ ] **Step 1: Capture every page at 390×844 and compare to references**

Check column width, side padding, title scale, key amount scale, whitespace, control height, radius, border, Apple Blue selection line, result hierarchy, and completion contrast.

- [ ] **Step 2: Exercise interaction states in a real browser**

Record or capture default, pressed, loading, success, validation failure, disabled, page transition, progress growth, progress rollback, and reduced-motion states.

- [ ] **Step 3: Correct visual and interaction drift**

Keep changes inside existing tokens and components. Re-run the relevant focused test after every change.

- [ ] **Step 4: Run the complete verification suite**

Run: `npm test && npm run lint && npm run build && npm run test:e2e`

Expected: all commands exit 0 with no failed tests.

- [ ] **Step 5: Document local use and Demo mode**

README includes install, development, production build, test commands, local-data behavior, Demo invitation, Demo date flag, and the explicit statement that the MVP invitation adapter must be replaced before external release.
