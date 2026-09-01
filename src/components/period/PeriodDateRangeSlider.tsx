import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  autoExpandNative?: boolean;
}

function toDate(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function fromDate(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a: Date, b: Date): number { return Math.round((a.getTime() - b.getTime()) / 86_400_000); }

const TOTAL_DAYS = 31;
const DAY_WIDTH = 100 / (TOTAL_DAYS - 1);

const QUICK_PRESETS = [
  { label: '今天', days: 0 },
  { label: '昨天開始', days: 1 },
  { label: '最近 3 天', days: 3 },
  { label: '最近 5 天', days: 5 },
  { label: '最近 7 天', days: 7 },
];

export function PeriodDateRangeSlider({ startDate, endDate, onChange, autoExpandNative = false }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const startOfRange = addDays(today, -15); // 31-day window centered on today
  const dates = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(startOfRange, i));

  const startIdx = Math.max(0, dates.findIndex(d => fromDate(d) >= startDate));
  const actualEndIdx = (() => {
    if (startIdx < 0) return TOTAL_DAYS - 1;
    for (let i = TOTAL_DAYS - 1; i >= startIdx; i--) {
      if (fromDate(dates[i]) <= endDate) return i;
    }
    return startIdx;
  })();

  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const getIdxFromClientX = useCallback((clientX: number): number => {
    if (!trackRef.current) return -1;
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(frac * (TOTAL_DAYS - 1));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const idx = getIdxFromClientX(e.clientX);
      if (idx < 0) return;
      if (dragging === 'start') {
        const newStart = fromDate(dates[Math.min(idx, actualEndIdx - 1)]);
        onChange(newStart, endDate);
      } else {
        const newEnd = fromDate(dates[Math.max(idx, startIdx + 1)]);
        onChange(startDate, newEnd);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, onChange, startDate, endDate, startIdx, actualEndIdx, dates, getIdxFromClientX]);

  const todayIdx = dates.findIndex(d => fromDate(d) === fromDate(today));
  const startPct = startIdx >= 0 ? startIdx * DAY_WIDTH : 0;
  const endPct = actualEndIdx >= 0 ? (actualEndIdx + 1) * DAY_WIDTH - DAY_WIDTH * 0.1 : 100;

  const applyPreset = (days: number) => {
    const s = fromDate(addDays(today, -days));
    onChange(s, fromDate(today));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Quick presets */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        {QUICK_PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.days)}
            style={{
              padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500,
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)',
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >{p.label}</button>
        ))}
      </div>

      {/* Labels for current selection */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', padding: '0 4px' }}>
        <span>{startDate}</span>
        <span>{startDate !== endDate ? endDate : ''}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        style={{
          position: 'relative', height: 44, cursor: 'pointer',
          userSelect: 'none', touchAction: 'none',
        }}
        onClick={(e) => {
          const idx = getIdxFromClientX(e.clientX);
          if (idx < 0) return;
          // Determine if we should move start or end — move the closer one
          const dStart = Math.abs(idx - startIdx);
          const dEnd = Math.abs(idx - actualEndIdx);
          if (dStart <= dEnd) {
            onChange(fromDate(dates[Math.min(idx, actualEndIdx - 1)]), endDate);
          } else {
            onChange(startDate, fromDate(dates[Math.max(idx, startIdx + 1)]));
          }
        }}
      >
        {/* Tick marks */}
        {dates.map((d, i) => {
          const isToday = fromDate(d) === fromDate(today);
          const inRange = i >= startIdx && i <= actualEndIdx;
          return (
            <div key={i}
              style={{
                position: 'absolute',
                left: `${i * DAY_WIDTH}%`,
                top: 8,
                width: 2,
                height: inRange ? 16 : isToday ? 14 : 10,
                borderRadius: 1,
                background: inRange ? 'var(--accent)' : isToday ? 'var(--text-2)' : 'var(--border)',
                transform: 'translateX(-50%)',
                transition: 'background 0.15s',
              }}
            />
          );
        })}

        {/* Selected range fill */}
        <div style={{
          position: 'absolute',
          left: `${startPct}%`,
          top: 26,
          height: 6,
          width: `${endPct - startPct}%`,
          borderRadius: 3,
          background: 'color-mix(in srgb, var(--accent) 35%, transparent)',
        }} />

        {/* Start handle */}
        <div
          onPointerDown={(e) => { e.stopPropagation(); setDragging('start'); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') onChange(fromDate(dates[Math.max(0, startIdx - 1)]), endDate);
            if (e.key === 'ArrowRight') onChange(fromDate(dates[Math.min(actualEndIdx - 1, startIdx + 1)]), endDate);
          }}
          role="slider"
          aria-label="開始日期"
          aria-valuetext={startDate}
          tabIndex={0}
          style={{
            position: 'absolute', left: `${startPct}%`, top: 22,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--accent)', border: '2px solid var(--bg-primary)',
            transform: 'translate(-50%, -50%)', cursor: 'grab',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            zIndex: 2,
          }}
        />

        {/* End handle */}
        <div
          onPointerDown={(e) => { e.stopPropagation(); setDragging('end'); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') onChange(startDate, fromDate(dates[Math.max(startIdx + 1, actualEndIdx - 1)]));
            if (e.key === 'ArrowRight') onChange(startDate, fromDate(dates[Math.min(TOTAL_DAYS - 1, actualEndIdx + 1)]));
          }}
          role="slider"
          aria-label="結束日期"
          aria-valuetext={endDate}
          tabIndex={0}
          style={{
            position: 'absolute', right: 0, left: `${endPct}%`, top: 22,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--accent)', border: '2px solid var(--bg-primary)',
            transform: 'translate(-50%, -50%)', cursor: 'grab',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            zIndex: 2,
          }}
        />
      </div>

      {/* Native date fallback */}
      <details open={autoExpandNative} style={{ fontSize: 12 }}>
        <summary style={{ color: 'var(--text-3)', cursor: 'pointer', padding: '4px 0' }}>精確選擇日期</summary>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input type="date" value={startDate} onChange={e => onChange(e.target.value, endDate)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
          <span style={{ alignSelf: 'center', color: 'var(--text-3)' }}>至</span>
          <input type="date" value={endDate} onChange={e => onChange(startDate, e.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
        </div>
      </details>
    </div>
  );
}
