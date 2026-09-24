import type { CSSProperties } from 'react';
import type { CompanionVisual } from '@/features/companionPets/companionPetPacks';

interface Props {
  visual: CompanionVisual;
  reducedMotion?: boolean;
  className?: string;
  testId?: string;
  onError?: () => void;
  loading?: 'eager' | 'lazy';
}

export function CompanionPetVisual({ visual, reducedMotion = false, className = '', testId, onError, loading = 'lazy' }: Props) {
  if (visual.renderer === 'image' || !visual.sprite) {
    return <img className={className} src={visual.src} alt="" aria-hidden="true" draggable={false} loading={loading} decoding="async" data-companion-rendered-asset={visual.id} data-testid={testId} onError={onError}/>;
  }
  const style = {
    '--pet-sprite-row': visual.sprite.row,
    '--pet-sprite-frames': visual.sprite.frameCount,
    '--pet-sprite-start-frame': visual.sprite.startFrame,
    '--pet-sprite-last-frame': visual.sprite.startFrame + visual.sprite.frameCount - 1,
    '--pet-sprite-once-steps': Math.max(1, visual.sprite.frameCount - 1),
    '--pet-sprite-duration': `${visual.sprite.frameCount / visual.sprite.fps}s`,
  } as CSSProperties;
  const playbackClass = visual.sprite.loop ? 'is-looping' : `is-once ${visual.sprite.holdLastFrame ? 'holds-last-frame' : ''}`;
  return <span className={`companion-sprite ${playbackClass} ${reducedMotion ? 'is-frozen' : ''} ${className}`} style={style} data-companion-rendered-asset={visual.id} data-sprite-start-frame={visual.sprite.startFrame} data-sprite-loop={String(visual.sprite.loop)} data-sprite-hold-last={String(visual.sprite.holdLastFrame)} data-testid={testId} aria-hidden="true">
    <img src={visual.src} alt="" draggable={false} loading={loading} decoding="async" onError={onError}/>
  </span>;
}
