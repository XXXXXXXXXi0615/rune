import { useMemo } from 'react';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { getTrackDisplayTitle, useMusicStore } from '@/store/musicStore';
import { selectAgentAvatar, selectAgentDisplayName, useAppStore } from '@/store/useAppStore';

const time = (value: number) => Number.isFinite(value) && value > 0
  ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
  : '0:00';

export function RuneListeningRoom({ onOpenQueue, onOpenLibrary }: { onOpenQueue: () => void; onOpenLibrary: () => void }) {
  const tracks = useMusicStore((s) => s.tracks);
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const queueTrackIds = useMusicStore((s) => s.queueTrackIds);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const currentTime = useMusicStore((s) => s.currentTime);
  const runtimeDuration = useMusicStore((s) => s.duration);
  const shuffle = useMusicStore((s) => s.shuffle);
  const loopMode = useMusicStore((s) => s.loopMode);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const previous = useMusicStore((s) => s.previous);
  const next = useMusicStore((s) => s.next);
  const seek = useMusicStore((s) => s.seek);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const cycleLoopMode = useMusicStore((s) => s.cycleLoopMode);
  const profile = useAppStore((s) => s.profile);
  const partner = useAppStore((s) => s.partner);
  const currentTrack = useMemo(() => tracks.find((track) => track.id === currentTrackId) ?? tracks[0] ?? null, [currentTrackId, tracks]);
  const queue = useMemo(() => (queueTrackIds ?? tracks.map((track) => track.id)).filter((id) => tracks.some((track) => track.id === id)), [queueTrackIds, tracks]);
  const duration = runtimeDuration || currentTrack?.duration || 0;
  const fallback = profile.avatarInitial || profile.displayName?.charAt(0) || '我';
  const runeName = selectAgentDisplayName(partner);
  const runeAvatar = selectAgentAvatar(partner);
  const runeFallback = (partner.avatarInitial || runeName || '智').charAt(0).toUpperCase();

  return <section className="rune-room" aria-labelledby="rune-room-title" data-testid="rune-listening-room">
    <div className={`rune-room__avatars${isPlaying ? ' is-playing' : ''}`} data-testid="dual-avatar-stage">
      <div className="rune-room__avatar rune-room__avatar--user">
        <AvatarImage avatarConfig={profile.avatarImage} fallbackInitial={fallback} initial={fallback} color={profile.avatarColor || 'user'} size={112} label={profile.displayName || '使用者'} />
        <span>{profile.displayName || '你'}</span>
      </div>
      <span className="rune-room__plus" aria-hidden="true">＋</span>
      <div className="rune-room__avatar rune-room__avatar--rune">
        <AvatarImage avatarConfig={runeAvatar} fallbackInitial={runeFallback} initial={runeFallback} color={partner.avatarColor || 'char'} size={116} label={runeName} />
        <span>{runeName}</span>
      </div>
    </div>
    {currentTrack ? <>
      <div className="rune-room__identity"><p>NOW LISTENING</p><h2 id="rune-room-title">{getTrackDisplayTitle(currentTrack)}</h2><span>{currentTrack.artist || '本地音樂'}</span></div>
      <div className="rune-room__player">
        <div className="rune-room__progress"><span>{time(currentTime)}</span><input type="range" min="0" max={duration || 1} value={Math.min(currentTime, duration || 1)} onChange={(event) => seek(Number(event.target.value))} aria-label="播放進度" aria-valuetext={`${time(currentTime)} / ${time(duration)}`} /><span>{time(duration)}</span></div>
        <div className="rune-room__controls">
          <button className={shuffle ? 'is-active' : ''} onClick={toggleShuffle} aria-label="隨機播放" aria-pressed={shuffle}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg></button>
          <button onClick={previous} aria-label="上一首"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5 9 12l9 7V5ZM6 5v14" /></svg></button>
          <button className="rune-room__play" onClick={togglePlay} aria-label={isPlaying ? '暫停' : '播放'}>{isPlaying ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" /></svg>}</button>
          <button onClick={next} aria-label="下一首"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 5 9 7-9 7V5Zm12 0v14" /></svg></button>
          <button className={loopMode !== 'off' ? 'is-active' : ''} onClick={cycleLoopMode} aria-label={`循環模式 ${loopMode}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></svg>{loopMode === 'one' && <small>1</small>}</button>
        </div>
      </div>
      <div className="rune-room__queue"><div><strong>接下來</strong><span>{queue.length} 首 · 暫存播放順序</span></div><button onClick={onOpenQueue}>查看隊列</button></div>
    </> : <div className="rune-room__empty"><h2 id="rune-room-title">共聽室在等第一首聲音</h2><p>從音樂庫匯入本地音訊，Rune 會留在這裡陪你聽。</p><button onClick={onOpenLibrary}>前往音樂庫</button></div>}
  </section>;
}
