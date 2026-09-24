import type { CSSProperties } from 'react';
import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';
import { DAY_PAGE_HEIGHT, DAY_PAGE_WIDTH } from './calendarDayScene';
import type { CalendarDayElement } from '@/types';

/**
 * Shared Day Canvas presentation primitives.
 *
 * Single source of the canvas's purely presentational leaves. Both the Full
 * Shared Day Canvas (`CalendarDayCanvas`) and the Day Inspector compact preview
 * (`DayInspectorSlots`) render from these — the canonical scene data stays in
 * `features/calendar/calendarDayScene`; nothing here owns or persists state.
 */

export interface SceneTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

const visualHash = (value: string) => [...value].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
export const memoVariant = (id: string) => ['cream', 'mint', 'lavender'][visualHash(id) % 3];
export const tapeVariant = (id: string) => ['kraft', 'mint', 'lavender', 'blue-gray'][visualHash(id) % 4];
export const pinVariant = (id: string) => ['amber', 'lavender', 'teal'][visualHash(`${id}:pin`) % 3];

/** Pure percentage mapping from page coordinates — no interaction state. */
export function canvasTransformStyle(transform: SceneTransform): CSSProperties {
  return {
    left: `${transform.x / DAY_PAGE_WIDTH * 100}%`,
    top: `${transform.y / DAY_PAGE_HEIGHT * 100}%`,
    width: `${transform.width / DAY_PAGE_WIDTH * 100}%`,
    height: `${transform.height / DAY_PAGE_HEIGHT * 100}%`,
    transform: `rotate(${transform.rotation}deg)`,
    zIndex: transform.zIndex,
  };
}

export function ScenePhoto({ item }: { item: CalendarDayElement }) {
  const url = useAssetBlobUrl(item.assetId);
  return url ? <><span className={`calendar-tape is-${tapeVariant(item.id)}`} /><img src={url} alt="日曆照片" draggable={false} /><small className="calendar-photo-caption">留在這一天的光</small></> : <span>照片讀取中</span>;
}

export function SceneSticker({ id }: { id?: CalendarDayElement['stickerId'] }) {
  return <svg viewBox="0 0 100 100" aria-label={id || '月潮貼紙'}>{id === 'star'
    ? <path d="m50 8 12 27 30 3-23 20 7 30-26-16-26 16 7-30L8 38l30-3Z" />
    : id === 'tide-wave' ? <path d="M8 60c12-20 25-20 38 0s26 20 46 0v18c-20 20-34 20-48 0S21 58 8 78Z" />
      : <><circle cx="50" cy="50" r="34" /><circle className="cut" cx="64" cy="39" r="31" /></>}</svg>;
}
