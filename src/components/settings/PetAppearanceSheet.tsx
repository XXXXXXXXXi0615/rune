import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';

const SIZE_LS_KEY = 'lunartide_clawd_size_v1';
const DEFAULT_SIZE = 100;
const MIN_SIZE = 25;
const MAX_SIZE = 150;

function loadSize(): number {
  try { const r = localStorage.getItem(SIZE_LS_KEY); if (r) { const n = parseInt(r, 10); if (n >= MIN_SIZE && n <= MAX_SIZE) return n; } } catch {}
  return DEFAULT_SIZE;
}
function saveSize(s: number) { try { localStorage.setItem(SIZE_LS_KEY, String(s)); } catch {} }
// Sync size across tabs
function dispatchSizeChange(s: number) { saveSize(s); window.dispatchEvent(new CustomEvent('clawd:sizeChange', { detail: s })); }

/* ── Clawd SVG ── */
export function ClawdIcon({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"
      style={{ color: 'var(--accent, #d4773c)', filter: 'drop-shadow(0 2px 8px rgba(212,119,60,0.25))' }}>
      <title>Clawd</title>
      <path d="M4.5 6h15v5H22v2h-2.5v3h-1v2H17v-2h-1v2h-1.5v-2h-5v2H8v-2H7v2H5.5v-2h-1v-3H2v-2h2.5ZM7 8v3h1V8Zm9 0v3h1V8Z" />
    </svg>
  );
}

interface Props { isOpen: boolean; onClose: () => void; }

export function PetAppearanceSheet({ isOpen, onClose }: Props) {
  const petWidget = useAppStore((s) => s.petWidget);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [visible, setVisible] = useState(petWidget?.visible !== false);
  const [size, setSize] = useState(loadSize);

  useEffect(() => {
    if (!isOpen) return;
    setSize(loadSize());
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSizeChange = (value: number) => {
    setSize(value);
    dispatchSizeChange(value);
  };

  const handleSave = () => {
    dispatchSizeChange(size);
    updateSettings({
      petWidget: {
        ...petWidget,
        visible,
        currentMood: petWidget?.currentMood || 'idle',
        moodImages: petWidget?.moodImages || {},
      },
    });
    onClose();
  };

  return createPortal(
    <div className="quick-sheet-overlay active" onClick={onClose}>
      <div className="quick-sheet pet-appearance-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">{t('pet.appearance')}</span>
        </div>

        <div className="quick-sheet-body pet-appearance-body">
          {/* Preview */}
          <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
            <ClawdIcon size={size} />
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>Clawd</div>
          </div>

          {/* Show pet toggle */}
          <div className="liquid-row" style={{ alignItems: 'center' }}>
            <div className="liquid-row-left">
              <div className="liquid-row-text">
                <div className="liquid-row-label">{t('pet.showToggle')}</div>
              </div>
            </div>
            <div className="liquid-row-right">
              <label className="liquid-switch">
                <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
              </label>
            </div>
          </div>

          {/* Size slider */}
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>桌寵大小</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{size}%</span>
            </div>
            <input
              type="range"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={size}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              style={{
                width: '100%', height: 6, appearance: 'none',
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 100}%, var(--border) ${((size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 100}%, var(--border) 100%)`,
                borderRadius: 3, outline: 'none', cursor: 'pointer',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
              <span>{MIN_SIZE}%</span>
              <span>{MAX_SIZE}%</span>
            </div>
          </div>
        </div>

        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('sheet.cancel')}</button>
          <button type="button" className="btn-primary" onClick={handleSave}>{t('sheet.save')}</button>
        </div>
      </div>
    </div>, document.body);
}
