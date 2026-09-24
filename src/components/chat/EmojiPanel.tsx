import { useState, useRef, useEffect, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { saveAsset, getAsset, deleteAsset } from '@/store/assets';
import { t } from '@/i18n';
import type { StickerPack, StickerPackItem } from '@/types';
import { LUNARIS_STICKER_POOL, type StickerPoolItem } from '@/ai/stickerEngine';

type TabId = 'user' | 'lunaris';

interface EmojiPanelProps {
  onSelectSticker?: (url: string, name?: string) => void;
}

/* ── Shared sticker grid ── */
function StickerGrid({ items, onTap, showDelete, onDelete, showAddTile, onAddTileClick }: {
  items: StickerPackItem[];
  onTap: (item: StickerPackItem) => void;
  showDelete?: boolean;
  onDelete?: (id: string) => void;
  showAddTile?: boolean;
  onAddTileClick?: () => void;
}) {
  return (
    <div className="sticker-grid">
      {items.map((item) => (
        <div key={item.id} className="sticker-item" data-sticker-id={item.id}>
          <img
            src={item.url}
            alt={item.name}
            className="sticker-img"
            onClick={() => onTap(item)}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {showDelete && (
            <button type="button" className="sticker-remove" onClick={() => onDelete?.(item.id)} aria-label={t('sticker.remove')}>
              ×
            </button>
          )}
        </div>
      ))}
      {showAddTile && onAddTileClick && (
        <button type="button" className="sticker-add-tile" onClick={onAddTileClick} aria-label={t('sticker.addTile')}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M8 2v12M2 8h12" />
          </svg>
          <span className="sticker-add-tile-label">{t('sticker.addTile')}</span>
        </button>
      )}
    </div>
  );
}

/* ── Pack section ── */
function PackSection({ pack, onTap, showDelete, onDeleteItem, onDeletePack, showAddTile, onAddSticker }: {
  pack: StickerPack;
  onTap: (item: StickerPackItem) => void;
  showDelete?: boolean;
  onDeleteItem?: (id: string) => void;
  onDeletePack?: () => void;
  showAddTile?: boolean;
  onAddSticker?: () => void;
}) {
  return (
    <div className="pack-section" data-pack-id={pack.id}>
      <div className="pack-header">
        <span className="pack-name">{pack.name}</span>
        {showDelete && onDeletePack && (
          <button type="button" className="pack-delete-btn" onClick={onDeletePack} aria-label={t('sticker.packDelete')}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5M14 7v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 14V7" />
            </svg>
          </button>
        )}
      </div>
      <StickerGrid
        items={pack.stickers}
        onTap={onTap}
        showDelete={showDelete}
        onDelete={onDeleteItem}
        showAddTile={showAddTile}
        onAddTileClick={onAddSticker}
      />
    </div>
  );
}

/* ── Create Pack Modal ── */
function CreatePackModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (packId: string) => void;
}) {
  const createStickerPack = useAppStore((s) => s.createStickerPack);
  const addStickerToPack = useAppStore((s) => s.addStickerToPack);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [packName, setPackName] = useState('');
  const [owner, setOwner] = useState<'user' | 'lunaris'>('user');
  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    const name = packName.trim();
    if (!name) { setError(t('sticker.packName') + ' 不能為空'); return; }
    setCreating(true);
    setError('');

    try {
      const packId = createStickerPack(name, owner);

      for (const file of files) {
        const assetId = await saveAsset(file, file.type || 'image/png');
        const blobUrl = URL.createObjectURL(file);
        const fileType = file.type === 'image/gif' ? 'gif' : 'image';
        addStickerToPack(packId, file.name.replace(/\.[^.]+$/, ''), blobUrl, assetId, fileType);
      }

      onCreated(packId);
    } catch {
      setError(t('sticker.loadFail'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="create-pack-modal">
      <div className="create-pack-form">
        <div className="create-pack-title">{t('sticker.createPack')}</div>

        <input
          className="form-input-sm"
          type="text"
          placeholder={t('sticker.packName')}
          value={packName}
          onChange={(e) => { setPackName(e.target.value); setError(''); }}
          autoFocus
        />

        <div className="create-pack-owner">
          <span className="create-pack-label">{t('sticker.packOwner')}</span>
          <div className="owner-toggle">
            <button
              type="button"
              className={`owner-btn ${owner === 'user' ? 'active' : ''}`}
              onClick={() => setOwner('user')}
            >
              {t('sticker.packUser')}
            </button>
            <button
              type="button"
              className={`owner-btn ${owner === 'lunaris' ? 'active' : ''}`}
              onClick={() => setOwner('lunaris')}
            >
              {t('sticker.packLunaris')}
            </button>
          </div>
        </div>

        <button type="button" className="create-pack-upload" onClick={() => fileInputRef.current?.click()}>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M10 3v14M3 10h14" />
            <rect x="2" y="2" width="16" height="16" rx="3" />
          </svg>
          {t('sticker.addMultiple')}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} aria-hidden="true" />

        {files.length > 0 && (
          <div className="create-pack-file-list">
            {files.map((f, i) => (
              <div key={i} className="create-pack-file-item">
                <span className="create-pack-file-name">{f.name}</span>
                <button type="button" className="create-pack-file-remove" onClick={() => removeFile(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        {error && <span className="sticker-error">{error}</span>}

        <div className="create-pack-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={creating} style={{ flex: 1 }}>
            {t('sheet.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating} style={{ flex: 1 }}>
            {creating ? '...' : t('sticker.create')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sticker Upload Modal (drag & drop + file picker) ── */
function StickerUploadModal({ packId, onClose, onUploaded }: {
  packId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const addStickerToPack = useAppStore((s) => s.addStickerToPack);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('僅支援圖片檔案');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const assetId = await saveAsset(file, file.type);
      const blobUrl = URL.createObjectURL(file);
      const fileType = file.type === 'image/gif' ? 'gif' : 'image';
      addStickerToPack(packId, file.name.replace(/\.[^.]+$/, ''), blobUrl, assetId, fileType);
      onUploaded();
    } catch {
      setError(t('sticker.loadFail'));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="create-pack-modal">
      <div className="create-pack-form">
        <div className="create-pack-title">{t('sticker.uploadTitle')}</div>

        <div
          className={`sticker-upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          {uploading ? (
            <span className="sticker-upload-status">{t('sticker.uploading')}</span>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="sticker-upload-hint">{t('sticker.uploadHint')}</span>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFilePick} aria-hidden="true" />

        {error && <span className="sticker-error">{error}</span>}

        <div className="create-pack-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={uploading} style={{ flex: 1 }}>
            {t('sheet.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main EmojiPanel ── */
export function EmojiPanel({ onSelectSticker }: EmojiPanelProps) {
  const customStickers = useAppStore((s) => s.customStickers || []);
  const stickerPacks = useAppStore((s) => s.stickerPacks || []);
  const createStickerPack = useAppStore((s) => s.createStickerPack);
  const addStickerToPack = useAppStore((s) => s.addStickerToPack);
  const deleteStickerFromPack = useAppStore((s) => s.deleteStickerFromPack);
  const deleteStickerPack = useAppStore((s) => s.deleteStickerPack);

  const [tab, setTab] = useState<TabId>('user');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploadTargetPackId, setUploadTargetPackId] = useState<string | null>(null);
  const [resolvedPacks, setResolvedPacks] = useState<StickerPack[]>([]);
  const migratedRef = useRef(false);

  /* ── One-time migration from customStickers ── */
  useEffect(() => {
    if (migratedRef.current) return;
    const userPacks = stickerPacks.filter((p) => p.owner === 'user');
    if (customStickers.length > 0 && userPacks.length === 0) {
      const packId = createStickerPack('我的貼圖', 'user');
      for (const st of customStickers) {
        addStickerToPack(packId, st.name, st.url, st.assetId);
      }
    }
    migratedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Resolve blob URLs from IndexedDB ── */
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const resolved = await Promise.all(
        stickerPacks.map(async (pack) => ({
          ...pack,
          stickers: await Promise.all(
            pack.stickers.map(async (st) => {
              if (st.assetId && (!st.url || st.url.startsWith('blob:'))) {
                try {
                  const blob = await getAsset(st.assetId);
                  if (blob) return { ...st, url: URL.createObjectURL(blob) };
                } catch {}
              }
              return st;
            }),
          ),
        })),
      );
      if (!cancelled) setResolvedPacks(resolved);
    };
    resolve();
    return () => { cancelled = true; };
  }, [stickerPacks]);

  const userPacks = resolvedPacks.filter((p) => p.owner === 'user');
  const lunarisPacks = resolvedPacks.filter((p) => p.owner === 'lunaris');

  const lunarisBuiltinItems: StickerPackItem[] = LUNARIS_STICKER_POOL.map((s: StickerPoolItem) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    tags: s.tags,
    createdAt: 0,
  }));

  const handleStickerTap = useCallback((item: StickerPackItem) => {
    onSelectSticker?.(item.url, item.name);
  }, [onSelectSticker]);

  const handleDeleteItem = useCallback((packId: string, itemId: string) => {
    const pack = resolvedPacks.find((p) => p.id === packId);
    const item = pack?.stickers.find((st) => st.id === itemId);
    if (item?.assetId) deleteAsset(item.assetId).catch(() => {});
    deleteStickerFromPack(packId, itemId);
  }, [resolvedPacks, deleteStickerFromPack]);

  const handleDeletePack = useCallback((packId: string) => {
    deleteStickerPack(packId);
  }, [deleteStickerPack]);

  const handlePackCreated = useCallback((_packId: string) => {
    setShowCreateModal(false);
  }, []);

  const handleUploaded = useCallback(() => {
    setUploadTargetPackId(null);
  }, []);

  return (
    <div className="emoji-panel">
      {/* ── Tab bar ── */}
      <div className="emoji-tabs">
        <button type="button" className={`emoji-tab ${tab === 'user' ? 'active' : ''}`} onClick={() => setTab('user')}>
          我的表情
        </button>
        <button type="button" className={`emoji-tab ${tab === 'lunaris' ? 'active' : ''}`} onClick={() => setTab('lunaris')}>
          LUNARIS 可用表达
        </button>
      </div>

      <div className="emoji-panel-scroll">
        {/* ── User packs ── */}
        {tab === 'user' && (
          <div className="emoji-user-tab">
            <div className="emoji-user-actions">
              <button type="button" className="sticker-pack-create-btn" onClick={() => setShowCreateModal(true)}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M8 2v12M2 8h12" />
                </svg>
                {t('sticker.createPack')}
              </button>
            </div>
            {userPacks.length === 0 ? (
              <div className="sticker-empty">{t('sticker.empty')}</div>
            ) : (
              userPacks.map((pack) => (
                <PackSection
                  key={pack.id}
                  pack={pack}
                  onTap={handleStickerTap}
                  showDelete
                  onDeleteItem={(id) => handleDeleteItem(pack.id, id)}
                  onDeletePack={() => handleDeletePack(pack.id)}
                  showAddTile
                  onAddSticker={() => setUploadTargetPackId(pack.id)}
                />
              ))
            )}
          </div>
        )}

        {/* ── LUNARIS 可用表达 ── */}
        {tab === 'lunaris' && (
          <div className="emoji-lunaris-tab">
            <PackSection
              pack={{
                id: 'lunaris-builtin',
                name: 'LUNARIS',
                owner: 'lunaris',
                stickers: lunarisBuiltinItems,
                createdAt: 0,
              }}
              onTap={handleStickerTap}
            />
            {lunarisPacks.map((pack) => (
              <PackSection
                key={pack.id}
                pack={pack}
                onTap={handleStickerTap}
                showDelete
                onDeleteItem={(id) => handleDeleteItem(pack.id, id)}
                onDeletePack={() => handleDeletePack(pack.id)}
                showAddTile
                onAddSticker={() => setUploadTargetPackId(pack.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create Pack Modal (overlay) ── */}
      {showCreateModal && (
        <CreatePackModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handlePackCreated}
        />
      )}

      {/* ── Sticker Upload Modal (overlay) ── */}
      {uploadTargetPackId && (
        <StickerUploadModal
          packId={uploadTargetPackId}
          onClose={() => setUploadTargetPackId(null)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
