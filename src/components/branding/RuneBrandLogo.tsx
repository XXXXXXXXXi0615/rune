import { useEffect, useState } from 'react';
import { LunartideLogo } from '@/components/branding/LunartideLogo';
import { resolveRuneBrandAsset, type RuneBrandMood } from '@/components/branding/runeBrandAssets';

interface RuneBrandLogoProps {
  mood?: RuneBrandMood;
  className?: string;
  decorative?: boolean;
  'aria-label'?: string;
}

export function RuneBrandLogo({
  mood = 'neutral',
  className,
  decorative = false,
  'aria-label': ariaLabel = 'Rune',
}: RuneBrandLogoProps) {
  const neutralSrc = resolveRuneBrandAsset();
  const requestedSrc = resolveRuneBrandAsset(mood);
  const [displayedSrc, setDisplayedSrc] = useState<string | null>(null);
  const [candidateSrc, setCandidateSrc] = useState(requestedSrc);

  useEffect(() => {
    setCandidateSrc(requestedSrc);
  }, [requestedSrc]);

  const handleCandidateError = () => {
    if (candidateSrc !== neutralSrc) {
      setCandidateSrc(neutralSrc);
      return;
    }
    setCandidateSrc('');
    setDisplayedSrc(null);
  };

  return (
    <span
      className={['rune-brand-logo', className].filter(Boolean).join(' ')}
      data-rune-brand-mood={mood}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative || undefined}
    >
      <LunartideLogo className="rune-brand-logo__legacy" decorative />
      {displayedSrc && (
        <img
          className="rune-brand-logo__image"
          src={displayedSrc}
          alt=""
          draggable={false}
        />
      )}
      {candidateSrc && candidateSrc !== displayedSrc && (
        <img
          className="rune-brand-logo__candidate"
          src={candidateSrc}
          alt=""
          aria-hidden="true"
          onLoad={() => setDisplayedSrc(candidateSrc)}
          onError={handleCandidateError}
        />
      )}
    </span>
  );
}
