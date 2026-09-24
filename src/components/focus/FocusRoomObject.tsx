import type { CSSProperties } from 'react';

export type FocusRoomObjectKind =
  | 'computer-desk'
  | 'monitor'
  | 'keyboard'
  | 'chair'
  | 'desk-lamp'
  | 'coffee-machine'
  | 'cup'
  | 'counter'
  | 'shelf'
  | 'toilet'
  | 'sink'
  | 'paper'
  | 'small-window'
  | 'bed'
  | 'nightstand'
  | 'bed-lamp'
  | 'moon-window';

export interface FocusRoomObjectData {
  id: string;
  kind: FocusRoomObjectKind;
  x: number;
  y: number;
  width: number;
  height: number;
  collision: boolean;
}

export function FocusRoomObject({ object }: { object: FocusRoomObjectData }) {
  return (
    <span
      className={`focus-room-prop focus-room-prop--${object.kind}`}
      style={{
        '--object-x': object.x,
        '--object-y': object.y,
        '--object-w': object.width,
        '--object-h': object.height,
      } as CSSProperties}
      aria-hidden="true"
    >
      <i /><i /><i />
    </span>
  );
}
