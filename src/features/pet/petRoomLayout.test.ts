import { describe, expect, it } from 'vitest';
import { clampPetRoomPosition, getPetRoomLayout, PET_ROOM_LAYOUTS } from '@/features/pet/petRoomLayout';

describe('TIDEBOUND pet room layouts', () => {
  it('provides independent desktop and mobile layouts for all four rooms', () => {
    expect(Object.keys(PET_ROOM_LAYOUTS)).toEqual(['computer', 'coffee', 'toilet', 'bed']);
    expect(new Set(Object.values(PET_ROOM_LAYOUTS).map((room) => `${room.desktop.scale}:${room.desktop.initialPosition.x}:${room.desktop.initialPosition.y}`)).size).toBe(4);
    expect(getPetRoomLayout('computer', true)).not.toBe(getPetRoomLayout('computer', false));
  });

  it('clamps a dragged position to the room bounds', () => {
    const layout = getPetRoomLayout('coffee', false);
    expect(clampPetRoomPosition({ x: -1, y: 2 }, layout)).toEqual({
      x: layout.dragBounds.minX,
      y: layout.dragBounds.maxY,
    });
  });

  it('moves the pet out of a furniture avoid zone', () => {
    const layout = getPetRoomLayout('computer', false);
    const zone = layout.avoidZones[0];
    const result = clampPetRoomPosition({ x: zone.x + zone.width / 2, y: zone.y + zone.height }, layout, { width: 0.12, height: 0.22 });
    const overlapsHorizontally = result.x + 0.06 > zone.x && result.x - 0.06 < zone.x + zone.width;
    const overlapsVertically = result.y > zone.y && result.y - 0.22 < zone.y + zone.height;
    expect(overlapsHorizontally && overlapsVertically).toBe(false);
  });
});
