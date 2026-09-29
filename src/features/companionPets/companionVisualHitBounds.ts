/**
 * Companion visual hit-region metadata (Companion-C1).
 *
 * The Companion DOM box (`--pet-size` square) is mostly transparent: the
 * painted character occupies a small part of it. A rectangular button over the
 * whole box therefore intercepted pointer input over page controls behind
 * transparent pixels. This module carries per-visual **hit bounds**: the region
 * of the box that actually owns pointer input, i.e. the union of visible pixels
 * across the animation.
 *
 * Measurement method (offline, precomputed — no runtime canvas hit testing):
 *  1. Each visual asset is decoded frame by frame in the browser with the
 *     WebCodecs `ImageDecoder` (GIF: `tracks.selectedTrack.frameCount`; the
 *     Logos atlas is a static WebP sprite sheet, so per-cell regions are
 *     measured instead).
 *  2. Per frame, the bounding box of pixels with `alpha > 16` is accumulated
 *     into a union bound, so the result safely covers every animation frame.
 *  3. The union is mapped into the square pet box using the exact CSS used by
 *     `CompanionPetVisual`:
 *       - `renderer: 'image'` → `object-fit: contain` + `object-position: 50% 100%`
 *         (uniform scale `1 / max(srcW, srcH)`, horizontally centred,
 *         bottom-aligned),
 *       - `renderer: 'sprite'` → the atlas cell (192×208) fills the box in both
 *         axes, so cell-relative bounds are already box-relative.
 *
 * Bounds are normalised to the pet box (`0..1`), so they are independent of the
 * mobile/tablet/desktop `--pet-size` and of the user scale preference.
 *
 * Coverage measured across all 44 CLAWD visuals at a 64px box: 7.4%–93.8% of
 * the box (the box itself was 100% before C1).
 */

export interface CompanionHitBounds { left: number; top: number; right: number; bottom: number }

/** Union alpha bounds per CLAWD GIF, normalised to the square pet box. */
const CLAWD_HIT_BOUNDS: Readonly<Record<string, CompanionHitBounds>> = {
  'clawd-bubble': { left: 0.3311, top: 0.4603, right: 0.8543, bottom: 0.9106 },
  'clawd-building': { left: 0.3102, top: 0.5281, right: 0.8152, bottom: 0.9241 },
  'clawd-carrying': { left: 0.3013, top: 0.5927, right: 0.7119, bottom: 0.9139 },
  'clawd-coding': { left: 0.325, top: 0.6875, right: 0.6667, bottom: 0.9167 },
  'clawd-conducting': { left: 0.298, top: 0.447, right: 0.7285, bottom: 0.9007 },
  'clawd-crab-walking': { left: 0, top: 0.3359, right: 1, bottom: 0.9375 },
  'clawd-debugger': { left: 0.3079, top: 0.6391, right: 0.7351, bottom: 0.9139 },
  'clawd-disconnected': { left: 0.0625, top: 0.3594, right: 0.875, bottom: 0.9922 },
  'clawd-dizzy': { left: 0, top: 0.2422, right: 0.9922, bottom: 0.9766 },
  'clawd-error': { left: 0.298, top: 0.457, right: 0.7185, bottom: 0.9172 },
  'clawd-exercise': { left: 0.2792, top: 0.6708, right: 0.7083, bottom: 0.9125 },
  'clawd-going-away': { left: 0, top: 0.6406, right: 0.9297, bottom: 1 },
  'clawd-guitar': { left: 0.3083, top: 0.375, right: 0.7083, bottom: 0.9125 },
  'clawd-happy': { left: 0.1656, top: 0.3477, right: 0.8046, bottom: 0.9106 },
  'clawd-headphones-groove': { left: 0.202, top: 0.6026, right: 0.745, bottom: 0.9106 },
  'clawd-idle-living': { left: 0.0078, top: 0.2891, right: 0.9922, bottom: 1 },
  'clawd-idle-reading': { left: 0.3046, top: 0.5662, right: 0.6656, bottom: 0.9106 },
  'clawd-idle': { left: 0.3278, top: 0.6921, right: 0.6656, bottom: 0.9106 },
  'clawd-juggling': { left: 0.3146, top: 0.5099, right: 0.6788, bottom: 0.9106 },
  'clawd-mini-clawd': { left: 0, top: 0.2266, right: 1, bottom: 1 },
  'clawd-notification': { left: 0.202, top: 0.4172, right: 0.6623, bottom: 0.9106 },
  'clawd-painting': { left: 0.2208, top: 0.4625, right: 0.675, bottom: 0.8917 },
  'clawd-photo': { left: 0.3083, top: 0.6417, right: 0.6583, bottom: 0.8917 },
  'clawd-react-annoyed': { left: 0.3311, top: 0.4272, right: 0.7815, bottom: 0.9106 },
  'clawd-react-double-jump': { left: 0.2947, top: 0.3775, right: 0.7053, bottom: 0.9106 },
  'clawd-sleeping': { left: 0.3013, top: 0.4669, right: 0.6921, bottom: 0.9106 },
  'clawd-static-base': { left: 0, top: 0.3359, right: 1, bottom: 0.9375 },
  'clawd-sweeping': { left: 0.255, top: 0.6159, right: 0.6589, bottom: 0.9437 },
  'clawd-thinking': { left: 0.2649, top: 0.4503, right: 0.6589, bottom: 0.894 },
  'clawd-typing': { left: 0.3179, top: 0.4238, right: 0.6722, bottom: 0.9172 },
  'clawd-working-beacon': { left: 0.2188, top: 0.2813, right: 0.7813, bottom: 0.8828 },
  'clawd-working-building': { left: 0.1172, top: 0.3516, right: 0.9375, bottom: 0.9922 },
  'clawd-working-carrying': { left: 0.1875, top: 0.375, right: 0.9922, bottom: 1 },
  'clawd-working-conducting': { left: 0.0664, top: 0, right: 0.9648, bottom: 0.9922 },
  'clawd-working-confused': { left: 0.0703, top: 0.2109, right: 0.9688, bottom: 0.9297 },
  'clawd-working-debugger': { left: 0.0078, top: 0.4453, right: 1, bottom: 0.9922 },
  'clawd-working-juggling': { left: 0, top: 0.0234, right: 1, bottom: 0.9609 },
  'clawd-working-overheated': { left: 0.207, top: 0.3672, right: 0.793, bottom: 1 },
  'clawd-working-pushing': { left: 0.1016, top: 0.375, right: 0.7266, bottom: 1 },
  'clawd-working-sweeping': { left: 0.0078, top: 0.375, right: 0.8984, bottom: 0.9922 },
  'clawd-working-thinking': { left: 0.0977, top: 0, right: 0.9023, bottom: 0.9766 },
  'clawd-working-typing': { left: 0, top: 0.3438, right: 0.9922, bottom: 0.9766 },
  'clawd-working-wizard': { left: 0.2383, top: 0.2266, right: 0.7227, bottom: 0.9688 },
  'mini-crab-typing': { left: 0.1055, top: 0.0703, right: 0.8945, bottom: 0.9531 },
};

/** Union alpha bounds per Logos atlas animation (cell-relative = box-relative). */
const LOGOS_HIT_BOUNDS: Readonly<Record<string, CompanionHitBounds>> = {
  'logos-idle': { left: 0.1771, top: 0.024, right: 0.8229, bottom: 0.976 },
  'logos-running-right': { left: 0.0938, top: 0.024, right: 0.9063, bottom: 0.976 },
  'logos-running-left': { left: 0.0885, top: 0.024, right: 0.9063, bottom: 0.976 },
  'logos-waving': { left: 0.1615, top: 0.024, right: 0.8385, bottom: 0.976 },
  'logos-jumping': { left: 0.026, top: 0.024, right: 0.974, bottom: 0.976 },
  'logos-failed': { left: 0.0365, top: 0.024, right: 0.9635, bottom: 0.976 },
  'logos-waiting': { left: 0.1302, top: 0.024, right: 0.8698, bottom: 0.976 },
  'logos-running': { left: 0.125, top: 0.024, right: 0.8698, bottom: 0.976 },
  'logos-review': { left: 0.1615, top: 0.024, right: 0.8385, bottom: 0.976 },
};

const MEASURED_HIT_BOUNDS: Readonly<Record<string, CompanionHitBounds>> = {
  ...CLAWD_HIT_BOUNDS,
  ...LOGOS_HIT_BOUNDS,
};

/**
 * Measured hit bounds for a visual id, or `null` when the visual has no
 * measurement yet (the caller supplies its own conservative fallback).
 */
export function measuredCompanionHitBounds(visualId: string): CompanionHitBounds | null {
  return MEASURED_HIT_BOUNDS[visualId] ?? null;
}

export const MEASURED_COMPANION_HIT_BOUNDS_COUNT = Object.keys(MEASURED_HIT_BOUNDS).length;
