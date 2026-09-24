import { useEffect, useMemo, useState } from 'react';
import { getTrackDisplayTitle, useMusicStore } from '@/store/musicStore';
import { MusicCover, resolveMusicCoverSource } from './MusicCover';

const time = (value: number) => Number.isFinite(value) && value >= 0
  ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
  : '—:—';

export function MusicPlaylistStudio({
  onImport,
  onCreatePlaylist,
  onQueue,
  onOpenPlaylist,
  onEditPlaylist,
}: {
  onImport: () => void;
  onCreatePlaylist: () => void;
  onQueue: () => void;
  onOpenPlaylist: (id: string) => void;
  onEditPlaylist: (id: string) => void;
}) {
  const tracks = useMusicStore(s => s.tracks) as any[];
  const playlists = useMusicStore(s => s.playlists);
  const currentTrackId = useMusicStore(s => s.currentTrackId);
  const queueTrackIds = useMusicStore(s => s.queueTrackIds);
  const playbackSource = useMusicStore(s => s.playbackSource);
  const isPlaying = useMusicStore(s => s.isPlaying);
  const currentTime = useMusicStore(s => s.currentTime);
  const duration = useMusicStore(s => s.duration);
  const volume = useMusicStore(s => s.volume);
  const shuffle = useMusicStore(s => s.shuffle);
  const loopMode = useMusicStore(s => s.loopMode);
  const togglePlay = useMusicStore(s => s.togglePlay);
  const previous = useMusicStore(s => s.previous);
  const next = useMusicStore(s => s.next);
  const seek = useMusicStore(s => s.seek);
  const setVolume = useMusicStore(s => s.setVolume);
  const toggleShuffle = useMusicStore(s => s.toggleShuffle);
  const cycleLoopMode = useMusicStore(s => s.cycleLoopMode);
  const playFromSource = useMusicStore(s => s.playFromSource);
  const reorderPlaylistTracks = useMusicStore(s => s.reorderPlaylistTracks);
  const setQueue = useMusicStore(s => s.setQueue);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const currentTrack = useMemo(() => tracks.find(t => t.id === currentTrackId) || tracks[0] || null, [tracks, currentTrackId]);
  const sourcePlaylist = playbackSource.type === 'playlist' ? playlists.find(p => p.id === playbackSource.playlistId) : undefined;
  const queue = useMemo(() => (queueTrackIds || sourcePlaylist?.trackIds || tracks.map(t => t.id)).map(id => tracks.find(t => t.id === id)).filter(Boolean), [queueTrackIds, sourcePlaylist, tracks]);
  const safeDuration = duration > 0 ? duration : Number(currentTrack?.duration || 0);
  const queueDuration = queue.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);

  useEffect(() => {
    if (!queueTrackIds && sourcePlaylist) setQueue(sourcePlaylist.trackIds);
  }, [queueTrackIds, setQueue, sourcePlaylist]);

  const playTrack = (id: string) => {
    const ids = queue.map(t => t.id);
    const source = sourcePlaylist ? { type: 'playlist' as const, playlistId: sourcePlaylist.id } : { type: 'library' as const };
    playFromSource(id, source, ids.length ? ids : tracks.map(t => t.id));
  };

  return (
    <section className="music-studio" aria-label="正在播放">
      {currentTrack ? (
        <>
          <div className={`music-studio__stage${isPlaying ? ' is-playing' : ''}`}>
            <div className="music-studio__glow" style={{ backgroundImage: resolveMusicCoverSource(currentTrack) ? `url(${resolveMusicCoverSource(currentTrack)})` : undefined }} />
            <div className="music-studio__playlist">
              <MusicCover id={sourcePlaylist?.id || currentTrack.id} src={sourcePlaylist?.customCover || resolveMusicCoverSource(currentTrack)} className="music-studio__cover" lazy={false} />
              <span className="music-studio__source-label">{sourcePlaylist ? 'PLAYLIST' : 'PLAYBACK QUEUE'}</span>
              {sourcePlaylist ? <button className="music-studio__playlist-title" onClick={() => onOpenPlaylist(sourcePlaylist.id)}>{sourcePlaylist.name}</button> : <h2 className="music-studio__playlist-title">當前播放隊列</h2>}
              {sourcePlaylist?.description && <p className="music-studio__playlist-description">{sourcePlaylist.description}</p>}
              <p className="music-studio__playlist-stats">{queue.length} 首{queueDuration > 0 ? ` · ${time(queueDuration)}` : ''}</p>
              <div className="music-studio__playlist-actions">
                <button onClick={sourcePlaylist ? () => onEditPlaylist(sourcePlaylist.id) : onImport}>＋ 新增歌曲</button>
                <button onClick={sourcePlaylist ? () => onEditPlaylist(sourcePlaylist.id) : onQueue}>{sourcePlaylist ? '編輯歌單' : '編輯隊列'}</button>
                <button onClick={toggleShuffle}>隨機播放</button>
              </div>
            </div>
            <div className="music-studio__now">
              <span className="music-studio__eyebrow">NOW PLAYING</span>
              <h2>{getTrackDisplayTitle(currentTrack)}</h2>
              <p>{currentTrack.artist || '本地音樂'}{currentTrack.album ? ` · ${currentTrack.album}` : ''}</p>
              <div className="music-studio__progress">
                <span>{time(currentTime)}</span>
                <input type="range" min="0" max={safeDuration || 1} value={Math.min(currentTime, safeDuration || 1)} disabled={!safeDuration} onChange={e => seek(Number(e.target.value))} aria-label="播放進度" aria-valuemin={0} aria-valuemax={safeDuration || 0} aria-valuenow={Math.min(currentTime, safeDuration || 0)} />
                <span>{time(safeDuration)}</span>
              </div>
              <div className="music-studio__controls">
                <button className={shuffle ? 'active' : ''} onClick={toggleShuffle} aria-pressed={shuffle} aria-label="隨機播放"><svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg></button>
                <button onClick={previous} aria-label="上一首"><svg viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4"/><path d="M5 5v14"/></svg></button>
                <button className="primary" onClick={togglePlay} aria-label={isPlaying ? '暫停' : '播放'}>{isPlaying ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>}</button>
                <button onClick={next} aria-label="下一首"><svg viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20"/><path d="M19 5v14"/></svg></button>
                <button className={loopMode !== 'off' ? 'active' : ''} onClick={cycleLoopMode} aria-label={`循環模式：${loopMode}`}><svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>{loopMode === 'one' && <small>1</small>}</button>
              </div>
              <label className="music-studio__volume"><svg viewBox="0 0 24 24"><path d="M5 9v6h4l5 4V5L9 9H5zM18 9a4 4 0 010 6"/></svg><input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} aria-label="音量" /></label>
            </div>
          </div>

          <div className="music-studio__list-head"><div><h2>播放清單</h2><span>{queue.length} 首</span></div><div><button onClick={onImport}>導入音樂</button><button onClick={onQueue}>查看隊列</button></div></div>
          <div className="music-studio__tracks">
            {queue.map((track, index) => <button key={track.id} className={`${track.id === currentTrackId ? 'is-current' : ''}${dragIndex === index ? ' is-dragging' : ''}`} onClick={() => playTrack(track.id)} draggable={Boolean(sourcePlaylist)} onDragStart={() => setDragIndex(index)} onDragEnd={() => setDragIndex(null)} onDragOver={event => { if (sourcePlaylist) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (sourcePlaylist && dragIndex !== null && dragIndex !== index) reorderPlaylistTracks(sourcePlaylist.id, dragIndex, index); setDragIndex(null); }}>
              <span className="music-studio__index">{track.id === currentTrackId && isPlaying ? '▮▮' : String(index + 1).padStart(2, '0')}</span>
              <MusicCover id={track.id} src={resolveMusicCoverSource(track)} />
              <span className="music-studio__track-meta"><strong>{getTrackDisplayTitle(track)}</strong><small>{track.artist || '本地音樂'}</small></span>
              <span>{time(Number(track.duration || 0))}</span>
            </button>)}
          </div>
        </>
      ) : (
        <div className="music-studio__empty"><MusicCover id="lunartide-studio-empty" /><h2>播放清單還是空的</h2><p>匯入一段聲音，或先建立一張可以反覆回來的歌單。</p><div><button className="primary" onClick={onImport}>導入音樂</button><button onClick={onCreatePlaylist}>＋ 建立歌單</button></div></div>
      )}
    </section>
  );
}
