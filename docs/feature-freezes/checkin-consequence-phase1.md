# Check-in Consequence Phase 1 Freeze

Status: **FROZEN**<br>
Effective: **2026-09-20**<br>
Canonical surface: the existing daily check-in / 報備 system (`useCheckInStore` + the consolidated 報備 window)

## A. Canonical ownership chain

| # | Owner | Where |
| --- | --- | --- |
| 1 | Check-in store (single owner) | `src/features/tideclock/useCheckInStore.ts`, persist `lunartide-check-in` v1 |
| 2 | Completed day | `CheckInRecord { kind:'clock_in', status:'completed' \| 'late' }` |
| 3 | Missed day | `CheckInRecord { kind:'clock_in', status:'makeup_required' }` |
| 4 | Streak | `calculatePerfectStreak` in `src/features/tideclock/tideclockEngine.ts` |
| 5 | Tide rank / progress | canonical MoonDew ledger via `getMoonDewProgression` (`src/features/moon-dew/`), streak input through the one-way `canonicalCheckInStreak` adapter |
| 6 | Local-date normalization | `toLocalDateString` (`src/utils/date.ts`) |
| 7 | Rollover | day keys derive at read time; day-close reconcile is `useCheckInReconcile` |
| 8 | Presentation | consolidated 報備 window (`DailyTideFloatingWindow` → `CheckInTabContent`): stats, calendar grid, consequence block; island `UsageControlPanel` shows status/streak |
| 9 | Consequence copy | `src/features/tideclock/checkInConsequence.ts` (single canonical set) |
| 10 | Backfill | store-level `submitMakeup` / `canMakeup` (existing; no UI) |

No second missed-day store, streak, calendar status or progress counter may be created.

## B. Missed-day representation

One `CheckInRecord { kind: 'clock_in', status: 'makeup_required' }` per ended local day without a
check-in record — the existing canonical missed state. Date-keyed; exactly one final state per
day; the calendar maps it to `× 漏簽` (`dt-calendar-cell--missed`, `data-date-state="missed"`).

## C. Reconcile algorithm

- `findUnreconciledMissedDates(records, now)` (pure): candidates are strictly **after the user's
  earliest check-in** (history anchor — days before reporting started are never marked), bounded
  to the **current local month**, and the **previous day is always covered** (23:59 → 00:00
  rollover works even across a month boundary). No check-in history → no candidates.
- `reconcileMissedDays(now?)` (store): single batch write of missed records; **idempotent** —
  reruns return 0 and never duplicate or re-mark a day.
- Trigger `useCheckInReconcile` (mounted in the always-mounted dock): app mount + `visibilitychange`
  → visible + a 30s watcher that only fires when the local date changes. Local-date based,
  UI-independent, and never a “mount-time deduct once” side effect.
- DST-safe: noon-anchored date iteration; all day keys via `toLocalDateString`.

## D. Streak contract

Canonical owner is `calculatePerfectStreak`. A missed day breaks the streak (missed markers and
made-up records are excluded from the perfect streak); completed history is never mutated.

## E. Tide-progress contract

潮階 progress is owned by the canonical MoonDew ledger. A missed day creates **0 progress** (no
ledger entry); there is **no negative progress, no rollback, and no historical reversal**. This
phase did not attach a new progress pipeline and did not modify the ledger.

## F. Acknowledgement contract

- Presentation shows in the existing check-in panel only: one low-frequency block on entering the
  報備 panel when a latest missed day is unacknowledged and today is still open.
- **Once per missed day**; the presentation writes the acknowledgement; reload does not replay it;
  a newer missed day may present once again; completing today retires the presentation.
- The `×` control dismisses the block for the session.
- No new store, no new route, no modal, no popup spam.

## G. Canonical copy (single set — no random pool)

```
「昨天沒來。
『忘了』不是我接受的理由。
現在，把今天該做的補上。」
```

Secondary line: `今天完成報備前，潮階不會前進。`

For an older latest missed day only the leading date token is substituted
(`9月15日沒來。` / `9月15日漏簽`); the voice itself never varies.

## H. Persistence field

`acknowledgedMissedDate: string | null` in the existing `useCheckInStore` state (included in the
existing `partialize`, same `lunartide-check-in` v1 key, no version bump — old payloads merge
safely under zustand's shallow merge).

## I. Backfill rule

The existing store-level backfill (`submitMakeup`, 48h window from the marker's `createdAt`) may
correct data, but **makeup does not restore the perfect streak** — made-up days stay excluded from
`calculatePerfectStreak`. No backfill UI is added by this phase.

## J. Freeze boundary

Phase 1 is closed. Do not start, add, or plan — without an explicit, separately authorized reopen:

- Phase 1.1;
- escalation punishment or multiple punishment levels;
- random Rune copy pools for the consequence;
- streak recovery mechanics;
- paid recovery;
- chat / calendar lockouts;
- new currency or new reward systems;
- any second missed-day store, streak, progress counter, or calendar status owner.

Allowed without reopening this freeze: documentation, evidence integrity, and checkpoint/staging
work that references this baseline.

## Validation baseline

- Acceptance `e2e/checkin-consequence-phase1.spec.ts`: **18/18** (9 scenarios × Chromium/WebKit).
- Tideclock unit suite: **82/82**; full Vitest: 169 files / **1605/1605**.
- Acceptance + regression batch: **58 passed / 0 failed** (moondew-rehome, daily-ritual-visual-polish,
  calendar-daily-settlement).
- TypeScript: **0 errors**. Production build: **PASS**.
- Evidence: `docs/reports/evidence/checkin-consequence-phase1/` (14 PNG + `INDEX.md`, hashes verified).
- Report: `docs/reports/checkin-consequence-phase1.md`.
