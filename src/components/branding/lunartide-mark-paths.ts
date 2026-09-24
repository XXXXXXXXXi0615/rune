/**
 * Single source of truth for all Lunartide mark SVG paths.
 *
 * Design: Twin-tide interlocking (双潮互嵌) — left amber, right teal,
 * with a dramatic S-curve seam, two nodes, and a center crescent void.
 *
 * All components import from here; public SVGs are regenerated from
 * the same geometry with hardcoded fallback colours.
 */

/* ---- viewBox is always 0 0 100 100 ---- */

/** Outer circle radius for the core mark */
export const R = 42;

/** Outer circle radius for the emblem (slightly larger) */
export const R_EMBLEM = 43;

/* ---- S-curve seam (dramatic twin-tide bite) ---- */

/**
 * S-curve from TOP (50,8) to BOTTOM (50,92).
 * cp1 pulls hard LEFT so the gold half bites into right territory at the top.
 * cp2 pulls hard RIGHT so the teal half bites into left territory at the bottom.
 */
export const S_CURVE_DOWN = 'C 22 22, 78 70, 50 92';

/**
 * S-curve from BOTTOM (50,92) to TOP (50,8) — the reverse.
 */
export const S_CURVE_UP = 'C 78 70, 22 22, 50 8';

/* ---- Left (gold / amber) half ---- */
export function leftHalfPath(r = R): string {
  const top = 50 - r;
  const bot = 50 + r;
  const side = 50 - r;
  return `M50 ${top}A${r} ${r} 0 0 0 ${side} 50A${r} ${r} 0 0 0 50 ${bot}${S_CURVE_UP}Z`;
}

/* ---- Right (teal) half ---- */
export function rightHalfPath(r = R): string {
  const top = 50 - r;
  const bot = 50 + r;
  const side = 50 + r;
  return `M50 ${top}A${r} ${r} 0 0 1 ${side} 50A${r} ${r} 0 0 1 50 ${bot}${S_CURVE_UP}Z`;
}

/* ---- Nodes ---- */
export const NODE_LEFT = { cx: 24, cy: 40, r: 5 } as const;
export const NODE_RIGHT = { cx: 76, cy: 60, r: 5 } as const;

/* ---- Centre crescent void ---- */
export const VOID_PATH = 'M50 33A8 8 0 1 0 56.5 51A6 6 0 1 1 50 33Z';

/* ---- Favicon-size larger nodes & void ---- */
export const FAV_NODE_LEFT = { cx: 23, cy: 39, r: 6.5 } as const;
export const FAV_NODE_RIGHT = { cx: 77, cy: 61, r: 6.5 } as const;

/** Thicker crescent for tiny sizes */
export const FAV_VOID_PATH = 'M50 31A9 9 0 1 0 57 52.5A6.5 6.5 0 1 1 50 31Z';
