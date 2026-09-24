import type { CSSProperties } from 'react';
import { usePetAnimation } from '@/hooks/usePetAnimation';
import '@/components/pet/pet-sprite.css';

interface PetSpriteProps {
  animationId: string;
  scale?: number;
  flipX?: boolean;
  playing?: boolean;
  loop?: boolean;
  onAnimationEnd?: () => void;
  className?: string;
  speed?: number;
}

export function PetSprite({ animationId, scale = 1, flipX = false, playing = true, loop, onAnimationEnd, className = '', speed = 1 }: PetSpriteProps) {
  const { atlas, frameIndex, loadError } = usePetAnimation({ animationId, playing, loop, onAnimationEnd, speed });
  const frame = atlas?.frames[frameIndex];
  const safeFrame = frame && !frame.empty ? frame : atlas?.frames[0];
  const style = atlas && safeFrame ? {
    '--pet-columns': atlas.columns,
    '--pet-rows': atlas.rows,
    '--pet-column': safeFrame.column,
    '--pet-row': safeFrame.row,
    '--pet-scale': scale,
    '--pet-flip': flipX ? -1 : 1,
  } as CSSProperties : undefined;

  if (loadError) return <span className={`pet-sprite-placeholder ${className}`} role="img" aria-label="吉伊暫時休息中" />;
  return <span className={`pet-sprite ${atlas ? 'is-ready' : 'is-loading'} ${className}`} style={style} role="img" aria-label="吉伊" />;
}
