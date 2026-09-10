# Task 1 report: deadline-independent necessary reserves

## Result

Implemented `RESERVE_HORIZON_DAYS = 365` in `lib/simulation/simulator.ts`. `requiredReserve()` now scans the fixed 365-day observation window and no longer derives its horizon from the goal deadline. Amounts remain integer cents.

## RED evidence

Command:

```text
npm test -- lib/simulation/simulator.mixed.test.ts
```

Result: 10 tests ran, 8 passed, 2 failed as expected. The new deadline monotonicity test observed reserves of 30,000 vs 45,000 cents, and the deadline-today fixed-expense test observed 0 instead of 50,000 cents.

## GREEN evidence

Command:

```text
npm test -- lib/simulation/simulator.test.ts lib/simulation/simulator.mixed.test.ts
```

Result: all 16 assertions passed, including both new regression tests and the randomized invariant test. Vitest also emitted one `vitest-worker` `onTaskUpdate` timeout while the 160-second randomized test ran; this is recorded as a runner concern below.

## Full-suite evidence

Command:

```text
npm test
```

Result: 61/64 assertions passed. Failures were outside the scoped files: two `features/app/GoalioApp.test.tsx` tests timed out at 5 seconds, and `lib/simulation/purchase.test.ts` still expects the former shorter reserve behavior. The full run also emitted the same Vitest worker update timeout.

## Files changed

- `lib/simulation/simulator.ts`: fixed reserve horizon at 365 days and removed the unused `daysBetween` import.
- `lib/simulation/simulator.mixed.test.ts`: added the two specified regression tests; updated the existing reserve expectation to reflect the fixed horizon; extended the randomized test budget to 180 seconds because the mandated horizon makes it run for about 160 seconds.

## Self-review

- Change is limited to the requested simulator and mixed-test files.
- Reserve calculations continue to use `cents()` and integer arithmetic.
- Deadline remains used for deadline eligibility/completion checks; it only no longer controls the reserve scan window.
- `git diff --check` passed.

## Concerns

The fixed 365-day scan substantially increases simulation cost. The mixed randomized test takes about 160 seconds and causes Vitest worker update-timeout noise; two UI tests hit their existing 5-second limits in the full suite. The purchase test’s old short-horizon expectation now conflicts with the binding 365-day reserve rule and should be revisited by the broader simulation-stability work.

## Fix round 1

Addressed review findings by computing one 730-day cash-flow prefix timeline and rolling minimum per simulation path. Reserve lookups for the current and projected dates are now near-linear and preserve the fixed 365-day horizon and integer-cent arithmetic. The randomized test timeout was reduced from 180 seconds to 30 seconds.

The day-boundary regression expense now occurs on 2026-02-16 (day 46), proving that a 40/45-day implementation cannot satisfy it. The purchase reserve fixture now uses a 40,000-cent balance and 4,000-cent purchase, preserving the intended 500-cent reserve shortfall under the 36,500-cent living reserve.

### Fix verification

```text
npx vitest run lib/simulation/simulator.test.ts lib/simulation/simulator.mixed.test.ts lib/simulation/purchase.test.ts
```

Result: 3 files passed, 20/20 tests passed; randomized invariant completed in about 18 seconds.

```text
npm test
```

Result: 9 files passed, 64/64 tests passed, no unhandled errors; total duration about 22 seconds.

Self-review after the fix: the reserve timeline covers every projected date through today + 365 days plus its full 365-day lookahead, scenario purchases are included in the precomputed flow, and `git diff --check` is clean.
