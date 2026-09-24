import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';
import type { CountdownEvent } from '@/features/countdown/countdownEngine';
import './countdownVisuals.css';

/**
 * Calendar C2 — shared countdown visuals.
 *
 * The editor, the Calendar countdown card and the Home countdown widget all
 * render the same cover / icon / colour language from this single module, so a
 * configured cover can never drift between surfaces. `coverAssetId`, `iconId`
 * and `colorToken` are the canonical `CountdownEvent` fields — this file adds
 * presentation only.
 */

export const COUNTDOWN_COLOR_TOKENS = [
  { token: 'teal', hex: '#5db8a6', label: '青' },
  { token: 'amber', hex: '#e8a55a', label: '琥珀' },
  { token: 'coral', hex: '#cc785c', label: '珊瑚' },
  { token: 'rose', hex: '#c4577a', label: '玫' },
  { token: 'plum', hex: '#8a5e9c', label: '紫' },
  { token: 'ink', hex: '#3d3d3a', label: '墨' },
];

export const COUNTDOWN_ICON_NAMES = ['star', 'heart', 'spark', 'moon', 'sun', 'wave'];

export function countdownColorHex(token?: string): string {
  return COUNTDOWN_COLOR_TOKENS.find((entry) => entry.token === token)?.hex ?? COUNTDOWN_COLOR_TOKENS[0].hex;
}

export function CountdownGlyph({ name, size = 18 }: { name?: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'star': return <svg {...p}><polygon points="12 2 14.6 8.6 21.6 9.2 16.4 13.6 18 20.4 12 16.8 6 20.4 7.6 13.6 2.4 9.2 9.4 8.6" /></svg>;
    case 'heart': return <svg {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>;
    case 'spark': return <svg {...p}><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4" /></svg>;
    case 'moon': return <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
    case 'sun': return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case 'wave': return <svg {...p}><path d="M2 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" /><path d="M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" /></svg>;
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l2.5 2.5" /></svg>;
  }
}

/**
 * Cover presentation shared by every surface. A configured cover renders the
 * stored asset; otherwise the canonical colour/icon language is the fallback —
 * never a broken image, never a placeholder frame.
 */
export function CountdownCover({ event, size = 56, className }: { event: CountdownEvent; size?: number; className?: string }) {
  const coverUrl = useAssetBlobUrl(event.coverAssetId);
  const box = { width: size, height: size };
  if (coverUrl) {
    return <span className={`countdown-cover is-cover${className ? ` ${className}` : ''}`} data-cover="image" style={box}>
      <img src={coverUrl} alt="" loading="lazy" />
    </span>;
  }
  const hex = countdownColorHex(event.colorToken);
  return <span
    className={`countdown-cover is-fallback${className ? ` ${className}` : ''}`}
    data-cover="fallback"
    data-color-token={event.colorToken ?? 'teal'}
    style={{ ...box, color: hex, background: `color-mix(in srgb, ${hex} 16%, transparent)` }}
  >
    <CountdownGlyph name={event.iconId} size={Math.round(size * 0.48)} />
  </span>;
}
