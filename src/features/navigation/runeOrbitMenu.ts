/**
 * Rune Utility Orb — Radial Orbit Menu (Phase 2A)
 *
 * Defines the 7 fixed orbital slots that the Orb reveals when tapped on
 * desktop. Slot indices are *stable* — the same module always expands to
 * the same angle/orbit. Slot positions never drift between renders.
 *
 * Geometry uses mathematical angle convention: 0° = east, 90° = north,
 * 180° = west, 270° = south. Presentation code applies `-sin(angle)`
 * when translating into CSS / SVG (whose y-axis points down).
 */

import type { AppModuleId } from './types';

/* ── Sized dimensions ─────────────────────────────────────────────── */
export const RUNE_ORB_MAIN_BALL_SIZE = 56;
export const RUNE_ORB_SUB_BALL_SIZE = 44;
export const RUNE_ORB_SUB_BALL_HIT = 52;
// Phase 1.2: radii recalculated so adjacent 44px beads never intersect.
// At 30° spacing the chord between neighbours is 2·r·sin(15°); r=92 gives
// 47.6px (> 44px bead + clearance), r=140 gives 72.5px on the outer ring.
export const RUNE_ORB_INNER_RADIUS = 92;
export const RUNE_ORB_OUTER_RADIUS = 140;
export const RUNE_ORB_REVEAL_STAGGER_MS = 28;

/* ── Slot definition types ────────────────────────────────────────── */
export type RuneOrbitRing = 'inner' | 'outer';

export interface RuneOrbitSlotDefinition {
  /** Stable slot index (0..6). */
  index: number;
  /** Mathematical angle (degrees). 90° = north, 180° = west. */
  angleDeg: number;
  /** Inner ring (5 high-frequency) or Outer ring (3 secondary). */
  ring: RuneOrbitRing;
}

/* ── Inner ring — 5 primary actions spread across 210° → 90° ──────── */
export const RUNE_ORBIT_INNER_SLOTS: readonly RuneOrbitSlotDefinition[] = [
  { index: 0, ring: 'inner', angleDeg: 210 },
  { index: 1, ring: 'inner', angleDeg: 180 },
  { index: 2, ring: 'inner', angleDeg: 150 },
  { index: 3, ring: 'inner', angleDeg: 120 },
  { index: 4, ring: 'inner', angleDeg: 90 },
];

/* ── Outer ring — 2 secondary actions (Phase 1.2.1 re-pack, 7 total) ── */
export const RUNE_ORBIT_OUTER_SLOTS: readonly RuneOrbitSlotDefinition[] = [
  { index: 5, ring: 'outer', angleDeg: 195 }, /* gap (210,180) */
  { index: 6, ring: 'outer', angleDeg: 135 }, /* gap (150,120) */
];

export const RUNE_ORBIT_SLOTS: readonly RuneOrbitSlotDefinition[] = [
  ...RUNE_ORBIT_INNER_SLOTS,
  ...RUNE_ORBIT_OUTER_SLOTS,
];

/* ── Module assignment to slots (audit-driven, registry-derived) ──── */
/*
 * A. PRIMARY (5) — visited daily across the app's first-week usage data
 *    0  Chat        — direct LUNANIS conversation entry
 *    1  Music       — playlist + mini-player hub
 *    2  Stash       — personal snippets and materials
 *    3  Calendar    — todos + countdown + water (owns quest time context)
 *    4  Settings    — canonical settings entry (TIDEQUEST owns quests;
 *                     the orb must not duplicate that navigation duty)
 *
 * B. SECONDARY (2) — frequently touched but not in the primary ring.
 *    Life Ledger retired in Calendar Phase 3A: its surfaces live under
 *    Calendar > 生活, so the orb no longer carries a duplicate entry.
 *    Outer slots re-packed to 195/135 (slot 5/6) — no hole at the old 105°.
 *    5  MoonLex     — vocabulary collection + practice
 *    6  Tidewatch   — checkins / reminders / milestones
 */
export const RUNE_ORBIT_PRIMARY_MODULE_IDS: readonly AppModuleId[] = [
  'chat',
  'music',
  'stash',
  'calendar',
  'settings',
];

export const RUNE_ORBIT_SECONDARY_MODULE_IDS: readonly AppModuleId[] = [
  'moonlex',
  'tidewatch',
];

/* ── Geometry helpers ─────────────────────────────────────────────── */
export interface RuneOrbitOffset {
  /** x offset from orb center, in pixels (CSS coordinate, +x = right). */
  offsetX: number;
  /** y offset from orb center, in pixels (CSS coordinate, +y = down). */
  offsetY: number;
}

export function resolveRuneOrbitRadius(slot: RuneOrbitSlotDefinition): number {
  return slot.ring === 'inner' ? RUNE_ORB_INNER_RADIUS : RUNE_ORB_OUTER_RADIUS;
}

export function resolveRuneOrbitOffset(slot: RuneOrbitSlotDefinition): RuneOrbitOffset {
  const radius = resolveRuneOrbitRadius(slot);
  const rad = (slot.angleDeg * Math.PI) / 180;
  return {
    offsetX: Math.cos(rad) * radius,
    offsetY: -Math.sin(rad) * radius,
  };
}

/**
 * Returns true if the given module id has been assigned to one of the
 * orbit slots. Modules outside this list will be reachable via the
 * overflow More sheet instead of the radial orbit.
 */
export function isOrbitSlotModule(id: AppModuleId): boolean {
  return (
    RUNE_ORBIT_PRIMARY_MODULE_IDS.includes(id)
    || RUNE_ORBIT_SECONDARY_MODULE_IDS.includes(id)
  );
}
