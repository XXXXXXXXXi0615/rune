import { useState } from 'react';
import { getTrackDisplayTitle, useMusicStore } from '@/store/musicStore';
import { useMusicEffectsStore } from '@/store/useMusicEffectsStore';
import { MusicCover, resolveMusicCoverSource } from './MusicCover';
import { MetalKnob } from './ConsoleControls';

export function PlayerConsolePane({ track, onCoverClick }: { track: any; onCoverClick: () => void }) {
  const [queueOpen, setQueueOpen] = useState(false);
  const tracks = useMusicStore((state) => state.tracks);
  const queue = useMusicStore((state) => state.queueTrackIds);
  const volume = useMusicStore((state) => state.volume);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const favorites = useMusicStore((state) => state.favorites);
  const setVolume = useMusicStore((state) => state.setVolume);
  const toggleFavorite = useMusicStore((state) => state.toggleFavorite);
  const balance = useMusicEffectsStore((state) => state.balance);
  const setParameter = useMusicEffectsStore((state) => state.setParameter);
  const cover = resolveMusicCoverSource(track);
  const queuedTracks = (queue || []).map((id) => tracks.find((item) => item.id === id)).filter(Boolean);
  const favorite = favorites.includes(track.id);
  const balanceLabel = balance === 0 ? '中央' : `${balance < 0 ? 'L' : 'R'} ${Math.round(Math.abs(balance) * 100)}`;
  return <div className="player-console-pane">
    <button className={`console-disc${isPlaying ? ' is-playing' : ''}`} onClick={onCoverClick} aria-label={cover ? '更换封面' : '上传封面'}>
      <MusicCover id={track.id} src={cover} lazy={false} />
      <span className="console-disc__hub" />
    </button>
    <div className="console-track-meta">
      <span>NOW PLAYING</span>
      <h1>{getTrackDisplayTitle(track)}</h1>
      <p>{track.artist || '本地音乐'}</p>
      <dl className="console-track-details">
        <div><dt>专辑</dt><dd>{track.album || '月潮音乐库'}</dd></div>
        <div><dt>来源</dt><dd>本地音乐</dd></div>
      </dl>
      <button className="console-favorite" onClick={() => toggleFavorite(track.id)} aria-pressed={favorite}>{favorite ? '♥ 已收藏' : '♡ 收藏'}</button>
    </div>
    <aside className="console-parameters">
      <div className="console-knob-row">
        <MetalKnob label="主音量" value={Math.round(volume * 100)} min={0} max={100} step={1} unit="%" onChange={(value) => setVolume(value / 100)} defaultValue={80} formatValue={(value) => `${Math.round(value)}%`} scaleLabels={['0', '80', '100']} />
        <MetalKnob label="左右平衡" value={balance} min={-1} max={1} step={0.1} unit="" onChange={(value) => setParameter('balance', value)} formatValue={() => balanceLabel} scaleLabels={['L', 'C', 'R']} />
      </div>
      <div className="console-status-grid" aria-label="播放状态">
        <div className="console-status-item"><span>播放来源</span><strong>本地音乐库</strong></div>
        <div className="console-status-item"><span>音场状态</span><strong>月潮 Hi-Fi</strong></div>
      </div>
      <div className="console-secondary-actions">
        <button onClick={() => setQueueOpen((value) => !value)} aria-expanded={queueOpen}><span>播放队列 · {queuedTracks.length}</span><b aria-hidden="true">›</b></button>
        <button disabled title="浏览器输出设备由系统管理"><span>系统输出设备</span><b aria-hidden="true">›</b></button>
      </div>
      {queueOpen && <div className="console-queue">{queuedTracks.length ? queuedTracks.slice(0, 5).map((item) => <span key={item!.id}>{getTrackDisplayTitle(item!)}</span>) : <span>队列里还没有下一首</span>}</div>}
    </aside>
  </div>;
}
