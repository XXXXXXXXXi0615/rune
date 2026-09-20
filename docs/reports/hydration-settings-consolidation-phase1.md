# Hydration Settings Consolidation Phase 1

Date: **2026-09-20**<br>
Branch: `main`<br>
Observed HEAD: `81d92601f42aea430c8abb214ddeeae7e77c3187`<br>
Status: **PASS** — main view is the record surface only; 每日目標 + 快捷補水設定 live in the
secondary settings subview of the same Daily Tide window.

## 1. Existing hydration ownership (audit result — no second store created)

| Owner | Where |
| --- | --- |
| Hydration store (single) | `src/store/useHydrationStore.ts`, persist **`lunartide-hydration-v1`** (version 3, v1→v3 migrations) |
| Daily goal | `settings.dailyGoalMl` + `setDailyGoal(ml)` (clamped 250–6000) |
| Quick-add presets | `settings.quickAmounts` + `setQuickAmounts(amounts)` (custom amounts supported, ≤6 entries, ≤3000 each) |
| Custom amount | `addEntry(ml, 'custom')` (UI validation: >0, ≤3000) |
| Today's entries | `entries[]` + `getDailyEntries` / `getDailyTotal` / `getLatestEntryOfDay`; `removeEntry(id)` |
| Undo last entry | `undoLastEntry()` |
| Reset | `resetSettings()` |
| Presentation | `src/components/home/HydrationTabContent.tsx` (dock 今日飲水 tab) + dock footer (已自動儲存 · 關閉) |

Phase 1 used only these owners; no schema, store, route, or persistence change.

## 2. What changed

**Main view (lighter, record-only surface)**

- Removed the right-hand target list (`.hyd-milestones`: 500 / 1000 / 1500 / 2000 ml labels).
- Kept: current/target summary, water vessel + percent, quick refill (+ 自訂), today's records
  (+ undo, show more), 飲水設定 entry, footer auto-save status + 關閉.
- Vessel stage is now a single centered column (no second column reserved for the removed list).

**Settings subview (secondary surface, same window)**

- 飲水設定 entry (`hyd-settings-toggle`) opens the settings view inside the Daily Tide window.
- 每日目標 — `radiogroup`: **1500 / 2000 / 2500 / 自訂** (`setDailyGoal`; instant write, auto-saved).
  自訂 reveals the existing numeric input (`hyd-goal-input`, clamped 250–6000) + 儲存.
- 快捷補水設定 — reuses the existing owner editor (currently `+200 · +100 · +250 · +500` on a
  fresh install; edit → `setQuickAmounts`) plus a read-only 目前 summary line.
- 恢復預設 — kept (existing `resetSettings` affordance; removes both goal and quick overrides).
- Back control returns to the main view; exactly one subview exists at a time; no new route, no
  modal stack, same Daily Tide window.

**Not added** (per scope): reminders, notification permission, background scheduling, achievements,
hydration punishment, AI advice, new schema, new store, new route.

## 3. Behaviour notes

- The legacy-cup bootstrap is pre-existing and now visible in the settings summary: a fresh install
  migrates `cupMl` (200) into the first quick amount → `[200, 100, 250, 500]`.
- `hyd-settings-body` (accordion body) is retired; its only references were in pre-existing stale
  specs. `hyd-settings-toggle` keeps its test id as the entry navigator.

## 4. Responsive / visual contract

- 390 / 430: no horizontal overflow; all four target controls ≥44×44 and hit-testable; footer
  `關閉` remains visible and reachable; only the dock body scrolls (header/footer geometry stable
  while the body is scrolled).
- Light and dark themes verified for both subviews.

## 5. Acceptance (new spec, 7 scenarios × Chromium/WebKit = 14/14)

`e2e/hydration-settings-consolidation-phase1.spec.ts`

- Main view no target radio list (`.hyd-milestones` + `hyd-milestone-*` absent), summary / vessel /
  quick row / settings entry / footer auto-save intact.
- Settings subview: single subview, target change (2000 → 2500), back → main updates instantly
  (`/ 2500 ml`, 20% after a 500 ml record), persisted in `lunartide-hydration-v1`.
- 自訂 target (3200) persists across reload; quick refill and custom refill unchanged.
- Quick presets editable from settings (existing owner): `100, 200` → quick row `+100/+200`, and a
  subsequent record uses the edited preset.
- Records + undo unchanged (newest-first, time/source, undo, delete).
- 390 / 430 mobile contract above.

## 6. Gates

| Gate | Result |
| --- | --- |
| Acceptance (Chromium + WebKit) | **14/14 passed** |
| `e2e/daily-ritual-visual-polish.spec.ts` (updated: milestone assertions → “no target list”; dark contrast now audited on the settings target controls) | passed |
| Regression batch (`moondew-rehome`, `checkin-consequence-phase1`, polish, acceptance) | **56 passed / 0 failed** |
| TypeScript (`tsc -b --pretty false`) | **0 errors** |
| Vitest | **1605/1605 passed** |
| Production build | **PASS** |
| Evidence | `docs/reports/evidence/hydration-settings-consolidation-phase1/` (16 PNG) |

Pre-existing failures (not caused by this phase): `home-today-state-phase2a` ×6 — it still expects
the retired Home check-in widget row (`metrics.rowCount == 4`, `home-checkin-surface`), which was
removed by an earlier Home phase; its hydration assertions are never reached. Same stale-spec family
as `home-daily-checkin-phase1` / `phase2b`.

## 7. Final UX closure (copy / spacing only)

- **Auto-save semantics conflict resolved by copy**: the hydration footer now reads
  「**設定已同步**」 (was 「已自動儲存」). Persistence behaviour is unchanged; the test id keeps its
  historical name (`hyd-autosave-note`) to avoid unrelated spec churn — a rename can ride a future
  cleanup.
- 每日目標 keeps **preset click → immediate persistence** (no draft state).
- 快捷補水設定 keeps its explicit **draft → 儲存 / 取消** flow; it was not converted to auto-save.
- 恢復預設 keeps its existing behaviour; only its vertical spacing below the editor was slightly
  increased (`.hyd-settings-reset { margin-top: 6px }`). No warning modal added.
- No empty space was filled and nothing new was introduced (no reminders, notifications, AI advice,
  or further settings).

## 8. Remaining risks

- Pre-existing stale specs referencing retired hydration testids (`home-hydration-phase15a` —
  already failing at boot before this phase; `home-today-state-phase2a` as above).
- The milestone labels are gone from the DOM; any future doc/spec referencing
  `hyd-milestone-*` must use the settings target controls instead.
- No production behaviour outside hydration presentation was touched: check-in consequence,
  streak, missed-day reconcile, MoonDew, Chat, Provider, Guest, and Home Clock are unchanged.
