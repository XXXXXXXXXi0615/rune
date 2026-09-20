# Hydration Settings Consolidation Phase 1 Freeze

Status: **FROZEN**<br>
Effective: **2026-09-20**<br>
Canonical surface: the 今日飲水 tab of the Daily Tide window (`DailyTideFloatingWindow`)

## Canonical ownership

| Owner | Where |
| --- | --- |
| Store (single) | `src/store/useHydrationStore.ts` — `useHydrationStore` |
| Persistence | **`lunartide-hydration-v1` v3** (unchanged by this phase) |
| Daily goal | `settings.dailyGoalMl` + `setDailyGoal()` |
| Quick amounts | `settings.quickAmounts` + `setQuickAmounts()` |
| Records | `entries` + `getDailyEntries()` / `removeEntry()` / `undoLastEntry()` |
| Presentation | `src/components/home/HydrationTabContent.tsx` + `src/components/home/DailyTideFloatingWindow.tsx` (footer) |

No second hydration store, goal owner, quick-amount owner, or persistence schema may be created.

## Frozen product contract

**Main hydration view** contains: current/target summary · progress vessel · quick refill ·
custom refill · today's records · undo last entry · 飲水設定 entry · footer 「設定已同步」 · close.

The main view **MUST NOT restore the 500 / 1000 / 1500 / 2000 ml milestone list**; target
information lives in the settings subview only.

**Settings subview** (same Daily Tide window, no new route, exactly one hydration subview at a time):

- 每日目標 — `1500 / 2000 / 2500 / 自訂`; a preset click persists immediately; 自訂 uses the
  existing clamped numeric input.
- 快捷補水設定 — the existing `quickAmounts` owner with its **draft → 儲存 / 取消** editor
  (deliberately not auto-saved).
- 恢復預設 — existing `resetSettings` behaviour.

## Freeze boundary

Without an explicit, separately authorized reopen, do not:

- restore the milestone list on the main view;
- create a second hydration store, goal owner, or quick-amount owner;
- add reminders, notifications, or background scheduling;
- add hydration punishment;
- add AI hydration advice;
- change the persistence schema or the hydration entry semantics;
- open Hydration Phase 1.1.

## Validation baseline

- Acceptance `e2e/hydration-settings-consolidation-phase1.spec.ts`: **14/14** (7 scenarios × Chromium/WebKit).
- Focused closure run (acceptance + `daily-ritual-visual-polish`): **20/20**.
- TypeScript: **0 errors**. Production build: **PASS**. `git diff --check`: **PASS**.
- Vitest (repository): **1605/1605**.
- Evidence: `docs/reports/evidence/hydration-settings-consolidation-phase1/` (16 PNG).
- Report: `docs/reports/hydration-settings-consolidation-phase1.md`.
- Checkpoint audit: `docs/reports/hydration-settings-consolidation-phase1-freeze-checkpoint-audit.md`.
