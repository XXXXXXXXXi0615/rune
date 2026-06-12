import { useRef, useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { BackButton } from '@/components/layout/BackButton';
import { Card } from '@/components/ui/Card';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MusicPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trackName, setTrackName] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasTrack, setHasTrack] = useState(false);
  const updateSettings = useAppStore((s) => s.updateSettings);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    };
  }, []);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (audioRef.current) { audioRef.current.pause(); }
    const audio = new Audio();
    audio.src = url;
    audio.volume = 0.8;
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => { setPlaying(false); });
    audio.addEventListener('play', () => setPlaying(true));
    audio.addEventListener('pause', () => setPlaying(false));

    setTrackName(file.name.replace(/\.[^.]+$/, ''));
    setHasTrack(true);
    setPlaying(false);
    setCurrentTime(0);

    updateSettings({ music: { ...useAppStore.getState().music, currentTrackId: file.name, tracks: [] } });
    e.target.value = '';
  }, [updateSettings]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); }
    else { a.play().catch(() => {}); }
  };

  return (
    <section id="music-view" className="view">
      <BackButton to="/" />
      <Header eyebrow={t('music.eyebrow')} title={t('music.title')} />

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={handleUpload}
      />

      <Card>
        <div className="vinyl-player">
          {/* Vinyl disc */}
          <div className={`vinyl-disc ${playing ? 'spinning' : ''}`}>
            <div className="vinyl-grooves" />
            <div className="vinyl-label">
              {hasTrack ? (
                <span className="vinyl-label-text">{trackName}</span>
              ) : (
                <span className="vinyl-label-empty">♪</span>
              )}
            </div>
          </div>

          {/* Track info */}
          {hasTrack ? (
            <>
              <div className="vinyl-track-name">{trackName}</div>

              {/* Waveform bar with play button */}
              <div className="waveform-row">
                <button type="button" className="vinyl-btn-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? (
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                  )}
                </button>
                <div
                  className="waveform-bar"
                  role="slider"
                  aria-label={t('music.progressAria')}
                  aria-valuemin={0}
                  aria-valuemax={duration || 0}
                  aria-valuenow={currentTime}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const a = audioRef.current;
                    if (a && duration > 0) { a.currentTime = ratio * duration; setCurrentTime(ratio * duration); }
                  }}
                >
                  {Array.from({ length: 48 }).map((_, i) => {
                    const heights = [0.4,0.6,0.3,0.8,0.5,0.9,0.4,0.7,0.3,0.6,0.8,0.5,0.4,0.9,0.3,0.7,
                      0.5,0.8,0.4,0.6,0.3,0.9,0.5,0.7,0.4,0.6,0.8,0.3,0.5,0.9,0.4,0.7,
                      0.3,0.6,0.8,0.5,0.4,0.9,0.6,0.3,0.7,0.5,0.8,0.4,0.6,0.9,0.5,0.7];
                    const h = heights[i];
                    const progress = duration > 0 ? currentTime / duration : 0;
                    const barPos = i / 48;
                    const played = barPos <= progress;
                    return (
                      <span
                        key={i}
                        className={`waveform-bar-item ${played ? 'played' : ''}`}
                        style={{ height: `${h * 100}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="vinyl-time-row">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </>
          ) : (
            <div className="vinyl-empty">
              <p className="vinyl-empty-text">{t('music.empty')}</p>
              <button className="btn-ghost" onClick={() => inputRef.current?.click()}>
                {t('music.upload')}
              </button>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
