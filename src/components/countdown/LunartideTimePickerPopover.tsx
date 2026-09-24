// ================================================================
// LunartideTimePickerPopover — custom time picker popover
// Desktop only (fine pointer). Touch devices use native pickers.
// ================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  isOpen: boolean;
  value: string; // HH:mm or ''
  onSelect: (time: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

type Period = 'am' | 'pm';

function parseTime(val: string): { h24: number; m: number } | null {
  if (!/^\d{2}:\d{2}$/.test(val)) return null;
  const [h, m] = val.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h24: h, m };
}

function formatTime(h24: number, m: number): string {
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function LunartideTimePickerPopover({ isOpen, value, onSelect, onClose, anchorRef }: Props) {
  const initial = parseTime(value);
  const [use12h, setUse12h] = useState(true);
  const [h24, setH24] = useState(initial?.h24 ?? 9);
  const [m, setM] = useState(initial?.m ?? 0);
  const [period, setPeriod] = useState<Period>(() => (initial?.h24 ?? 9) < 12 ? 'am' : 'pm');
  const [activeCol, setActiveCol] = useState<'hour' | 'minute' | 'period'>('hour');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync when value changes from outside
  useEffect(() => {
    if (value) {
      const p = parseTime(value);
      if (p) {
        setH24(p.h24);
        setM(p.m);
        setPeriod(p.h24 < 12 ? 'am' : 'pm');
      }
    }
  }, [value]);

  // 24h mode auto-syncs h24 from hour/period
  const displayHour = useMemo(() => {
    if (use12h) {
      const h12 = h24 % 12;
      return h12 === 0 ? 12 : h12;
    }
    return h24;
  }, [use12h, h24]);

  // Set h24 from 12h display + period
  const set12Hour = useCallback((h12: number) => {
    if (period === 'am') {
      setH24(h12 === 12 ? 0 : h12);
    } else {
      setH24(h12 === 12 ? 12 : h12 + 12);
    }
  }, [period]);

  const commitTime = useCallback(() => {
    const t = formatTime(h24, m);
    onSelect(t);
    onClose();
  }, [h24, m, onSelect, onClose]);

  // Position
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const anchor = anchorRef.current;
    const rect = anchor.getBoundingClientRect();
    const pw = 200;
    const ph = 310;
    const gap = 8;
    let top = rect.bottom + gap;
    let left = Math.min(rect.right - pw, window.innerWidth - pw - 8);
    if (left < 8) left = Math.max(8, rect.left);
    if (top + ph > window.innerHeight - 8) {
      top = rect.top - ph - gap;
      if (top < 8) top = Math.max(8, window.innerHeight - ph - 8);
    }
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [isOpen]);

  // Click away
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [isOpen, onClose]);

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': e.preventDefault(); onClose(); break;
        case 'Enter': e.preventDefault(); commitTime(); break;
        case 'ArrowUp': e.preventDefault(); adjustActive(-1); break;
        case 'ArrowDown': e.preventDefault(); adjustActive(1); break;
        case 'ArrowLeft': e.preventDefault(); moveCol(-1); break;
        case 'ArrowRight': e.preventDefault(); moveCol(1); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, activeCol, h24, m, period, use12h]);

  const moveCol = useCallback((dir: number) => {
    const cols: Array<'hour' | 'minute' | 'period'> = use12h ? ['period', 'hour', 'minute'] : ['hour', 'minute'];
    const idx = cols.indexOf(activeCol) + dir;
    const next = Math.max(0, Math.min(cols.length - 1, idx));
    setActiveCol(cols[next]);
  }, [activeCol, use12h]);

  const adjustActive = useCallback((dir: number) => {
    if (activeCol === 'hour') {
      if (use12h) {
        const h12 = h24 % 12;
        const nh12 = ((h12 - 1 + dir + 12) % 12) + 1;
        set12Hour(nh12);
      } else {
        setH24((h24 + dir + 24) % 24);
      }
    } else if (activeCol === 'minute') {
      const idx = MINUTES.indexOf(m);
      const nidx = (idx + dir + MINUTES.length) % MINUTES.length;
      setM(MINUTES[nidx]);
    } else if (activeCol === 'period') {
      setPeriod(p => p === 'am' ? 'pm' : 'am');
    }
  }, [activeCol, h24, m, use12h, period]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="cde-time-popover"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-modal="false"
      aria-label="選擇時間"
    >
      {/* Format toggle */}
      <div className="cde-time-popover-head">
        <span className="cde-time-popover-title">選擇時間</span>
        <button
          type="button"
          className="cde-time-popover-format"
          onClick={() => setUse12h(v => !v)}
          aria-pressed={!use12h}
        >
          24h
        </button>
      </div>

      {/* Columns */}
      <div className="cde-time-popover-cols">
        {/* Period (12h only) */}
        {use12h && (
          <div className="cde-time-popover-col" data-active={activeCol === 'period'}>
            <button
              type="button"
              className={`cde-time-popover-col-btn${period === 'am' ? ' active' : ''}`}
              onClick={() => setPeriod('am')}
            >
              AM
            </button>
            <div className="cde-time-popover-col-divider" />
            <button
              type="button"
              className={`cde-time-popover-col-btn${period === 'pm' ? ' active' : ''}`}
              onClick={() => setPeriod('pm')}
            >
              PM
            </button>
          </div>
        )}

        {/* Hours */}
        <div className="cde-time-popover-col" data-active={activeCol === 'hour'}>
          {(use12h ? HOURS_12 : HOURS_24).map(h => (
            <button
              key={h}
              type="button"
              className={`cde-time-popover-col-btn${h === displayHour ? ' active' : ''}`}
              onClick={() => use12h ? set12Hour(h) : setH24(h)}
            >
              {String(h).padStart(2, '0')}
            </button>
          ))}
        </div>

        {/* Minutes */}
        <div className="cde-time-popover-col" data-active={activeCol === 'minute'}>
          {MINUTES.map(mm => (
            <button
              key={mm}
              type="button"
              className={`cde-time-popover-col-btn${mm === m ? ' active' : ''}`}
              onClick={() => setM(mm)}
            >
              {String(mm).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="cde-time-popover-foot">
        <button type="button" className="cde-time-popover-foot-btn" onClick={() => { onSelect(''); onClose(); }}>
          清除
        </button>
        <button type="button" className="cde-time-popover-foot-btn primary" onClick={commitTime}>
          確定
        </button>
      </div>
    </div>,
    document.body,
  );
}
