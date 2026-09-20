# Hydration Settings Consolidation Phase 1 — Freeze & Safe Checkpoint Audit

Date: **2026-09-20**<br>
Branch: `main`<br>
Observed HEAD: `81d92601f42aea430c8abb214ddeeae7e77c3187`<br>
Scope: freeze document · exact manifest · safe staging · single checkpoint commit

## 0. Freeze gate (re-verified on the current tree)

| Gate | Result |
| --- | --- |
| Acceptance `e2e/hydration-settings-consolidation-phase1.spec.ts` (7 × Chromium/WebKit) | **14/14 passed** |
| Focused closure run (acceptance + `daily-ritual-visual-polish`) | **20/20 passed** |
| TypeScript (`tsc -b --pretty false`) | **0 errors** |
| Production build | **PASS** |
| `git diff --check` | **PASS** |
| Persistence / store / schema | **unchanged** (`useHydrationStore` untouched; `lunartide-hydration-v1` v3) |

## 1. Exact manifest

Classification: **A** production · **B** unit tests · **C** e2e · **D** reports · **E** evidence ·
**F** freeze document.

### Staged set

| Class | Path | Ownership | Tracking | Mixed-phase content | Decision |
| --- | --- | --- | --- | --- | --- |
| A | `src/components/home/HydrationTabContent.tsx` | This phase's hydration presentation (main/settings subviews). Carries the hydration workstream's earlier presentation phases (summary / vessel / quick refill / records) as its same-domain lineage | untracked | same-domain lineage only (no foreign feature content) | **STAGE (whole file)** |
| C | `e2e/hydration-settings-consolidation-phase1.spec.ts` | 100% this phase | untracked (new) | none | **STAGE** |
| D | `docs/reports/hydration-settings-consolidation-phase1.md` | Phase report | untracked (new) | none | **STAGE** |
| D | `docs/reports/hydration-settings-consolidation-phase1-freeze-checkpoint-audit.md` | this audit | untracked (new) | none | **STAGE** |
| E | `docs/reports/evidence/hydration-settings-consolidation-phase1/` (16 PNG) | Phase evidence | untracked (new) | none | **STAGE** |
| F | `docs/feature-freezes/hydration-settings-consolidation-phase1.md` | Freeze document | untracked (new) | none | **STAGE** |

### Kept UNSTAGED (shared files — mixed with other phases)

| Class | Path | Mixed-phase content | Decision |
| --- | --- | --- | --- |
| A | `src/components/home/DailyTideFloatingWindow.tsx` | The whole Daily Tide dock from earlier phases, including the **Check-in Consequence Phase 1** presentation (`checkin-consequence`, acknowledgement wiring) and the growth surface; this phase contributed only the footer copy 「設定已同步」 | **UNSTAGED** |
| A | `src/styles/dailytide.css` | The dock's full stylesheet: earlier dock phases, hydration presentation (this phase's `.hyd-settings-view` / `.hyd-goal-option*` + milestone removal), **Check-in Consequence styles** (`.dt-consequence*`), growth and calendar styles | **UNSTAGED** |
| C | `e2e/daily-ritual-visual-polish.spec.ts` | The ritual-polish phase's whole spec; this phase updated only its milestone assertions / dark-contrast target | **UNSTAGED** |

Why no partial staging: all three are **untracked**, so there is no safe hunk boundary in the
index. `git add -N` + `git add -p` on a new file would commit a fragment (e.g., one changed line as
the file's entire content), producing an incoherent file and a broken overlap with the other
workstreams those files carry. Per the checkpoint rule the safe action is to keep them unstaged and
record it here; they remain in the worktree for a future consolidated checkpoint of their owning
surfaces (same policy already recorded for Check-in Consequence Phase 1).

## 2. Protected paths check

Staged set contains **none** of: Check-in Consequence files, Chat / Composer, Guest Lounge,
Provider Settings, credential/runtime, DiaryPanel, Home Clock, recovery artifacts, unrelated
hydration history. **Protected staged count = 0.**

## 3. Staged review

| Check | Result |
| --- | --- |
| Exact manifest count | **21** (1 production · 1 e2e · 2 reports incl. this audit · 16 evidence · 1 freeze document) |
| Actual staged count | **21** |
| Unexpected | **0** |
| Missing | **0** |
| Protected | **0** |
| `git diff --cached --check` | **PASS** |
| `git diff --cached --name-status` | all entries are new files (`A`) from the manifest above; no unrelated phase present |

## 4. Evidence hashes (frozen set, staged = worktree)

| File | SHA-256 |
| --- | --- |
| `main-light-chromium.png` | `401ed7cb17b09006fa7180d6534bacb04880258f92606dd0395dfd33fff6e4b6` |
| `main-light-webkit.png` | `b68e3bee8f3d3821925b79b8ab94dd9e697bee53c8ee226339a166b9b9750143` |
| `main-dark-chromium.png` | `45d33ffa4026d7d8f27bf461886671442ec5146c137069eb76f32cd490830a75` |
| `main-dark-webkit.png` | `84b29f99d8c897c4ab6e7aa41f6d33ac95929d8f16ec207d629ecc6bd15fca67` |
| `settings-light-chromium.png` | `dc62b662deee4f958205d90e2b37343789f907b183b401af26c3a6f3fba6004a` |
| `settings-light-webkit.png` | `b8bee21f0af2c7511993c95d99ae5c208966b01ed5e2370167a550bf1411da94` |
| `settings-dark-chromium.png` | `0b191fe397e0a230731e8f9844ef950be1ffb6d706cdd42d2b81e069f83c6f70` |
| `settings-dark-webkit.png` | `c1afdfb33da1f30aa7d8dfaba0e0caea8ba471ccfea91dcf3b490c9a79d8cdfb` |
| `main-390-chromium.png` | `d963fc846986f9d9e24d7929deb89e3fb6ffc55257f468978353e2e5436e44c2` |
| `main-390-webkit.png` | `7beed21b71e827d08b3066fefa318b9d17b30d00a39a0ed3595d3aeda4590a74` |
| `main-430-chromium.png` | `3518e5e77d6e8f9e9447f0ac287347fa5263a84665254e775681bc3d2ffcb51f` |
| `main-430-webkit.png` | `0d950a387b771763fe9efd361ef9b7a559d754c5f7e1df887f9362d1f6f52031` |
| `settings-390-chromium.png` | `49d3928cb24d87cad1b9d8d25ac7001aba623054268def501d020425a6659783` |
| `settings-390-webkit.png` | `220743282219262705095ba43dfefcfa763eb9eb4a015990da036f9481c4c72e` |
| `settings-430-chromium.png` | `b757c3384f45663856f2f3900ec1eb0dd0af994cd29929f6fc89c07896874ae8` |
| `settings-430-webkit.png` | `3bb1247500cd0e66e3902c821655ebbcdee3be890c7cf65aae4962f2c5ffc746` |

16/16 present; the acceptance spec rewrites this set on every run (identical scenarios), so the
hashes above describe the frozen checkpoint set.

## 5. Commit

Single checkpoint commit created after all gates passed:

- message: `freeze: close hydration settings consolidation phase 1`
- commit hash: recorded in the task's final report
- amend / push / tag / rebase: **not performed**

Hydration Settings Consolidation Phase 1 = **FROZEN**.
