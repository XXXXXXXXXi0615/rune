import { useEffect, useRef, useState } from 'react';
import { LUNARIS_PET_STATES, type LunarisPetState } from '@/config/lunarisPetStates';

export interface LunarisPetProps {
  state: LunarisPetState;
  size?: 'compact' | 'floating' | 'card' | 'pet';
  className?: string;
  onVisualState?: (visible: boolean) => void;
}

export function LunarisPet({ state, size = 'floating', className = '', onVisualState }: LunarisPetProps) {
  const config = LUNARIS_PET_STATES[state];
  const [imageFailed, setImageFailed] = useState(false);
  const visualStateRef = useRef(onVisualState);
  visualStateRef.current = onVisualState;

  useEffect(() => {
    setImageFailed(false);
    visualStateRef.current?.(Boolean(config.src));
    return () => visualStateRef.current?.(false);
  }, [config.src]);

  const emitVisible = (visible: boolean) => visualStateRef.current?.(visible);

  if (imageFailed) {
    if (import.meta.env.DEV) {
      console.debug(`[LunarisPet] image failed for state="${state}" src="${config.src}"`);
    }
    return null;
  }

  return (
    <span
      className={`lunaris-pet lunaris-pet--${size} lunaris-pet--${state} ${className}`.trim()}
      data-state={state}
      role="img"
      aria-label={imageFailed ? config.fallbackText : undefined}
      title={imageFailed ? `${config.label} · ${config.fallbackText}` : undefined}
    >
      {!imageFailed && (
        <span className="lunaris-pet__image-wrap">
          <img
            className="lunaris-pet__image"
            src={config.src}
            alt=""
            draggable={false}
            onLoad={() => emitVisible(true)}
            onError={() => {
              setImageFailed(true);
              emitVisible(false);
            }}
          />
        </span>
      )}
    </span>
  );
}
