/**
 * Desktop TodayStatusFloat window geometry (Rune Daily Status Window Resize Phase 1).
 *
 * Pure helpers only — the component owns state and gestures, this module owns the
 * bounds and the tolerant (legacy-compatible) persistence payload.
 *
 * Payload: `{ x, y, width?, maxHeight? }` on the canonical
 * `lunartide-daily-tide-window-position` key. `{ x, y }` (legacy) stays readable and
 * missing fields fall back to the defaults below. No second geometry owner.
 *
 * The desktop shell keeps `height: auto` + `.dt-dock-body` internal scroll; a user
 * `maxHeight` is a *cap*, never a fixed height.
 */

/** Frozen desktop default width (mirrored by `.dt-window` CSS). */
export const DEFAULT_WINDOW_WIDTH = 640;
/** Smallest width that keeps the header natural, the three tab labels readable and the calendar cells >= 44px. */
export const MIN_WINDOW_WIDTH = 360;
/** Largest width that still reads as a floating utility window, never a full-app page. */
export const MAX_WINDOW_WIDTH = 720;
/** Smallest usable height cap (header ~86px + a scrollable body). */
export const MIN_WINDOW_MAX_HEIGHT = 300;
/** Mirrors the frozen `.dt-window { max-height: 72dvh }` ceiling. */
export const WINDOW_MAX_HEIGHT_RATIO = 0.72;
/** Keeps the shell clear of the viewport edge after a resize. */
export const VIEWPORT_MARGIN = 12;
export const KEYBOARD_RESIZE_STEP = 8;
export const KEYBOARD_RESIZE_STEP_LARGE = 32;

export interface WindowSize {
  width: number;
  /** `null` = no user cap (the frozen 72dvh default applies). */
  maxHeight: number | null;
}

export interface WindowGeometry extends WindowSize {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** `min(720px, viewportWidth - 32px)` — never below the minimum, so the shell always has a legal width. */
export function maxWidthFor(viewportWidth: number): number {
  return Math.max(MIN_WINDOW_WIDTH, Math.min(MAX_WINDOW_WIDTH, viewportWidth - 32));
}

export function clampWidth(width: number, viewportWidth: number): number {
  return clamp(Math.round(width), MIN_WINDOW_WIDTH, maxWidthFor(viewportWidth));
}

/** The frozen 72dvh ceiling expressed in pixels for the current viewport. */
export function defaultMaxHeightFor(viewportHeight: number): number {
  return Math.round(viewportHeight * WINDOW_MAX_HEIGHT_RATIO);
}

/** `min(user cap, 72dvh, viewportHeight - y - 12)`, floor at the minimum usable height. */
export function clampMaxHeight(maxHeight: number, viewportHeight: number, y: number): number {
  const ceiling = Math.min(defaultMaxHeightFor(viewportHeight), viewportHeight - y - VIEWPORT_MARGIN);
  return clamp(Math.round(maxHeight), MIN_WINDOW_MAX_HEIGHT, Math.max(MIN_WINDOW_MAX_HEIGHT, ceiling));
}

/**
 * Tolerant read: x/y must be finite numbers (otherwise `null`, matching the previous
 * behaviour); width/maxHeight are validated per field and clamped, so legacy
 * `{ x, y }` payloads and out-of-range values both resolve to a legal size.
 */
export function parseGeometry(
  raw: string | null,
  viewport: { width: number; height: number },
): WindowGeometry | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WindowGeometry> | null;
    if (!value || typeof value.x !== 'number' || typeof value.y !== 'number') return null;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    const width = typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0
      ? clampWidth(value.width, viewport.width)
      : DEFAULT_WINDOW_WIDTH;
    const maxHeight = typeof value.maxHeight === 'number' && Number.isFinite(value.maxHeight) && value.maxHeight > 0
      ? clampMaxHeight(value.maxHeight, viewport.height, value.y)
      : null;
    return { x: value.x, y: value.y, width, maxHeight };
  } catch {
    return null;
  }
}

/** Writes the defaults implicitly: a user who never resized keeps the legacy `{ x, y }` payload. */
export function serializeGeometry(geometry: WindowGeometry): string {
  const payload: Record<string, number> = { x: geometry.x, y: geometry.y };
  if (geometry.width !== DEFAULT_WINDOW_WIDTH) payload.width = geometry.width;
  if (geometry.maxHeight !== null) payload.maxHeight = geometry.maxHeight;
  return JSON.stringify(payload);
}
