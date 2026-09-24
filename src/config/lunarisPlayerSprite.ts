export type LunarisPlayerState =
  | 'idle'
  | 'walking'
  | 'coding'
  | 'sleeping'
  | 'toilet';

export type LunarisPlayerDirection = 'down' | 'up' | 'left' | 'right';

export interface LunarisPlayerFrame {
  x: number;
  y: number;
}

export interface LunarisPlayerAnimation {
  frames: LunarisPlayerFrame[];
  frameMs: number;
}

export const LUNARIS_PLAYER_SPRITE = {
  id: 'lunaris',
  displayName: 'LUNARIS',
  spritesheetPath: `${import.meta.env.BASE_URL}assets/players/lunanis/spritesheet.webp`,
  sheetWidth: 1536,
  sheetHeight: 1872,
  frameWidth: 192,
  frameHeight: 208,
} as const;

const frame = (column: number, row: number): LunarisPlayerFrame => ({
  x: column * LUNARIS_PLAYER_SPRITE.frameWidth,
  y: row * LUNARIS_PLAYER_SPRITE.frameHeight,
});

export const LUNARIS_PLAYER_ANIMATIONS: Record<LunarisPlayerState, LunarisPlayerAnimation> = {
  idle: {
    frames: [frame(0, 0), frame(1, 0), frame(2, 0), frame(3, 0), frame(4, 0), frame(5, 0)],
    frameMs: 420,
  },
  walking: {
    frames: [frame(0, 1), frame(1, 1), frame(2, 1), frame(3, 1), frame(4, 1), frame(5, 1), frame(6, 1), frame(7, 1)],
    frameMs: 95,
  },
  coding: {
    frames: [frame(0, 7), frame(1, 7), frame(2, 7), frame(3, 7), frame(4, 7), frame(5, 7)],
    frameMs: 180,
  },
  sleeping: {
    frames: [frame(5, 5), frame(6, 5), frame(5, 5), frame(7, 5)],
    frameMs: 540,
  },
  toilet: {
    frames: [frame(0, 6), frame(1, 6), frame(2, 6), frame(3, 6), frame(4, 6), frame(5, 6)],
    frameMs: 220,
  },
};
