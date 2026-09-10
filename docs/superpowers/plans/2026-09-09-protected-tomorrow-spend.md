# Goalio Protected Tomorrow Spend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home-page tomorrow spend limit protect the user's currently displayed goal progress.

**Architecture:** Keep one shared simulator. Add the current effective goal progress as an acceptance condition inside the existing integer search, then update the home copy and product documentation to state the same promise.

**Tech Stack:** TypeScript, React 19, Next.js 16, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-09-protected-tomorrow-spend-design.md`

## Global Constraints

- Amounts remain integer cents.
- Tomorrow's basic expense remains separate from the extra-spend limit.
- Existing target progress must be protected before free spending.
- The unified simulator remains the only calculation source for the page.
- Chinese copy must not use the forbidden “不是……而是……” construction.

---

### Task 1: Protect current goal progress in the tomorrow limit

**Files:**
- Modify: `lib/simulation/simulator.ts:119-144`
- Test: `lib/simulation/simulator.test.ts`

**Interfaces:**
- Consumes: `simulateKnown(input).effectiveSaved`
- Produces: `tomorrowMaxSpend: Cents` whose candidate simulations never reduce the current `effectiveSaved`

- [x] **Step 1: Write the failing cross-day regression test**

Create a fixture with a current balance of ¥1,000, current target progress of ¥125, tomorrow food of ¥20, a future income of ¥1,000, and an ¥1,888 goal. Assert that the extra-spend limit is ¥455. Feed the next day's actual balance after spending ¥456 plus ¥20 back into `runSimulation` and assert that progress is ¥124.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run lib/simulation/simulator.test.ts -t "protects current goal progress"`

Expected: FAIL because the current search accepts a candidate that consumes the protected ¥125.

- [x] **Step 3: Add the protected-progress search condition**

Pass the baseline `effectiveSaved` into `maxSpendTomorrow`. Accept a binary-search candidate only when `meetsDeadline(...)` is true and the candidate result's `effectiveSaved` is greater than or equal to the baseline value.

- [x] **Step 4: Run the focused test and simulator suite**

Run: `npm test -- --run lib/simulation/simulator.test.ts`

Expected: all simulator tests PASS.

### Task 2: Report purchases that consume protected progress

**Files:**
- Modify: `lib/simulation/purchase.ts`
- Test: `lib/simulation/purchase.test.ts`
- Modify: `features/app/GoalioApp.tsx`
- Test: `features/app/GoalioApp.test.tsx`

**Interfaces:**
- Consumes: baseline and scenario `effectiveSaved` values
- Produces: `PurchaseEvaluation` kind `progress-reduced` with `baselineSaved`, `scenarioSaved`, `amount`, and completion dates

- [x] **Step 1: Write the failing purchase regression test**

Use a purchase that reduces current goal progress from ¥125 to ¥124 while leaving the rounded completion date unchanged. Assert that the result kind is `progress-reduced` and the reduction is ¥1.

- [x] **Step 2: Run the focused purchase test and verify RED**

Run: `npm test -- --run lib/simulation/purchase.test.ts -t "reports reduced goal progress"`

Expected: FAIL because the current evaluator returns `no-impact`.

- [x] **Step 3: Add the progress-reduced result**

Compare scenario `effectiveSaved` with baseline `effectiveSaved` before returning `no-impact`. Return the new result kind whenever the scenario value is lower, then map it to clear result-page copy.

- [x] **Step 4: Run purchase and result-page tests**

Run: `npm test -- --run lib/simulation/purchase.test.ts features/app/GoalioApp.test.tsx`

Expected: all purchase and application tests PASS.

### Task 3: Make the home page state the protected amount clearly

**Files:**
- Modify: `features/app/GoalioApp.tsx:427-437`
- Test: `features/app/GoalioApp.test.tsx`
- Modify: `GOALIO_DIRECTION.md`
- Modify: `GOALIO_COPY_GUIDE.md`
- Modify: `GOALIO_UI_IMAGE_PROMPTS.md`

**Interfaces:**
- Consumes: `result.tomorrowMaxSpend`
- Produces: visible label “明天额外最多可花” and a note explaining that basic costs and saved progress are protected

- [x] **Step 1: Update the integration test first**

Assert that the home result displays “明天额外最多可花” and the protection note. Remove expectations for the ambiguous old label.

- [x] **Step 2: Run the focused integration test and verify RED**

Run: `npm test -- --run features/app/GoalioApp.test.tsx -t "completes the setup journey"`

Expected: FAIL because the page still renders the old label and note.

- [x] **Step 3: Update UI copy and documentation**

Render “明天额外最多可花”. Render: “这个金额不包含明天的基本开销，也不会动用已为目标留好的钱。实际余额或计划变化后会重新计算。” Update the three product copy/direction documents to use the same definition.

- [x] **Step 4: Run the focused integration test**

Run: `npm test -- --run features/app/GoalioApp.test.tsx -t "completes the setup journey"`

Expected: PASS.

### Task 4: Verify the complete product behavior

**Files:**
- Verify all files changed in Tasks 1 and 2

**Interfaces:**
- Consumes: the finished simulator and page copy
- Produces: a tested production build and a browser-verified home screen

- [x] **Step 1: Run all automated checks**

Run: `npm test && npm run lint && npm run build`

Expected: 0 test failures, 0 lint errors, and a successful production build.

- [x] **Step 2: Verify in the local browser**

Advance through a representative day, update the actual balance, and confirm that the home screen visibly uses the new label and that the displayed progress follows the cross-day invariant.
