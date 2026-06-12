import { useState, useEffect, useRef, useId } from 'react';
import { getPetImage } from '@/store/petImages';
import type { AvatarImageMeta } from '@/types';

interface Props {
  avatarConfig?: AvatarImageMeta;
  fallbackInitial?: string;
  label?: string;
  image?: AvatarImageMeta;
  initial: string;
  color: string;
  size?: number;
  className?: string;
}

export function AvatarImage({
  avatarConfig,
  fallbackInitial,
  label,
  image,
  initial,
  color,
  size = 32,
  className,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const urlRef = useRef<string | null>(null);
  const gradientId = useId();
  const resolvedImage = avatarConfig || image;
  const resolvedInitial = (fallbackInitial || initial || '?').charAt(0).toUpperCase();

  useEffect(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(null);
     
    setFailed(false);
    if (!resolvedImage?.key || resolvedImage.storage !== 'indexeddb') {
      return undefined;
    }
    let cancelled = false;
    getPetImage(resolvedImage.key).then((blob) => {
      if (cancelled || !blob) { if (!cancelled) setFailed(true); return; }
      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      setUrl(u);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [resolvedImage?.key, resolvedImage?.storage]);

  return (
    <div
      className={`capsule-avatar ${color} ${className || ''}`}
      style={{ width: size, height: size }}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
    >
      {url && !failed ? (
        <img src={url} alt={label || ''}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          draggable={false} onError={() => setFailed(true)} />
      ) : (
        <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
          <defs>
            <radialGradient id={gradientId} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#faf9f5" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#a28fb8" stopOpacity="0.18" />
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="15.5" fill={`url(#${gradientId})`} />
          <circle cx="16" cy="16" r="15.5" fill="none" stroke="rgba(162,143,184,0.30)" strokeWidth="1" />
          <circle cx="11.5" cy="12.5" r="3.2" fill="rgba(162,143,184,0.30)" />
          <path d="M5 24c0-4 5-7 11-7s11 3 11 7" fill="none" stroke="rgba(162,143,184,0.20)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
