import { useCallback, useEffect, useRef, useState } from 'react';
import { LunarisPet } from '@/components/pet/LunarisPet';
import { PetSprite } from '@/components/pet/PetSprite';
import { getPetDefinition, resolvePetAnimation } from '@/pets/petRegistry';
import type { PetId, PetSemanticState } from '@/pets/types';
import type { LunarisPetState } from '@/config/lunarisPetStates';
import { getResolvedClawdAsset } from '@/features/desktopPet/manifests/clawdOverrides';
import type { PetPresentationRenderer } from '@/features/desktopPet/types';

export function RegisteredPetVisual({ petId, semantic, scale = 1, playing = true, runtimeAssetId, renderer, speed = 1, loop, loading = 'eager', onVisualState }: {
  petId: PetId;
  semantic: PetSemanticState;
  scale?: number;
  playing?: boolean;
  runtimeAssetId?: string;
  renderer?: PetPresentationRenderer;
  speed?: number;
  loop?: boolean;
  loading?: 'eager' | 'lazy';
  onVisualState?: (visible: boolean) => void;
}) {
  const definition = getPetDefinition(petId);
  const animation = runtimeAssetId || resolvePetAnimation(definition, semantic);
  const clawdAsset = renderer === 'clawd-asset' ? getResolvedClawdAsset(animation) : undefined;
  const [assetFailed, setAssetFailed] = useState(false);
  const [assetLoaded, setAssetLoaded] = useState(false);
  const [idleFallbackFailed, setIdleFallbackFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualStateRef = useRef(onVisualState);
  visualStateRef.current = onVisualState;

  const emitVisible = useCallback((visible: boolean) => {
    visualStateRef.current?.(visible);
  }, []);

  useEffect(() => {
    setAssetFailed(false);
    setAssetLoaded(false);
    setIdleFallbackFailed(false);
  }, [animation, renderer]);

  useEffect(() => {
    if (renderer === 'clawd-asset' && idleFallbackFailed) emitVisible(false);
  }, [emitVisible, idleFallbackFailed, renderer]);

  useEffect(() => {
    if (!clawdAsset?.animated || playing) return;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !image.complete || !image.naturalWidth) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d')?.drawImage(image, 0, 0);
  }, [animation, assetLoaded, clawdAsset, playing]);

  if (clawdAsset && !assetFailed) {
    const handleError = () => {
      setAssetFailed(true);
      emitVisible(false);
      if (import.meta.env.DEV) {
        console.debug(`[RegisteredPetVisual] clawd-asset failed for id="${clawdAsset.id}"`);
      }
    };
    return clawdAsset.animated
      ? <span className={`registered-pet-gif${playing ? ' is-playing' : ' is-paused'}`}><img ref={imageRef} className="registered-pet-asset" src={clawdAsset.src} alt="" draggable={false} loading={loading} onLoad={() => { setAssetLoaded(true); emitVisible(true); }} onError={handleError} /><canvas ref={canvasRef} className="registered-pet-gif__paused" aria-hidden="true" /></span>
      : <img ref={imageRef} className="registered-pet-asset" src={clawdAsset.src} alt="" draggable={false} loading={loading} onLoad={() => { setAssetLoaded(true); emitVisible(true); }} onError={handleError} />;
  }

  if (renderer === 'clawd-asset') {
    if (idleFallbackFailed) {
      if (import.meta.env.DEV) {
        console.debug(`[RegisteredPetVisual] idle fallback also failed for "${animation}"`);
      }
      return null;
    }
    return (
      <LunarisPet
        state="idle"
        size="pet"
        onVisualState={(visible) => {
          if (!visible) setIdleFallbackFailed(true);
          emitVisible(visible);
        }}
      />
    );
  }

  const handleLunarisVisualState = (visible: boolean) => emitVisible(visible);

  const renderers = {
    'lunaris-animation': <LunarisPet state={animation as LunarisPetState} size="pet" onVisualState={handleLunarisVisualState} />,
    'sprite-atlas': <PetSprite animationId={animation} scale={scale} playing={playing} speed={speed} loop={loop} />,
  };
  return renderers[definition.assetType];
}
