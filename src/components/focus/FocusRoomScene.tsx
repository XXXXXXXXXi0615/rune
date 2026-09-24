import { useMemo } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import type { RoomStatus } from '@/components/focus/FocusRoomPanel';
import { FocusRoomObject, type FocusRoomObjectData } from '@/components/focus/FocusRoomObject';
import { TideboundRoomPet } from '@/components/pet/TideboundRoomPet';
import type { FocusRoomCategory, FocusRoomType } from '@/components/focus/types';

interface TilePoint { x: number; y: number }

export interface FocusRoomDefinition {
  id: FocusRoomType;
  label: string;
  subtitle: string;
  category: FocusRoomCategory;
  suggestedMinutes: number;
  width: number;
  height: number;
  tileSize: number;
  objects: FocusRoomObjectData[];
  walkableTiles: TilePoint[];
  spawnPoint: TilePoint;
  collisionData: TilePoint[];
}

const roomObjects: Record<FocusRoomType, FocusRoomObjectData[]> = {
  computer: [
    { id: 'desk', kind: 'computer-desk', x: 1, y: 1, width: 4, height: 1, collision: true },
    { id: 'monitor', kind: 'monitor', x: 2.1, y: 0.7, width: 1.7, height: 1.2, collision: true },
    { id: 'keyboard', kind: 'keyboard', x: 2.2, y: 1.75, width: 1.5, height: 0.35, collision: false },
    { id: 'chair', kind: 'chair', x: 2.35, y: 2.25, width: 1.3, height: 1.2, collision: true },
    { id: 'lamp', kind: 'desk-lamp', x: 4.35, y: 0.65, width: 0.7, height: 1.4, collision: true },
  ],
  coffee: [
    { id: 'counter', kind: 'counter', x: 0.7, y: 1.1, width: 4.6, height: 1.2, collision: true },
    { id: 'machine', kind: 'coffee-machine', x: 1.2, y: 0.45, width: 1.35, height: 1.45, collision: true },
    { id: 'cup', kind: 'cup', x: 3.1, y: 1, width: 0.65, height: 0.75, collision: false },
    { id: 'shelf', kind: 'shelf', x: 4.25, y: 0.3, width: 1.1, height: 1.4, collision: true },
  ],
  toilet: [
    { id: 'toilet', kind: 'toilet', x: 0.8, y: 2.1, width: 1.5, height: 1.5, collision: true },
    { id: 'sink', kind: 'sink', x: 3.7, y: 1.8, width: 1.5, height: 1.2, collision: true },
    { id: 'paper', kind: 'paper', x: 2.5, y: 2.2, width: 0.6, height: 0.8, collision: false },
    { id: 'window', kind: 'small-window', x: 2.1, y: 0.25, width: 1.8, height: 1.1, collision: true },
  ],
  bed: [
    { id: 'bed', kind: 'bed', x: 0.55, y: 1.35, width: 3.7, height: 2.4, collision: true },
    { id: 'nightstand', kind: 'nightstand', x: 4.45, y: 2.35, width: 1, height: 1.1, collision: true },
    { id: 'lamp', kind: 'bed-lamp', x: 4.6, y: 1.55, width: 0.65, height: 1, collision: true },
    { id: 'window', kind: 'moon-window', x: 3.7, y: 0.15, width: 1.7, height: 1.35, collision: true },
  ],
};

function points(width: number, height: number, objects: FocusRoomObjectData[]) {
  const collisionData = objects.filter((object) => object.collision).flatMap((object) => {
    const result: TilePoint[] = [];
    for (let y = Math.floor(object.y); y < Math.ceil(object.y + object.height); y += 1) {
      for (let x = Math.floor(object.x); x < Math.ceil(object.x + object.width); x += 1) result.push({ x, y });
    }
    return result;
  });
  const blocked = new Set(collisionData.map(({ x, y }) => `${x}:${y}`));
  const walkableTiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({ x, y })),
  ).flat().filter(({ x, y }) => !blocked.has(`${x}:${y}`));
  return { collisionData, walkableTiles };
}

function defineRoom(base: Omit<FocusRoomDefinition, 'objects' | 'walkableTiles' | 'collisionData'>): FocusRoomDefinition {
  const objects = roomObjects[base.id];
  return { ...base, objects, ...points(base.width, base.height, objects) };
}

export const FOCUS_ROOMS: FocusRoomDefinition[] = [
  defineRoom({ id: 'computer', label: '寫程式', subtitle: '專注工作', category: 'focus', suggestedMinutes: 25, width: 6, height: 5, tileSize: 16, spawnPoint: { x: 3, y: 4 } }),
  defineRoom({ id: 'coffee', label: '補給', subtitle: '快速啟動', category: 'focus', suggestedMinutes: 5, width: 6, height: 5, tileSize: 16, spawnPoint: { x: 3, y: 4 } }),
  defineRoom({ id: 'toilet', label: '摸魚', subtitle: '短暫透氣', category: 'break', suggestedMinutes: 8, width: 6, height: 5, tileSize: 16, spawnPoint: { x: 3, y: 4 } }),
  defineRoom({ id: 'bed', label: '休息', subtitle: '恢復狀態', category: 'rest', suggestedMinutes: 15, width: 6, height: 5, tileSize: 16, spawnPoint: { x: 4, y: 4 } }),
];

export function getFocusRoom(roomType: FocusRoomType): FocusRoomDefinition {
  return FOCUS_ROOMS.find((room) => room.id === roomType) || FOCUS_ROOMS[0];
}

interface FocusRoomSceneProps {
  status: RoomStatus;
  selectedRoom: FocusRoomType;
  active?: boolean;
  onRoomSelect?: (room: FocusRoomType) => void;
  onSuggestedMinutes?: (minutes: number) => void;
}

export function FocusRoomScene({ status, selectedRoom, active = false, onRoomSelect, onSuggestedMinutes }: FocusRoomSceneProps) {
  const rooms = active ? [getFocusRoom(selectedRoom)] : FOCUS_ROOMS;
  const tilesByRoom = useMemo(() => Object.fromEntries(FOCUS_ROOMS.map((room) => [room.id,
    Array.from({ length: room.height }, (_, y) => Array.from({ length: room.width }, (_, x) => ({ x, y }))).flat(),
  ])), []);

  const selectSuggested = (event: MouseEvent, minutes: number) => {
    event.stopPropagation();
    onSuggestedMinutes?.(minutes);
  };

  return (
    <div className={`focus-room-scene${active ? ' focus-room-scene--active' : ''}`} data-room-status={status} data-selected-room={selectedRoom}>
      <div className="focus-room-grid">
        {rooms.map((room) => {
          const selected = room.id === selectedRoom;
          return (
            <div
              key={room.id}
              className={`focus-room-card${selected ? ' focus-room-card--selected' : ''}`}
              data-room={room.id}
              onClick={() => onRoomSelect?.(room.id)}
              onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRoomSelect?.(room.id);
                }
              }}
              role="button"
              tabIndex={active ? -1 : 0}
              aria-pressed={selected}
              aria-label={`${room.label}，${room.subtitle}`}
            >
              <span className="focus-room-card-scene" style={{ '--room-cols': room.width, '--room-rows': room.height, '--room-tile-size': `${room.tileSize}px` } as CSSProperties}>
                {tilesByRoom[room.id].map((tile) => (
                  <i key={`${tile.x}-${tile.y}`} className="focus-room-card-tile" style={{ '--tile-x': tile.x, '--tile-y': tile.y } as CSSProperties} />
                ))}
                <span className="focus-room-spawn" style={{ '--spawn-x': room.spawnPoint.x, '--spawn-y': room.spawnPoint.y } as CSSProperties} />
                {room.objects.map((object) => <FocusRoomObject key={object.id} object={object} />)}
                {selected && <TideboundRoomPet roomId={room.id} status={status} />}
              </span>
              <span className="focus-room-card-copy">
                <span><b>{room.label}</b><small>{room.subtitle}</small></span>
                <button type="button" className="focus-room-suggestion" onClick={(event) => selectSuggested(event, room.suggestedMinutes)}>
                  建議 {room.suggestedMinutes} 分
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
