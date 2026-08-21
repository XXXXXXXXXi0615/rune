# Lunartide Home Current Contract

## Canonical Home content
- Flow Day Clock (`HomeFixedClockSection` / `MoonGlassClock`)
- Presence Pill (`HomePresencePill`)
- Home Photo Wall (`HomePhotoWall` — standalone feature)

Home renders exactly `HomeFixedClockSection` → `HomePresencePill` → `HomePhotoWall` inside `HomePage`. No other Home-owned dashboard content is canonical.

## Explicitly retired from Home
- Home Widget Grid (`HomeWidgetGrid` and all widget cards)
- widget toolbar / edit mode / gallery
- Tidebound Home CTA (`home-primary-cta` / `home-primary-cta-zone` / `開始這一輪`)
- Journal (月潮手記) — entire system
- Forum (論壇) and its sub-concepts: 時序 / 碎片 / 日期 / 回聲

These must not be re-added to `HomePage` without an explicit product decision. `src/pages/HomePage.tsx` is the single source of truth for Home composition.

## Tidebound ownership
- Canonical entry remains TIDEQUEST (`/quests`, `/focus`, `TideRail` / `FocusIsland`).
- Home does not own Tidebound launch UI. The retired CTA dispatched `tidebound:open-quick`; that dispatch is removed from `HomePage`.
- `tidebound:open-quick` may still be used by active non-Home owners (e.g., `TideRailTabContent` dispatches, `FocusIsland` listens). The event contract itself is not deleted.

## Photo Wall ownership
- Photo Wall is a standalone Home feature. New owner: `src/components/home/HomePhotoWall.tsx` + `src/store/usePhotoWallStore.ts` + `src/styles/photo-wall.css`.
- It is not Journal-owned. Former owner was `src/components/journal/PhotoWall.tsx` inside `JournalPhotosPage`; that ownership is retired.
- Existing `lunartide-photo-wall` persisted user data (photoEntries + layoutByPhotoId) must remain compatible. Store key is `lunartide-photo-wall`; merge/normalization is idempotent and preserves existing photos.

## Journal status
The entire 月潮手記 system is retired from production UI:
- 論壇 (Forum)
- 時序 (Timeline)
- 碎片 (Fragments)
- 日期 (Date/Calendar view)
- 回聲 (Echo / AI threads)
- Journal header / tabs / sub-navigation / forum filters / search / author filters / thread list / post detail / replies / likes / bookmarks / subscriptions / composer / stats / side rails

Retired routes: `/journal`, `/journal/*`, `/diary`, `/diary/*`, `/memory`, `/memory-vault`, `/forum/profile`, plus legacy redirects. Old Journal URLs must not render Journal UI (fall through to not-found / redirect).

Historical types/migrations/i18n (e.g., `JournalEntry` in `src/types`, `lunartide-photo-wall` compatibility fields, `forum` i18n keys) may remain only for compatibility and must not be rendered as live UI.

## CLAWD boundary
- CLAWD (`CompanionPetHost`, `PetSafeRegionResolver`, `clawdRuntime`) remains global.
- Photo Wall canvas (`.photo-wall`) is NOT a blanket pet safe-region. Only actual interactive Photo Wall controls are protected: `photo-fab`, `home-photo-wall-add`, lightbox controls, `AddPhotoSheet` buttons.
- `data-pet-safe-region="interactive"` must not be applied to the full wall/canvas. Empty canvas area remains walkable for the pet.

## Change rule
Future agents must not reintroduce retired Home/Journal systems (Journal/Forum, Widget Grid, Home CTA) without an explicit product decision. Any proposal to restore must be reviewed against this contract and `docs/architecture.md`.
