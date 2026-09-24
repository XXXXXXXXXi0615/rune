import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  LUNARIS_PLAYER_ANIMATIONS,
  LUNARIS_PLAYER_SPRITE,
  type LunarisPlayerDirection,
  type LunarisPlayerState,
} from '@/config/lunarisPlayerSprite';
import './LunarisPlayerSprite.css';

export interface LunarisPlayerSpriteProps {
  state: LunarisPlayerState;
  direction?: LunarisPlayerDirection;
  scale?: number;
  className?: string;
}

export function LunarisPlayerSprite({
  state,
  direction = 'down',
  scale = 0.35,
  className = '',
}: LunarisPlayerSpriteProps) {
  const animation = LUNARIS_PLAYER_ANIMATIONS[state] ?? LUNARIS_PLAYER_ANIMATIONS.idle;
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, [state, direction]);

  useEffect(() => {
    if (animation.frames.length <= 1) return;
    const id = window.setInterval(() => {
      setFrameIndex(current => (current + 1) % animation.frames.length);
    }, animation.frameMs);
    return () => window.clearInterval(id);
  }, [animation.frameMs, animation.frames.length]);

  const frame = animation.frames[frameIndex % animation.frames.length];
  const style = useMemo(() => ({
    '--lunaris-player-scale': scale,
    '--lunaris-frame-width': `${LUNARIS_PLAYER_SPRITE.frameWidth}px`,
    '--lunaris-frame-height': `${LUNARIS_PLAYER_SPRITE.frameHeight}px`,
  }) as CSSProperties, [scale]);

  return (
    <span
      className={`lunaris-player-sprite lunaris-player-sprite--${state} lunaris-player-sprite--${direction} ${className}`.trim()}
      style={style}
      data-state={state}
      data-direction={direction}
      role="img"
      aria-label={`LUNARIS 狀態：${state}`}
      title={`LUNARIS · ${state}`}
    >
      <span
        className="lunaris-player-sprite__frame"
        style={{
          backgroundImage: `url("${LUNARIS_PLAYER_SPRITE.spritesheetPath}")`,
          backgroundPosition: `-${frame.x}px -${frame.y}px`,
          backgroundSize: `${LUNARIS_PLAYER_SPRITE.sheetWidth}px ${LUNARIS_PLAYER_SPRITE.sheetHeight}px`,
        }}
        aria-hidden="true"
      />
    </span>
  );
}

export type { LunarisPlayerDirection, LunarisPlayerState };
