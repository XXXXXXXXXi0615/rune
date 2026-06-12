import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getAsset } from '@/store/assets';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Player() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  const tracks = useAppStore((s) => s.music.tracks);
  const currentTrackId = useAppStore((s) => s.music.currentTrackId);
  const volume = useAppStore((s) => s.music.volume);
  const loop = useAppStore((s) => s.music.loop);
  const setCurrentTrack = useAppStore((s) => s.setCurrentTrack);
  const setTrackDuration = useAppStore((s) => s.setTrackDuration);
  const toggleLoop = useAppStore((s) => s.toggleLoop);

  const currentTrack = tracks.find((t) => t.id === currentTrackId);
  const currentIndex = currentTrackId ? tracks.findIndex((t) => t.id === currentTrackId) : -1;

  // Load audio from IndexedDB when current track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = tracks.find((t) => t.id === currentTrackId);

    if (!track) {
      audio.pause();
      audio.src = '';
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    setLoading(true);
    let cancelled = false;
    let url: string | null = null;

    getAsset(track.assetId).then((blob) => {
      if (cancelled) return;
      if (!blob) { setLoading(false); return; }
      url = URL.createObjectURL(blob);
      const s = useAppStore.getState();
      audio.src = url;
      audio.volume = s.music.volume;
      audio.loop = s.music.loop;
      setLoading(false);
      audio.play().catch(() => {});
    });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [currentTrackId, tracks]);

  // Sync volume/loop to audio element without re-loading track
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
  }, [loop]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    const prev = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
    setCurrentTrack(tracks[prev].id);
  }, [tracks, currentIndex, setCurrentTrack]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const next = currentIndex >= tracks.length - 1 ? 0 : currentIndex + 1;
    setCurrentTrack(tracks[next].id);
  }, [tracks, currentIndex, setCurrentTrack]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setCurrentTime(t);
    if (audioRef.current) {
      audioRef.current.currentTime = t;
    }
  }, []);

  const handleEnded = useCallback(() => {
    const s = useAppStore.getState();
    if (s.music.loop) return;
    if (tracks.length <= 1) {
      setPlaying(false);
      setCurrentTime(0);
      return;
    }
    const next = currentIndex >= tracks.length - 1 ? 0 : currentIndex + 1;
    setCurrentTrack(tracks[next].id);
  }, [tracks, currentIndex, setCurrentTrack]);

  if (tracks.length === 0) {
    return (
      <div className="player-body">
        <div className="player-art">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <p className="music-empty">還沒有音樂，上傳一首歌，讓今天有聲音</p>
      </div>
    );
  }

  return (
    <div className="player-body">
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            setDuration(d);
            const ct = useAppStore.getState().music.tracks.find(
              (t) => t.id === useAppStore.getState().music.currentTrackId
            );
            if (ct && !ct.duration && isFinite(d)) {
              setTrackDuration(ct.id, d);
            }
          }
        }}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setLoading(false)}
      />

      <div className={`player-art${playing ? ' playing' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>

      <div className="player-info">
        <div className="player-title">{currentTrack?.title ?? '—'}</div>
        <div className="player-meta">
          {loading ? '載入中...' : currentTrack?.fileName ?? ''}
        </div>
      </div>

      <div className="player-progress-row">
        <span className="player-time">{formatTime(currentTime)}</span>
        <input
          type="range"
          className="player-progress"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
        />
        <span className="player-time">{formatTime(duration)}</span>
      </div>

      <div className="player-controls">
        <button className="player-btn" onClick={toggleLoop} aria-label="Loop">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
        </button>

        <button className="player-btn" onClick={handlePrev} aria-label="Previous">
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        <button className="player-btn-play" onClick={handlePlayPause} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button className="player-btn" onClick={handleNext} aria-label="Next">
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
          </svg>
        </button>

        <div className="player-volume-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {volume > 0 && <path d="M15.54 8.46a5 5 0 010 7.07" />}
            {volume > 0.5 && <path d="M19.07 4.93a10 10 0 010 14.14" />}
          </svg>
          <input
            type="range"
            className="player-volume"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => useAppStore.getState().setVolume(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
