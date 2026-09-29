# Rune Cloudflare Deployment Phase 1A.2 — Current Rune Checkpoint

Date: 2026-09-30. Scope: Git source checkpoint only. No Cloudflare deployment, `main`/`staging` update, production feature edit, persistence change, auth change, or user-data migration.

## A. Checkpoint Branch

- Branch: `checkpoint/current-rune-2026-09-29`, created from local `main` at `c3c1cfff4311d8b0d59b75ce4297d3031b5790ab` without replacing or cleaning the working tree.
- `origin/checkpoint/current-rune-2026-09-29` was created after checkpoint validation. `origin/main` and `origin/staging` were not updated.
- Pre-existing recovery snapshot: `/Users/shidaoxiang/Desktop/lunartide-recovery/2026-09-29-cloudflare-predeploy-source-closure/`.
- The user-owned Vite server on `127.0.0.1:5173`, PID 33114, was not stopped or restarted.
- The Phase 1A.1 [source audit](rune-cloudflare-phase1a1-deployment-source-closure.md) supplied the 87-path source candidate set, the dirty-tree classification, and the dependency triage. This phase did not repeat that audit.

## B. Intentional Deletions

All 31 tracked production/config deletions from Phase 1A.1 were checked against active imports, route mounts, registries, tests, and asset references. The current build and a clean checkpoint build resolve without them. The exact per-path classification is in Appendix B. `UNKNOWN` production deletions: **0**. The deleted `Icon\r` path is a separate unknown root artifact and was **not** staged.

## C. Production Source Set

- The checkpoint contains all 87 exact Phase 1A.1 production/config candidate paths: 39 modified, 31 deleted, and 17 new. Appendix A lists them as committed tree changes.
- Seven newly tracked TypeScript runtime modules and nine Rune World static files now exist in the committed tree. Build output contains all nine static files.
- The clean checkpoint `dist/` and working-tree `dist/` had matching content except `prototypes/pomo-bunny.html` (deliberately excluded) and four `.DS_Store` files copied only from the local checkout. This comparison supports source equivalence without treating local private artifacts as deployable files.
- Remaining `src/` entries are only `chat.css.bak` and `runeOrbGeometry.retired-test.ts`, both excluded non-runtime files. The only remaining `public/` dirty path is the prototype above. No current runtime import depends on an untracked source file.
- Neither `.github/workflows/deploy-pages.yml` nor `.github/workflows/ci.yml` was staged. The former can publish GitHub Pages and is outside this Cloudflare checkpoint.

## D. Node Version Closure

`.node-version` is the canonical pin: **22.23.2**. `README.md` now states the same tested version. The clean checkout ran `npm ci` and `npm run build` with Node 22.23.2. Future Cloudflare Pages configuration should select Node 22.23.2 or a compatible 22.x runtime; no Cloudflare configuration was changed. The untracked GitHub workflows still declare Node 24 and remain excluded pending their own review. No dependency version changed.

## E. Dependency Security Gate

The Phase 1A.1 scan found 13 affected packages (one critical, eight high, four moderate); five remain when omitting dev dependencies. This phase changed no dependency or lockfile. Classification for the source checkpoint:

At push time, GitHub reported **43 advisory alerts on the default branch**. This is an alert count on a different ref, not the same unit as npm's affected-package count; it does not replace the triage below.

| Finding | Checkpoint decision | Reason / follow-up |
|---|---|---|
| `react-router` high Framework Mode manifest DoS and high unstable RSC CSRF | DOES NOT BLOCK CHECKPOINT | Rune is a declarative `BrowserRouter` Vite SPA; neither affected mode is used. Recheck before public hosting. |
| `react-router` moderate open redirect | MANUAL REVIEW LATER | Browser runtime is reachable, but an attacker-controlled navigation path has not been demonstrated. Audit route input flows before wider exposure. |
| `@capacitor/cli` → `tar` critical and `plist` → `@xmldom/xmldom` high | DOES NOT BLOCK CHECKPOINT; MANUAL REVIEW LATER | CLI/native tooling is not in the emitted browser bundle; no untrusted archive-processing browser path is established. Review native/build usage separately. |
| ESLint/Babel, Vite/PostCSS, Vitest/jsdom advisories | DOES NOT BLOCK CHECKPOINT; MANUAL REVIEW LATER | Build, lint, or test tooling rather than deployed SPA runtime. Review in dependency maintenance phase. |

No confirmed remotely exploitable production-runtime critical/high path was established by the existing triage. The targeted candidate scan found no confirmed private credential; it did find a clearly named fake `sk-guest...` test fixture. This verdict applies to a private Git checkpoint, not to public deployment approval. Keep the security review open.

## F. Commit List

| Commit | Paths | Reason |
|---|---:|---|
| `44b1199` | 14 | Home Rune World actor/events and static artwork. |
| `3e78f85` | 15 | Daily Status, hydration, check-in, calendar and health runtime. |
| `2d37c92` | 13 | Companion and launcher canonical controls; retired pet entry files. |
| `9d56ded` | 4 | Existing auth/guest presentation changes. |
| `fe4c45e` | 3 | Cache and service worker runtime. |
| `ad45e02` | 18 | App shell, usage controls, and replaced shell/UI files. |
| `f958bb7` | 19 | Replaced legacy presentation and asset files. |
| `56bfe3d` | 3 | Node version pin, README alignment, third-party notices. |
| `2eac5d5` | 10 | Canonical unit tests; the clean checkpoint initially failed TypeScript because the older check-in test still imported retired modules. This commit closed that build gap. |
| `7a6df7b` | 5 | Focused browser regression specs that passed on current Rune. |
| `72e62d4` | 3 | Passing Companion secondary-click, Rune Launcher, and Daily Status window browser specs. |
| `c46c071` | 3 | Playwright config and imported helpers needed to reproduce focused specs. |

Every commit used explicit paths and passed `git diff --cached --check` immediately before commit. No `git add .`, `git commit -a`, clean, hard reset, or restore was used.

## G. Build Result

- Original checkout: `npm ci` **PASS**, `npm run build` **PASS** (1,328 transformed modules).
- Isolated clean checkout at checkpoint commit: `npm ci` **PASS**, `npm run build` **PASS** (1,328 modules) after committing the updated canonical tests. This is the decisive source-tree build, free of the original working tree's untracked source/test dependencies.
- Vite reported existing large-chunk and ineffective dynamic-import warnings; no build error. All nine Rune World static files were present in clean `dist/`.

## H. Regression Result

Core suite covers Home Rune actor/assets, Chat onboarding, Music, Calendar, Settings, lazy routes, Companion recovery and the Launcher. Focused unit tests: **73 passed across nine files**. Core browser suite: **Chromium 65 passed; WebKit 64 passed, one skipped**. Additional Companion secondary-click, Launcher, and Daily Status window suite: **53 passed, one skipped** across Chromium and WebKit. Chat route/local-send rerun after Vite cache repair: **4 passed Chromium**. Returning Auth success (correct Access String, Home navigation, reload): **2 passed**, one per engine.

Additional existing acceptance specs still fail on the *current working Rune* and were not treated as checkpoint regressions: `home-rune-world-3a1.spec.ts` expects a 390px clock height >140px while current height is 135.3125px; `calendar-checkin-residual-closure.spec.ts` expects `.app-main.scrollWidth ≤ 390` while current value is 418px; `settings-navigation-phase1.spec.ts` expects the retired `[data-settings-entry="clawd"]` selector. One case from each was rerun after the Vite cache repair and reproduced. These are product/test-contract follow-ups; no product code was changed in this checkpoint phase.

## I. Runtime Error Result

The passing core Playwright cases assert zero unexpected `console.error` and `pageerror`; the Settings regression spec also records `unhandledrejection` separately. A separate ten-navigation smoke (Home, Chat, Music, Calendar, Settings × Chromium/WebKit) measured **console.error = 0, pageerror = 0, unhandledrejection = 0**, HTTP 200 and no route error fallback in every case. Immediately after `npm ci`, the user-owned Vite process returned `504 Outdated Optimize Dep` for `thinking-orbs.js`, which produced temporary Chat lazy-import failures. `npx vite optimize` rebuilt only the dependency cache; the server was not restarted. Chat suites then passed. This is a dev-server cache incident, not a checkpoint source failure. Final server health: listener PID 33114 remained present; `GET /` returned 200. The server state was preserved.

## J. Remaining Dirty Tree

The exact post-checkpoint dirty-entry inventory is recorded separately in the pre-existing recovery folder as `metadata/phase1a2-remaining-dirty.tsv`. Each entry carries its Git status and one of: intentionally excluded evidence, local/private, generated, future work, or unknown. After the final test-source commits, the inventory contains **1,433 entries**: 862 intentionally excluded evidence, 555 future-work entries, six local/private, nine generated, and one unknown root artifact (`Icon\r`). The inventory excludes this report because it is committed as the final documentation artifact. No production source is in the unknown category. Production source remains fully accounted for; no runtime dependency is left in unknown dirty state.

## K. Excluded Local / Private Files

Screenshots, evidence JSON, browser storage, `.commandcode/`, `.workbuddy-ai/`, local screenshot scripts, recovery snapshots, `dist/`, `node_modules/`, caches, the modified prototype, backup/retired test files, and the two untracked GitHub workflows were not staged. The four local `.DS_Store` entries found in working `dist/` do not appear in the clean checkpoint build.

## L. Deployment Readiness

This phase establishes a source checkpoint only. It does **not** authorize merge to `main`, update `staging`, Cloudflare Pages creation, Access configuration, custom domain, or deployment. Asset licensing, dependency findings, and the known Home/Calendar acceptance gaps remain separate follow-ups.

**CURRENT RUNE CHECKPOINT: PASS — source checkpoint and selected core regression are complete.** The three known legacy acceptance failures above remain explicit product/test follow-ups; they are present in the current working Rune and do not represent a checkpoint rollback. This verdict does not approve deployment.

## Appendix A — Exact production/config checkpoint paths

All 87 paths below are in `origin/main..checkpoint` commit changes. Status prefixes are relative to the original `main`: `M`, `D`, and `A` (the Phase 1A.1 `??` paths are now added).

- ` D` `public/favicon.svg`
- ` D` `public/icons.svg`
- ` M` `public/sw.js`
- ` D` `src/ai/mockReplies.ts`
- ` D` `src/ai/persona.ts`
- ` D` `src/components/PetWidget/PetWidget.tsx`
- ` M` `src/components/auth/GuestLounge.css`
- ` M` `src/components/auth/GuestLounge.tsx`
- ` M` `src/components/calendar/WaterSection.tsx`
- ` D` `src/components/calendar/WaterSettings.tsx`
- ` M` `src/components/health/HealthOverviewPanel.tsx`
- ` D` `src/components/home/DailyTarot.tsx`
- ` M` `src/components/home/DailyTideFloatingWindow.tsx`
- ` M` `src/components/home/DailyTidePanel.tsx`
- ` M` `src/components/home/HomeHydrationWidget.tsx`
- ` D` `src/components/home/HomePhotoWall.tsx`
- ` M` `src/components/home/RunePixelWorld.css`
- ` M` `src/components/home/RunePixelWorld.tsx`
- ` D` `src/components/home/UsageDetailSheet.tsx`
- ` D` `src/components/home/UsagePanel.tsx`
- ` M` `src/components/layout/AppShell.tsx`
- ` D` `src/components/layout/BottomNav.tsx`
- ` D` `src/components/layout/DesktopChrome.tsx`
- ` M` `src/components/layout/FocusIsland.tsx`
- ` D` `src/components/layout/MiniPlayer.tsx`
- ` M` `src/components/layout/RouteStatusIsland.tsx`
- ` M` `src/components/layout/RuneUtilityHost.css`
- ` M` `src/components/layout/RuneUtilityHost.tsx`
- ` D` `src/components/music/Player.tsx`
- ` D` `src/components/music/Playlist.tsx`
- ` M` `src/components/navigation/MobileTabBar.css`
- ` M` `src/components/pet/CompanionPetHost.css`
- ` M` `src/components/pet/CompanionPetHost.tsx`
- ` M` `src/components/settings/CompanionDisplaySettings.tsx`
- ` D` `src/components/settings/PetAppearanceSheet.tsx`
- ` D` `src/components/ui/Button.tsx`
- ` D` `src/components/ui/FullScreenPanel.tsx`
- ` D` `src/components/ui/Input.tsx`
- ` M` `src/components/usage/UsageControlPanel.css`
- ` M` `src/components/usage/UsageControlPanel.tsx`
- ` M` `src/components/usage/UsageHost.tsx`
- ` M` `src/components/usage/UsageLockSettings.tsx`
- ` D` `src/data/tarot.ts`
- ` M` `src/features/companionPets/companionPetPacks.ts`
- ` M` `src/features/desktopPet/PetSafeRegionResolver.ts`
- ` M` `src/features/home/dailyRitualPresentation.ts`
- ` D` `src/features/moon-dew/MoonDewAchievements.tsx`
- ` D` `src/features/moon-dew/MoonDewProgress.tsx`
- ` D` `src/features/moon-dew/canonicalCheckInStreak.ts`
- ` D` `src/features/moon-dew/getMoonDewProgression.ts`
- ` D` `src/features/moon-dew/moondew.css`
- ` M` `src/features/storage/cacheRegistry.ts`
- ` M` `src/features/tideclock/checkInConsequence.ts`
- ` M` `src/features/tideclock/useCheckInStore.ts`
- ` M` `src/pages/AuthGate.tsx`
- ` D` `src/pages/MusicPage.tsx`
- ` M` `src/pages/PeriodPage.tsx`
- ` D` `src/pages/PetAppearancePage.tsx`
- ` D` `src/pages/SystemActivityPage.tsx`
- ` M` `src/pages/rune-login-gate.css`
- ` M` `src/services/cache/cacheScanner.ts`
- ` M` `src/store/useAppStore.ts`
- ` D` `src/store/usePhotoWallStore.ts`
- ` M` `src/store/useRuneUtilityStore.ts`
- ` M` `src/styles/dailytide.css`
- ` D` `src/styles/desktop.css`
- ` M` `src/styles/mobile-shell.css`
- ` D` `src/styles/photo-wall.css`
- ` M` `src/styles/settings.css`
- ` M` `src/utils/date.ts`
- ` A` `.node-version`
- ` A` `public/assets/home/rune-world/actors/rune/v0.1/character-rune-idle-4dir.runtime.png`
- ` A` `public/assets/home/rune-world/actors/rune/v0.1/character-rune-walk-down-4f.runtime.png`
- ` A` `public/assets/home/rune-world/actors/rune/v0.1/character-rune-walk-left-4f.runtime.png`
- ` A` `public/assets/home/rune-world/actors/rune/v0.1/character-rune-walk-right-4f.runtime.png`
- ` A` `public/assets/home/rune-world/actors/rune/v0.1/character-rune-walk-up-4f.runtime.png`
- ` A` `public/assets/home/rune-world/actors/rune/v0.1/character-rune-wave-down-6f.runtime.png`
- ` A` `public/assets/home/rune-world/day.png`
- ` A` `public/assets/home/rune-world/manifest.json`
- ` A` `public/assets/home/rune-world/night.png`
- ` A` `src/components/home/DailyMoodBar.tsx`
- ` A` `src/features/companionPets/companionVisualHitBounds.ts`
- ` A` `src/features/home/runeWorldActor.ts`
- ` A` `src/features/home/runeWorldActorRuntime.ts`
- ` A` `src/features/home/windowGeometry.ts`
- ` A` `src/features/tideclock/dailyCheckInEvents.ts`
- ` A` `src/store/useDailyMoodStore.ts`

## Appendix B — Deletion closure by exact path

A = intentional retirement; B = replaced by current owner; C = obsolete artifact. Every row is a tracked deletion relative to original `main`. Active import, route, registry, test, and asset references were reviewed; clean TypeScript/build verification closed source references.

| Deleted path | Class | Evidence / owner |
|---|---|---|
| `public/favicon.svg` | B | Replaced by the live branded icon links in `index.html`. |
| `public/icons.svg` | B | Replaced by `/icons/icon-192.png` and `/icons/icon-512.png` in `index.html`. |
| `src/ai/mockReplies.ts` | A | Old mock reply module has no active import. |
| `src/ai/persona.ts` | A | Old persona module has no active import; current agent/character owners remain. |
| `src/components/PetWidget/PetWidget.tsx` | B | CompanionPetHost is the mounted actor owner. |
| `src/components/calendar/WaterSettings.tsx` | B | Current WaterSection and hydration settings own the UI. |
| `src/components/home/DailyTarot.tsx` | A | Retired Home tarot presentation is not mounted. |
| `src/components/home/HomePhotoWall.tsx` | A | Retired Photo Wall presentation is not mounted. |
| `src/components/home/UsageDetailSheet.tsx` | B | UsageControlPanel/UsageHost own the live control. |
| `src/components/home/UsagePanel.tsx` | B | UsageControlPanel/UsageHost own the live control. |
| `src/components/layout/BottomNav.tsx` | B | MobileTabBar is the current mobile navigation owner. |
| `src/components/layout/DesktopChrome.tsx` | B | AppShell/SystemTopBar own the current shell. |
| `src/components/layout/MiniPlayer.tsx` | B | Music shell/player owns current playback presentation. |
| `src/components/music/Player.tsx` | B | Current `src/pages/Music/` components own playback. |
| `src/components/music/Playlist.tsx` | B | Current `src/pages/Music/` components own playlists. |
| `src/components/settings/PetAppearanceSheet.tsx` | B | CompanionDisplaySettings and Companion menu own current controls. |
| `src/components/ui/Button.tsx` | C | Unused generic UI component, no active import. |
| `src/components/ui/FullScreenPanel.tsx` | C | Unused generic UI component, no active import. |
| `src/components/ui/Input.tsx` | C | Unused generic UI component, no active import. |
| `src/data/tarot.ts` | A | Retired tarot data module has no active import. |
| `src/features/moon-dew/MoonDewAchievements.tsx` | B | Current Moon Dew ledger/engine remains; old presentation retired. |
| `src/features/moon-dew/MoonDewProgress.tsx` | B | Current Moon Dew ledger/engine remains; old presentation retired. |
| `src/features/moon-dew/canonicalCheckInStreak.ts` | B | Current Tideclock check-in owner supplies streak semantics. |
| `src/features/moon-dew/getMoonDewProgression.ts` | B | Current Moon Dew engine and check-in owner supply progression. |
| `src/features/moon-dew/moondew.css` | C | Stylesheet for the retired Moon Dew presentation. |
| `src/pages/MusicPage.tsx` | B | `src/pages/Music/Music.tsx` is the active route component. |
| `src/pages/PetAppearancePage.tsx` | B | Legacy route redirects to current settings/companion controls. |
| `src/pages/SystemActivityPage.tsx` | A | Retired route page is absent from active route table. |
| `src/store/usePhotoWallStore.ts` | A | Retired presentation store has no active import; no persisted user data was deleted. |
| `src/styles/desktop.css` | C | Unused stylesheet; current shell styles are elsewhere. |
| `src/styles/photo-wall.css` | C | Stylesheet for retired Photo Wall presentation. |
