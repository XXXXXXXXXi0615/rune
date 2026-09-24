import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatMusicTime } from '@/hooks/useAudioPlayer';
import { getTrackDisplayName, useMusicStore } from '@/store/musicStore';
import './MusicIsland.css';

function MusicArtwork({ cover }: { cover?: string }) {
  return (
    <span className="music-island__artwork" aria-hidden="true">
      {cover ? <img src={cover} alt="" /> : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />
        </svg>
      )}
    </span>
  );
}

export function MusicIsland() {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const tracks = useMusicStore((state) => state.tracks);
  const currentTrackId = useMusicStore((state) => state.currentTrackId);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const togglePlay = useMusicStore((state) => state.togglePlay);
  const previous = useMusicStore((state) => state.previous);
  const next = useMusicStore((state) => state.next);
  const [expanded, setExpanded] = useState(false);

  const track = useMemo(() => tracks.find((item) => item.id === currentTrackId) ?? null, [tracks, currentTrackId]);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : (track?.duration ?? 0);
  const trackEnded = safeDuration > 0 && currentTime >= safeDuration - 0.25;
  const hasMusicSession = Boolean(track) && !trackEnded && (isPlaying || currentTime > 0);
  const visible = hasMusicSession && !pathname.startsWith('/music');
  const progress = safeDuration > 0 ? Math.min(100, Math.max(0, currentTime / safeDuration) * 100) : 0;
  const title = track ? getTrackDisplayName(track) : '';
  const artist = track ? ((track as { artist?: string }).artist || '本地音訊') : '';
  const cover = track?.customCover;

  const openListenPage = useCallback(() => {
    if (track) navigate(`/music/listen/${encodeURIComponent(track.id)}`);
  }, [navigate, track]);
  const handlePlayback = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    togglePlay();
  }, [togglePlay]);

  if (!visible || !track) return null;

  return (
    <section className={`music-island${expanded ? ' music-island--expanded' : ''}`} aria-label="音樂播放狀態">
      <button type="button" className="music-island__main" onClick={openListenPage} aria-label={`回到 ${title} 共聽頁`}>
        <MusicArtwork cover={cover} />
        <span className="music-island__meta"><strong>{title}</strong><span>{expanded ? artist : title}</span></span>
        {!expanded && <span className="music-island__time">{formatMusicTime(currentTime)}</span>}
      </button>
      <button type="button" className="music-island__play" onClick={handlePlayback} aria-label={isPlaying ? '暫停' : '播放'}>
        {isPlaying ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" /></svg>}
      </button>
      <button
        type="button"
        className="music-island__expand"
        onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }}
        aria-label={expanded ? '收合音樂控制' : '展開音樂控制'}
        aria-expanded={expanded}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg>
      </button>
      <span className="music-island__progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
      {expanded && (
        <div className="music-island__expanded-content">
          <div className="music-island__timeline"><span>{formatMusicTime(currentTime)}</span><span>{formatMusicTime(safeDuration)}</span></div>
          <div className="music-island__controls">
            <button type="button" onClick={(event) => { event.stopPropagation(); previous(); }} aria-label="上一首"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 9 12l9 6V6ZM6 6v12" /></svg></button>
            <button type="button" className="is-primary" onClick={handlePlayback} aria-label={isPlaying ? '暫停' : '播放'}>{isPlaying ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" /></svg>}</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); next(); }} aria-label="下一首"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 9 6-9 6V6Zm12 0v12" /></svg></button>
          </div>
          <button type="button" className="music-island__return" onClick={(event) => { event.stopPropagation(); openListenPage(); }}>回到共聽頁</button>
        </div>
      )}
    </section>
  );
}
