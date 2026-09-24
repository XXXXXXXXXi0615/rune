import { useState, useRef, useEffect, useMemo, type FormEvent, type ChangeEvent } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { saveAsset, getAsset } from '@/store/assets';
import { t } from '@/i18n';
import type { CustomSticker } from '@/types';

export type ToolDrawerView = 'grid' | 'stickers' | 'memory';

interface ToolDrawerProps {
  open: boolean;
  activeView: ToolDrawerView;
  onViewChange: (view: ToolDrawerView) => void;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker?: (url: string, name?: string) => void;
  onSelectMemory?: (text: string) => void;
}

const TOOLS = [
  {
    id: 'stickers' as const,
    labelKey: 'td.tool.emoji',
    subKey: 'td.tool.emojiSub',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.5 3.5h8.8L19.5 7.7v10.1a2.7 2.7 0 0 1-2.7 2.7H6.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
        <path d="M15.2 3.8V8h4" />
        <path d="M9 11.5h.01M15 11.5h.01" />
        <path d="M9.4 15a4.1 4.1 0 0 0 5.2 0" />
      </svg>
    ),
  },
  {
    id: 'memory' as const,
    labelKey: 'td.tool.memory',
    subKey: 'td.tool.memorySub',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 8.1 12 5l5 3.1v4.8L12 16l-5-3.1V8.1Z" />
        <path d="M4.5 11.2 12 16l7.5-4.8" />
        <path d="M4.5 15.2 12 20l7.5-4.8" />
        <path d="M17.6 4.4 18 3l.4 1.4L20 5l-1.6.6L18 7l-.4-1.4L16 5l1.6-.6Z" />
      </svg>
    ),
  },
] as const;

export function ToolDrawer({
  open,
  activeView,
  onViewChange,
  onClose,
  onSelectEmoji,
  onSelectSticker,
  onSelectMemory,
}: ToolDrawerProps) {

  const handleToolTap = (toolId: (typeof TOOLS)[number]['id']) => {
    onViewChange(toolId);
  };

  if (!open) return null;

  return (
    <div className="tool-drawer" role="dialog" aria-label={t('td.title')}>

      {activeView === 'grid' && (
        <div className="td-grid-view">
          <div className="td-header">
            <div className="td-header-text">
              <span className="td-title">{t('td.title')}</span>
              <span className="td-subtitle">{t('td.subtitle')}</span>
            </div>
          </div>

          <div className="td-tool-grid" aria-label={t('td.title')}>
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className="td-tool-card"
                onClick={() => handleToolTap(tool.id)}
                data-tool={tool.id}
              >
                <span className="td-tool-icon-wrap">
                  <span className="td-tool-icon">{tool.icon}</span>
                </span>
                <span className="td-tool-copy">
                  <span className="td-tool-label">{t(tool.labelKey)}</span>
                  <span className="td-tool-sub">{t(tool.subKey)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeView === 'stickers' && (
        <StickerChildPanel
          onBack={() => onViewChange('grid')}
          onSelectEmoji={onSelectEmoji}
          onSelectSticker={onSelectSticker}
          onClose={onClose}
        />
      )}

      {activeView === 'memory' && (
        <MemoryPickerPanel
          onBack={() => onViewChange('grid')}
          onSelectMemory={onSelectMemory}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function StickerChildPanel({
  onBack,
  onSelectEmoji: _onSelectEmoji,
  onSelectSticker,
  onClose,
}: {
  onBack: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker?: (url: string, name?: string) => void;
  onClose: () => void;
}) {
  const customStickers = useAppStore((s) => s.customStickers || []);
  const addSticker = useAppStore((s) => s.addSticker);
  const deleteSticker = useAppStore((s) => s.deleteSticker);
  const stickerFileRef = useRef<HTMLInputElement>(null);

  const [urlOpen, setUrlOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [previewFail, setPreviewFail] = useState(false);
  const [resolvedStickers, setResolvedStickers] = useState<CustomSticker[]>(customStickers);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const resolved = await Promise.all(
        customStickers.map(async (sticker) => {
          if (sticker.assetId && (!sticker.url || sticker.url.startsWith('blob:'))) {
            try {
              const blob = await getAsset(sticker.assetId);
              if (blob) return { ...sticker, url: URL.createObjectURL(blob) };
            } catch {
              // Keep the existing URL when the asset cannot be restored.
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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (stickerFileRef.current) stickerFileRef.current.value = '';
    try {
      const assetId = await saveAsset(file, file.type || 'image/png');
      addSticker(file.name.replace(/\.[^.]+$/, ''), URL.createObjectURL(file), assetId);
    } catch {
      setError(t('sticker.loadFail'));
    }
  };

  const isValidUrl = (value: string) => /^https?:\/\/.+/.test(value.trim());

  const handleUrlAdd = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || !isValidUrl(trimmed) || trimmed.length > 2000 || previewFail) {
      setError(t('sticker.urlInvalid'));
      return;
    }
    addSticker(name, trimmed);
    setName('');
    setUrl('');
    setError('');
    setPreviewFail(false);
    setUrlOpen(false);
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
    <div className="td-child-panel">
      <div className="td-child-header">
        <button type="button" className="td-back-btn" onClick={onBack}>
          <span aria-hidden="true">←</span>
          <span>{t('td.title')}</span>
        </button>
      </div>

      <input
        ref={stickerFileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />

      <button type="button" className="sticker-add-btn" onClick={() => stickerFileRef.current?.click()}>
        + {t('sticker.add')}
      </button>

      {!urlOpen ? (
        <button type="button" className="sticker-url-link" onClick={() => setUrlOpen(true)}>
          {t('sticker.fromUrl')}
        </button>
      ) : (
        <form className="sticker-add-form" onSubmit={handleUrlAdd}>
          <input className="form-input-sm" type="text" placeholder={t('sticker.name')} value={name} onChange={(event) => setName(event.target.value)} />
          <input className="form-input-sm" type="text" placeholder={t('sticker.urlPlaceholder')} value={url} onChange={(event) => { setUrl(event.target.value); setError(''); }} onBlur={handleUrlBlur} />
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
            <button type="button" className="btn-ghost" onClick={() => { setUrlOpen(false); setError(''); setUrl(''); setName(''); setPreviewFail(false); }} style={{ flex: 1 }}>{t('sheet.cancel')}</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>{t('sheet.save')}</button>
          </div>
        </form>
      )}

      {error && !urlOpen && <span className="sticker-error">{error}</span>}

      {resolvedStickers.length === 0 ? (
        <div className="sticker-empty">{t('sticker.empty')}</div>
      ) : (
        <div className="sticker-grid">
          {resolvedStickers.map((sticker) => (
            <div key={sticker.id} className="sticker-item">
              <img
                src={sticker.url}
                alt={sticker.name || 'sticker'}
                className="sticker-img"
                onClick={() => { onSelectSticker?.(sticker.url, sticker.name); onClose(); }}
                onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
              />
              <button type="button" className="sticker-remove" onClick={() => deleteSticker(sticker.id)} aria-label={t('sticker.remove')}>x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryPickerPanel({
  onBack,
  onSelectMemory,
  onClose,
}: {
  onBack: () => void;
  onSelectMemory?: (text: string) => void;
  onClose: () => void;
}) {
  const memoryEntries = useAppStore((s) => s.memoryEntries || []);
  const forumPosts = useAppStore((s) => s.forumPosts || []);
  const healthRecords = useAppStore((s) => s.healthRecords || []);

  interface MemoryItem {
    id: string;
    content: string;
    sourceLabel: string;
    createdAt: number;
  }

  const relativeTime = (ts: number): string => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '剛剛';
    if (mins < 60) return `${mins}分鐘前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小時前`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const sections = useMemo(() => {
    const forumItems: MemoryItem[] = [];
    for (const p of forumPosts) {
      if (!p.content) continue;
      forumItems.push({
        id: `forum-${p.id}`,
        content: p.content,
        sourceLabel: '記憶',
        createdAt: p.createdAt,
      });
    }
    forumItems.sort((a, b) => b.createdAt - a.createdAt);

    const memoryItems: MemoryItem[] = [];
    for (const m of memoryEntries) {
      const content = m.summary || m.bodyThoughts || m.scene;
      if (!content) continue;
      memoryItems.push({
        id: `mem-${m.id}`,
        content,
        sourceLabel: '潮痕',
        createdAt: m.createdAt,
      });
    }
    memoryItems.sort((a, b) => b.createdAt - a.createdAt);

    const moodItems: MemoryItem[] = [];
    for (const r of healthRecords) {
      if (r.type !== 'mood') continue;
      const content = r.notes || r.mood || '';
      if (!content) continue;
      moodItems.push({
        id: `mood-${r.id}`,
        content,
        sourceLabel: '今日心緒',
        createdAt: r.createdAt,
      });
    }
    moodItems.sort((a, b) => b.createdAt - a.createdAt);

    return [
      { title: '最近論壇', items: forumItems.slice(0, 5), icon: 'forum' as const },
      { title: '最近潮痕', items: memoryItems.slice(0, 5), icon: 'memory' as const },
      { title: '今日心緒', items: moodItems.slice(0, 5), icon: 'mood' as const },
    ].filter((s) => s.items.length > 0);
  }, [forumPosts, memoryEntries, healthRecords]);

  const formatCitation = (item: MemoryItem) =>
    `引用記憶：\n\n${item.content}\n\n——來自 ${item.sourceLabel}`;

  const truncate = (text: string, max = 80) =>
    text.length <= max ? text : text.slice(0, max) + '…';

  const sourceBadgeColor = (label: string) => {
    if (label === '潮痕') return '#5DB872';
    if (label === '論壇') return '#7C6FF0';
    return '#F5A623';
  };

  return (
    <div className="td-child-panel td-memory-picker">
      <div className="td-child-header">
        <button type="button" className="td-back-btn" onClick={onBack}>
          <span aria-hidden="true">←</span>
          <span>{t('td.title')}</span>
        </button>
        <span className="td-child-title">選擇記憶</span>
      </div>
      {sections.length === 0 ? (
        <div className="td-ph-content" style={{ paddingTop: 32 }}>
          <p className="td-ph-text" style={{ maxWidth: 260 }}>還沒有可引用的記憶。</p>
          <p className="td-ph-hint" style={{ textTransform: 'none', letterSpacing: 0, maxWidth: 240, lineHeight: 1.4 }}>
            先寫下今日心緒、建立論壇帖文、或留下第一條潮痕。
          </p>
        </div>
      ) : (
        <div className="td-memory-list">
          {sections.map((section) => (
            <div key={section.title} className="td-memory-section">
              <div className="td-memory-section-head">
                <SectionIcon type={section.icon} />
                <span className="td-memory-section-title">{section.title}</span>
              </div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="td-memory-item"
                  onClick={() => {
                    onSelectMemory?.(formatCitation(item));
                    onClose();
                  }}
                >
                  <span className="td-memory-item-copy">
                    <span className="td-memory-item-text">{truncate(item.content)}</span>
                    <span className="td-memory-item-meta">
                      <span
                        className="td-memory-item-source"
                        style={{
                          background: `color-mix(in srgb, ${sourceBadgeColor(item.sourceLabel)} 14%, transparent)`,
                          color: sourceBadgeColor(item.sourceLabel),
                        }}
                      >
                        {item.sourceLabel}
                      </span>
                      <span className="td-memory-item-date">{relativeTime(item.createdAt)}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionIcon({ type }: { type: 'forum' | 'memory' | 'mood' }) {
  if (type === 'forum') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7l-3 3V4a1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  if (type === 'memory') {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3L5 6v5l5 3 5-3V6l-5-3z" />
        <path d="M3.5 9.5L10 13l6.5-3.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M7 9h.01" strokeWidth="2" />
      <path d="M13 9h.01" strokeWidth="2" />
      <path d="M7.5 13a3 3 0 0 0 5 0" />
    </svg>
  );
}
