# Period Source Recovery Integrity — Incident & Checkpoint

> Date: 2026-09-01 · Status: CLOSED / FROZEN

## Incident

During Phase 3A.1 a cleanup helper (one-shot python heredoc, never saved to repo)
truncated `src/pages/PeriodPage.tsx` at the first matched legacy-state line. The
file had never been committed to git and had no backup → the working copy was
lost mid-task.

## Recovery

- Only complete logic source unaffected by the incident:
  `dist/assets/PeriodPage-*.js` (produced by the Phase 3A final build).
  Dry-run extraction (`/tmp/periodpage-chunk.js`, `/tmp/periodpage-strings.txt`)
  was used as ground truth; the page was reconstructed source-first, **not**
  by reverse-engineering the minified code as the architecture.
- Reconstruction found & fixed (vs recovery evidence):
  1. Bento action list order — original: `[hydrate, log, rest?, warm?, move]`
  2. Dew balance in the actions header — live `getMoonDewBalance()` (not static text)
  3. Mood mini-card accent — dynamic mood color (fallback `#c64545`)
  4. `toLocaleDateString` locale parity (`zh-TW` / `en`)
  5. `onAction?.()` on new action toggle (hydrate → +250ml; log → composer)
  6. Hydration undo targeted the correct entry via `useHydrationStore.getState()`
- Verification: 230/230 targeted browser tests (chromium+webkit) — the suite is
  the executable contract for every restored behavior.

## Guard Rules (binding for future destructive source rewrites)

Any destructive source rewrite must:
- target file exists AND (git-tracked OR backup exists)
- write to a temp file, verify non-empty output + expected marker count
- atomic replace (never open→truncate→write)
- prefer `git add` of audited files immediately after a milestone so the
  working tree is always recoverable

## Freeze

- `PeriodInputSurface` = shared `PeriodRecordSheet` only (legacy PeriodModal retired)
- `src/pages/PeriodPage.tsx`, `src/styles/period*.css`, `src/components/period/*`,
  `src/features/period/*`, `src/utils/periodStorage*` now git-tracked (explicit add).
