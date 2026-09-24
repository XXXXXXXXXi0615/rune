export const PERCH_ACCEPTANCE_VERTICAL_PX = 40;
export const PERCH_DETACH_DRAG_PX = 60;
export const PERCH_PREVIEW_ID = 'home-flow-clock';

export interface PerchSurfaceRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface PerchExclusionZone {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RenderedPetRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Recovers the unscaled CSS origin from a bottom-centred transformed pet rect. */
export function resolvePetCssOrigin(rect: RenderedPetRect, petSize: number): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2 - petSize / 2,
    y: rect.bottom - petSize,
  };
}

/** Resolves the semantic rendered anchor without assuming the rendered size equals petSize. */
export function resolveRenderedPetFoot(rect: RenderedPetRect, footAnchor: number): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height * footAnchor,
  };
}

export function resolveClockPerchSurface(): PerchSurfaceRect | null {
  const el = document.querySelector<HTMLElement>('[data-pet-perch-surface="home-flow-clock"]');
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
}

export function isInPerchAcceptanceZone(
  footX: number,
  footY: number,
  clockRect: PerchSurfaceRect,
  acceptanceBand = PERCH_ACCEPTANCE_VERTICAL_PX,
): boolean {
  return footX >= clockRect.left && footX <= clockRect.right
    && footY >= clockRect.top && footY <= clockRect.top + acceptanceBand;
}

export function resolvePerchNormalizedX(footX: number, clockRect: PerchSurfaceRect): number {
  if (clockRect.width <= 0) return 0.5;
  return Math.max(0, Math.min(1, (footX - clockRect.left) / clockRect.width));
}

export function resolvePerchPosition(
  clockRect: PerchSurfaceRect,
  normalizedX: number,
  petSize: number,
  footAnchor: number,
): { x: number; y: number } {
  const petLeft = clockRect.left + normalizedX * clockRect.width - petSize / 2;
  const footY = clockRect.top;
  const petTop = footY - petSize * footAnchor;
  return { x: petLeft, y: petTop };
}

export function resolveClockExclusionZones(clockRect: PerchSurfaceRect): PerchExclusionZone[] {
  const el = document.querySelector<HTMLElement>('[data-pet-perch-surface="home-flow-clock"]');
  if (!el) return [];
  const zones: PerchExclusionZone[] = [];
  const pillars = el.querySelector('.fdc-pillars-wrapper');
  if (pillars) {
    const r = pillars.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) zones.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  }
  const digitalClock = el.querySelector('.fdc-digital-clock-wrapper');
  if (digitalClock) {
    const r = digitalClock.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) zones.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  }
  return zones;
}

export function intersectsExclusion(
  petLeft: number,
  petRight: number,
  petTop: number,
  petBottom: number,
  zones: PerchExclusionZone[],
): boolean {
  return zones.some((z) => petRight > z.left && petLeft < z.right && petBottom > z.top && petTop < z.bottom);
}

export function clampNormalizedX(
  normalizedX: number,
  clockRect: PerchSurfaceRect,
  petSize: number,
  zones: PerchExclusionZone[],
): number {
  if (zones.length === 0) return normalizedX;
  const halfPet = petSize / 2;
  const petLeft = clockRect.left + normalizedX * clockRect.width - halfPet;
  const petRight = petLeft + petSize;
  const petTop = clockRect.top - petSize * 0.94;
  const petBottom = clockRect.top;
  if (!intersectsExclusion(petLeft, petRight, petTop, petBottom, zones)) return normalizedX;
  const step = 0.02;
  for (let offset = step; offset <= 1; offset += step) {
    for (const dir of [-1, 1]) {
      const candidate = normalizedX + offset * dir;
      if (candidate < 0 || candidate > 1) continue;
      const cLeft = clockRect.left + candidate * clockRect.width - halfPet;
      const cRight = cLeft + petSize;
      if (!intersectsExclusion(cLeft, cRight, petTop, petBottom, zones)) return candidate;
    }
  }
  return normalizedX;
}

export function shouldDetachFromPerch(
  dragX: number,
  dragY: number,
  originX: number,
  originY: number,
): boolean {
  return Math.hypot(dragX - originX, dragY - originY) > PERCH_DETACH_DRAG_PX;
}

export function isClockPerchAvailable(breakpoint: string): boolean {
  if (breakpoint === 'mobile') return false;
  return resolveClockPerchSurface() !== null;
}
