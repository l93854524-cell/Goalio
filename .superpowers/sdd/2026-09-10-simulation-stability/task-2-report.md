# Task 2 report: stable same-day comparison baseline

## Result

Added `previousSnapshot(state, today)` in `features/app/GoalioApp.tsx`. It considers stored history plus `lastResult`, excludes every snapshot dated today or later, and selects the latest remaining date. `applyPlanChange()`, `BalanceScreen.submit()`, `HomeScreen`, `PurchaseResultScreen`, and the root component's `home` branch now use this shared baseline.

## RED evidence

Command:

```text
npm test -- features/app/GoalioApp.test.tsx -t "同日重复提交"
```

Result: 1 targeted test ran and failed as expected. After the second same-day submission, Testing Library could no longer find `/今天多留了/`; the rendered change copy was `今天的目标进度保持不变`. The failure directly demonstrated that the first same-day snapshot had replaced the prior-day comparison baseline.

## GREEN evidence

Command:

```text
npm test -- features/app/GoalioApp.test.tsx -t "同日重复提交"
```

Result: 1/1 targeted test passed. The same-day change copy remained stable after an identical resubmission and after unmounting and rendering again from persisted state.

Command:

```text
npm test -- features/app/GoalioApp.test.tsx
```

Result: 26/26 component tests passed, including same-day resubmission, refresh restoration, plan editing, purchase evaluation, daily check-in, and existing interaction coverage.

## Full-suite evidence

Command:

```text
npm test
```

Result: 9/9 test files passed and 65/65 tests passed. The randomized simulation invariant completed within its existing budget.

Command:

```text
npm run lint -- features/app/GoalioApp.tsx features/app/GoalioApp.test.tsx
```

Result: exited 0 with no lint diagnostics.

## Files changed

- `features/app/GoalioApp.tsx`: added the strictly-prior snapshot selector and reused it at all five required simulation/evaluation call sites.
- `features/app/GoalioApp.test.tsx`: added the same-day identical-balance regression covering the second submission and persisted reload.
- `.superpowers/sdd/2026-09-10-simulation-stability/task-2-report.md`: recorded TDD and verification evidence.

## Self-review

- The selector matches the required contract: only dates strictly earlier than `today` qualify, `lastResult` is included only when it passes the same filter, and descending ISO-date order selects the latest qualifying snapshot.
- Sorting operates on a newly constructed candidates array and cannot reorder persisted history.
- All five call sites named in the brief use the selector; no direct `lastResult`-based `previous` construction remains in `GoalioApp.tsx`.
- The regression exercises user-visible behavior through real components and local storage. Reverting `BalanceScreen.submit()` to use the same-day `lastResult` reproduces the tested failure.
- Task 1's simulation reserve implementation and tests were not modified.
- `git diff --check` passed.

## Concerns

None identified within this task's scope.
