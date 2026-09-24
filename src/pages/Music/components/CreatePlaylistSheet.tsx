import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMusicStore, type MusicPlaylist, getTrackDisplayTitle } from '@/store/musicStore';

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
  editPlaylist?: MusicPlaylist;
  initialTrackId?: string;
}

export function CreatePlaylistSheet({ onClose, onCreated, editPlaylist, initialTrackId }: Props) {
  const tracks = useMusicStore((s) => s.tracks);
  const createPlaylist = useMusicStore((s) => s.createPlaylist);
  const updatePlaylist = useMusicStore((s) => s.updatePlaylist);
  const addTracksToPlaylist = useMusicStore((s) => s.addTracksToPlaylist);

  const [name, setName] = useState(editPlaylist?.name || '');
  const [description, setDescription] = useState(editPlaylist?.description || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(editPlaylist?.trackIds || (initialTrackId ? [initialTrackId] : [])));
  const [search, setSearch] = useState('');
  const [step, setStep] = useState<'info' | 'tracks'>(editPlaylist ? 'tracks' : 'info');
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverDataUrl, setCoverDataUrl] = useState<string | undefined>(editPlaylist?.customCover);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = search.trim()
    ? tracks.filter((t: any) => {
        const label = getTrackDisplayTitle(t).toLowerCase();
        return label.toLowerCase().includes(search.toLowerCase());
      })
    : tracks;

  const toggleTrack = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCover = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const out = Math.min(size, 512);
        canvas.width = out; canvas.height = out;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out);
        setCoverDataUrl(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (editPlaylist) {
      updatePlaylist(editPlaylist.id, { name: trimmedName, description: description.trim() || undefined, customCover: coverDataUrl });
      // Replace all tracks
      const store = useMusicStore.getState();
      store.removeTracksFromPlaylist(editPlaylist.id, editPlaylist.trackIds);
      if (selectedIds.size > 0) {
        store.addTracksToPlaylist(editPlaylist.id, [...selectedIds]);
      }
      onCreated(editPlaylist.id);
    } else {
      const id = createPlaylist(trimmedName, description.trim() || undefined, [...selectedIds], coverDataUrl);
      onCreated(id);
    }
  }, [name, description, selectedIds, coverDataUrl, editPlaylist, createPlaylist, updatePlaylist, addTracksToPlaylist, onCreated]);

  return createPortal(
    <div className="cps-overlay" onClick={onClose}>
      <div className="cps-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cps-header">
          <h2>{editPlaylist ? '編輯歌單' : '建立歌單'}</h2>
          <button className="cps-close" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {step === 'info' ? (
          <div className="cps-body">
            <div className="cps-cover-row">
              <div className="cps-cover-preview" onClick={() => coverRef.current?.click()}>
                {coverDataUrl
                  ? <img src={coverDataUrl} alt="" />
                  : <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                }
              </div>
              <span className="cps-cover-label">歌單封面（可選）</span>
              <input ref={coverRef} type="file" accept="image/*" hidden onChange={handleCover} />
            </div>
            <label>
              <span>歌單名稱 *</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="我的歌單" maxLength={60} autoFocus />
            </label>
            <label>
              <span>描述（可選）</span>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述這個歌單" maxLength={200} />
            </label>
            <div className="cps-actions">
              <button className="im-lyrics-btn" onClick={onClose}>取消</button>
              {!editPlaylist && (
                <button className="im-lyrics-btn" onClick={handleSubmit} disabled={!name.trim()}>
                  直接建立
                </button>
              )}
              <button className="im-lyrics-btn primary" onClick={() => setStep('tracks')} disabled={!name.trim()}>
                下一步：選擇歌曲
              </button>
            </div>
          </div>
        ) : (
          <div className="cps-body">
            {tracks.length === 0 ? (
              <div className="cps-empty-tracks">
                <p>音樂庫還沒有音訊</p>
                <span>先上傳一些聲音，再把它們整理成歌單。</span>
              </div>
            ) : (
              <>
                <div className="cps-search">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜尋歌曲…"
                  />
                </div>
                <div className="cps-track-count">已選 {selectedIds.size} 首</div>
                <div className="cps-track-list">
                  {filtered.map((t: any) => {
                    const label = getTrackDisplayTitle(t);
                    const isSelected = selectedIds.has(t.id);
                    return (
                      <div
                        key={t.id}
                        className={`cps-track${isSelected ? ' selected' : ''}`}
                        onClick={() => toggleTrack(t.id)}
                      >
                        <div className="cps-track-check">
                          {isSelected && <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </div>
                        <div className="cps-track-cover">
                          {t.customCover
                            ? <img src={t.customCover} alt="" />
                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                          }
                        </div>
                        <div className="cps-track-meta">
                          <strong>{label}</strong>
                          <span>{t.artist || ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="cps-actions">
              <button className="im-lyrics-btn" onClick={() => setStep('info')}>上一步</button>
              <button className="im-lyrics-btn primary" onClick={handleSubmit}>
                {editPlaylist ? '儲存' : '建立歌單'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
