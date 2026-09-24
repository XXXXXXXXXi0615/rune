import { useMemo, useState, useEffect, useRef } from 'react';
import { useMusicStore, type MusicPlaylist, getTrackDisplayTitle } from '@/store/musicStore';
import { MusicCover } from './MusicCover';

function trackLabel(t: any): string { return getTrackDisplayTitle(t); }
function trackArtist(t: any): string { return t?.artist || ''; }
function fmtDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function normalizeForSearch(text: string): string {
  return text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isInternalId(name: string): boolean {
  if (/^(Aud|Blob|File|audio|tmp)\d{10,}$/i.test(name)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) return true;
  if (/^\d{10,}$/.test(name)) return true;
  return false;
}

function searchLabel(t: any): string {
  const label = getTrackDisplayTitle(t);
  return isInternalId(label) ? '' : label;
}

export function SearchView({
  openTrack,
  onOpenPlaylist,
  onShowContext,
}: {
  openTrack: (id: string) => void;
  onOpenPlaylist: (id: string) => void;
  onShowContext: (e: React.MouseEvent, trackId: string) => void;
}) {
  const tracks = useMusicStore(s => s.tracks) as any[];
  const playlists = useMusicStore(s => s.playlists);
  const playFromSource = useMusicStore(s => s.playFromSource);
  const selectTrack = useMusicStore(s => s.selectTrack);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setDebounced(''); return; }
    debounceRef.current = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const results = useMemo(() => {
    const q = debounced.toLowerCase().trim();
    if (!q) return { tracks: [], playlists: [] };
    const nq = normalizeForSearch(q);

    const matchedTracks = tracks.filter(t => {
      const name = (t.displayName || t.title || '').toLowerCase();
      const artist = (t.artist || '').toLowerCase();
      const fileName = (t.fileName || '').toLowerCase();
      const normFileName = normalizeForSearch(t.fileName || '');
      const label = searchLabel(t).toLowerCase();
      return label.includes(nq) || name.includes(nq) || artist.includes(nq) || fileName.includes(nq) || normFileName.includes(nq);
    });

    const matchedPlaylists = playlists.filter(p => {
      const name = p.name.toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(nq) || desc.includes(nq);
    });

    return { tracks: matchedTracks, playlists: matchedPlaylists };
  }, [debounced, tracks, playlists]);

  const hasQuery = query.trim().length > 0;
  const hasResults = results.tracks.length > 0 || results.playlists.length > 0;

  const handlePlayAll = (trackIds: string[]) => {
    if (trackIds.length === 0) return;
    const source = { type: 'search' as const, query: debounced };
    playFromSource(trackIds[0], source, trackIds);
  };

  const handleTrackPlay = (trackId: string) => {
    const source = { type: 'search' as const, query: debounced };
    const queue = results.tracks.map(t => t.id);
    playFromSource(trackId, source, queue);
  };

  return (
    <div className="lm-section">
      <div className="lm-search" style={{ marginBottom: 0 }}>
        <div className="sv-search-wrap">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} className="sv-search-icon"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input ref={inputRef} className="lm-search-input sv-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索歌曲、演出者与歌单..." />
          {hasQuery && (
            <button className="sv-clear" onClick={() => { setQuery(''); setDebounced(''); inputRef.current?.focus(); }} aria-label="清除搜索">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
      </div>

      {!hasQuery && (
        <div className="lm-empty" style={{ minHeight: 200 }}>
          <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <p>搜索本地歌曲、演出者与歌单</p>
          <span>输入关键词开始搜索你的音乐库。</span>
        </div>
      )}

      {hasQuery && !hasResults && (
        <div className="lm-empty" style={{ minHeight: 200 }}>
          <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <p>找不到相关内容</p>
          <span>换个名称、演出者或歌单关键字试试。</span>
        </div>
      )}

      {hasQuery && hasResults && (
        <div className="sv-results">
          {results.tracks.length > 0 && (
            <div className="sv-section" style={{ marginBottom: 20 }}>
              <div className="sv-section-head">
                <h3>歌曲</h3>
                <span className="lm-count-inner">{results.tracks.length} 首歌曲</span>
              </div>
              <div className="lm-tracks">
                {results.tracks.map(t => (
                  <div key={t.id} className="lm-track" onClick={() => openTrack(t.id)} role="link" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') openTrack(t.id); }}>
                    <div className="lm-track-cover">
                      <MusicCover id={t.id} src={t.customCover} />
                    </div>
                    <div className="lm-track-meta">
                      <strong>{trackLabel(t)}</strong>
                      <span>{trackArtist(t)}{t.duration ? ` · ${fmtDur(t.duration)}` : ''}</span>
                    </div>
                    <div className="lm-track-actions" style={{ opacity: 1 }}>
                      <button className="lm-track-menu" onClick={e => { e.stopPropagation(); handleTrackPlay(t.id); }} aria-label="播放" title="播放">
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                      </button>
                      <button className="lm-track-menu" onClick={e => { e.stopPropagation(); onShowContext(e, t.id); }} aria-label="加入歌单" title="加入歌单">
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {results.playlists.length > 0 && (
            <div className="sv-section">
              <div className="sv-section-head">
                <h3>歌单</h3>
                <span className="lm-count-inner">{results.playlists.length} 个歌单</span>
              </div>
              <div className="sv-playlist-list">
                {results.playlists.map(p => (
                  <div key={p.id} className="sv-playlist-row" onClick={() => onOpenPlaylist(p.id)} role="link" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') onOpenPlaylist(p.id); }}>
                    {p.customCover ? (
                      <div className="sv-playlist-cover"><img src={p.customCover} alt="" /></div>
                    ) : (
                      <div className="sv-playlist-cover"><MusicCover id={p.id} /></div>
                    )}
                    <div className="sv-playlist-meta">
                      <strong>{p.name}</strong>
                      <span>{p.trackIds.length} 首</span>
                    </div>
                    <div className="sv-playlist-actions" style={{ opacity: 1 }}>
                      <button className="sv-playlist-btn" onClick={e => { e.stopPropagation(); handlePlayAll(p.trackIds); }} aria-label="播放全部">
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                      </button>
                      <button className="sv-playlist-btn" onClick={e => { e.stopPropagation(); onOpenPlaylist(p.id); }} aria-label="打开歌单">
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
