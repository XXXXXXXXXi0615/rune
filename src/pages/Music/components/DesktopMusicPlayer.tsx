import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrackDisplayTitle, useMusicStore } from '@/store/musicStore';
import { MusicCover, resolveMusicCoverSource } from './MusicCover';

function time(value: number) {
  if (!Number.isFinite(value) || value < 0) return '—:—';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

export function DesktopMusicPlayer({ onQueue }: { onQueue: () => void }) {
  const navigate = useNavigate();
  const tracks = useMusicStore(s => s.tracks);
  const currentId = useMusicStore(s => s.currentTrackId);
  const isPlaying = useMusicStore(s => s.isPlaying);
  const currentTime = useMusicStore(s => s.currentTime);
  const duration = useMusicStore(s => s.duration);
  const volume = useMusicStore(s => s.volume);
  const shuffle = useMusicStore(s => s.shuffle);
  const loopMode = useMusicStore(s => s.loopMode);
  const favorites = useMusicStore(s => s.favorites);
  const togglePlay = useMusicStore(s => s.togglePlay);
  const previous = useMusicStore(s => s.previous);
  const next = useMusicStore(s => s.next);
  const seek = useMusicStore(s => s.seek);
  const setVolume = useMusicStore(s => s.setVolume);
  const toggleShuffle = useMusicStore(s => s.toggleShuffle);
  const cycleLoopMode = useMusicStore(s => s.cycleLoopMode);
  const toggleFavorite = useMusicStore(s => s.toggleFavorite);
  const track = useMemo(() => tracks.find(t => t.id === currentId) || null, [tracks, currentId]);
  if (!track) return <div className="music-desktop-player music-desktop-player--idle"><span>選一首音樂，LUNARIS 會在這裡陪你聽。</span></div>;
  const safeDuration = duration > 0 ? duration : Number((track as any).duration || 0);
  return <div className="music-desktop-player" data-pet-safe-zone>
    <div className="music-desktop-player__track"><MusicCover id={track.id} src={resolveMusicCoverSource(track as unknown as Record<string, unknown>)} lazy={false} /><div><strong>{getTrackDisplayTitle(track)}</strong><span>{(track as any).artist || '本地音樂'}</span></div><button onClick={() => toggleFavorite(track.id)} aria-label={favorites.includes(track.id) ? '取消喜歡' : '加入喜歡'}>{favorites.includes(track.id) ? '♥' : '♡'}</button></div>
    <div className="music-desktop-player__center"><div className="music-player-controls"><button aria-pressed={shuffle} onClick={toggleShuffle} aria-label="隨機播放">⇄</button><button onClick={previous} aria-label="上一首">◀</button><button className="music-player-controls__play" onClick={togglePlay} aria-label={isPlaying ? '暫停' : '播放'}>{isPlaying ? 'Ⅱ' : '▶'}</button><button onClick={next} aria-label="下一首">▶</button><button onClick={cycleLoopMode} aria-label={`循環模式 ${loopMode}`}>↻</button></div><div className="music-player-progress"><span>{time(currentTime)}</span><input type="range" min="0" max={safeDuration || 1} value={Math.min(currentTime, safeDuration || 1)} onChange={e => seek(Number(e.target.value))} aria-label="播放進度" aria-valuetext={`${time(currentTime)} / ${time(safeDuration)}`} /><span>{safeDuration ? time(safeDuration) : '—:—'}</span></div></div>
    <div className="music-desktop-player__tools"><button aria-label="歌詞" disabled>詞</button><button onClick={onQueue} aria-label="播放隊列">≡</button><button aria-label="播放裝置" disabled>▣</button><label aria-label="音量"><span>◖</span><input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label><button onClick={() => navigate(`/music/listen/${encodeURIComponent(track.id)}`)} aria-label="展開播放器">↗</button></div>
  </div>;
}
