import type { FocusRoomType } from './types';

const FOCUS_ROOMS = new Set<FocusRoomType>(['computer', 'coffee']);

export function getFocusRoomSummaryMinutes(roomType: FocusRoomType, focusMinutes: number, breakMinutes: number): number {
  return FOCUS_ROOMS.has(roomType) ? focusMinutes : breakMinutes;
}
