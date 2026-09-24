/**
 * ImmersiveListeningPage — Phase 5 with cover upload + track edit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMusicStore } from '@/store/musicStore';
import { trackLabel } from './components/PlayerPane';
import { MusicNowPlayingConsole } from './components/MusicNowPlayingConsole';
import { resolveMusicCoverSource } from './components/MusicCover';
import '@/styles/music-listening.css';

/* ── Image processing helper ── */
function processCoverImage(file: File, maxSize = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('NOT_IMAGE')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const outSize = Math.min(size, maxSize);
        canvas.width = outSize;
        canvas.height = outSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('NO_CONTEXT')); return; }
        ctx.drawImage(img, sx, sy, size, size, 0, 0, outSize, outSize);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

/* ── Track Edit Popover ── */
function TrackEditPopover({
  track,
  onClose,
  onSave,
}: {
  track: any;
  onClose: () => void;
  onSave: (patch: { displayName?: string; artist?: string }) => void;
}) {
  const [name, setName] = useState(track.displayName || track.title || '');
  const [artist, setArtist] = useState(track.artist || '');

  return (
    <div className="im-edit-overlay" onClick={onClose}>
      <div className="im-edit-popover" onClick={(e) => e.stopPropagation()}>
        <h3>編輯歌曲資訊</h3>
        <label>
          <span>曲名</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="歌曲名稱"
            maxLength={120}
          />
        </label>
        <label>
          <span>演出者</span>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="演出者"
            maxLength={80}
          />
        </label>
        <div className="im-edit-actions">
          <button className="im-lyrics-btn" onClick={onClose}>取消</button>
          <button
            className="im-lyrics-btn primary"
            onClick={() => {
              onSave({ displayName: name.trim() || undefined, artist: artist.trim() || undefined });
              onClose();
            }}
          >儲存</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════ */
export function ImmersiveListeningPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const hasHydrated = useMusicStore((s) => s.hasHydrated);
  const tracks = useMusicStore((s) => s.tracks);
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const selectTrack = useMusicStore((s) => s.selectTrack);
  const reloadTrack = useMusicStore((s) => s.reloadTrack);
  const replaceTrackAsset = useMusicStore((s) => s.replaceTrackAsset);
  const setTrackCustomCover = useMusicStore((s) => s.setTrackCustomCover);
  const renameTrack = useMusicStore((s) => s.renameTrack);
  const audioError = useMusicStore((s) => s.error);
  const audioIsLoading = useMusicStore((s) => s.isLoading);
  const audioDuration = useMusicStore((s) => s.duration);
  const appliedRouteTrackIdRef = useRef<string | null>(null);
  const reimportFileRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const routeTrackId = decodeURIComponent(String(trackId ?? ''));
  const track = useMemo(() => routeTrackId ? tracks.find((t: any) => String(t.id) === routeTrackId || t.id === routeTrackId) : undefined, [tracks, routeTrackId]);
  const currentTrack = useMemo(() => currentTrackId ? tracks.find((t: any) => String(t.id) === String(currentTrackId)) : undefined, [tracks, currentTrackId]);

  const hasMissingAssetId = !(track as any)?.assetId?.trim();
  const isMissingAssetError = audioError?.code === 'ASSET_NOT_FOUND' || audioError?.code === 'ASSET_LOAD_FAILED';
  const audioAssetMissing = hasMissingAssetId || isMissingAssetError;

  useEffect(() => {
    if (hasHydrated && routeTrackId && track) {
      const routeChanged = appliedRouteTrackIdRef.current !== routeTrackId;
      if (routeChanged) appliedRouteTrackIdRef.current = routeTrackId;

      if (routeChanged && track.id !== currentTrackId) {
        selectTrack(track.id);
      } else if (track.id === currentTrackId && !audioIsLoading && !audioError && audioDuration <= 0) {
        void reloadTrack(track.id);
      }
    }
  }, [hasHydrated, routeTrackId, track, currentTrackId, selectTrack, reloadTrack, audioIsLoading, audioDuration, audioError]);

  /* ── Cover handlers ── */
  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file || !track) return;
    setCoverError(null);
    try {
      const dataUrl = await processCoverImage(file);
      setTrackCustomCover(track.id, dataUrl);
    } catch (err: any) {
      setCoverError(err?.message === 'NOT_IMAGE' ? '請選擇圖片檔案' : '圖片處理失敗');
      setTimeout(() => setCoverError(null), 3000);
    }
  }, [track, setTrackCustomCover]);

  const handleRemoveCover = useCallback(() => {
    if (!track) return;
    setTrackCustomCover(track.id, undefined);
  }, [track, setTrackCustomCover]);

  const openCoverPicker = useCallback(() => { coverInputRef.current?.click(); }, []);

  /* ── Track edit handler ── */
  const handleTrackSave = useCallback((patch: { displayName?: string; artist?: string }) => {
    if (!track) return;
    if (patch.displayName !== undefined) {
      renameTrack(track.id, patch.displayName);
    }
    if (patch.artist !== undefined) {
      useMusicStore.setState(s => ({
        tracks: s.tracks.map((t: any) => t.id === track.id ? { ...t, artist: patch.artist } : t),
      }));
    }
  }, [track, renameTrack]);

  if (!hasHydrated) {
    return (
      <div className="im-page im-page--loading">
        <p>載入中…</p>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="im-page im-page--empty">
        <p>找不到這段音訊。</p>
        <p style={{ fontSize: 12, color: 'var(--music-listen-muted)' }}>它可能已被移除，或不在目前的音樂庫裡。</p>
        <Link to="/music" className="im-back-btn">返回音樂庫</Link>
      </div>
    );
  }

  if (audioAssetMissing) {
    const handleReimport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.currentTarget.files ?? []);
      e.currentTarget.value = '';
      if (!files.length) return;
      const file = files[0];
      if (!file.type.startsWith('audio/')) return;

      const { deleteAsset } = await import('@/store/assets');
      const store = useMusicStore.getState();
      const oldTrack = store.tracks.find((t: any) => t.id === track.id);
      const oldMeta = oldTrack ? {
        assetId: (oldTrack as any).assetId,
        fileName: (oldTrack as any).fileName,
        fileSize: (oldTrack as any).fileSize,
        fileType: (oldTrack as any).fileType,
        duration: (oldTrack as any).duration,
      } : null;

      let result: { oldAssetId?: string; newAssetId: string } | undefined;

      try {
        result = await replaceTrackAsset(track.id, file);
      } catch { return; }

      try {
        await store.reloadTrack(track.id);
        if (result.oldAssetId) { deleteAsset(result.oldAssetId).catch(() => {}); }
      } catch {
        if (oldMeta) {
          useMusicStore.setState(s => ({
            tracks: s.tracks.map((t: any) => t.id === track.id ? { ...t, ...oldMeta } : t),
            error: null,
          }));
        }
        if (result.newAssetId) { deleteAsset(result.newAssetId).catch(() => {}); }
        await useMusicStore.getState().reloadTrack(track.id);
        useMusicStore.setState({ error: { code: 'REIMPORT_FAILED', message: '新音訊無法載入，已恢復原來的檔案。' } });
      }
    };

    return (
      <div className="im-page im-page--error">
        <Link to="/music" className="im-back" aria-label="返回音樂庫" style={{ alignSelf: 'flex-start', margin: '24px 0 0 20px' }}>
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--music-listen-text)', margin: 0 }}>{trackLabel(track)}</h2>
          <p style={{ fontSize: 13, color: 'var(--music-listen-muted)' }}>音訊檔案需要重新匯入。</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="im-back-btn im-reimport-btn" onClick={() => reimportFileRef.current?.click()}>重新匯入音訊</button>
            <Link to="/music" className="im-back-btn" style={{ background: 'var(--music-listen-control)' }}>返回音樂庫</Link>
          </div>
        </div>
        <input ref={reimportFileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" hidden onChange={handleReimport} />
      </div>
    );
  }

  const displayTrack = currentTrack || track;
  const coverUrl = resolveMusicCoverSource(displayTrack as unknown as Record<string, unknown>);

  return (
    <div className="im-page">
      <div className={`im-bg${!coverUrl ? ' im-bg--fallback' : ''}`}>
        {coverUrl && <img src={coverUrl} alt="" className="im-bg-img" />}
      </div>
      <div className="im-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 8 }}>
          <Link to="/music" className="im-back" aria-label="返回音樂庫">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
          </Link>
          {/* Edit track info button */}
          <button
            className="im-back"
            aria-label="編輯歌曲資訊"
            title="編輯歌曲資訊"
            onClick={() => setEditing(true)}
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
          </button>
          {/* Cover management */}
          {coverUrl && (
            <button
              className="im-back"
              aria-label="移除封面"
              title="移除封面"
              onClick={handleRemoveCover}
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>

        {coverError && (
          <div className="im-cover-error">{coverError}</div>
        )}

        {(audioIsLoading || audioError) && <div className={`hifi-audio-status${audioError ? ' is-error' : ''}`}>{audioError?.message || '正在准备音频…'}</div>}
        <MusicNowPlayingConsole track={displayTrack} onCoverClick={openCoverPicker} />
      </div>

      <input ref={coverInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif" hidden onChange={handleCoverUpload} />

      {editing && (
        <TrackEditPopover
          track={displayTrack}
          onClose={() => setEditing(false)}
          onSave={handleTrackSave}
        />
      )}
    </div>
  );
}
