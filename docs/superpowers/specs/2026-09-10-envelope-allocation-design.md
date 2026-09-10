# Goalio Envelope Allocation Design

## Goal

Make every financial result derive from one priority waterfall so goal progress, completion dates, and discretionary spending cannot contradict one another.

## Financial model

For a given date and balance, Goalio allocates money in this order:

1. Future required living costs and fixed expenses.
2. The current savings goal, capped at the goal amount.
3. Discretionary spending.

The current goal allocation is `clamp(balance - requiredReserve, 0, goal.amount)`. It is derived from the current balance and current plan on every calculation. Historical snapshots explain change over time but never cap a new positive allocation.

If the current allocation equals the goal amount, the completion date is today. Otherwise, Goalio projects scheduled income, food, expenses, and scenario purchases forward and returns the first date on which the projected balance can cover both that date's required reserve and the full goal amount. No artificial daily-release period is applied.

## Spending limits and purchase evaluation

Tomorrow's extra-spend limit uses the same simulator. A candidate purchase is safe only when it preserves the current goal allocation, preserves required reserves, and leaves the projected completion date on or before the goal deadline.

Purchase evaluation compares baseline and purchase scenarios produced by the same allocation model. The maximum no-delay purchase preserves the baseline goal allocation and baseline completion date. The earliest no-delay purchase uses the same conditions.

## Plan changes and history

Changing balance, goal amount, goal deadline, income, food, or fixed expenses triggers a derivation from the complete current input. `previous.effectiveSaved` is used only to calculate the displayed change. Edit order and same-day recalculation cannot alter the resulting allocation.

## Required invariants

- Sufficient current cash funds the goal immediately after required reserves are covered.
- Increasing balance cannot reduce goal allocation or delay completion for an otherwise identical plan.
- Tightening a deadline cannot increase the safe discretionary-spend limit.
- Identical current inputs produce identical results regardless of history or edit order.
- Spending the displayed maximum preserves required reserves and the current goal allocation.
- `canMeetDeadline` is true exactly when a completion date exists on or before the deadline.
- A home view that says the deadline cannot be met never displays a safe-spend amount.

## Compatibility

The persisted schema remains version 1. Existing `lastResult.effectiveSaved` values remain readable and are reinterpreted only as historical comparison points during the next calculation.

