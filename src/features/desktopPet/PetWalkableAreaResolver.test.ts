import { describe, expect, it } from 'vitest';
import { anchorToNormalized, anchorToPetRect, clampPetAnchor, normalizedToAnchor, resolvePetWalkableArea, type PetOpticalBounds } from './PetWalkableAreaResolver';

const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
const optical: PetOpticalBounds = { width: 100, height: 120, anchorX: 50, anchorY: 110 };

describe('PetWalkableAreaResolver', () => {
  it('keeps a mobile pet above a wide music stack', () => {
    const result = resolvePetWalkableArea({ viewportRect: rect(0, 0, 390, 844), sidebarRect: rect(-280, 0, 0, 844), dialogRects: [rect(0, 585, 390, 732), rect(16, 585, 374, 649)], safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 }, opticalBounds: { width: 72, height: 72, anchorX: 36, anchorY: 64.8 } });
    expect(result.safeBottom).toBe(271);
    expect(anchorToPetRect(clampPetAnchor({ x: 306, y: 808.8 }, result, { width: 72, height: 72, anchorX: 36, anchorY: 64.8 }).x, clampPetAnchor({ x: 306, y: 808.8 }, result, { width: 72, height: 72, anchorX: 36, anchorY: 64.8 }).y, { width: 72, height: 72, anchorX: 36, anchorY: 64.8 }).bottom).toBeLessThanOrEqual(573);
  });
  it('resolves all four edges from chrome and bottom players', () => {
    const result = resolvePetWalkableArea({ viewportRect: rect(0, 0, 1280, 800), sidebarRect: rect(0, 0, 240, 800), headerRect: rect(240, 0, 1280, 52), desktopMusicPlayerRect: rect(240, 700, 1280, 800), opticalBounds: optical });
    expect(result.walkableRect).toMatchObject({ left: 252, top: 64, right: 1268, bottom: 688 });
    expect(result.obstacleRects).toHaveLength(3);
  });

  it('preserves a feet anchor while optical size changes', () => {
    const area = resolvePetWalkableArea({ viewportRect: rect(0, 0, 1000, 700), opticalBounds: optical });
    const anchor = { x: 700, y: 600 };
    const larger = { width: 200, height: 240, anchorX: 100, anchorY: 220 };
    expect(clampPetAnchor(anchor, area, larger)).toEqual(anchor);
  });

  it('round-trips normalized positions and avoids a dialog', () => {
    const area = resolvePetWalkableArea({ viewportRect: rect(0, 0, 900, 700), dialogRects: [rect(580, 380, 820, 650)], opticalBounds: optical });
    const normalized = { x: .8, y: .8, anchor: 'feet-center' as const };
    const anchor = normalizedToAnchor(normalized, area, optical);
    const pet = { left: anchor.x - 50, right: anchor.x + 50, top: anchor.y - 110, bottom: anchor.y + 10 };
    expect(pet.right <= 572 || pet.left >= 828 || pet.bottom <= 372 || pet.top >= 658).toBe(true);
    const saved = anchorToNormalized(anchor, area, optical, 'feet-center');
    expect(saved.x).toBeGreaterThanOrEqual(0); expect(saved.x).toBeLessThanOrEqual(1);
  });
});
