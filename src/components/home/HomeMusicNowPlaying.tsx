import { useNavigate } from 'react-router-dom';
import { useMusicStore } from '@/store/musicStore';
import { MusicCover, resolveMusicCoverSource } from '@/pages/Music/components/MusicCover';
import './HomeMusicNowPlaying.css';

function PlayIcon({ playing }: { playing: boolean }) {
  return playing
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>;
}

export function HomeMusicNowPlaying({ preset }: { preset: 'island' | 'medium' }) {
  const navigate = useNavigate();
  const tracks = useMusicStore((state) => state.tracks);
  const currentTrackId = useMusicStore((state) => state.currentTrackId);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const togglePlay = useMusicStore((state) => state.togglePlay);
  const previous = useMusicStore((state) => state.previous);
  const next = useMusicStore((state) => state.next);
  const track = tracks.find((item) => item.id === currentTrackId) ?? null;
  const progress = duration > 0 ? Math.min(100, Math.max(0, currentTime / duration * 100)) : 0;

  if (!track) return <div className={`home-music-widget is-${preset} is-empty`} data-testid="home-music-now-playing">
    <span aria-hidden="true">♫</span><span>還沒有播放音樂</span>
    {preset === 'medium' && <button type="button" onClick={() => navigate('/music')}>前往音樂</button>}
  </div>;

  const title = track.displayName || track.title;
  return <section className={`home-music-widget is-${preset}`} data-testid="home-music-now-playing" aria-label="目前播放">
    <MusicCover id={track.id} src={resolveMusicCoverSource(track as unknown as Record<string, unknown>)} label={title} className="home-music-cover" />
    <div className="home-music-copy"><strong title={title}>{title}</strong>{track.artist && <small>{track.artist}</small>}</div>
    {preset === 'medium' && <div className="home-music-progress" role="progressbar" aria-label="播放進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i style={{ width: `${progress}%` }} /></div>}
    <div className="home-music-controls">
      {preset === 'medium' && <button type="button" onClick={previous} aria-label="上一首">‹</button>}
      <button type="button" onClick={togglePlay} aria-label={isPlaying ? '暫停' : '播放'}><PlayIcon playing={isPlaying} /></button>
      {preset === 'medium' && <button type="button" onClick={next} aria-label="下一首">›</button>}
    </div>
  </section>;
}
