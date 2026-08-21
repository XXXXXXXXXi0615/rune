import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePhotoWallStore, getPhotoEntriesSize, type PhotoWallLayout } from '@/store/usePhotoWallStore';
import { useToastStore } from '@/store/useToastStore';
import { compressImageFile } from '@/utils/imageCompression';
import type { PhotoEntry } from '@/types';
import '@/styles/photo-wall.css';

const PIN_COLORS = ['#d87c4c', '#8a7ab8', '#5a8a5a', '#b87038', '#8a6060', '#6080a8'];

function toLocalDateString(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toLocalTimeString(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectAspect(w: number, h: number): PhotoEntry['aspectRatio'] {
  const ratio = w / h;
  if (ratio > 1.3) return 'landscape';
  if (ratio < 0.75) return 'portrait';
  return 'square';
}

async function compressForPhotoWall(file: File): Promise<string> {
  let blob = await compressImageFile(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    outputType: 'image/jpeg',
    quality: 0.80,
  });
  if (blob.size > 800 * 1024) {
    blob = await compressImageFile(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      outputType: 'image/jpeg',
      quality: 0.65,
    });
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getAspectFromFile(file: File): Promise<PhotoEntry['aspectRatio']> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(detectAspect(img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => resolve('square');
    img.src = URL.createObjectURL(file);
  });
}

function AddPhotoSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (photo: { imageData: string; caption: string; aspectRatio: PhotoEntry['aspectRatio'] }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<PhotoEntry['aspectRatio']>('square');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFilePicked = useCallback(async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    const previewUrl = URL.createObjectURL(f);
    setPreview(previewUrl);
    try {
      const aspect = await getAspectFromFile(f);
      setAspectRatio(aspect);
    } catch { /* use default square */ }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    try {
      const imageData = await compressForPhotoWall(file);
      URL.revokeObjectURL(preview);
      onAdd({ imageData, caption: caption.trim(), aspectRatio });
      onClose();
    } catch {
      setUploading(false);
      alert('图片处理失败，请重试。');
    }
  }, [file, preview, caption, aspectRatio, onAdd, onClose]);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  return createPortal(
    <div className="add-photo-sheet-overlay" onClick={onClose}>
      <div className="add-photo-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="add-photo-sheet-header">
          <h2>新增到照片墙</h2>
          <button type="button" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="add-photo-sheet-body">
          {!preview ? (
            <div className="add-photo-buttons">
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { handleFilePicked(e.target.files?.[0]); e.target.value = ''; }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={(e) => { handleFilePicked(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" onClick={() => fileRef.current?.click()}>
                <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                </svg>
                从相簿选取
              </button>
              <button type="button" onClick={() => cameraRef.current?.click()}>
                <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                </svg>
                拍照
              </button>
            </div>
          ) : (
            <>
              <div className="photo-preview">
                <img src={preview} alt="预览" />
              </div>
              <button type="button" style={{
                background: 'transparent', border: 'none', color: 'var(--text-3)',
                cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start', padding: 0,
              }} onClick={() => {
                URL.revokeObjectURL(preview);
                setPreview('');
                setFile(null);
              }}>
                重新选图
              </button>
            </>
          )}
          <textarea
            className="add-photo-caption-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="在这里写几个字…（可留空）"
            rows={2}
          />
          <button
            type="button"
            className="add-photo-submit"
            disabled={!file || uploading}
            onClick={handleSubmit}
          >
            {uploading ? '处理中…' : '加入照片墙'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PhotoLightbox({
  photo,
  onClose,
  onUpdate,
  onDelete,
}: {
  photo: PhotoEntry;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<PhotoEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const [caption, setCaption] = useState(photo.caption);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleSaveCaption = useCallback(() => {
    onUpdate(photo.id, { caption: caption.trim() });
    setEditing(false);
  }, [photo.id, caption, onUpdate]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = photo.imageData;
    a.download = `lunartide-photo-${photo.id.slice(0, 8)}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [photo]);

  const handleDelete = useCallback(() => {
    onDelete(photo.id);
    onClose();
  }, [photo.id, onDelete, onClose]);

  return createPortal(
    <div className="lightbox-overlay" onClick={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="关闭">
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
      </button>

      <div className="lightbox-polaroid" onClick={(e) => e.stopPropagation()}>
        <div className={`polaroid-img-area ${photo.aspectRatio}`}>
          <img src={photo.imageData} alt={photo.caption || ''} className="loaded" />
        </div>
        <div className="polaroid-bottom">
          {editing ? (
            <input
              className="lightbox-caption-input"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={handleSaveCaption}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCaption(); }}
              autoFocus
            />
          ) : (
            <span
              className="lightbox-caption-input"
              onClick={() => setEditing(true)}
              style={{ cursor: 'text' }}
            >
              {caption || ' '}
            </span>
          )}
        </div>
      </div>

      <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setEditing(true)}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          编辑说明
        </button>
        <button type="button" onClick={handleDownload}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          储存
        </button>
        <button type="button" className="danger" onClick={() => setShowDelete(true)}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3,6 5,6 21,6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          删除
        </button>
      </div>

      {showDelete && (
        <div className="lightbox-delete-dialog" onClick={(e) => { e.stopPropagation(); setShowDelete(false); }}>
          <div onClick={(e) => e.stopPropagation()}>
            <h3>删除这张照片？</h3>
            <p>删除后无法复原。</p>
            <div className="lightbox-delete-dialog-buttons">
              <button type="button" className="cancel" onClick={() => setShowDelete(false)}>取消</button>
              <button type="button" className="confirm" onClick={handleDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function useLazyImages(containerRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.onload = () => img.classList.add('loaded');
            observer.unobserve(img);
          }
        }
      }
    }, { rootMargin: '200px' });

    const imgs = container.querySelectorAll<HTMLImageElement>('img[data-src]');
    imgs.forEach((img) => observer.observe(img));

    return () => observer.disconnect();
  }, [enabled, containerRef]);
}

export function HomePhotoWall() {
  const photoEntries = usePhotoWallStore((s) => s.photoEntries);
  const addPhotoEntry = usePhotoWallStore((s) => s.addPhotoEntry);
  const updatePhotoEntry = usePhotoWallStore((s) => s.updatePhotoEntry);
  const layoutByPhotoId = usePhotoWallStore((s) => s.layoutByPhotoId);
  const commitPhotoLayout = usePhotoWallStore((s) => s.commitPhotoLayout);
  const showToast = useToastStore((s) => s.showToast);

  const [showSheet, setShowSheet] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoEntry | null>(null);
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  const [runtimeLayouts, setRuntimeLayouts] = useState<Record<string, PhotoWallLayout>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ photoId: string; pointerId: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const runtimeLayoutsRef = useRef<Record<string, PhotoWallLayout>>({});
  const touchCandidate = useRef<{ photoId: string; pointerId: number; pointerType: string; x: number; y: number; target: HTMLElement; timer: number } | null>(null);
  const suppressClick = useRef<string | null>(null);

  const useLazy = photoEntries.length > 20;
  useLazyImages(wallRef, useLazy);

  const sorted = useMemo(() =>
    [...photoEntries].sort((a, b) => b.createdAt - a.createdAt),
    [photoEntries],
  );

  const handleAdd = useCallback((photo: {
    imageData: string;
    caption: string;
    aspectRatio: PhotoEntry['aspectRatio'];
  }) => {
    const id = addPhotoEntry({
      imageData: photo.imageData,
      caption: photo.caption,
      date: toLocalDateString(Date.now()),
      time: toLocalTimeString(Date.now()),
      rotation: Math.round((Math.random() * 12 - 6) * 10) / 10,
      offsetX: Math.round((Math.random() * 20 - 10) * 10) / 10,
      offsetY: Math.round((Math.random() * 20 - 8) * 10) / 10,
      pinColor: pickRandom(PIN_COLORS),
      aspectRatio: photo.aspectRatio,
    });
    setEnteringIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 500);
    showToast('照片已加入');

    const usedKB = getPhotoEntriesSize() / 1024;
    if (usedKB > 4000) {
      setTimeout(() => showToast(`照片墙已使用 ${Math.round(usedKB / 1024)}MB，建议清理旧照片`), 1000);
    }
  }, [addPhotoEntry, showToast]);

  const handleDelete = useCallback((photoId: string) => {
    usePhotoWallStore.getState().deletePhotoEntry(photoId);
  }, []);

  const beginDrag = useCallback((photoId: string, pointerId: number, clientX: number, clientY: number, target: HTMLElement) => {
    const board = wallRef.current?.getBoundingClientRect();
    const item = target.getBoundingClientRect();
    if (!board) return;
    const current = runtimeLayouts[photoId] || layoutByPhotoId[photoId];
    const maxZ = Math.max(0, ...Object.values({ ...layoutByPhotoId, ...runtimeLayouts }).map((layout) => layout.zOrder));
    const lifted = { ...current, zOrder: maxZ + 1 };
    runtimeLayoutsRef.current = { ...runtimeLayoutsRef.current, [photoId]: lifted };
    setRuntimeLayouts(runtimeLayoutsRef.current);
    dragRef.current = { photoId, pointerId, offsetX: clientX - item.left, offsetY: clientY - item.top, moved: false };
    setDraggingId(photoId);
    try { target.setPointerCapture?.(pointerId); } catch { /* synthetic pointer tests and released touch streams */ }
  }, [layoutByPhotoId, runtimeLayouts]);

  const onPhotoPointerDown = useCallback((event: React.PointerEvent<HTMLElement>, photoId: string) => {
    if (event.button !== 0) return;
    const target = event.currentTarget;
    if (event.pointerType === 'touch') {
      const timer = window.setTimeout(() => {
        const candidate = touchCandidate.current;
        if (!candidate || candidate.photoId !== photoId) return;
        beginDrag(photoId, candidate.pointerId, candidate.x, candidate.y, candidate.target);
        touchCandidate.current = null;
      }, 400);
      touchCandidate.current = { photoId, pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, target, timer };
      return;
    }
    try { target.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointer tests */ }
    touchCandidate.current = { photoId, pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, target, timer: 0 };
  }, [beginDrag]);

  const onPhotoPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const candidate = touchCandidate.current;
    if (candidate) {
      const distance = Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y);
      if (candidate.pointerType !== 'touch' && distance > 3) {
        beginDrag(candidate.photoId, candidate.pointerId, candidate.x, candidate.y, candidate.target);
        touchCandidate.current = null;
      } else if (candidate.pointerType === 'touch' && distance > 8) {
        window.clearTimeout(candidate.timer);
        touchCandidate.current = null;
      }
    }
    const drag = dragRef.current;
    const boardEl = wallRef.current;
    if (!drag || !boardEl || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const board = boardEl.getBoundingClientRect();
    const item = event.currentTarget.getBoundingClientRect();
    const travelX = Math.max(1, board.width - item.width);
    const travelY = Math.max(1, board.height - item.height);
    const left = Math.max(0, Math.min(travelX, event.clientX - board.left - drag.offsetX));
    const top = Math.max(0, Math.min(travelY, event.clientY - board.top - drag.offsetY));
    if (Math.hypot(event.movementX, event.movementY) > 1) drag.moved = true;
    const next = { ...(runtimeLayoutsRef.current[drag.photoId] || layoutByPhotoId[drag.photoId]), x: left / travelX, y: top / travelY };
    runtimeLayoutsRef.current = { ...runtimeLayoutsRef.current, [drag.photoId]: next };
    setRuntimeLayouts(runtimeLayoutsRef.current);
  }, [layoutByPhotoId]);

  const finishPhotoPointer = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const candidate = touchCandidate.current;
    if (candidate) { window.clearTimeout(candidate.timer); touchCandidate.current = null; }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const finalLayout = runtimeLayoutsRef.current[drag.photoId] || layoutByPhotoId[drag.photoId];
    if (drag.moved) suppressClick.current = drag.photoId;
    commitPhotoLayout(finalLayout);
    dragRef.current = null;
    setDraggingId(null);
  }, [commitPhotoLayout, layoutByPhotoId]);

  const moveByKeyboard = useCallback((event: React.KeyboardEvent<HTMLElement>, photoId: string) => {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const current = runtimeLayouts[photoId] || layoutByPhotoId[photoId];
    const step = event.shiftKey ? .08 : .02;
    const next = { ...current, x: Math.max(0, Math.min(1, current.x + direction[0] * step)), y: Math.max(0, Math.min(1, current.y + direction[1] * step)) };
    runtimeLayoutsRef.current = { ...runtimeLayoutsRef.current, [photoId]: next };
    setRuntimeLayouts(runtimeLayoutsRef.current);
    commitPhotoLayout(next);
  }, [commitPhotoLayout, layoutByPhotoId, runtimeLayouts]);

  const boardHeight = Math.max(620, 420 + Math.ceil(sorted.length / 4) * 220);

  if (sorted.length === 0) {
    return (
      <div className="home-photo-wall-section">
        <div className="home-photo-wall-header">
          <h2>照片牆</h2>
        </div>
        <div className="photo-wall-bg">
          <div className="photo-wall-empty">
            <div className="photo-wall-empty-icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="4" y="4" width="40" height="40" rx="4" />
                <circle cx="16" cy="16" r="5" />
                <path d="m44 32-12-12L6 44" />
              </svg>
            </div>
            <h2>还没有照片</h2>
            <p>把今天看见的瞬间留在这里</p>
            <button type="button" onClick={() => setShowSheet(true)}>+ 新增第一张</button>
          </div>
          {showSheet && <AddPhotoSheet onClose={() => setShowSheet(false)} onAdd={handleAdd} />}
          <button type="button" className="photo-fab" onClick={() => setShowSheet(true)} aria-label="新增照片" data-pet-safe-region="interactive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M12 16V6" /><path d="M7 11h10" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-photo-wall-section">
      <div className="home-photo-wall-header">
        <h2>照片牆</h2>
        <button type="button" className="home-photo-wall-add" onClick={() => setShowSheet(true)} aria-label="新增照片" data-pet-safe-region="interactive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
        </button>
      </div>
      <div className="photo-wall-bg">
        <div className="photo-wall" ref={wallRef} style={{ height: boardHeight }}>
          {sorted.map((photo) => {
            const isEntering = enteringIds.has(photo.id);
            const layout = runtimeLayouts[photo.id] || layoutByPhotoId[photo.id];
            if (!layout) return null;
            return (
              <div
                key={photo.id}
                className={`polaroid-wrap${isEntering ? ' entering' : ''}${draggingId === photo.id ? ' is-dragging' : ''}`}
                data-photo-id={photo.id}
                tabIndex={0}
                role="button"
                aria-label={`照片：${photo.caption || photo.id}，可移動`}
                onPointerDown={(event) => onPhotoPointerDown(event, photo.id)}
                onPointerMove={onPhotoPointerMove}
                onPointerUp={finishPhotoPointer}
                onPointerCancel={finishPhotoPointer}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setLightboxPhoto(photo);
                  else moveByKeyboard(event, photo.id);
                }}
                style={{
                  '--rotation': `${layout.rotation}deg`,
                  '--pin-color': photo.pinColor,
                  left: `${layout.x * 100}%`,
                  top: `${layout.y * 100}%`,
                  '--anchor-x': `${layout.x * -100}%`,
                  '--anchor-y': `${layout.y * -100}%`,
                  zIndex: layout.zOrder,
                } as React.CSSProperties}
              >
                <div
                  className="polaroid"
                  onClick={() => {
                    if (suppressClick.current === photo.id) { suppressClick.current = null; return; }
                    setLightboxPhoto(photo);
                  }}
                >
                  <div className="pin">
                    <div className="pin-cap" />
                    <div className="pin-needle" />
                  </div>
                  <div className={`polaroid-img-area ${photo.aspectRatio}`}>
                    {useLazy ? (
                      <img data-src={photo.imageData} alt={photo.caption || ''} />
                    ) : (
                      <img src={photo.imageData} alt={photo.caption || ''} className="loaded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                  </div>
                  <div className="polaroid-bottom">
                    <span className="polaroid-caption">{photo.caption || ' '}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="photo-fab" onClick={() => setShowSheet(true)} aria-label="新增照片" data-pet-safe-region="interactive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
        </button>

        {showSheet && <AddPhotoSheet onClose={() => setShowSheet(false)} onAdd={handleAdd} />}
        {lightboxPhoto && (
          <PhotoLightbox
            photo={lightboxPhoto}
            onClose={() => setLightboxPhoto(null)}
            onUpdate={updatePhotoEntry}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
