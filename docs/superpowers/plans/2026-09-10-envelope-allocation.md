# Goalio Envelope Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace time-released goal progress with a deterministic envelope allocation shared by projections and spending decisions.

**Architecture:** Keep `runSimulation` as the single financial boundary. Derive current goal allocation directly from balance minus required reserves, project completion through dated cash flows, and let the existing home and purchase layers consume the resulting values.

**Tech Stack:** TypeScript 5.9, React 19, Next.js 16 App Router, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-10-envelope-allocation-design.md`

## Global Constraints

- Preserve the existing version 1 local-storage schema.
- Use integer cents for every financial calculation.
- Use one simulation result for home, purchase evaluation, and plan recalculation.
- Do not retain the 30-day release floor in financial readiness.
- Historical progress may affect `change` only.

---

### Task 1: Envelope allocation and completion projection

**Files:**
- Modify: `lib/simulation/simulator.test.ts`
- Modify: `lib/simulation/simulator.mixed.test.ts`
- Modify: `lib/simulation/simulator.ts`

**Interfaces:**
- Consumes: `SimulationInput`, scheduled cash-flow rules, integer-cent helpers.
- Produces: the existing `runSimulation(input): SimulationResult` interface with deterministic `effectiveSaved`, `completionDate`, `requiredReserve`, `canMeetDeadline`, and `tomorrowMaxSpend`.

- [ ] **Step 1: Replace paced-progress expectations with envelope invariants**

Add literal fixtures proving that ¥23,000 immediately funds a ¥1,800 goal, same-day balance increases raise allocation, history does not alter identical current inputs, and a future completion date comes from cash-flow projection.

- [ ] **Step 2: Run simulator tests and verify the new assertions fail**

Run: `npm test -- lib/simulation/simulator.test.ts lib/simulation/simulator.mixed.test.ts`

Expected: failures show the old same-day freeze and daily-release completion date.

- [ ] **Step 3: Implement the envelope calculation**

Remove `releasePerDay`. Compute current allocation from current safe capacity, add a bounded day-by-day completion projection, and retain `previous.effectiveSaved` only for `change`.

- [ ] **Step 4: Run simulator tests and make every invariant pass**

Run: `npm test -- lib/simulation/simulator.test.ts lib/simulation/simulator.mixed.test.ts`

Expected: all simulator tests pass.

### Task 2: Purchase alternatives use the protected envelope

**Files:**
- Modify: `lib/simulation/purchase.test.ts`
- Modify: `lib/simulation/purchase.ts`

**Interfaces:**
- Consumes: `runSimulation(input): SimulationResult` from Task 1.
- Produces: the existing `evaluatePurchase(input): PurchaseEvaluation` API with alternatives that preserve baseline allocation and completion date.

- [ ] **Step 1: Add failing purchase tests for a fully funded goal and a partially funded goal**

Assert that the maximum no-delay amount excludes the baseline goal allocation and that buying one cent beyond the safe amount reduces allocation or delays completion.

- [ ] **Step 2: Run purchase tests and verify the expected failures**

Run: `npm test -- lib/simulation/purchase.test.ts`

Expected: at least one new envelope-preservation assertion fails under the old alternative search.

- [ ] **Step 3: Apply the baseline-allocation condition to purchase searches**

Require candidate scenarios to keep `effectiveSaved >= baseline.effectiveSaved` in addition to preserving the baseline completion date.

- [ ] **Step 4: Run purchase tests**

Run: `npm test -- lib/simulation/purchase.test.ts`

Expected: all purchase tests pass.

### Task 3: Recalculate edited goals and verify the home contract

**Files:**
- Modify: `features/app/GoalioApp.test.tsx`
- Modify: `features/app/GoalioApp.tsx`
- Modify: `GOALIO_DIRECTION.md`
- Modify: `GOALIO_COPY_GUIDE.md`

**Interfaces:**
- Consumes: `runSimulation` from Task 1 and persisted `GoalioState`.
- Produces: atomically recalculated goal edits and a home page whose completion and spend rows come from the same result.

- [ ] **Step 1: Add a failing UI regression test for the reported scenario**

Enter a ¥1,800 goal due today and a ¥23,000 balance after an existing same-day snapshot. Assert that the goal is immediately complete. Add a home-state assertion that an infeasible deadline never coexists with the tomorrow-spend row.

- [ ] **Step 2: Run the UI regression test and verify it fails for the old progress freeze**

Run: `npm test -- features/app/GoalioApp.test.tsx`

Expected: the reported-scenario test remains on the home view with stale progress.

- [ ] **Step 3: Route goal-plan changes through current-input recalculation**

Pass `today` into `GoalScreen`, commit the edited goal through `applyPlanChange`, and ensure the next balance submission derives the allocation independently from history.

- [ ] **Step 4: Update product documentation**

Describe goal allocation as current balance after required reserves and define discretionary spending as the remainder after the goal envelope.

- [ ] **Step 5: Run UI tests**

Run: `npm test -- features/app/GoalioApp.test.tsx`

Expected: all UI tests pass.

### Task 4: Full verification

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a release-ready implementation with no contradictory financial outputs.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run static checks**

Run: `npm run lint`

Expected: zero lint errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js production build succeeds.

