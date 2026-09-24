# Retired — Cashflow UI (Life Utility Simplification, Phase B)

Retired on 2026-09-15 as part of **PHASE B — Cashflow UI Retirement**
(plan: `docs/plans/LIFE_UTILITY_SIMPLIFICATION_PLAN.md`).

## What retired here

Cashflow product presentation only. The canonical finance layer was **not** retired:

- `useAppStore.moneyTransactions` + `add/update/deleteMoneyTransaction` — **kept**
- `src/features/lifeLedger/canonicalFinanceStore.ts` (canonical finance bridge) — **kept**
- Life Ledger `entries` (`expense` / `income`) — **kept**
- Chat expense ingestion (`ChatPage` → `addLedgerEntry`) — **kept**
- Calendar Life finance projection (`lifeUtilityContent.deriveDailyFinanceTotals`) — **kept**

## Files

| File | Was |
|---|---|
| `MoneyHeroCard.tsx` | cashflow hero (balance + month in/out) |
| `LedgerOverview.tsx` | cashflow overview (month totals, budgets, upcoming subs) |
| `LedgerTransactions.tsx` | cashflow transaction list + budget bars + quick add |
| `LedgerBudget.tsx` | cashflow budget view |
| `LedgerSubscriptions.tsx` | subscription list / totals |
| `LedgerSettings.tsx` | accounts + payment sources + subscription settings |
| `SubscriptionEditor.tsx` | subscription editor |
| `TransactionEditorDialog.tsx` / `TransactionEditorSheet.tsx` / `TransactionEditorForm.tsx` | cashflow transaction editors |
| `LedgerQuickActions.tsx` | cashflow quick actions |
| `LedgerWorkspace.tsx` / `LedgerBottomNav.tsx` | cashflow workspace shell (page/window modes) |
| `LedgerFloatingWindow.tsx` | unmounted cashflow floating window |
| `Subscriptions.tsx` + `Subscriptions.module.css` | orphaned subscriptions page (dead lazy import) |
| `useLedgerWindowStore.ts` | cashflow window/tab UI store (in-memory only, no persistence) |

## Restore note

Restoration is **not** authorised by Phase B. These files are kept only as a historical
reference so the presentation can be audited without git archaeology. Restoring any of them
also restores the retired Cashflow product surface, which the approved plan retires
permanently (see plan §5 retire list / §7 migration list).
