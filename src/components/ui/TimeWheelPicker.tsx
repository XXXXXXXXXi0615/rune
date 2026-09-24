import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WheelPicker, type WheelColumnSpec } from './WheelPicker';
import './WheelPicker.css';

interface TimeWheelPickerProps {
  isOpen: boolean;
  value: string;
  triggerRect?: DOMRect;
  onConfirm: (time: string) => void;
  onCancel: () => void;
}

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

function snap5(m: number): number {
  return Math.round(m / 5) * 5;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MIN_ITEMS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const MIN_VALS = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimeWheelPicker({
  isOpen,
  value,
  triggerRect,
  onConfirm,
  onCancel,
}: TimeWheelPickerProps) {
  const parsed = parseTime(value);
  const [hour, setHour] = useState(parsed.h);
  const [minute, setMinute] = useState(parsed.m);
  const popoverRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

  useEffect(() => {
    if (!isOpen) return;
    const p = parseTime(value);
    setHour(p.h);
    setMinute(snap5(p.m));
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement;
    const timer = requestAnimationFrame(() => {
      popoverRef.current?.querySelector<HTMLElement>('button')?.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  const columns: WheelColumnSpec[] = useMemo(() => [
    { items: HOURS, selectedIndex: hour, onChange: (i) => setHour(i) },
    { items: MIN_ITEMS, selectedIndex: Math.max(0, MIN_VALS.indexOf(snap5(minute))), onChange: (i) => setMinute(MIN_VALS[i]) },
  ], [hour, minute]);

  const handleConfirm = useCallback(() => {
    const m = snap5(minute);
    onConfirm(`${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }, [hour, minute, onConfirm]);

  const quickNow = useCallback(() => {
    const p = parseTime('');
    setHour(p.h);
    setMinute(snap5(p.m));
  }, []);

  const quickSet = useCallback((h: number, m = 0) => {
    setHour(h);
    setMinute(m);
  }, []);

  if (!isOpen) return null;

  let popoverStyle: React.CSSProperties | undefined;
  if (!isMobile && triggerRect) {
    const winW = window.innerWidth;
    const pw = 280;
    let left = triggerRect.left;
    if (left + pw > winW - 12) left = winW - pw - 12;
    if (left < 12) left = 12;
    let top = triggerRect.bottom + 6;
    if (top + 380 > window.innerHeight) top = triggerRect.top - 380 - 6;
    popoverStyle = { position: 'fixed', left, top, width: pw, zIndex: 1800 };
  }

  const content = (
    <div className={isMobile ? 'cal-picker-sheet' : 'cal-picker-popover'} ref={popoverRef} style={!isMobile ? popoverStyle : undefined}>
      <h3 className="cal-picker-title">選擇時間</h3>

      <div style={{ height: 180, padding: '0 12px' }}>
        <WheelPicker columns={columns} separators={[':']} masks={false} highlight={false} />
      </div>

      <div className="cal-time-quick">
        <button type="button" className="cal-date-chip" onClick={quickNow}>現在</button>
        <button type="button" className="cal-date-chip" onClick={() => quickSet(0, 0)}>00:00</button>
        <button type="button" className="cal-date-chip" onClick={() => quickSet(9, 0)}>09:00</button>
        <button type="button" className="cal-date-chip" onClick={() => quickSet(21, 0)}>21:00</button>
      </div>

      <div className="cal-picker-actions">
        <button type="button" className="cal-picker-btn cal-picker-btn--clear" onClick={() => onConfirm('')}>清除</button>
        <button type="button" className="cal-picker-btn cal-picker-btn--cancel" onClick={onCancel}>取消</button>
        <button type="button" className="cal-picker-btn cal-picker-btn--confirm" onClick={handleConfirm}>確定</button>
      </div>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div className="cal-picker-overlay" onClick={onCancel}>{content}</div>,
      document.body,
    );
  }
  return createPortal(content, document.body);
}
