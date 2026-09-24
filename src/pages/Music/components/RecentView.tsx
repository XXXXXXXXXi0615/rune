import { useMemo, useState } from 'react';
import { useMusicStore, getTrackDisplayTitle } from '@/store/musicStore';
import { MusicCover } from './MusicCover';

function trackLabel(t: any): string { return getTrackDisplayTitle(t); }
function trackArtist(t: any): string { return t?.artist || ''; }
function fmtDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return '刚刚';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return '';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDay.getTime() === today.getTime()) return `今天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (dDay.getTime() === yesterday.getTime()) return `昨天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatGroupLabel(key: string): string {
  switch (key) {
    case 'today': return '今天';
    case 'yesterday': return '昨天';
    case 'week': return '本周';
    default: return '更早';
  }
}

export function RecentView({ openTrack, onSwitchToLibrary, onShowContext }: {
  openTrack: (id: string) => void;
  onSwitchToLibrary: () => void;
  onShowContext: (e: React.MouseEvent, trackId: string) => void;
}) {
  const tracks = useMusicStore(s => s.tracks) as any[];
  const playHistory = useMusicStore(s => s.playHistory);
  const removePlayHistory = useMusicStore(s => s.removePlayHistory);
  const clearPlayHistory = useMusicStore(s => s.clearPlayHistory);

  const [confirmClear, setConfirmClear] = useState(false);

  const grouped = useMemo(() => {
    const groups: Record<string, { trackId: string; lastPlayedAt: string; playCount: number }[]> = {
      today: [], yesterday: [], week: [], earlier: [],
    };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 6 * 86400000);

    const sorted = [...playHistory].sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime());

    for (const entry of sorted) {
      const d = new Date(entry.lastPlayedAt);
      const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      let key: string;
      if (dDay.getTime() === today.getTime()) key = 'today';
      else if (dDay.getTime() === yesterday.getTime()) key = 'yesterday';
      else if (dDay.getTime() >= weekAgo.getTime()) key = 'week';
      else key = 'earlier';
      groups[key].push({ trackId: entry.trackId, lastPlayedAt: entry.lastPlayedAt, playCount: entry.playCount });
    }
    return groups;
  }, [playHistory]);

  const hasHistory = playHistory.length > 0;

  if (!hasHistory) {
    return (
      <div className="lm-section">
        <div className="lm-empty">
          <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
          <p>还没有播放记录</p>
          <span>播放过的音频会出现在这里，方便你再次回到那些声音。</span>
          <button className="lm-empty-btn" onClick={onSwitchToLibrary}>前往音乐库</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lm-section">
      <div className="lm-section-head">
        <h2>最近播放</h2>
        {!confirmClear ? (
          <button className="lm-pldetail-btn" onClick={() => setConfirmClear(true)} style={{ fontSize: 12, padding: '4px 10px', minHeight: 30 }}>
            清除播放记录
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>清除最近播放记录？歌曲和歌单不会被删除。</span>
            <button className="lm-pldetail-btn" style={{ fontSize: 12, padding: '4px 10px', minHeight: 30, color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => { clearPlayHistory(); setConfirmClear(false); }}>确认清除</button>
            <button className="lm-pldetail-btn" style={{ fontSize: 12, padding: '4px 10px', minHeight: 30 }} onClick={() => setConfirmClear(false)}>取消</button>
          </div>
        )}
      </div>
      {Object.entries(grouped).map(([key, entries]) => {
        if (entries.length === 0) return null;
        return (
          <div key={key} className="recent-group">
            <div className="recent-group-label">{formatGroupLabel(key)}</div>
            {entries.map(entry => {
              const t = tracks.find(tr => tr.id === entry.trackId) as any;
              if (!t) return null;
              const ago = timeAgo(entry.lastPlayedAt);
              const date = formatDate(entry.lastPlayedAt);
              return (
                <div key={entry.trackId} className="recent-row" onClick={() => openTrack(entry.trackId)} role="link" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') openTrack(entry.trackId); }}>
                  <div className="lm-track-cover">
                    <MusicCover id={t.id} src={t.customCover} />
                  </div>
                  <div className="lm-track-meta">
                    <strong>{trackLabel(t)}</strong>
                    <span>{trackArtist(t)}{ago ? ` · ${ago}` : ` · ${date}`}</span>
                  </div>
                  <span className="recent-count">{entry.playCount} 次播放</span>
                  <button className="lm-track-menu" onClick={e => { e.stopPropagation(); onShowContext(e, entry.trackId); }} aria-label="更多操作">
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                  </button>
                  <button className="recent-remove" onClick={e => { e.stopPropagation(); removePlayHistory(entry.trackId); }} aria-label="从最近播放移除" title="从最近播放移除">
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
