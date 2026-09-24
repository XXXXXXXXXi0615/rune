/**
 * TimePickerSheet.tsx — iOS-style time wheel picker
 *
 * Two-column wheel: hours (00-23) + minutes (00/05/10/...55)
 * Desktop: compact popover. Mobile: bottom sheet.
 */

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { WheelPicker, type WheelColumnSpec } from './WheelPicker';

interface TimePickerSheetProps {
  isOpen: boolean;
  value: string;       // HH:mm or empty string
  title?: string;
  onConfirm: (time: string) => void;
  onCancel: () => void;
}

/** Parse "HH:mm" → { h, m }; fallback to current time. */
function parseTime(value: string): { h: number; m: number } {
  const parts = (value || '').split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
    return { h, m };
  }
  const now = new Date();
  return { h: now.getHours(), m: Math.floor(now.getMinutes() / 5) * 5 };
}

/** Snap minutes to nearest 5. */
function snap5(m: number): number {
  return Math.round(m / 5) * 5;
}

const HOURS_ITEMS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_ITEMS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const MINUTES_VALUES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimePickerSheet({
  isOpen,
  value,
  title = '選擇時間',
  onConfirm,
  onCancel,
}: TimePickerSheetProps) {
  const parsed = parseTime(value);
  const [hour, setHour] = useState(parsed.h);
  const [minute, setMinute] = useState(parsed.m);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(isOpen);
    if (isOpen) {
      const p = parseTime(value);
      setHour(p.h);
      setMinute(snap5(p.m));
    }
  }, [isOpen, value]);

  // ── All hooks must be called unconditionally, BEFORE any early return ──

  const columns: WheelColumnSpec[] = useMemo(() => [
    { items: HOURS_ITEMS, selectedIndex: ready ? hour : 0, onChange: (i) => setHour(i) },
    { items: MINUTES_ITEMS, selectedIndex: ready ? Math.max(0, MINUTES_VALUES.indexOf(snap5(minute))) : 0, onChange: (i) => setMinute(MINUTES_VALUES[i]) },
  ], [hour, minute, ready]);

  // ── Early return AFTER all hooks ──
  if (!isOpen || !ready) return null;

  const handleConfirm = () => {
    const m = snap5(minute);
    onConfirm(`${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const quickSet = (h: number, m = 0) => {
    setHour(h);
    setMinute(m);
  };

  return createPortal(
    <div className="wheel-sheet-overlay wheel-sheet-overlay--compact" onClick={onCancel}>
      <div className="wheel-sheet wheel-sheet--compact wheel-sheet--time" onClick={(e) => e.stopPropagation()}>
        <h3 className="wheel-sheet-title">{title}</h3>

        <WheelPicker columns={columns} separators={[':']} masks={false} highlight={false} />

        {/* Quick buttons */}
        <div className="time-quick-row">
          <button type="button" className="time-quick-btn" onClick={() => { const p = parseTime(''); quickSet(p.h, p.m); }}>現在</button>
          <button type="button" className="time-quick-btn" onClick={() => quickSet(0, 0)}>00:00</button>
          <button type="button" className="time-quick-btn" onClick={() => quickSet(9, 0)}>09:00</button>
          <button type="button" className="time-quick-btn" onClick={() => quickSet(21, 0)}>21:00</button>
        </div>

        <div className="wheel-sheet-actions">
          <button type="button" className="wheel-btn-cancel" onClick={onCancel}>取消</button>
          <button type="button" className="wheel-btn-confirm" onClick={handleConfirm}>確認</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
