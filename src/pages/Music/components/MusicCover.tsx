import type { CSSProperties } from 'react';

const PALETTES = [
  ['#d89558', '#5ea89d'], ['#b9816a', '#768db0'], ['#d7a65d', '#8f7da8'],
  ['#668f91', '#d28a6d'], ['#7d9a72', '#b77984'], ['#9a7f69', '#5f9ca5'],
];

export function stableCoverStyle(seed: string): CSSProperties {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  const palette = PALETTES[Math.abs(hash) % PALETTES.length];
  const angle = 115 + (Math.abs(hash) % 45);
  return { background: `linear-gradient(${angle}deg, ${palette[0]}, ${palette[1]})` };
}

export function resolveMusicCoverSource(item?: Record<string, unknown> | null): string | undefined {
  if (!item) return undefined;
  const candidates = [
    item.embeddedCover,
    item.embeddedArtwork,
    item.customCover,
    item.albumCover,
    item.playlistCover,
    item.artworkUrl,
    item.coverUrl,
  ];
  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0);
}

export function MusicCover({ id, src, label, className = '', lazy = true }: {
  id: string;
  src?: string;
  label?: string;
  className?: string;
  lazy?: boolean;
}) {
  return (
    <span className={`music-cover ${className}`} style={src ? undefined : stableCoverStyle(id)} aria-hidden="true">
      {src ? <img src={src} alt="" loading={lazy ? 'lazy' : 'eager'} /> : (
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 33V14l20-4v18" /><circle cx="13" cy="34" r="5" /><circle cx="33" cy="29" r="5" />
        </svg>
      )}
      {label && <span className="music-cover__label">{label.slice(0, 1)}</span>}
    </span>
  );
}
