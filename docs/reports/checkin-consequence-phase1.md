# Check-in Consequence Phase 1

Date: **2026-09-20**<br>
Branch: `main`<br>
Observed HEAD: `93cb6840a1f854f3f90ae6b4ff50985f96525473`<br>
Status: **PASS** — missed-day reconcile + low-frequency consequence, inside the existing check-in owners only.

## 1. Canonical owner chain (audit result)

| # | Owner | Where | Notes |
| --- | --- | --- | --- |
| 1 | Daily check-in store | `src/features/tideclock/useCheckInStore.ts`, persist `lunartide-check-in` v1 | single canonical owner (Life Utility Phase A closure; legacy `useAppStore.tideCheckIn` writers fenced) |
| 2 | Completed day | `CheckInRecord { kind:'clock_in', status:'completed'\|'late' }` | strict mode adds a `clock_out` record |
| 3 | Missed day | `CheckInRecord { kind:'clock_in', status:'makeup_required' }` | created by the existing `markMissed(date)`; **had zero production callers** before this phase — the model existed, nothing wrote it. Calendar maps it to `× 漏簽` (`dt-calendar-cell--missed`) |
| 4 | Streak | `calculatePerfectStreak` (tideclockEngine) via `getCurrentPerfectStreak` | excludes `makeup_required` and `makeupReason`; one-way MoonDew adapter `selectCanonicalCheckInStreak` (no second source) |
| 5 | Tide rank (潮階) | `getMoonDewProgression(ledger, focusSessions, checkInStreak)` over `useAppStore.moonDewLedger` | ledger-owned; check-ins feed it via `clockIn → addMoonDewEntry`; missed days add no entries → **0 progress automatically**, no reversal path → no negative/rollback. §8 gate: no new progress pipeline added; the ledger was not touched |
| 6 | Local-date normalization | `toLocalDateString` (`src/utils/date.ts`) | all day keys are local `YYYY-MM-DD` |
| 7 | Timezone / rollover | none before this phase | day keys derive at read time; Phase 1 adds the day-close reconcile (§3) |
| 8 | Persistence / migration | same key, version 1, existing `partialize` | one new field joins `partialize`; zustand shallow merge keeps old payloads valid (no version bump) |
| 9 | Calendar / check-in UI | live panel = `DailyTideFloatingWindow` → `CheckInTabContent` (報備 tab): stats, `dt-calendar-grid` (status→today/checked/missed/future), legend ○今天 ○已報備 ×漏簽; island `UsageControlPanel` (status + streak) | `DailyCheckInWelcomePanel` / `HomeCheckInWidget` / `DailyTidePanel` / `DailyTideWidget` are orphaned (unmounted) — pre-existing |
| 10 | Existing backfill | store-level `submitMakeup` / `canMakeup` (48h window, writes `makeupReason` + `CheckInCorrection`) | no UI; perfect streak already excludes made-up days. Phase 1 keeps it as-is and adds nothing |

No second missed-day store, streak, calendar status, or progress counter was created.

## 2. Modified files

**Production**

| File | SHA-256 |
| --- | --- |
| `src/features/tideclock/tideclockEngine.ts` — `findUnreconciledMissedDates`, `selectLatestMissedDate` (pure) | `3328be6a2cd59d05b19696fc87ead83f8f1230f0f478a00e0f5e47bc269152ba` |
| `src/features/tideclock/useCheckInStore.ts` — `buildMissedRecord`, `reconcileMissedDays`, `acknowledgeMissedConsequence`, `acknowledgedMissedDate` | `b12807fbeb7b53d04750e914cfce174903a0eb076dc50b68f919c4584b43a5c0` |
| `src/features/tideclock/checkInConsequence.ts` (new) — canonical copy + presentation selector | `ae151fd7c283d0c7b92fa0e73ab77c275d59aa6413bd6c9e4ae5b51547dac0d9` |
| `src/features/tideclock/useCheckInReconcile.ts` (new) — app-level trigger hook | `44e18b3f464e458af10b5bbb8f8a281b5042d48a32377119ad64be9c2dadefcc` |
| `src/components/home/DailyTideFloatingWindow.tsx` — hook mount, missedDays union, consequence block | `6129c2191fa95f7e7ea75f5327d3b5f4cc4fd768a746b83a77d76752c7764ac5` |
| `src/styles/dailytide.css` — `.dt-consequence*` | `926e766aaab058a8445229bdbe90e9f645569e8d8757b9fd2129756320569486` |

**Tests**

| File | SHA-256 |
| --- | --- |
| `src/features/tideclock/checkInReconcile.test.ts` (new, 8) | `2e6ee0ee0c94aaf65a30188946051de90008b484679886fd57f8a1e56a890ce9` |
| `src/features/tideclock/checkInConsequence.test.ts` (new, 6) | `0390748b70e976d39d289082d1e88d75160595246151c5c6897ecbf0788e179d` |
| `e2e/checkin-consequence-phase1.spec.ts` (new, 9 scenarios) | `9e31aba8cae6b858037d0237346662bb80004d1508c23545850ec882d8680537` |

**Docs / evidence** — this report + `docs/reports/evidence/checkin-consequence-phase1/` (14 PNG).

Not touched (safety boundary): hydration store/schema, provider/runtime, credential, Guest Lounge, ChatPage, DiaryPanel, recovery artifacts, Home Clock, Composer Utility Tray, MoonDew ledger, other stores.

## 3. Missed-day algorithm

- **State**: one `makeup_required` `clock_in` record per ended local day that has no check-in record — the existing canonical missed representation. Date-keyed (+ the record-existence check) ⇒ one final state per day.
- **Window** (`findUnreconciledMissedDates`): strictly after the user's earliest check-in (history anchor — days before reporting started are never marked), bounded to the current local month, **plus the previous day** as a rollover guarantee (works across a month boundary). No check-in history → no candidates. Noon-anchored, `toLocalDateString`-based date iteration (DST-safe).
- **Idempotent**: re-runs (reload, remount, visibility) return 0 and never duplicate or re-mark a day; `reconcileMissedDays` performs a single batch write.
- **Trigger** (`useCheckInReconcile`, mounted in the always-mounted dock): runs at app mount, on `visibilitychange` → visible, and on a 30s watcher that only fires when the local date changed. Independent of whether any check-in UI is open; no mount-time "deduct once" side effect — it only derives missing day states.
- **Audit fix during acceptance**: the first window rule force-included yesterday even for a user whose history started *today*, which the Phase A ownership regression spec caught; the rule now marks strictly post-anchor days, locked by a new unit test.

## 4. Streak behavior

- Owner unchanged. A missed day is excluded from `calculatePerfectStreak`, so the streak breaks at it; completed history is untouched; makeup (`submitMakeup`) corrects the record but never restores the streak (existing rule, now covered by a unit test). Verified in acceptance A (5-day streak kept, no consequence) and B (streak 0).

## 5. Tide-progress behavior

- 潮階 is ledger-owned (MoonDew ledger). A missed day writes no ledger entry → 0 progress; no negatives, no rollback, no re-settlement of completed days, no history mutation. Verified in acceptance B (`0` check-in grants, `潮階 · Lv1 初潮`, `0 / 50`). Per §8 no new progress pipeline was attached.

## 6. Consequence acknowledgement behavior

- **Presentation** — entering the 報備 panel with an unacknowledged latest missed day and today still open shows one low-frequency block above the CTA: `× 昨日漏簽` · Rune voice · hint `今天完成報備前，潮階不會前進。` The `×` control dismisses it for the session.
- **Copy** — one canonical set, no random pool: `「昨天沒來。\n『忘了』不是我接受的理由。\n現在，把今天該做的補上。」`; only the leading date token is substituted for an older missed day (`9月15日沒來。` / `9月15日漏簽`).
- **Acknowledgement** — minimal field `acknowledgedMissedDate` in the existing check-in store (no new store, no new global state); written when the consequence is presented; persisted through the existing `partialize`.
- **Frequency** — never replayed on panel re-entry or reload; disappears once today is recorded (acceptance E); a newer missed day presents once again; historical missed marks remain in records.
- **No punishment** — no data deletion, no Rune lock, no feature gating, no currency deduction, no new resource, no popup spam.

## 7. Screenshots

`docs/reports/evidence/checkin-consequence-phase1/` (14): `A-clean-*`, `B-missed-state-*`, `C-consequence-light-*`, `C-consequence-dark-*`, `F-two-misses-calendar-*`, `I-390-*`, `I-430-*` × Chromium/WebKit. This session cannot render images; the assertions above are programmatic, and human visual review is recommended.

## 8. Tests

- **Acceptance (new spec, 9 scenarios × Chromium/WebKit = 18/18)**: A completed-yesterday (streak 5, no consequence) · B missed-yesterday (missed state, streak 0, 0 tide progress) · C first entry presents the canonical consequence once (exact copy + persisted acknowledgement) · D reload does not duplicate the missed entry or replay the consequence · E completing today retires it · F two consecutive missed days marked once each + `× 漏簽` calendar mapping + reload-safe · H 23:59 → 00:00 rollover reconciles the previous day exactly once · I 390/430 no overflow, CTA and close reachable. G (backfill) is covered at unit level because the existing backfill has no UI.
- **Unit**: 14 new tests (`checkInReconcile.test.ts` 8, `checkInConsequence.test.ts` 6); tideclock family 82/82.
- **Regression (Chromium+WebKit, all green)**: `life-utility-phase-d-moondew-rehome`, `daily-ritual-visual-polish`, `calendar-daily-settlement-phase1` + the new acceptance spec — **58 passed / 0 failed**.
- **Pre-existing failures (not caused by this phase; evidenced)**: `calendar-checkin-residual-closure` ×4 — it seeds no check-in data (reconcile is a no-op) and fails on the current calendar layout (`.app-main` scrollWidth 388 > 360); `five-element-checkin-phase1` ×4 — the seeded `[data-widget-id="home-checkin"]` Home widget is retired from the stack; `top-utility-island-phase-d1.spec.ts:194` — stale panel-close assertion (flaky; `UsageControlPanel` untouched since 2026-09-16); the orphaned Home panel specs (`home-daily-checkin-phase1` 8/8, `phase2b`) remain stale as before.

## 9. TypeScript

`tsc -b --pretty false`: **0 errors**.

## 10. Build

`npm run build`: **PASS** (only the repository's pre-existing chunk-size / ineffective-dynamic-import warnings).

## 11. Remaining risks / notes

- The reconcile window is month-bounded + history-anchored: days before the first-ever check-in stay unmarked, while the report's `漏簽天數` counter keeps its pre-existing union semantics (absent days also count). This inconsistency predates Phase 1 and was deliberately not changed (it is spec-codified in `life-utility-phase-d-moondew-rehome`).
- `acknowledgedMissedDate` is a single value: when a newer missed day is presented, older unshown misses are absorbed (intentional low-frequency behaviour).
- Backfill stays store-level (no UI) and its `makeupHours` window runs from the marker's `createdAt`; a backfilled day never restores the perfect streak.
- Orphaned check-in panels and their stale specs still exist (pre-existing debt, unrelated to this phase).
- Repository remains broadly dirty; nothing was staged or committed by this phase.
