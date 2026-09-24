import { useEffect, useRef, useState } from 'react';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { formatMusicTime } from '@/hooks/useAudioPlayer';
import { getTrackDisplayTitle } from '@/store/musicStore';

export function trackLabel(t: any): string {
  return getTrackDisplayTitle(t);
}

export function trackArtist(t: any): string {
  return t?.artist || '本地音訊';
}

function UserAvatar({ size }: { size: number }) {
  const profile = useAppStore((s) => s.profile);
  const userName = useAppStore((s) => s.userName);
  const fallback = (profile.displayName || userName || 'U').charAt(0).toUpperCase();
  if (profile.avatarImage) {
    return <AvatarImage avatarConfig={profile.avatarImage} fallbackInitial={fallback} initial={fallback} color="user" size={size} className="co-avatar" />;
  }
  return <span className="co-avatar co-avatar--fallback" style={{ width: size, height: size }}>{fallback}</span>;
}

function LUNARISAvatar({ size }: { size: number }) {
  const partner = useAppStore((s) => s.partner);
  const fallback = selectPartnerDisplayName(partner).charAt(0).toUpperCase();
  if (partner.avatarImage) {
    return <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={fallback} initial={fallback} color="char" size={size} className="co-avatar" />;
  }
  return <span className="co-avatar co-avatar--lunaris" style={{ width: size, height: size }}>{fallback}</span>;
}

function HeartConnection({ playing }: { playing: boolean }) {
  return (
    <svg className={`co-cables${playing ? ' co-cables--active' : ''}`} viewBox="0 0 120 80" fill="none" aria-hidden="true">
      <path d="M10 68 Q26 38 42 42 Q55 44 60 44"
        stroke="color-mix(in srgb, var(--accent) 45%, transparent)" strokeWidth="1.8"
        strokeLinecap="round" opacity={playing ? 0.7 : 0.38} />
      <path d="M110 68 Q94 38 78 42 Q65 44 60 44"
        stroke="color-mix(in srgb, var(--accent) 45%, transparent)" strokeWidth="1.8"
        strokeLinecap="round" opacity={playing ? 0.7 : 0.38} />
      <path d="M10 73 Q28 48 38 46 Q50 44 60 44"
        stroke="color-mix(in srgb, var(--accent) 22%, transparent)" strokeWidth="0.9"
        strokeLinecap="round" opacity={playing ? 0.45 : 0.22} />
      <path d="M110 73 Q92 48 82 46 Q70 44 60 44"
        stroke="color-mix(in srgb, var(--accent) 22%, transparent)" strokeWidth="0.9"
        strokeLinecap="round" opacity={playing ? 0.45 : 0.22} />
      <path d="M60 45.5 C60 45.5 52.5 36 46.5 39.5 C40.5 43 44 52.5 60 57.5 C76 52.5 79.5 43 73.5 39.5 C67.5 36 60 45.5 60 45.5 Z"
        fill="color-mix(in srgb, var(--accent) 72%, transparent)"
        stroke="color-mix(in srgb, var(--accent) 55%, transparent)" strokeWidth="1"
        opacity={playing ? 0.92 : 0.55} />
      {playing && (
        <circle cx="60" cy="46.5" r="2.5" fill="var(--accent)" opacity="0.6">
          <animate attributeName="opacity" values="0.3;0.75;0.3" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

export function useCoListeningTimer(isPlaying: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(0);
  const accRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (isPlaying && document.visibilityState === 'visible') {
      startedRef.current = performance.now();
      const tick = () => {
        const now = performance.now();
        setElapsed(Math.floor((accRef.current + now - startedRef.current) / 1000));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    } else {
      if (startedRef.current) {
        accRef.current += performance.now() - startedRef.current;
        startedRef.current = 0;
      }
      cancelAnimationFrame(rafRef.current);
    }
  }, [isPlaying]);

  useEffect(() => {
    const h = () => {
      if (document.hidden) {
        if (startedRef.current) {
          accRef.current += performance.now() - startedRef.current;
          startedRef.current = 0;
        }
        cancelAnimationFrame(rafRef.current);
      }
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  return elapsed;
}

function MoonTurntable({ isPlaying, coverUrl, onCoverClick }: { isPlaying: boolean; coverUrl?: string; onCoverClick?: () => void }) {
  return (
    <div className="moon-turntable" aria-hidden="true">
      <div className={`moon-turntable__platter${isPlaying ? ' spinning' : ''}`}>
        <div className="moon-turntable__groove" />
        <div className="moon-turntable__groove" />
        <div
          className="moon-turntable__cover-wrap"
          onClick={onCoverClick}
          role={onCoverClick ? 'button' : undefined}
          tabIndex={onCoverClick ? 0 : undefined}
          aria-label={onCoverClick ? (coverUrl ? '更換封面' : '上傳封面') : undefined}
          onKeyDown={onCoverClick ? (e) => { if (e.key === 'Enter') onCoverClick(); } : undefined}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="" className="moon-turntable__cover" />
          ) : (
            <div className="moon-turntable__cover-fallback">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
              {onCoverClick && <span className="moon-turntable__cover-hint">上傳封面</span>}
            </div>
          )}
        </div>
      </div>
      <div className={`moon-turntable__arm${isPlaying ? ' playing' : ''}`} />
    </div>
  );
}

export function PlayerPane({
  isPlaying,
  coverUrl,
  elapsed,
  title,
  artist,
  onCoverClick,
  error,
  isLoading,
}: {
  isPlaying: boolean;
  coverUrl?: string;
  elapsed: number;
  title: string;
  artist: string;
  onCoverClick?: () => void;
  error?: { code: string; message: string } | null;
  isLoading?: boolean;
}) {
  return (
    <>
      <div className="co-listening-header">
        <div className="co-listening-pair">
          <UserAvatar size={72} />
          <HeartConnection playing={isPlaying} />
          <LUNARISAvatar size={72} />
        </div>
        {elapsed > 0 && <p className="co-listening-duration">一起聽了 {formatMusicTime(elapsed)}</p>}
      </div>

      <MoonTurntable isPlaying={isPlaying} coverUrl={coverUrl} onCoverClick={onCoverClick} />

      <div className="im-now-playing">
        <h1 className="im-track-title">{title}</h1>
        <p className="im-track-artist">{artist}</p>
      </div>

      {isLoading && (
        <p className="im-player-status" style={{ textAlign: 'center', fontSize: 13, color: 'var(--music-listen-muted)', padding: '4px 0' }}>
          正在準備音訊…
        </p>
      )}
      {error && !isLoading && (
        <p className="im-player-status im-player-status--error" style={{ textAlign: 'center', fontSize: 13, color: 'var(--error)', padding: '4px 0' }}>
          {error.message}
        </p>
      )}

    </>
  );
}
