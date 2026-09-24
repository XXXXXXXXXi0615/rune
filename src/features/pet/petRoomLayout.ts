import type { FocusRoomType } from '@/components/focus/types';
import type { PetRoomPosition } from '@/features/pet/types';

export interface PetDragBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PetAvoidZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PetRoomLayout {
  scale: number;
  anchorX: number;
  anchorY: number;
  initialPosition: PetRoomPosition;
  dragBounds: PetDragBounds;
  avoidZones: PetAvoidZone[];
}

interface ResponsivePetRoomLayout {
  desktop: PetRoomLayout;
  mobile: PetRoomLayout;
}

export const PET_ROOM_LAYOUTS: Record<FocusRoomType, ResponsivePetRoomLayout> = {
  computer: {
    desktop: { scale: 0.88, anchorX: 0.5, anchorY: 1, initialPosition: { x: 0.82, y: 0.93 }, dragBounds: { minX: 0.13, maxX: 0.88, minY: 0.52, maxY: 0.95 }, avoidZones: [{ x: 0.25, y: 0.06, width: 0.65, height: 0.43 }] },
    mobile: { scale: 0.8, anchorX: 0.5, anchorY: 1, initialPosition: { x: 0.8, y: 0.93 }, dragBounds: { minX: 0.16, maxX: 0.84, minY: 0.56, maxY: 0.94 }, avoidZones: [{ x: 0.23, y: 0.05, width: 0.68, height: 0.45 }] },
  },
  coffee: {
    desktop: { scale: 0.82, anchorX: 0.5, anchorY: 1, initialPosition: { x: 0.84, y: 0.94 }, dragBounds: { minX: 0.13, maxX: 0.89, minY: 0.55, maxY: 0.95 }, avoidZones: [{ x: 0.1, y: 0.04, width: 0.7, height: 0.48 }] },
    mobile: { scale: 0.76, anchorX: 0.5, anchorY: 1, initialPosition: { x: 0.82, y: 0.94 }, dragBounds: { minX: 0.16, maxX: 0.86, minY: 0.58, maxY: 0.94 }, avoidZones: [{ x: 0.08, y: 0.03, width: 0.72, height: 0.5 }] },
  },
  toilet: {
    desktop: { scale: 0.78, anchorX: 0.5, anchorY: 1, initialPosition: { x: 0.52, y: 0.95 }, dragBounds: { minX: 0.15, maxX: 0.86, minY: 0.55, maxY: 0.96 }, avoidZones: [{ x: 0.31, y: 0.02, width: 0.39, height: 0.4 }] },
    mobile: { scale: 0.72, anchorX: 0.5, anchorY: 1, initialPosition: { x: 0.52, y: 0.94 }, dragBounds: { minX: 0.17, maxX: 0.83, minY: 0.58, maxY: 0.95 }, avoidZones: [{ x: 0.29, y: 0.02, width: 0.42, height: 0.42 }] },
  },
  bed: {
    desktop: { scale: 0.94, anchorX: 0.5, anchorY: 0.94, initialPosition: { x: 0.42, y: 0.78 }, dragBounds: { minX: 0.14, maxX: 0.86, minY: 0.55, maxY: 0.94 }, avoidZones: [{ x: 0.58, y: 0.02, width: 0.36, height: 0.38 }] },
    mobile: { scale: 0.84, anchorX: 0.5, anchorY: 0.94, initialPosition: { x: 0.42, y: 0.8 }, dragBounds: { minX: 0.17, maxX: 0.83, minY: 0.58, maxY: 0.93 }, avoidZones: [{ x: 0.56, y: 0.02, width: 0.38, height: 0.4 }] },
  },
};

export function getPetRoomLayout(roomId: FocusRoomType, mobile: boolean): PetRoomLayout {
  return PET_ROOM_LAYOUTS[roomId][mobile ? 'mobile' : 'desktop'];
}

function intersectsZone(position: PetRoomPosition, footprint: { width: number; height: number }, zone: PetAvoidZone) {
  const left = position.x - footprint.width / 2;
  const right = position.x + footprint.width / 2;
  const top = position.y - footprint.height;
  const bottom = position.y;
  return right > zone.x && left < zone.x + zone.width && bottom > zone.y && top < zone.y + zone.height;
}

export function clampPetRoomPosition(
  position: PetRoomPosition,
  layout: Pick<PetRoomLayout, 'dragBounds' | 'avoidZones'>,
  footprint = { width: 0.18, height: 0.38 },
): PetRoomPosition {
  const { dragBounds } = layout;
  let next = {
    x: Math.min(dragBounds.maxX, Math.max(dragBounds.minX, position.x)),
    y: Math.min(dragBounds.maxY, Math.max(dragBounds.minY, position.y)),
  };
  for (const zone of layout.avoidZones) {
    if (!intersectsZone(next, footprint, zone)) continue;
    const candidates = [
      { x: zone.x - footprint.width / 2, y: next.y },
      { x: zone.x + zone.width + footprint.width / 2, y: next.y },
      { x: next.x, y: zone.y - 0.01 },
      { x: next.x, y: zone.y + zone.height + footprint.height },
    ].map((candidate) => ({
      x: Math.min(dragBounds.maxX, Math.max(dragBounds.minX, candidate.x)),
      y: Math.min(dragBounds.maxY, Math.max(dragBounds.minY, candidate.y)),
    })).filter((candidate) => !intersectsZone(candidate, footprint, zone));
    candidates.sort((a, b) => Math.hypot(a.x - next.x, a.y - next.y) - Math.hypot(b.x - next.x, b.y - next.y));
    if (candidates[0]) next = candidates[0];
  }
  return next;
}
