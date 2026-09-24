import type { ReadingBoardDecoration } from './types';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function screenDeltaToBoard(delta: number, scale: number) {
  return delta / Math.max(scale, 0.01);
}

export function resizeWithAspect(startWidth: number, startHeight: number, deltaX: number, deltaY: number, lockAspect: boolean) {
  if (!lockAspect) return { width: Math.max(32, startWidth + deltaX), height: Math.max(32, startHeight + deltaY) };
  const ratio = startWidth / Math.max(startHeight, 1);
  const widthFromX = Math.max(32, startWidth + deltaX);
  const heightFromY = Math.max(32, startHeight + deltaY);
  if (Math.abs(deltaX) >= Math.abs(deltaY * ratio)) return { width: widthFromX, height: widthFromX / ratio };
  return { width: heightFromY * ratio, height: heightFromY };
}

export function normalizeZIndices(items: ReadingBoardDecoration[]) {
  return [...items].sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)).map((item, index) => ({ ...item, zIndex: index + 1 }));
}

export function snapDecoration(item: ReadingBoardDecoration, boardWidth: number, boardHeight: number, threshold: number) {
  const candidatesX = [0, boardWidth / 2 - item.width / 2, boardWidth - item.width];
  const candidatesY = [0, boardHeight / 2 - item.height / 2, boardHeight - item.height];
  let x = item.x; let y = item.y; let guideX: number | undefined; let guideY: number | undefined;
  for (const candidate of candidatesX) if (Math.abs(x - candidate) <= threshold) { x = candidate; guideX = candidate === 0 ? 0 : candidate === boardWidth - item.width ? boardWidth : boardWidth / 2; break; }
  for (const candidate of candidatesY) if (Math.abs(y - candidate) <= threshold) { y = candidate; guideY = candidate === 0 ? 0 : candidate === boardHeight - item.height ? boardHeight : boardHeight / 2; break; }
  return { item: { ...item, x, y }, guideX, guideY };
}

export function canMoveDecoration(item: ReadingBoardDecoration) { return !item.locked; }
export function restoreTransformOnPointerCancel(start: ReadingBoardDecoration) { return { ...start }; }
