/**
 * GachaCollectionWindow — Pixel Room gacha collection viewer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { type GachaCollectionItem, readCollection } from '@/pages/GachaMachineWindow';
import './GachaCollectionWindow.css';

type Rarity = GachaCollectionItem['rarity'];

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#a0b8c8',
  uncommon: '#6fcf97',
  rare: '#e8a55a',
  legendary: '#d4a0ff',
};

const RARITY_LABELS: Record<Rarity, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  legendary: '傳說',
};

const DISPLAY_KEY = 'gacha_display_v1';
const MAX_DISPLAY = 5;

function readDisplay(): string[] {
  try { return JSON.parse(localStorage.getItem(DISPLAY_KEY) || '[]'); } catch { return []; }
}
function saveDisplay(ids: string[]) { localStorage.setItem(DISPLAY_KEY, JSON.stringify(ids)); }

interface GachaCollectionWindowProps {
  open: boolean;
  onClose: () => void;
}

export function GachaCollectionWindow({ open, onClose }: GachaCollectionWindowProps) {
  const [filter, setFilter] = useState<'all' | Rarity>('all');
  const [items, setItems] = useState<GachaCollectionItem[]>(readCollection);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [displayIds, setDisplayIds] = useState<string[]>(readDisplay);

  useEffect(() => {
    if (open) { setItems(readCollection()); setDisplayIds(readDisplay()); setSelectedId(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleToggleDisplay = useCallback((itemId: string) => {
    setDisplayIds(prev => {
      const next = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : prev.length < MAX_DISPLAY ? [...prev, itemId] : prev;
      saveDisplay(next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.rarity === filter);
  }, [items, filter]);

  const totalOwned = useMemo(() => items.reduce((s, i) => s + i.ownedCount, 0), [items]);
  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);
  const isDisplayed = (id: string) => displayIds.includes(id);

  if (!open) return null;

  return createPortal(
    <div className="gcw-backdrop" onClick={onClose}>
      <div className="gcw-window" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="扭蛋收藏">
        <div className="gcw-header">
          <div>
            <span className="gcw-title">扭蛋收藏</span>
            <span className="gcw-count">{items.length} 種 · 共 {totalOwned} 次</span>
          </div>
          <button type="button" className="gcw-close" onClick={onClose} aria-label="關閉">×</button>
        </div>

        <div className="gcw-filters">
          {(['all', 'common', 'uncommon', 'rare', 'legendary'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`gcw-chip${filter === f ? ' gcw-chip--active' : ''}${f !== 'all' ? ` gcw-chip--${f}` : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : RARITY_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="gcw-body">
          {items.length === 0 ? (
            <div className="gcw-empty">還沒有收藏。去扭蛋機試試看。</div>
          ) : filtered.length === 0 ? (
            <div className="gcw-empty">這個分類還沒有收藏。</div>
          ) : (
            <div className="gcw-grid">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`gcw-card gcw-card--${item.rarity}${selectedId === item.id ? ' gcw-card--selected' : ''}`}
                  onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                >
                  {isDisplayed(item.id) && <span className="gcw-card-badge">展示中</span>}
                  <div className="gcw-card-rarity" style={{ color: RARITY_COLORS[item.rarity] }}>
                    {RARITY_LABELS[item.rarity]}
                  </div>
                  <div className="gcw-card-name">{item.name}</div>
                  {item.description && <div className="gcw-card-desc">{item.description}</div>}
                  <div className="gcw-card-meta">
                    <span className="gcw-card-count">{item.ownedCount > 1 && `x${item.ownedCount}`}</span>
                    <span className="gcw-card-date">{new Date(item.acquiredAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className={`gcw-detail gcw-detail--${selected.rarity}`}>
            <div className="gcw-detail-header">
              <div>
                <div className="gcw-detail-rarity" style={{ color: RARITY_COLORS[selected.rarity] }}>
                  {RARITY_LABELS[selected.rarity]}
                </div>
                <div className="gcw-detail-name">{selected.name}</div>
              </div>
              <button type="button" className="gcw-close" onClick={() => setSelectedId(null)} aria-label="關閉詳情">×</button>
            </div>
            {selected.description && (
              <div className="gcw-detail-desc">{selected.description}</div>
            )}
            <div className="gcw-detail-meta">
              <span>獲得次數：{selected.ownedCount}</span>
              <span>首次獲得：{new Date(selected.acquiredAt).toLocaleDateString()}</span>
            </div>
            <button
              type="button"
              className={`gcw-detail-btn${isDisplayed(selected.id) ? ' gcw-detail-btn--active' : ''}`}
              onClick={() => handleToggleDisplay(selected.id)}
            >
              {isDisplayed(selected.id) ? '取消展示' : displayIds.length >= MAX_DISPLAY ? `展示已滿（最多 ${MAX_DISPLAY}）` : '設為展示'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
