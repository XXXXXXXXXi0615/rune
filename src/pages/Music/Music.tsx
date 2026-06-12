import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudioPlayer, formatMusicTime } from '@/hooks/useAudioPlayer';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';
import { generatePixelCover } from '@/utils/pixelCover';
import { useAppStore } from '@/store/useAppStore';
import { getTrackDisplayName, useMusicStore } from '@/store/musicStore';
import { LunaMessage } from '@/components/layout/LunaMessage';
import styles from './Music.module.css';

const copy = {
  'zh-TW': {
    eyebrow: '月潮音匣',
    title: '音樂',
    upload: '上傳音訊',
    drop: '把音訊拖到這裡',
    emptyTitle: '點擊或拖放音訊',
    emptyHint: '支援 MP3 / WAV / FLAC / OGG / AAC 等瀏覽器可播放格式',
    nowPlaying: '正在播放',
    noTrack: '還沒有音樂',
    playlist: '播放清單',
    recently: '最近播放',
    favorites: '收藏',
    noRecent: '最近還沒有播放記錄',
    noFavorites: '還沒有收藏曲目',
    shortcuts: '快捷鍵',
    close: '關閉',
    remove: '移除',
    volume: '音量',
    stop: '停止',
    previous: '上一首',
    next: '下一首',
    play: '播放',
    pause: '暫停',
    loopOff: '循環：關閉',
    loopAll: '循環：全部',
    loopOne: '循環：單曲',
    shuffle: '隨機',
    favorite: '收藏',
    unfavorite: '取消收藏',
    mini: '迷你播放器',
    loading: '載入中…',
  },
  en: {
    eyebrow: 'Lunar Audio',
    title: 'Music',
    upload: 'Upload Audio',
    drop: 'Drop audio here',
    emptyTitle: 'Click or drop audio',
    emptyHint: 'Supports browser-playable MP3 / WAV / FLAC / OGG / AAC files',
    nowPlaying: 'Now Playing',
    noTrack: 'No music yet',
    playlist: 'Playlist',
    recently: 'Recently Played',
    favorites: 'Favorites',
    noRecent: 'No recent plays yet',
    noFavorites: 'No favorite tracks yet',
    shortcuts: 'Keyboard Shortcuts',
    close: 'Close',
    remove: 'Remove',
    volume: 'Volume',
    stop: 'Stop',
    previous: 'Previous',
    next: 'Next',
    play: 'Play',
    pause: 'Pause',
    loopOff: 'Loop: Off',
    loopAll: 'Loop: All',
    loopOne: 'Loop: One',
    shuffle: 'Shuffle',
    favorite: 'Favorite',
    unfavorite: 'Remove favorite',
    mini: 'Mini player',
    loading: 'Loading…',
  },
} as const;

function PlayIcon({ paused }: { paused: boolean }) {
  return paused ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="7,4 19,12 7,20" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function formatFileSize(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function Music() {
  const navigate = useNavigate();
  const language = useAppStore((state) => state.language);
  const text = copy[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameTrack = useMusicStore(s => s.renameTrack);
  const player = useAudioPlayer();
  const {
    audioRef,
    tracks = [],
    currentTrack,
    currentIndex,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    shuffle,
    loopMode,
    favorites = [],
    recentlyPlayed = [],
    error,
    uploadFiles,
    togglePlay,
    previous,
    next,
    stop,
    seek,
    setVolume,
    toggleShuffle,
    cycleLoopMode,
    toggleFavorite,
    selectTrack,
    removeTrack,
  } = player;

  useAudioVisualizer(audioRef, canvasRef, isPlaying);

  const currentCover = useMemo(() => {
    return generatePixelCover(currentTrack?.title || 'Lunartide');
  }, [currentTrack?.title]);

  const favoriteTracks = useMemo(() => {
    return tracks.filter((track) => favorites.includes(track.id));
  }, [favorites, tracks]);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const loopLabel = loopMode === 'one' ? text.loopOne : loopMode === 'all' ? text.loopAll : text.loopOff;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        seek(currentTime - 5);
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        seek(currentTime + 5);
      } else if (event.key.toLowerCase() === 'l') {
        cycleLoopMode();
      } else if (event.key.toLowerCase() === 's') {
        toggleShuffle();
      } else if (event.key.toLowerCase() === 'h') {
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, cycleLoopMode, seek, togglePlay, toggleShuffle]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    void uploadFiles(files);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <section
      id="music-view"
      className={`view ${styles.page}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        className={styles.hiddenInput}
        type="file"
        accept="audio/*"
        multiple
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />

      <LunaMessage page="music" />
      <div className={styles.topBar}>
        <button type="button" className={styles.backButton} aria-label="返回" onClick={() => navigate(-1)}>
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className={styles.headerCopy}>
          <div className={styles.eyebrow}>{text.eyebrow}</div>
          <div className={styles.title}>{text.title}</div>
        </div>
        <div className={styles.topActions}>
          <button type="button" className={styles.iconButton} onClick={() => setShortcutsOpen(true)} aria-label={text.shortcuts}>
            ⌘
          </button>
          <button type="button" className={styles.iconButton} onClick={() => setPlaylistOpen(true)} aria-label={text.playlist}>
            ☰
          </button>
          <button type="button" className={styles.smallButton} onClick={() => fileInputRef.current?.click()}>
            {text.upload}
          </button>
        </div>
      </div>

      <div className={`${styles.hero} ${dragging ? styles.dragging : ''}`}>
        {dragging && <div className={styles.dropOverlay}>{text.drop}</div>}
        {currentTrack ? (
          <>
            <div className={styles.nowPlaying}>
              <div className={`${styles.coverShell} ${isPlaying ? styles.playing : ''}`}>
                <span className={`${styles.albumRing} ${isPlaying ? styles.active : ''}`} aria-hidden="true" />
                <div
                  className={`${styles.cover} ${isPlaying ? styles.playing : ''}`}
                  style={{ backgroundImage: `url(${currentCover})` }}
                  aria-hidden="true"
                >
                  <span className={styles.coverCenter} />
                </div>
              </div>
              <div className={styles.trackInfo}>
                <div className={styles.trackLabel}>{text.nowPlaying}</div>
                <div className={styles.trackTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {renamingId === currentTrack.id ? (
                    <>
                      <input
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { renameTrack(currentTrack.id, renameValue.trim() || currentTrack.title); setRenamingId(null); }
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 8px', color: 'var(--text)', fontSize: 13, width: 180 }}
                      />
                      <button type="button" onClick={() => renameTrack(currentTrack.id, renameValue.trim() || currentTrack.title)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </>
                  ) : (
                    <>
                      <span>{getTrackDisplayName(currentTrack)}</span>
                      <button type="button" onClick={() => { setRenamingId(currentTrack.id); setRenameValue(getTrackDisplayName(currentTrack)); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2, fontSize: 12, opacity: 0.5 }}
                        title="重新命名">✎</button>
                    </>
                  )}
                </div>
                <div className={`${styles.statusBadge} ${isPlaying ? styles.statusPlaying : styles.statusReady}`}>
                  <span className={styles.statusDot} />
                  {isPlaying ? text.play : text.pause}
                </div>
                <div className={styles.trackMeta}>
                  {currentIndex + 1} / {tracks.length} · {formatFileSize(currentTrack.fileSize)}
                  {isLoading ? ` · ${text.loading}` : ''}
                </div>
                {error && <div className={styles.errorText}>{error}</div>}
              </div>
            </div>

            <div className={styles.progressBlock}>
              <div className={styles.timeRow}>
                <span>{formatMusicTime(currentTime)}</span>
                <span>{formatMusicTime(duration)}</span>
              </div>
              <input
                className={styles.range}
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                aria-label="seek bar"
                onChange={(event) => seek(Number(event.target.value))}
              />
            </div>

            <div className={styles.controls}>
              <div className={styles.controlDock}>
                <button type="button" className={`${styles.controlButton} ${loopMode !== 'off' ? styles.active : ''}`} onClick={cycleLoopMode} aria-label={loopLabel} title={loopLabel}>
                  {loopMode === 'one' ? '1' : '↻'}
                </button>
                <button type="button" className={styles.controlButton} onClick={previous} aria-label={text.previous}>‹</button>
                <button type="button" className={styles.primaryControl} onClick={togglePlay} aria-label={isPlaying ? text.pause : text.play}>
                  <PlayIcon paused={!isPlaying} />
                </button>
                <button type="button" className={styles.controlButton} onClick={next} aria-label={text.next}>›</button>
                <button type="button" className={`${styles.controlButton} ${shuffle ? styles.active : ''}`} onClick={toggleShuffle} aria-label={text.shuffle}>⤨</button>
                <button type="button" className={styles.controlButton} onClick={stop} aria-label={text.stop}>■</button>
                <button
                  type="button"
                  className={`${styles.controlButton} ${favorites.includes(currentTrack.id) ? styles.active : ''}`}
                  onClick={() => toggleFavorite(currentTrack.id)}
                  aria-label={favorites.includes(currentTrack.id) ? text.unfavorite : text.favorite}
                >
                  ♥
                </button>
              </div>
            </div>

            <div className={styles.volumeRow}>
              <span>{text.volume}</span>
              <input className={styles.range} type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
              <span>{Math.round(volume * 100)}%</span>
            </div>
          </>
        ) : (
          <button type="button" className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
            <span className={styles.uploadIcon}>♪</span>
            <span className={styles.uploadTitle}>{text.emptyTitle}</span>
            <span className={styles.uploadHint}>{text.emptyHint}</span>
          </button>
        )}
        <div className={styles.visualizerWrap}>
          <canvas ref={canvasRef} className={styles.visualizer} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>{text.recently}</span>
          </div>
          {recentlyPlayed.length > 0 ? (
            <div className={styles.list}>
              {recentlyPlayed.map((item) => (
                <button type="button" className={styles.listItem} key={`${item.id}-${item.playedAt}`} onClick={() => selectTrack(item.id)}>
                  <span className={styles.listCover} style={{ backgroundImage: `url(${generatePixelCover(getTrackDisplayName(item))})` }} />
                  <span>
                    <span className={styles.itemTitle}>{getTrackDisplayName(item)}</span>
                    <span className={styles.itemMeta}>{formatMusicTime(item.duration ?? 0)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>{text.noRecent}</p>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>{text.favorites}</span>
          </div>
          {favoriteTracks.length > 0 ? (
            <div className={styles.list}>
              {favoriteTracks.map((track) => (
                <button type="button" className={styles.listItem} key={track.id} onClick={() => selectTrack(track.id)}>
                  <span className={styles.listCover} style={{ backgroundImage: `url(${generatePixelCover(track.title)})` }} />
                  <span>
                    <span className={styles.itemTitle}>{getTrackDisplayName(track)}</span>
                    <span className={styles.itemMeta}>{formatMusicTime(track.duration ?? 0)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>{text.noFavorites}</p>
          )}
        </section>
      </div>

      {playlistOpen && (
        <>
          <div className={styles.drawerBackdrop} onClick={() => setPlaylistOpen(false)} />
          <aside className={styles.drawer} aria-label={text.playlist}>
            <div className={styles.drawerHead}>
              <strong>{text.playlist}</strong>
              <button type="button" className={styles.iconButton} onClick={() => setPlaylistOpen(false)} aria-label={text.close}>×</button>
            </div>
            <div className={styles.drawerBody}>
              {tracks.length > 0 ? tracks.map((track, index) => (
                <div key={track.id} className={`${styles.drawerTrack} ${track.id === currentTrack?.id ? styles.current : ''}`}>
                  <button type="button" className={styles.drawerTrackMain} onClick={() => selectTrack(track.id)}>
                    <span>{index + 1}</span>
                    <span>
                      <span className={styles.itemTitle}>{getTrackDisplayName(track)}</span>
                      <span className={styles.itemMeta}>{formatMusicTime(track.duration ?? 0)} · {formatFileSize(track.fileSize)}</span>
                    </span>
                  </button>
                  <div className={styles.trackActions}>
                    <button type="button" className={`${styles.smallButton} ${favorites.includes(track.id) ? styles.active : ''}`} onClick={() => toggleFavorite(track.id)} aria-label={favorites.includes(track.id) ? text.unfavorite : text.favorite}>♥</button>
                    <button type="button" className={styles.smallButton} onClick={() => removeTrack(track.id)}>{text.remove}</button>
                  </div>
                </div>
              )) : (
                <p className={styles.emptyText}>{text.noTrack}</p>
              )}
            </div>
          </aside>
        </>
      )}

      {shortcutsOpen && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setShortcutsOpen(false)} />
          <div className={styles.modal} role="dialog" aria-label={text.shortcuts}>
            <div className={styles.drawerHead}>
              <strong>{text.shortcuts}</strong>
              <button type="button" className={styles.iconButton} onClick={() => setShortcutsOpen(false)} aria-label={text.close}>×</button>
            </div>
            <div className={styles.shortcutList}>
              <div className={styles.shortcutRow}><span className={styles.shortcutKey}>Space</span><span>{text.play} / {text.pause}</span></div>
              <div className={styles.shortcutRow}><span className={styles.shortcutKey}>← / →</span><span>Seek ±5s</span></div>
              <div className={styles.shortcutRow}><span className={styles.shortcutKey}>L</span><span>{loopLabel}</span></div>
              <div className={styles.shortcutRow}><span className={styles.shortcutKey}>S</span><span>{text.shuffle}</span></div>
              <div className={styles.shortcutRow}><span className={styles.shortcutKey}>H</span><span>{text.shortcuts}</span></div>
            </div>
            <button type="button" className={styles.smallButton} onClick={() => setShortcutsOpen(false)}>{text.close}</button>
          </div>
        </>
      )}

      {currentTrack && (
        <div className={styles.miniPlayer} aria-label={text.mini}>
          <div className={styles.miniProgress}>
            <div className={styles.miniProgressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.miniBody}>
            <span className={styles.miniCover} style={{ backgroundImage: `url(${currentCover})` }} />
            <span className={styles.miniInfo}>
              <span className={styles.miniTitle}>{currentTrack.title}</span>
              <span className={styles.miniMeta}>{formatMusicTime(currentTime)} / {formatMusicTime(duration)}</span>
            </span>
            <button type="button" className={styles.iconButton} onClick={togglePlay} aria-label={isPlaying ? text.pause : text.play}>
              <PlayIcon paused={!isPlaying} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
