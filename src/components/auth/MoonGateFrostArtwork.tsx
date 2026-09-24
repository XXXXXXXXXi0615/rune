import { InteractiveBlurReveal } from '@/components/effects/InteractiveBlurReveal';
import {
  resolveRuneLoginPortraitAsset,
  type RuneLoginPortraitState,
} from '@/components/branding/runeBrandAssets';
import type { CSSProperties } from 'react';
import './MoonGateFrostArtwork.css';

export function MoonGateFrostArtwork({ state }: { state: RuneLoginPortraitState }) {
  const artwork = resolveRuneLoginPortraitAsset(state);
  const artworkStyle = { '--moon-gate-frost-mask': `url("${artwork}")` } as CSSProperties;

  return (
    <div
      className="rlg-portrait moon-gate-frost-artwork"
      data-portrait-state={state}
      data-testid="rune-login-portrait"
      style={artworkStyle}
    >
      <InteractiveBlurReveal
        className="moon-gate-frost-artwork__reveal"
        imageSrc={artwork}
        alt=""
        variant="rune"
        imageFit="contain"
      />
    </div>
  );
}
