export type PetOpticalAnchor = 'feet-center' | 'optical-center';
export interface PetNormalizedPosition { x: number; y: number; anchor: PetOpticalAnchor }
export interface PetRect { left: number; top: number; right: number; bottom: number; width: number; height: number }
export interface PetOpticalBounds { width: number; height: number; anchorX: number; anchorY: number }
export interface PetWalkableAreaInput {
  viewportRect: PetRect; sidebarRect?: PetRect | null; headerRect?: PetRect | null; tideboundRect?: PetRect | null;
  liquidDockRect?: PetRect | null; musicMiniPlayerRect?: PetRect | null; desktopMusicPlayerRect?: PetRect | null;
  dialogRects?: PetRect[]; safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
  opticalBounds: PetOpticalBounds; gap?: number;
}
export interface PetWalkableAreaResult { walkableRect: PetRect; obstacleRects: PetRect[]; safeLeft: number; safeRight: number; safeTop: number; safeBottom: number }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const makeRect = (left: number, top: number, right: number, bottom: number): PetRect => ({ left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
const overlaps = (a: PetRect, b: PetRect, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

export function resolvePetWalkableArea(input: PetWalkableAreaInput): PetWalkableAreaResult {
  const gap = input.gap ?? 12;
  const inset = input.safeAreaInsets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const viewport = input.viewportRect;
  const obstacles = [input.sidebarRect, input.headerRect, input.tideboundRect, input.liquidDockRect, input.musicMiniPlayerRect, input.desktopMusicPlayerRect, ...(input.dialogRects ?? [])]
    .filter((rect): rect is PetRect => Boolean(rect && rect.width > 0 && rect.height > 0))
    .map((rect) => makeRect(Math.max(viewport.left, rect.left), Math.max(viewport.top, rect.top), Math.min(viewport.right, rect.right), Math.min(viewport.bottom, rect.bottom)))
    .filter((rect) => rect.width > 0 && rect.height > 0);
  let left = viewport.left + inset.left + gap, right = viewport.right - inset.right - gap;
  let top = viewport.top + inset.top + gap, bottom = viewport.bottom - inset.bottom - gap;
  for (const obstacle of obstacles) {
    const spansWidth = obstacle.width >= viewport.width * .35;
    const spansHeight = obstacle.height >= viewport.height * .5;
    if (spansWidth && obstacle.top <= viewport.top + gap && obstacle.bottom > top) top = Math.max(top, obstacle.bottom + gap);
    if (spansHeight && obstacle.left <= viewport.left + gap && obstacle.right > left) left = Math.max(left, obstacle.right + gap);
    const isLowerWideBarrier = spansWidth && obstacle.top >= viewport.top + viewport.height * .4;
    if ((isLowerWideBarrier || obstacle.top >= viewport.top + viewport.height * .5) && (isLowerWideBarrier || obstacle.bottom >= viewport.bottom - gap) && obstacle.top < bottom) bottom = Math.min(bottom, obstacle.top - gap);
    if (spansHeight && obstacle.right >= viewport.right - gap && obstacle.left < right) right = Math.min(right, obstacle.left - gap);
  }
  if (right - left < input.opticalBounds.width) { left = viewport.left + inset.left; right = viewport.right - inset.right; }
  if (bottom - top < input.opticalBounds.height) { top = viewport.top + inset.top; bottom = viewport.bottom - inset.bottom; }
  const walkableRect = makeRect(left, top, right, bottom);
  return { walkableRect, obstacleRects: obstacles, safeLeft: left, safeRight: viewport.right - right, safeTop: top, safeBottom: viewport.bottom - bottom };
}

export function anchorToPetRect(anchorX: number, anchorY: number, optical: PetOpticalBounds): PetRect {
  return makeRect(anchorX - optical.anchorX, anchorY - optical.anchorY, anchorX - optical.anchorX + optical.width, anchorY - optical.anchorY + optical.height);
}

export function clampPetAnchor(anchor: { x: number; y: number }, resolved: PetWalkableAreaResult, optical: PetOpticalBounds): { x: number; y: number } {
  const minX = resolved.walkableRect.left + optical.anchorX, maxX = resolved.walkableRect.right - (optical.width - optical.anchorX);
  const minY = resolved.walkableRect.top + optical.anchorY, maxY = resolved.walkableRect.bottom - (optical.height - optical.anchorY);
  let next = { x: Math.max(minX, Math.min(anchor.x, maxX)), y: Math.max(minY, Math.min(anchor.y, maxY)) };
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const petRect = anchorToPetRect(next.x, next.y, optical);
    const obstacle = resolved.obstacleRects.find((rect) => overlaps(petRect, rect, 12));
    if (!obstacle) break;
    const candidates = [
      { x: obstacle.left - 12 - (optical.width - optical.anchorX), y: next.y }, { x: obstacle.right + 12 + optical.anchorX, y: next.y },
      { x: next.x, y: obstacle.top - 12 - (optical.height - optical.anchorY) }, { x: next.x, y: obstacle.bottom + 12 + optical.anchorY },
    ].map((candidate) => ({ x: Math.max(minX, Math.min(candidate.x, maxX)), y: Math.max(minY, Math.min(candidate.y, maxY)) }))
      .filter((candidate) => !overlaps(anchorToPetRect(candidate.x, candidate.y, optical), obstacle, 12));
    candidates.sort((a, b) => Math.hypot(a.x - next.x, a.y - next.y) - Math.hypot(b.x - next.x, b.y - next.y));
    if (!candidates[0]) break;
    next = candidates[0];
  }
  return next;
}

export function normalizedToAnchor(position: PetNormalizedPosition, resolved: PetWalkableAreaResult, optical: PetOpticalBounds): { x: number; y: number } {
  const minX = resolved.walkableRect.left + optical.anchorX, maxX = resolved.walkableRect.right - (optical.width - optical.anchorX);
  const minY = resolved.walkableRect.top + optical.anchorY, maxY = resolved.walkableRect.bottom - (optical.height - optical.anchorY);
  return clampPetAnchor({ x: minX + clamp01(position.x) * Math.max(0, maxX - minX), y: minY + clamp01(position.y) * Math.max(0, maxY - minY) }, resolved, optical);
}

export function anchorToNormalized(anchor: { x: number; y: number }, resolved: PetWalkableAreaResult, optical: PetOpticalBounds, kind: PetOpticalAnchor): PetNormalizedPosition {
  const clamped = clampPetAnchor(anchor, resolved, optical);
  const minX = resolved.walkableRect.left + optical.anchorX, maxX = resolved.walkableRect.right - (optical.width - optical.anchorX);
  const minY = resolved.walkableRect.top + optical.anchorY, maxY = resolved.walkableRect.bottom - (optical.height - optical.anchorY);
  return { x: clamp01((clamped.x - minX) / Math.max(1, maxX - minX)), y: clamp01((clamped.y - minY) / Math.max(1, maxY - minY)), anchor: kind };
}
export const recommendedPetPosition = (): PetNormalizedPosition => ({ x: .88, y: .9, anchor: 'feet-center' });
