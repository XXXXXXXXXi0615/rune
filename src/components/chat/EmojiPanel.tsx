import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { saveAsset, getAsset } from '@/store/assets';
import { t } from '@/i18n';
import type { CustomSticker } from '@/types';

interface EmojiPanelProps {
  onSelect: (emoji: string) => void;
  onSelectSticker?: (url: string, name?: string) => void;
}

function isValidUrl(s: string) {
  return /^https?:\/\/.+/.test(s.trim());
}

export function EmojiPanel({ onSelect: _onSelect, onSelectSticker }: EmojiPanelProps) {
  const customStickers = useAppStore((s) => s.customStickers || []);
  const addSticker = useAppStore((s) => s.addSticker);
  const deleteSticker = useAppStore((s) => s.deleteSticker);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL form state
  const [urlOpen, setUrlOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [previewFail, setPreviewFail] = useState(false);

  // Restore blob URLs for asset-based stickers on mount
  const [resolvedStickers, setResolvedStickers] = useState<CustomSticker[]>(customStickers);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const resolved = await Promise.all(
        customStickers.map(async (sticker) => {
          if (sticker.assetId && (!sticker.url || sticker.url.startsWith('blob:'))) {
            // Recreate blob URL from IndexedDB (might be stale after reload)
            try {
              const blob = await getAsset(sticker.assetId);
              if (blob) {
                const freshUrl = URL.createObjectURL(blob);
                // Don't revoke old — it may still be in use
                return { ...sticker, url: freshUrl };
              }
            } catch {
              // asset gone — keep existing URL (may be old blob url)
            }
          }
          return sticker;
        }),
      );
      if (!cancelled) setResolvedStickers(resolved);
    };
    resolve();
    return () => { cancelled = true; };
  }, [customStickers]);

  // File upload handler
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Reset input so re-selecting the same file triggers onChange again
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const assetId = await saveAsset(file, file.type || 'image/png');
      const blobUrl = URL.createObjectURL(file);
      addSticker(file.name.replace(/\.[^.]+$/, ''), blobUrl, assetId);
    } catch {
      setError(t('sticker.loadFail'));
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // URL form handlers
  const handleUrlAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) { setError(t('sticker.urlInvalid')); return; }
    if (!isValidUrl(trimmed)) { setError(t('sticker.urlInvalid')); return; }
    if (trimmed.length > 2000) { setError(t('sticker.urlInvalid')); return; }
    if (previewFail) { setError(t('sticker.previewFail')); return; }
    addSticker(name, trimmed);
    setName(''); setUrl(''); setError(''); setPreviewFail(false); setUrlOpen(false);
  };

  const handleUrlBlur = () => {
    setPreviewFail(false);
    if (url.trim() && isValidUrl(url.trim())) {
      const img = new Image();
      img.onload = () => setPreviewFail(false);
      img.onerror = () => setPreviewFail(true);
      img.src = url.trim();
    }
  };

  return (
    <div className="emoji-panel">
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />

      <div className="emoji-panel-header">
        <span className="emoji-panel-title">{t('sticker.title')}</span>
      </div>

      {/* Primary: file upload button */}
      <button type="button" className="sticker-add-btn" onClick={openFilePicker}>
        + {t('sticker.add')}
      </button>

      {/* Secondary: URL link */}
      {!urlOpen ? (
        <button
          type="button"
          className="sticker-url-link"
          onClick={() => setUrlOpen(true)}
        >
          {t('sticker.fromUrl')}
        </button>
      ) : (
        <form className="sticker-add-form" onSubmit={handleUrlAdd}>
          <input
            className="form-input-sm"
            type="text"
            placeholder={t('sticker.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="form-input-sm"
            type="text"
            placeholder={t('sticker.urlPlaceholder')}
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            onBlur={handleUrlBlur}
          />
          {url.trim() && isValidUrl(url.trim()) && !previewFail && (
            <img
              src={url.trim()}
              alt="preview"
              className="sticker-preview"
              onError={() => setPreviewFail(true)}
              style={{ maxHeight: 80, objectFit: 'contain', borderRadius: 8 }}
            />
          )}
          {previewFail && <span className="sticker-error">{t('sticker.previewFail')}</span>}
          {error && <span className="sticker-error">{error}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setUrlOpen(false); setError(''); setUrl(''); setName(''); setPreviewFail(false); }}
              style={{ flex: 1 }}
            >
              {t('sheet.cancel')}
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              {t('sheet.save')}
            </button>
          </div>
        </form>
      )}

      {error && !urlOpen && <span className="sticker-error">{error}</span>}

      {/* Sticker grid */}
      {resolvedStickers.length === 0 ? (
        <div className="sticker-empty">{t('sticker.empty')}</div>
      ) : (
        <div className="sticker-grid">
          {resolvedStickers.map((s) => (
            <div key={s.id} className="sticker-item">
              <img
                src={s.url}
                alt={s.name || 'sticker'}
                className="sticker-img"
                onClick={() => onSelectSticker?.(s.url, s.name)}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <button
                type="button"
                className="sticker-remove"
                onClick={() => deleteSticker(s.id)}
                aria-label={t('sticker.remove')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
