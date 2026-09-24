import { useMemo, useState } from 'react';
import { useMusicStore, getTrackDisplayTitle } from '@/store/musicStore';
import type { MusicPlaybackSource } from '@/store/musicStore';

function trackLabel(t: any): string { return getTrackDisplayTitle(t); }
function trackArtist(t: any): string { return t?.artist || ''; }
function fmtDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sourceLabel(source: MusicPlaybackSource, playlists: any[]): string {
  switch (source.type) {
    case 'library': return '来自音乐库';
    case 'recent': return '来自最近播放';
    case 'search': return `来自搜索"${source.query}"`;
    case 'playlist': {
      const p = playlists.find(pl => pl.id === source.playlistId);
      return p ? `来自歌单"${p.name}"` : '来自本地音乐库';
    }
    default: return '来自本地音乐库';
  }
}

interface UpNextSheetProps {
  onClose: () => void;
}

export function UpNextSheet({ onClose }: UpNextSheetProps) {
  const tracks = useMusicStore(s => s.tracks) as any[];
  const playlists = useMusicStore(s => s.playlists);
  const currentTrackId = useMusicStore(s => s.currentTrackId);
  const queueTrackIds = useMusicStore(s => s.queueTrackIds);
  const playbackSource = useMusicStore(s => s.playbackSource);
  const selectTrack = useMusicStore(s => s.selectTrack);
  const removeFromQueue = useMusicStore(s => s.removeFromQueue);
  const reorderQueue = useMusicStore(s => s.reorderQueue);
  const setQueue = useMusicStore(s => s.setQueue);
  const isPlaying = useMusicStore(s => s.isPlaying);
  const togglePlay = useMusicStore(s => s.togglePlay);

  const currentTrack = useMemo(
    () => tracks.find(t => t.id === currentTrackId) || null,
    [tracks, currentTrackId]
  );

  const queue = useMemo(() => {
    const ids = queueTrackIds || [];
    const idx = currentTrackId ? ids.indexOf(currentTrackId) : -1;
    if (idx >= 0) return ids.slice(idx + 1);
    return ids.length > 0 ? ids : [];
  }, [queueTrackIds, currentTrackId]);

  const source = playbackSource || { type: 'library' as const };

  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const handleClearQueue = () => {
    if (currentTrack) setQueue([currentTrack.id]);
  };

  const handleItemClick = (trackId: string) => {
    selectTrack(trackId);
  };

  const handleRemove = (trackId: string) => {
    removeFromQueue(trackId);
  };

  const handleReorder = (fromIdx: number, toIdx: number) => {
    reorderQueue(fromIdx, toIdx);
  };

  const sourceText = sourceLabel(source, playlists);

  return (
    <div className="cps-overlay" onClick={onClose}>
      <div className="cps-sheet" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="cps-header">
          <h2>接下来播放</h2>
          <button className="cps-close" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="cps-body" style={{ paddingTop: 0 }}>
          {currentTrack && (
            <div className="un-current">
              <div className="un-current-label">现在播放</div>
              <div className="un-current-track">
                <div className="lm-track-cover" style={{ width: 44, height: 44 }}>
                  {currentTrack.customCover
                    ? <img src={currentTrack.customCover} alt="" />
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>}
                </div>
                <div className="lm-track-meta">
                  <strong>{trackLabel(currentTrack)}</strong>
                  <span>{trackArtist(currentTrack)}{currentTrack.duration ? ` · ${fmtDur(currentTrack.duration)}` : ''}</span>
                </div>
                <button className="un-play-btn" onClick={e => { e.stopPropagation(); togglePlay(); }} aria-label={isPlaying ? '暂停' : '播放'}>
                  {isPlaying
                    ? <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="0.5" /><rect x="14" y="4" width="4" height="16" rx="0.5" /></svg>
                    : <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>}
                </button>
              </div>
              <div className="un-source">{sourceText}</div>
            </div>
          )}
          <div className="un-queue-head">
            <span>接下来 {queue.length} 首</span>
            {queue.length > 0 && (
              <button className="un-clear-btn" onClick={handleClearQueue}>清空接下来播放</button>
            )}
          </div>
          {queue.length === 0 ? (
            <div className="lm-empty" style={{ minHeight: 120 }}>
              <p>队列为空</p>
              <span>从音乐库选择歌曲开始播放</span>
            </div>
          ) : (
            <div className="un-queue-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {queue.map((trackId, idx) => {
                const t = tracks.find(tr => tr.id === trackId) as any;
                if (!t) return null;
                const isFirst = idx === 0;
                const isLast = idx === queue.length - 1;
                return (
                  <div
                    key={t.id}
                    className={`un-queue-row${currentTrackId === t.id ? ' playing' : ''}${dragIdx === idx ? ' dragging' : ''}`}
                    draggable
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx); (e.currentTarget as HTMLElement).style.opacity = '0.4'; }}
                    onDragEnd={e => { (e.currentTarget as HTMLElement).style.opacity = ''; setDragIdx(null); }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) handleReorder(dragIdx, idx); setDragIdx(null); }}
                    onClick={() => handleItemClick(t.id)} role="link" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') handleItemClick(t.id); }}
                  >
                    <div className="un-drag-handle" onClick={e => e.stopPropagation()} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="9" cy="5" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                    </div>
                    <div className="lm-track-cover" style={{ width: 40, height: 40, borderRadius: 8 }}>
                      {t.customCover ? <img src={t.customCover} alt="" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>}
                    </div>
                    <div className="lm-track-meta">
                      <strong>{trackLabel(t)}</strong>
                      <span>{trackArtist(t)}{t.duration ? ` · ${fmtDur(t.duration)}` : ''}</span>
                    </div>
                    <div className="un-sort-btns" onClick={e => e.stopPropagation()}>
                      <button className="un-sort-btn" disabled={isFirst} onClick={() => handleReorder(idx, idx - 1)} aria-label="上移">
                        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button className="un-sort-btn" disabled={isLast} onClick={() => handleReorder(idx, idx + 1)} aria-label="下移">
                        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                    </div>
                    <button className="un-remove-btn" onClick={e => { e.stopPropagation(); handleRemove(t.id); }} aria-label="移除">
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
