/**
 * MusicShell — full-height music container with playlist support.
 */
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMusicStore, type MusicPlaylist, type MusicPlaybackSource, getTrackDisplayTitle } from '@/store/musicStore';
import { MusicDock, type MusicSection } from '@/components/music/MusicDock';
import { CreatePlaylistSheet } from './components/CreatePlaylistSheet';
import { UpNextSheet } from './components/UpNextSheet';
import { MusicCover, resolveMusicCoverSource } from './components/MusicCover';
import { RuneListeningRoom } from './components/RuneListeningRoom';
import { MusicLibrary } from './components/MusicLibrary';
import { useAppStore } from '@/store/useAppStore';
import { getLanguage } from '@/i18n';
import '@/styles/music-shell.css';

const isZh = getLanguage() === 'zh-TW';

function trackLabel(t: any): string { return getTrackDisplayTitle(t); }
function trackArtist(t: any): string { return t?.artist || ''; }
function fmtDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function resolveBackUrl(pathname: string, detailPlaylistId: string | null): string {
  if (pathname === '/music') return '/';
  if (pathname.startsWith('/music/playlists/') && detailPlaylistId) return '/music/playlists';
  if (pathname.startsWith('/music/playlists')) return '/music';
  if (pathname.startsWith('/music/library')) return '/music';
  if (pathname.startsWith('/music/recent')) return '/music';
  if (pathname.startsWith('/music/search')) return '/music';
  return '/';
}

function BackChevron() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function playlistTotalDuration(playlist: MusicPlaylist, tracks: any[]): number {
  let total = 0;
  for (const tid of playlist.trackIds) {
    const t = tracks.find((tr: any) => tr.id === tid);
    if (t?.duration && Number.isFinite(t.duration)) total += t.duration;
  }
  return total;
}

function PlaylistCover({ playlist, tracks }: { playlist: MusicPlaylist; tracks: any[] }) {
  if (playlist.customCover) {
    return <div className="lm-playlist-cover"><img src={playlist.customCover} alt="" /></div>;
  }
  const coverTracks = playlist.trackIds
    .map((tid) => tracks.find((t: any) => t.id === tid))
    .filter((t) => resolveMusicCoverSource(t))
    .slice(0, 4);
  if (coverTracks.length >= 2) {
    return (
      <div className="lm-playlist-cover">
        <div className="lm-playlist-cover-mosaic">
          {coverTracks.slice(0, 4).map((t, i) => <img key={i} src={resolveMusicCoverSource(t)} alt="" />)}
        </div>
      </div>
    );
  }
  return (
    <div className="lm-playlist-cover"><MusicCover id={playlist.id} /></div>
  );
}

/* ── Track context menu for adding to playlists ── */
function TrackContextMenu({
  trackId,
  track,
  onClose,
  anchor,
  onPlay,
  onCreateWithTrack,
}: {
  trackId: string;
  track?: any;
  onClose: () => void;
  anchor: { x: number; y: number };
  onPlay?: (id: string) => void;
  onCreateWithTrack: (id: string) => void;
}) {
  const playlists = useMusicStore((s) => s.playlists);
  const addTracksToPlaylist = useMusicStore((s) => s.addTracksToPlaylist);
  const removeTracksFromPlaylist = useMusicStore((s) => s.removeTracksFromPlaylist);
  const removePlayHistory = useMusicStore((s) => s.removePlayHistory);
  const navigate = useNavigate();

  return (
    <div className="lm-ctx-overlay" onClick={onClose}>
      <div className="lm-ctx-menu" style={{ left: Math.min(anchor.x, window.innerWidth - 200), top: Math.min(anchor.y, window.innerHeight - 200) }} onClick={(e) => e.stopPropagation()}>
        {onPlay && (
          <button className="lm-ctx-item" onClick={() => { onPlay(trackId); onClose(); }}>
            <span>播放</span>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
          </button>
        )}
        <div className="lm-ctx-title">加入歌單</div>
        {playlists.length === 0 ? (
          <div className="lm-ctx-empty">還沒有歌單</div>
        ) : (
          playlists.map((p) => {
            const inPlaylist = p.trackIds.includes(trackId);
            return (
              <button
                key={p.id}
                className="lm-ctx-item"
                onClick={() => {
                  if (inPlaylist) {
                    removeTracksFromPlaylist(p.id, [trackId]);
                  } else {
                    addTracksToPlaylist(p.id, [trackId]);
                  }
                  onClose();
                }}
              >
                <span>{p.name}</span>
                {inPlaylist && <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </button>
            );
          })
        )}
        <button className="lm-ctx-item" onClick={() => { onCreateWithTrack(trackId); onClose(); }}>
          <span>＋ 建立新歌單</span>
        </button>
        {removePlayHistory && (
          <button className="lm-ctx-item" onClick={() => { removePlayHistory(trackId); onClose(); }}>
            <span>從最近播放移除</span>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
        {track && (
          <button className="lm-ctx-item" onClick={() => { navigate(`/music/listen/${encodeURIComponent(String(trackId))}`); onClose(); }}>
            <span>編輯歌曲資訊</span>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   PLAYLIST DETAIL VIEW
   ════════════════════════════════════════ */
function PlaylistDetail({
  playlist,
  onBack,
  onEdit,
}: {
  playlist: MusicPlaylist;
  onBack: () => void;
  onEdit: () => void;
}) {
  const tracks = useMusicStore((s) => s.tracks) as any[];
  const currentId = useMusicStore((s) => s.currentTrackId);
  const removeTracksFromPlaylist = useMusicStore((s) => s.removeTracksFromPlaylist);
  const deletePlaylist = useMusicStore((s) => s.deletePlaylist);
  const reorderPlaylistTracks = useMusicStore((s) => s.reorderPlaylistTracks);
  const setPlaylistQueue = useMusicStore((s) => s.setPlaylistQueue);
  const selectTrack = useMusicStore((s) => s.selectTrack);
  const playFromSource = useMusicStore((s) => s.playFromSource);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const shuffle = useMusicStore((s) => s.shuffle);
  const navigate = useNavigate();

  const playlistTracks = useMemo(
    () => playlist.trackIds.map((tid) => tracks.find((t: any) => t.id === tid)).filter(Boolean),
    [playlist.trackIds, tracks]
  );
  const totalDuration = playlistTotalDuration(playlist, tracks);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const openTrack = (id: string) => {
    playFromSource(id, { type: 'playlist', playlistId: playlist.id }, playlistTracks.map((t: any) => t.id));
    navigate(`/music/listen/${encodeURIComponent(String(id))}`);
  };

  const handlePlayAll = () => {
    const validIds = playlistTracks.map((t: any) => t.id);
    playFromSource(validIds[0], { type: 'playlist', playlistId: playlist.id }, validIds);
  };

  const handleShufflePlay = () => {
    const validIds = playlistTracks.map((t: any) => t.id);
    if (!shuffle) toggleShuffle();
    if (validIds.length > 0) {
      const randIdx = Math.floor(Math.random() * validIds.length);
      playFromSource(validIds[randIdx], { type: 'playlist', playlistId: playlist.id }, validIds);
    }
  };

  return (
    <div className="lm-section">
      <button className="lm-pldetail-btn" onClick={onBack} style={{ marginBottom: 12 }}>
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        返回歌單
      </button>

      <div className="lm-pldetail-header">
        <div className="lm-pldetail-cover">
          <PlaylistCover playlist={playlist} tracks={tracks} />
        </div>
        <div className="lm-pldetail-info">
          <h1 className="lm-pldetail-name">{playlist.name}</h1>
          {playlist.description && <p className="lm-pldetail-desc">{playlist.description}</p>}
          <p className="lm-pldetail-stats">{playlistTracks.length} 首{totalDuration > 0 ? ` · ${fmtDur(totalDuration)}` : ''}</p>
          <div className="lm-pldetail-actions">
            <button className="lm-pldetail-btn primary" onClick={handlePlayAll} disabled={playlistTracks.length === 0} aria-label="播放全部">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21" /></svg>
              播放全部
            </button>
            <button className="lm-pldetail-btn" onClick={handleShufflePlay} disabled={playlistTracks.length === 0} aria-label="隨機播放">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
              隨機播放
            </button>
            <button className="lm-pldetail-btn" onClick={onEdit} aria-label="新增歌曲">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              新增歌曲
            </button>
            <button className="lm-pldetail-btn" onClick={onEdit} aria-label="編輯歌單">
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
              編輯
            </button>
            {!confirmDelete ? (
              <button className="lm-pldetail-btn" onClick={() => setConfirmDelete(true)} aria-label="刪除歌單">
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                刪除
              </button>
            ) : (
              <button className="lm-pldetail-btn" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => { deletePlaylist(playlist.id); onBack(); }} aria-label="確認刪除歌單">確認刪除</button>
            )}
          </div>
        </div>
      </div>

      {playlistTracks.length === 0 ? (
        <div className="lm-empty">
          <p>歌單裡還沒有歌曲</p>
          <span>從音樂庫加入歌曲到這個歌單。</span>
        </div>
      ) : (
        <div className="lm-tracks">
          {playlistTracks.map((t: any, idx: number) => {
            const isFirst = idx === 0;
            const isLast = idx === playlistTracks.length - 1;
            return (
            <div
              key={t.id}
              className={`lm-track${currentId === t.id ? ' playing' : ''}${dragIdx === idx ? ' dragging' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDragIdx(idx);
                (e.currentTarget as HTMLElement).style.opacity = '0.4';
              }}
              onDragEnd={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '';
                setDragIdx(null);
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) reorderPlaylistTracks(playlist.id, dragIdx, idx);
                setDragIdx(null);
              }}
              onClick={() => openTrack(t.id)} role="link" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') openTrack(t.id); }}>
              <div className="lm-track-drag-handle" onClick={(e) => e.stopPropagation()} aria-hidden="true">
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="9" cy="5" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="19" r="1" /></svg>
              </div>
              <div className="lm-track-cover">
                <MusicCover id={t.id} src={t.customCover} />
                {currentId === t.id && <span className="lm-playing-dot" />}
              </div>
              <div className="lm-track-meta">
                <strong>{trackLabel(t)}</strong>
                <span>{trackArtist(t)}{t.duration ? ` · ${fmtDur(t.duration)}` : ''}</span>
              </div>
              {/* Mobile sort buttons */}
              <div className="lm-track-sort-btns" onClick={(e) => e.stopPropagation()}>
                <button className="lm-track-sort-btn" disabled={isFirst} onClick={() => reorderPlaylistTracks(playlist.id, idx, idx - 1)} aria-label="上移" title="上移">
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
                </button>
                <button className="lm-track-sort-btn" disabled={isLast} onClick={() => reorderPlaylistTracks(playlist.id, idx, idx + 1)} aria-label="下移" title="下移">
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>
              <button className="lm-track-del" onClick={e => { e.stopPropagation(); removeTracksFromPlaylist(playlist.id, [t.id]); }} title="從歌單移除">−</button>
            </div>
          )})}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN SHELL
   ════════════════════════════════════════ */
export function MusicShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();
  const tracks = useMusicStore((s) => s.tracks) as any[];
  const playlists = useMusicStore((s) => s.playlists);
  const currentId = useMusicStore((s) => s.currentTrackId);
  const removeTrack = useMusicStore((s) => s.removeTrack);
  const playHistory = useMusicStore((s) => s.playHistory);
  const profile = useAppStore((s) => s.profile);

  const playFromSource = useMusicStore((s) => s.playFromSource);
  const pathSection = (): MusicSection => {
    if (location.pathname === '/music') {
      const legacySection = new URLSearchParams(location.search).get('section');
      if (legacySection === 'library' || legacySection === 'recent' || legacySection === 'playlists' || legacySection === 'search') return legacySection;
      return 'home';
    }
    if (location.pathname.startsWith('/music/recent')) return 'recent';
    if (location.pathname.startsWith('/music/playlists')) return 'playlists';
    if (location.pathname.startsWith('/music/search')) return 'search';
    return 'library';
  };
  const [section, setSection] = useState<MusicSection>(() => {
    if (location.pathname !== '/music') return pathSection();
    const s = sp.get('section');
    if (s === 'recent' || s === 'playlists' || s === 'search') return s;
    return 'home';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<MusicPlaylist | null>(null);
  const [detailPlaylistId, setDetailPlaylistId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ trackId: string; x: number; y: number } | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [showUpNext, setShowUpNext] = useState(false);
  const [createWithTrackId, setCreateWithTrackId] = useState<string | undefined>();

  const detailPlaylist = useMemo(() => detailPlaylistId ? playlists.find(p => p.id === detailPlaylistId) : null, [detailPlaylistId, playlists]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = '';
    if (!files.length) return;
    await useMusicStore.getState().uploadFiles(files);
  };

  const openTrack = (id: string) => navigate(`/music/listen/${encodeURIComponent(String(id))}`);

  const navigateToTrack = useCallback((id: string, source: MusicPlaybackSource, queue: string[]) => {
    playFromSource(id, source, queue);
    navigate(`/music/listen/${encodeURIComponent(String(id))}`);
  }, [playFromSource, navigate]);

  const handleSection = (s: MusicSection) => {
    setSection(s);
    setDetailPlaylistId(null);
    const route = s === 'home' ? '/music' : s === 'library' ? '/music/library' : `/music/${s}`;
    navigate(route);
  };
  const triggerImport = () => fileInputRef.current?.click();
  const switchToLibrary = () => handleSection('library');

  useEffect(() => {
    setSection(pathSection());
    if (location.pathname.startsWith('/music/playlists/')) setDetailPlaylistId(decodeURIComponent(location.pathname.split('/').pop() || ''));
  }, [location.pathname, location.search]);

  const handleTrackContext = useCallback((e: React.MouseEvent, trackId: string) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ trackId, x: e.clientX, y: e.clientY });
  }, []);

  /* Header count label */
  const headerCount = section === 'playlists' && !detailPlaylist
    ? `${playlists.length} 個歌單`
    : section === 'library' || section === 'recent' || section === 'search'
      ? `音樂庫 · ${tracks.length} 首`
      : detailPlaylist
        ? `${detailPlaylist.trackIds.length} 首`
        : '';

  const backUrl = resolveBackUrl(location.pathname, detailPlaylistId);
  const headerSubtitle = detailPlaylist
    ? (detailPlaylist.description || '')
    : section === 'home'
      ? `${profile.displayName || '理'} 的私人播放空間`
    : section === 'library' || section === 'recent' || section === 'search'
        ? `音樂庫 · ${tracks.length} 首`
        : '';

  return (
    <div className="lm-shell" data-clawd-anchor="music">
      {/* Header */}
      <header className="lm-header">
        <button className="lm-back" onClick={() => navigate(backUrl)} aria-label="返回">
          <BackChevron />
        </button>
        <div className="lm-identity">
          <h1 className="lm-title">{detailPlaylist ? detailPlaylist.name : section === 'home' ? 'Rune 共聽室' : section === 'playlists' ? '歌單' : (isZh ? '音樂庫' : 'Music Library')}</h1>
          {headerSubtitle && <p className="lm-subtitle">{headerSubtitle}</p>}
        </div>
        <div className="lm-header-actions" />
      </header>

      <nav className="music-desktop-nav" aria-label="音樂導覽">
        {([['home','共聽'],['library','音樂庫'],['playlists','歌單']] as [MusicSection,string][]).map(([id,label]) => <button key={id} aria-current={(section === id || (id === 'library' && (section === 'recent' || section === 'search'))) ? 'page' : undefined} onClick={() => handleSection(id)}>{label}</button>)}
        <span>{headerCount}</span>
      </nav>

      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" multiple hidden onChange={handleImport} />

      {/* Content */}
      <main className="lm-content">
        {!detailPlaylist && section === 'home' && (
          <RuneListeningRoom onOpenQueue={() => setShowUpNext(true)} onOpenLibrary={() => handleSection('library')} />
        )}
        {/* Playlist detail view */}
        {detailPlaylist && (
          <PlaylistDetail
            playlist={detailPlaylist}
            onBack={() => setDetailPlaylistId(null)}
            onEdit={() => { setEditingPlaylist(detailPlaylist); setShowCreateSheet(true); }}
          />
        )}

        {!detailPlaylist && (section === 'library' || section === 'recent' || section === 'search') && (
          <MusicLibrary onImport={triggerImport} onPlay={navigateToTrack} onMore={handleTrackContext} onDelete={setDeletingTrackId} />
        )}

        {/* Playlists */}
        {!detailPlaylist && section === 'playlists' && (
          <div className="lm-section">
            <div className="lm-section-head">
              <h2>我的歌單</h2>
              <button className="lm-pldetail-btn" onClick={() => { setEditingPlaylist(null); setShowCreateSheet(true); }}>+ 建立歌單</button>
            </div>
            {playlists.length === 0 ? (
              tracks.length === 0 ? (
                <div className="lm-empty">
                  <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                  <p>音樂庫還沒有音訊</p>
                  <span>先上傳一些聲音，再把它們整理成歌單。</span>
                  <button className="lm-empty-btn" onClick={triggerImport}>前往上傳音訊</button>
                </div>
              ) : (
                <div className="lm-empty">
                  <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 6h18M3 12h12M3 18h6" /></svg>
                  <p>還沒有歌單</p>
                  <span>把喜歡的歌曲整理成屬於自己的播放空間。</span>
                  <button className="lm-empty-btn" onClick={() => { setEditingPlaylist(null); setShowCreateSheet(true); }}>建立第一個歌單</button>
                </div>
              )
            ) : (
              <div className="lm-playlist-grid">
                {playlists.map((p) => (
                  <button key={p.id} className="lm-playlist-card" onClick={() => { setDetailPlaylistId(p.id); navigate(`/music/playlists/${encodeURIComponent(p.id)}`); }}>
                    <PlaylistCover playlist={p} tracks={tracks} />
                    <span className="lm-playlist-name">{p.name}</span>
                    <span className="lm-playlist-count">{p.trackIds.length} 首{playlistTotalDuration(p, tracks) > 0 ? ` · ${fmtDur(playlistTotalDuration(p, tracks))}` : ''}</span>
                    <span className="lm-playlist-play" aria-hidden="true">▶</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Layer */}
      <div className="lm-bottom" data-pet-safe-zone>
        <MusicDock activeView={section === 'recent' || section === 'search' ? 'library' : section} onViewChange={handleSection} />
      </div>

      {/* Create / Edit Playlist Sheet */}
      {showCreateSheet && (
        <CreatePlaylistSheet
          editPlaylist={editingPlaylist || undefined}
          initialTrackId={createWithTrackId}
          onClose={() => { setShowCreateSheet(false); setEditingPlaylist(null); }}
          onCreated={(id) => { setShowCreateSheet(false); setEditingPlaylist(null); setCreateWithTrackId(undefined); setDetailPlaylistId(id); navigate(`/music/playlists/${encodeURIComponent(id)}`); }}
        />
      )}

      {/* Track context menu */}
      {ctxMenu && (
        <TrackContextMenu
          trackId={ctxMenu.trackId}
          track={tracks.find((t: any) => t.id === ctxMenu.trackId)}
          anchor={{ x: ctxMenu.x, y: ctxMenu.y }}
          onClose={() => setCtxMenu(null)}
          onCreateWithTrack={(id) => { setCreateWithTrackId(id); setEditingPlaylist(null); setShowCreateSheet(true); }}
          onPlay={section === 'recent' ? (id) => {
            const source = { type: 'recent' as const };
            const queue = playHistory.map(h => h.trackId).filter(tid => tracks.some((t: any) => t.id === tid));
            useMusicStore.getState().playFromSource(id, source, queue);
          } : undefined}
        />
      )}

      {/* Up Next Sheet */}
      {showUpNext && <UpNextSheet onClose={() => setShowUpNext(false)} />}

      {/* Delete track confirmation */}
      {deletingTrackId && (
        (() => {
          const affectedCount = useMusicStore.getState().playlists.filter(p => p.trackIds.includes(deletingTrackId)).length;
          return (
            <div className="cps-overlay" onClick={() => setDeletingTrackId(null)}>
              <div className="cps-sheet" style={{ maxWidth: 360, maxHeight: 'none' }} onClick={(e) => e.stopPropagation()}>
                <div className="cps-header">
                  <h2>刪除歌曲</h2>
                  <button className="cps-close" onClick={() => setDeletingTrackId(null)} aria-label="關閉">
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
                <div className="cps-body" style={{ textAlign: 'center' }}>
                  {affectedCount > 0 ? (
                    <>
                      <p style={{ fontSize: 14, color: 'var(--text)' }}>
                        這首音訊正在 <strong>{affectedCount}</strong> 個歌單中使用。
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                        刪除後，也會從這些歌單中移除。
                      </p>
                    </>
                  ) : (
                    <p style={{ fontSize: 14, color: 'var(--text)' }}>確定要刪除這首歌曲嗎？</p>
                  )}
                  <div className="cps-actions" style={{ justifyContent: 'center', marginTop: 16 }}>
                    <button className="im-lyrics-btn" onClick={() => setDeletingTrackId(null)}>取消</button>
                    <button
                      className="im-lyrics-btn"
                      style={{ background: 'var(--error)', color: '#fff', borderColor: 'var(--error)' }}
                      onClick={() => { removeTrack(deletingTrackId); setDeletingTrackId(null); }}
                    >確認刪除</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}

/* ── MiniPlayer ── */
function MusicMiniPlayer({ onSwitchToLibrary, onOpenUpNext }: { onSwitchToLibrary: () => void; onOpenUpNext: () => void }) {
  const navigate = useNavigate();
  const tracks = useMusicStore((s) => s.tracks);
  const cid = useMusicStore((s) => s.currentTrackId);
  const track = useMemo(() => tracks.find((t: any) => t.id === cid) || null, [tracks, cid]);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const ct = useMusicStore((s) => s.currentTime);
  const dur = useMusicStore((s) => s.duration);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const isLoading = useMusicStore((s) => s.isLoading);
  const error = useMusicStore((s) => s.error);
  const loopMode = useMusicStore((s) => s.loopMode);
  const previous = useMusicStore((s) => s.previous);
  const next = useMusicStore((s) => s.next);

  if (!track) {
    return (
      <div className="lm-mini">
        <div className="lm-mini__inner lm-mini__inner--idle" onClick={onSwitchToLibrary}>
          <span className="lm-mini__cover">
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
          </span>
          <span className="lm-mini__meta">
            <strong>選一首音樂開始共聽</strong>
            <small>本地音樂會留在這台裝置</small>
          </span>
        </div>
      </div>
    );
  }

  const title = trackLabel(track);
  const artist = trackArtist(track);
  const cover = (track as any)?.customCover;
  const sd = Number.isFinite(dur) && dur > 0 ? dur : 0;
  const prog = sd > 0 ? (Math.max(0, ct) / sd) * 100 : 0;

  if (isLoading) {
    return (
      <div className="lm-mini">
        <div className="lm-mini__inner lm-mini__inner--loading">
          <span className="lm-mini__cover lm-mini__cover--pulse">
            <MusicCover id={track.id} src={cover} />
          </span>
          <span className="lm-mini__meta">
            <strong>{title}</strong>
            <small>載入中…</small>
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lm-mini">
        <div className="lm-mini__inner lm-mini__inner--error">
          <span className="lm-mini__cover" onClick={() => navigate(`/music/listen/${track.id}`)}>
            <MusicCover id={track.id} src={cover} />
          </span>
          <span className="lm-mini__meta">
            <strong>{title}</strong>
            <small>{error.code === 'ASSET_NOT_FOUND' || error.code === 'ASSET_LOAD_FAILED' ? '音訊檔案需要重新匯入' : error.message}</small>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="lm-mini">
      <div className="lm-mini__inner">
        <span className="lm-mini__progress" style={{ width: `${Math.min(100, prog)}%` }} />
        <button className="lm-mini__ctrl" onClick={e => { e.stopPropagation(); previous(); }} aria-label="上一首">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></svg>
        </button>
        <button className="lm-mini__main" onClick={() => navigate(`/music/listen/${track.id}`)}>
          <span className={`lm-mini__cover${isPlaying ? ' lm-mini__cover--spin' : ''}`}>
            {cover ? <img src={cover} alt="" /> : <MusicCover id={track.id} src={cover} />}
          </span>
          <span className="lm-mini__meta"><strong>{title}</strong>{artist && <small>{artist}</small>}</span>
          <span className="lm-mini__time">{sd > 0 ? fmtDur(ct) : '--:--'}<span className="lm-mini__dur">{sd > 0 ? ` / ${fmtDur(sd)}` : ''}</span></span>
        </button>
        <button className="lm-mini__btn" onClick={e => { e.stopPropagation(); togglePlay(); }} aria-label={isPlaying ? '暫停' : '播放'}>
          {isPlaying
            ? <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="0.5" /><rect x="14" y="4" width="4" height="16" rx="0.5" /></svg>
            : <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>}
        </button>
        <button className="lm-mini__ctrl" onClick={e => { e.stopPropagation(); next(); }} aria-label="下一首">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
        </button>
        <button className={`lm-mini__ctrl lm-mini__ctrl--loop${loopMode !== 'off' ? ' lm-mini__ctrl--active' : ''}`} onClick={e => { e.stopPropagation(); useMusicStore.getState().cycleLoopMode(); }} aria-label={`循環模式：${loopMode === 'off' ? '關閉' : loopMode === 'all' ? '全部循環' : '單曲循環'}`}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
