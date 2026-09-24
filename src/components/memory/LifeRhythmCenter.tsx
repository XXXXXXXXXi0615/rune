import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import {
  buildSleepStages,
  createHeartRate,
  createSleepRecord,
  loadSleepRecords,
  migrateSleepRecords,
  saveSleepRecord,
  SLEEP_QUALITY_LABELS,
  type SleepQuality,
  type SleepRecord,
  type SleepStageType,
} from '@/utils/sleepStorage';
import { SleepImportSheet } from '@/components/sleep/SleepImportSheet';
import { SleepTimeline } from '@/components/sleep/SleepTimeline';
import { SleepViewToggle, computeViewDateRange } from '@/components/sleep/SleepViewToggle';
import { DEFAULT_RULES } from '@/config/rewardRules';
import type { SleepView } from '@/components/sleep/SleepViewToggle';
import { SleepReceiptArchive } from '@/components/sleep/SleepReceiptArchive';
import { SleepReceiptDetailDrawer } from '@/components/sleep/SleepReceiptDetailDrawer';
import {
  exportSleepReceiptPNG,
  exportSleepReceiptPDF,
  computeSleepScore,
  sleepScoreLabel,
} from '@/utils/sleepReceipt';
import type { SleepReceipt } from '@/types';
import './SleepCenter.css';

interface LifeRhythmCenterProps {
  periodSummary: string;
}

const QUALITY_ORDER: SleepQuality[] = ['poor', 'fair', 'good', 'great'];

/* ── Helpers ── */
function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h${String(rest).padStart(2, '0')}m` : `${rest}m`;
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function heartRatePoints(record: SleepRecord, width = 240, height = 80): string {
  const samples = record.heartRate.samples.length > 1
    ? record.heartRate.samples
    : [record.heartRate.average, record.heartRate.average];
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = Math.max(1, max - min);
  const padX = 6;
  const usableW = width - padX * 2;
  const usableH = height - 24;
  return samples.map((value, index) => {
    const x = padX + (index / Math.max(1, samples.length - 1)) * usableW;
    const y = 12 + usableH - ((value - min) / range) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function formatZhDate(dateStr: string): string {
  if (!dateStr) return '選擇日期';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ══════════════════════════════════════
   ACTIVITY ICON
   ══════════════════════════════════════ */
function ActivityIcon({ type }: { type: 'sleep' | 'steps' | 'heart' | 'energy' }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (type === 'sleep') return <svg {...common}><path d="M18 15.5A7.5 7.5 0 0 1 8.5 6a7.5 7.5 0 1 0 9.5 9.5Z" /></svg>;
  if (type === 'steps') return <svg {...common}><path d="M8 4c1.5 2.5 1 5-1 7s-2 4 0 6 5 1 6-1M16 5c-1 3 0 5 2 7s2 4 0 6" /></svg>;
  if (type === 'heart') return <svg {...common}><path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" /></svg>;
  return <svg {...common}><path d="M13 2 5 14h7l-1 8 8-12h-7l1-8Z" /></svg>;
}

/* ══════════════════════════════════════
   WHEEL COLUMN — iOS-style scroll wheel
   ══════════════════════════════════════ */
const WHEEL_ITEM_H = 40;
const WHEEL_VISIBLE_H = 200;

function WheelColumn<T extends string | number>({
  items,
  value,
  onChange,
  formatItem,
}: {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  formatItem: (v: T) => string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipRef = useRef(false);
  const lastValRef = useRef<T>(value);
  const pad = (WHEEL_VISIBLE_H - WHEEL_ITEM_H) / 2;

  // Initial center
  useEffect(() => {
    if (!scrollRef.current) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    skipRef.current = true;
    scrollRef.current.scrollTo({ top: idx * WHEEL_ITEM_H });
    requestAnimationFrame(() => { skipRef.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value change → scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    if (value !== lastValRef.current) {
      lastValRef.current = value;
      skipRef.current = true;
      scrollRef.current.scrollTo({ top: idx * WHEEL_ITEM_H, behavior: 'instant' as ScrollBehavior });
      requestAnimationFrame(() => { skipRef.current = false; });
    }
  }, [value, items]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (skipRef.current || !scrollRef.current) return;
      const idx = Math.round(scrollRef.current.scrollTop / WHEEL_ITEM_H);
      if (idx < 0 || idx >= items.length) return;
      const v = items[idx];
      if (v !== value) {
        lastValRef.current = v;
        onChange(v);
      }
    }, 130);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="sleep-wheel-col">
      <div className="sleep-wheel-mask">
        <div className="sleep-wheel-indicator" />
        <div ref={scrollRef} className="sleep-wheel-scroll" onScroll={handleScroll}>
          <div style={{ height: pad }} />
          {items.map((item, i) => (
            <div key={`${item}-${i}`} className="sleep-wheel-item" style={{ height: WHEEL_ITEM_H }}>
              <span className="sleep-wheel-label">{formatItem(item)}</span>
            </div>
          ))}
          <div style={{ height: pad }} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DATE / TIME PICKER SHEETS (wheel)
   ══════════════════════════════════════ */
function DateTimePickerSheet({
  mode,
  value,
  title,
  onConfirm,
  onCancel,
}: {
  mode: 'date' | 'time';
  value: string;
  title: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}) {
  // Parse initial
  const initial = useMemo(() => {
    if (mode === 'date') {
      const d = value ? new Date(`${value}T00:00:00`) : new Date();
      if (Number.isNaN(d.getTime())) return { date: new Date() };
      return { date: d };
    }
    // time "HH:MM"
    const [h, m] = (value || '23:30').split(':').map((n) => Number(n));
    return { hours: Number.isFinite(h) ? h : 23, minutes: Number.isFinite(m) ? m : 30 };
  }, [mode, value]);

  const now = new Date();
  const currentYear = now.getFullYear();

  // Date state
  const [year, setYear] = useState(mode === 'date' ? (initial as { date: Date }).date.getFullYear() : currentYear);
  const [month, setMonth] = useState(mode === 'date' ? (initial as { date: Date }).date.getMonth() + 1 : now.getMonth() + 1);
  const [day, setDay] = useState(mode === 'date' ? (initial as { date: Date }).date.getDate() : now.getDate());

  // Time state
  const [hours, setHours] = useState(mode === 'time' ? (initial as { hours: number; minutes: number }).hours : 23);
  const [minutes, setMinutes] = useState(mode === 'time' ? (initial as { hours: number; minutes: number }).minutes : 30);

  const years = useMemo(() => Array.from({ length: 11 }, (_, i) => currentYear - 5 + i), [currentYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const maxDay = new Date(year, month, 0).getDate();
  const days = useMemo(() => Array.from({ length: maxDay }, (_, i) => i + 1), [maxDay]);
  const safeDay = Math.min(day, maxDay);
  useEffect(() => { if (day > maxDay) setDay(maxDay); }, [maxDay, day]);

  const hoursList = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutesList = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  useEffect(() => {
    document.body.classList.add('sheet-open');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('sheet-open'); window.removeEventListener('keydown', onKey); };
  }, [onCancel]);

  const handleConfirm = () => {
    if (mode === 'date') {
      onConfirm(`${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`);
    } else {
      onConfirm(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    }
  };

  return createPortal(
    <div className="sleep-picker-overlay" onClick={onCancel}>
      <div className="sleep-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sleep-picker-handle" />
        <div className="sleep-picker-head">
          <button type="button" className="sleep-picker-btn sleep-picker-btn--ghost" onClick={onCancel}>取消</button>
          <h3 className="sleep-picker-title">{title}</h3>
          <button type="button" className="sleep-picker-btn sleep-picker-btn--primary" onClick={handleConfirm}>確認</button>
        </div>

        {mode === 'date' ? (
          <div className="sleep-picker-wheels">
            <WheelColumn items={years} value={year} onChange={setYear} formatItem={(v) => `${v}年`} />
            <WheelColumn items={months} value={month} onChange={setMonth} formatItem={(v) => `${String(v).padStart(2, '0')}月`} />
            <WheelColumn items={days} value={safeDay} onChange={setDay} formatItem={(v) => `${String(v).padStart(2, '0')}日`} />
          </div>
        ) : (
          <div className="sleep-picker-wheels">
            <WheelColumn items={hoursList} value={hours} onChange={setHours} formatItem={(v) => String(v).padStart(2, '0')} />
            <div className="sleep-picker-colon">:</div>
            <WheelColumn items={minutesList} value={minutes} onChange={setMinutes} formatItem={(v) => String(v).padStart(2, '0')} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════
   SLEEP FORM SHEET (iOS bottom sheet)
   ══════════════════════════════════════ */
interface SleepFormState {
  date: string;
  sleepStart: string;
  sleepEnd: string;
  quality: SleepQuality;
  note: string;
  rem: string;
  core: string;
  deep: string;
  awake: string;
  heartRate: string;
  steps: string;
  activeEnergy: string;
}

function initialForm(): SleepFormState {
  return {
    date: localDateKey(),
    sleepStart: '23:30',
    sleepEnd: '07:30',
    quality: 'good',
    note: '',
    rem: '',
    core: '',
    deep: '',
    awake: '',
    heartRate: '57',
    steps: '',
    activeEnergy: '',
  };
}

function SleepFormSheet({
  onSave,
  onClose,
}: {
  onSave: (data: SleepFormState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SleepFormState>(initialForm);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [picker, setPicker] = useState<null | { mode: 'date' | 'time'; field: 'date' | 'sleepStart' | 'sleepEnd' }>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.add('sheet-open');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('sheet-open'); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const set = (field: keyof SleepFormState, value: string | SleepQuality) => {
    setForm((cur) => ({ ...cur, [field]: value }));
    if (error) setError('');
  };

  const handleConfirmPicker = (val: string) => {
    if (!picker) return;
    set(picker.field, val);
    setPicker(null);
  };

  const handleSave = () => {
    if (!form.date || !form.sleepStart || !form.sleepEnd) {
      setError('請填寫日期、入睡時間與起床時間。');
      return;
    }
    const totals = {
      awake: numberValue(form.awake),
      rem: numberValue(form.rem),
      core: numberValue(form.core),
      deep: numberValue(form.deep),
    };
    const stageSleepMinutes = totals.rem + totals.core + totals.deep;
    if (stageSleepMinutes <= 0) {
      setError('請在進階資料填寫 REM / 核心 / 深睡，或先載入示例。');
      return;
    }
    onSave(form);
  };

  return createPortal(
    <div className="sleep-sheet-overlay" onClick={onClose}>
      <section className="sleep-sheet" role="dialog" aria-modal="true" aria-labelledby="sleep-sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sleep-sheet-handle" />
        <header className="sleep-sheet-head">
          <div className="sleep-sheet-heading">
            <span className="sleep-sheet-eyebrow">New Record</span>
            <h2 id="sleep-sheet-title">記錄今晚</h2>
          </div>
          <button type="button" className="sleep-sheet-close" onClick={onClose} aria-label="關閉">&#x2715;</button>
        </header>

        <div className="sleep-sheet-body">
          {/* Date */}
          <div className="sleep-field">
            <label className="sleep-field-label">日期</label>
            <button type="button" className="sleep-field-btn" onClick={() => setPicker({ mode: 'date', field: 'date' })}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{formatZhDate(form.date)}</span>
            </button>
          </div>

          {/* Sleep window */}
          <div className="sleep-field sleep-field-row">
            <div className="sleep-field-cell">
              <label className="sleep-field-label">入睡時間</label>
              <button type="button" className="sleep-field-btn sleep-field-btn--mono" onClick={() => setPicker({ mode: 'time', field: 'sleepStart' })}>
                {form.sleepStart}
              </button>
            </div>
            <div className="sleep-field-cell">
              <label className="sleep-field-label">起床時間</label>
              <button type="button" className="sleep-field-btn sleep-field-btn--mono" onClick={() => setPicker({ mode: 'time', field: 'sleepEnd' })}>
                {form.sleepEnd}
              </button>
            </div>
          </div>

          {/* Quality */}
          <div className="sleep-field">
            <label className="sleep-field-label">睡眠品質</label>
            <div className="sleep-quality-row">
              {QUALITY_ORDER.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`sleep-quality-chip${form.quality === q ? ' active' : ''}`}
                  data-tone={q}
                  onClick={() => set('quality', q)}
                >
                  {SLEEP_QUALITY_LABELS[q]}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="sleep-field">
            <label className="sleep-field-label" htmlFor="sleep-note-input">備註</label>
            <textarea
              id="sleep-note-input"
              className="sleep-field-textarea"
              rows={3}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="輸入備註"
            />
          </div>

          {/* Advanced */}
          <button
            type="button"
            className={`sleep-advanced-toggle${advancedOpen ? ' open' : ''}`}
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
          >
            <span className="sleep-advanced-toggle-copy">
              <strong>進階資料</strong>
              <em>REM · 核心 · 深睡 · 清醒 · 心率 · 步數 · 活動能量</em>
            </span>
            <svg className="sleep-advanced-chevron" viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {advancedOpen && (
            <div className="sleep-advanced-grid">
              <label className="sleep-mini-field"><span>REM 分鐘</span>
                <input type="number" min={0} inputMode="numeric" value={form.rem} onChange={(e) => set('rem', e.target.value)} placeholder="76" />
              </label>
              <label className="sleep-mini-field"><span>核心睡眠 分鐘</span>
                <input type="number" min={0} inputMode="numeric" value={form.core} onChange={(e) => set('core', e.target.value)} placeholder="230" />
              </label>
              <label className="sleep-mini-field"><span>深睡 分鐘</span>
                <input type="number" min={0} inputMode="numeric" value={form.deep} onChange={(e) => set('deep', e.target.value)} placeholder="38" />
              </label>
              <label className="sleep-mini-field"><span>清醒 分鐘</span>
                <input type="number" min={0} inputMode="numeric" value={form.awake} onChange={(e) => set('awake', e.target.value)} placeholder="3" />
              </label>
              <label className="sleep-mini-field"><span>平均心率</span>
                <input type="number" min={35} inputMode="numeric" value={form.heartRate} onChange={(e) => set('heartRate', e.target.value)} placeholder="57" />
              </label>
              <label className="sleep-mini-field"><span>步數</span>
                <input type="number" min={0} inputMode="numeric" value={form.steps} onChange={(e) => set('steps', e.target.value)} placeholder="6842" />
              </label>
              <label className="sleep-mini-field"><span>活動能量 kcal</span>
                <input type="number" min={0} inputMode="numeric" value={form.activeEnergy} onChange={(e) => set('activeEnergy', e.target.value)} placeholder="386" />
              </label>
            </div>
          )}

          {error && <p className="sleep-form-error" role="alert">{error}</p>}
        </div>

        <footer className="sleep-sheet-foot">
          <button type="button" className="sleep-button sleep-button--glass" onClick={onClose}>取消</button>
          <button type="button" className="sleep-button sleep-button--primary" onClick={handleSave}>記錄今晚</button>
        </footer>
      </section>

      {picker && (
        <DateTimePickerSheet
          mode={picker.mode}
          value={picker.field === 'date' ? form.date : picker.field === 'sleepStart' ? form.sleepStart : form.sleepEnd}
          title={picker.mode === 'date' ? '選擇日期' : (picker.field === 'sleepStart' ? '入睡時間' : '起床時間')}
          onConfirm={handleConfirmPicker}
          onCancel={() => setPicker(null)}
        />
      )}
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════
   SLEEP CENTER
   ══════════════════════════════════════ */
export function LifeRhythmCenter({ periodSummary }: LifeRhythmCenterProps) {
  const addHealthRecord = useAppStore((s) => s.addHealthRecord);
  const deleteSleepReceiptAction = useAppStore((s) => s.deleteSleepReceipt);
  const saveSleepReceiptAction = useAppStore((s) => s.saveSleepReceiptToSecondBrain);
  const sleepReceipts = useAppStore((s) => s.sleepReceipts);
  const rewardRules = useAppStore((s) => s.rewardRules || []);
  const [records, setRecords] = useState<SleepRecord[]>(() => migrateSleepRecords());
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<SleepView>('day');
  const [section, setSection] = useState<'today' | 'archive' | 'intelligence'>('today');
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [receiptDetailId, setReceiptDetailId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  /* ── Life Check-in (今日報備) local state ── */
  const checkinActions = useMemo(() => [
    { id: 'brush', emoji: '🪥', label: '刷牙' },
    { id: 'eat', emoji: '🍽️', label: '吃飯' },
    { id: 'sleep', emoji: '😴', label: '睡覺' },
    { id: 'exercise', emoji: '🏃', label: '運動' },
    { id: 'water', emoji: '💧', label: '喝水' },
  ], []);

  const [gachaChances, setGachaChances] = useState(0);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAction, setCustomAction] = useState('');

  /* ── Gacha panel local state ── */
  const [gachaReward, setGachaReward] = useState<string | null>(null);
  const [gachaRewardHistory, setGachaRewardHistory] = useState<string[]>([]);
  const [gachaMemories, setGachaMemories] = useState<Array<{ id: string; cardType: string; reward: string; rarity: string; emoji: string; moodDelta: number; driftDelta: number; createdAt: number; bodyThoughts: string }>>([]);

  const emotionalPool = useMemo(() => {
    const enabled = (rewardRules || []).filter((r) => r.enabled);
    const pool = enabled.length > 0 ? enabled : DEFAULT_RULES;
    return pool.map((r) => ({
      emoji: r.emoji || '✨',
      text: r.rewardContent || r.name,
      rarity: r.rarity || 'gentle',
      moodDelta: r.moodDelta ?? 0.1,
      driftDelta: r.driftDelta ?? 0.05,
      condition: r.condition || {},
    }));
  }, [rewardRules]);

  // Reset gacha reward when midnight reset happens
  useEffect(() => {
    if (gachaChances === 0 && gachaRewardHistory.length > 0) {
      // Keep history but clear current reward between sessions
      setGachaReward(null);
    }
  }, [gachaChances, gachaRewardHistory.length]);

  // Load gacha memories from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lunartide_gacha_memories');
      if (raw) {
        const todayKey = new Date().toISOString().slice(0, 10);
        const entries = JSON.parse(raw).filter(
          (m: { createdAt: number }) => new Date(m.createdAt).toISOString().slice(0, 10) === todayKey
        );
        if (entries.length > 0) setGachaMemories(entries);
      }
    } catch {}
  }, []);

  // Midnight reset
  useEffect(() => {
    const checkReset = () => {
      const todayKey = new Date().toISOString().slice(0, 10);
      const stored = localStorage.getItem('lunartide_checkin_day');
      if (stored !== todayKey) {
        setCompletedActions([]);
        setGachaChances(0);
        localStorage.setItem('lunartide_checkin_day', todayKey);
      }
    };
    checkReset();
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(checkReset, msUntilMidnight + 1000);
    return () => clearTimeout(timer);
  }, []);

  /* ═══════════════════════════════════════════════════════
     PERSONALITY DRIFT — 7-day activity aggregation
     ═══════════════════════════════════════════════════════ */
  const DRIFT_KEY = 'lunartide_daily_log';

  function addDailyLog() {
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      const raw = localStorage.getItem(DRIFT_KEY);
      const log: Record<string, number> = raw ? JSON.parse(raw) : {};
      log[todayKey] = (log[todayKey] || 0) + 1;
      // Purge entries older than 14 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      const cutoffKey = cutoff.toISOString().slice(0, 10);
      for (const key of Object.keys(log)) {
        if (key < cutoffKey) delete log[key];
      }
      localStorage.setItem(DRIFT_KEY, JSON.stringify(log));
    } catch {}
  }

  const personalityDrift = useMemo(() => {
    try {
      const raw = localStorage.getItem(DRIFT_KEY);
      if (!raw) return { state: 'balanced' as const, avg: 0, days: 0 };
      const log: Record<string, number> = JSON.parse(raw);
      const today = new Date();
      const past7: number[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        past7.push(log[key] || 0);
      }
      const total = past7.reduce((s, v) => s + v, 0);
      const avg = total / 7;
      const activeDays = past7.filter((v) => v > 0).length;
      let state: 'calm' | 'balanced' | 'warm' = 'balanced';
      if (avg < 1.5 && activeDays < 4) state = 'calm';
      else if (avg > 3.5) state = 'warm';
      return { state, avg: Math.round(avg * 10) / 10, days: activeDays };
    } catch {
      return { state: 'balanced' as const, avg: 0, days: 0 };
    }
  }, [completedActions.length, gachaChances]);

  /* ═══════════════════════════════════════════════════════
     BEHAVIOR ORCHESTRATOR — central event pipeline
     ─────────────────────────────────────────────────────────
     Phase 1: Record   → addDailyLog()
     Phase 2: Execute  → update local state
     Phase 3: Cascade  → gachaChances / gachaReward
     Phase 4: React    → lunaReaction auto (useMemo deps)
     Phase 5: Echo     → data-echo auto (lunaReaction.mood)
     Phase 6: Drift    → personalityDrift auto (useMemo deps)
     ═══════════════════════════════════════════════════════ */

  const streak = useMemo(() => {
    try {
      const raw = localStorage.getItem(DRIFT_KEY);
      if (!raw) return 0;
      const log: Record<string, number> = JSON.parse(raw);
      let count = 0;
      const d = new Date();
      while (true) {
        const key = d.toISOString().slice(0, 10);
        if (log[key] && log[key] > 0) { count++; d.setDate(d.getDate() - 1); }
        else break;
      }
      return count;
    } catch { return 0; }
  }, [completedActions.length, gachaChances]);

  const lunaReaction = useMemo(() => {
    const count = completedActions.length;
    let mood: 'calm' | 'neutral' | 'warm' = 'neutral';
    const gachaBoost = gachaMemories.reduce((sum, m) => sum + (m.rarity === 'luminous' ? 2.0 : m.rarity === 'rare' ? 1.5 : m.rarity === 'warm' ? 1.0 : 0.5), 0);
    const driftMod = personalityDrift.state === 'calm' ? -1.0 : personalityDrift.state === 'warm' ? 1.0 : 0;
    const effectiveCount = count + gachaBoost + driftMod;
    if (effectiveCount <= 1) mood = 'calm';
    else if (effectiveCount >= 4) mood = 'warm';
    const bias = effectiveCount <= 1 ? -0.8 : effectiveCount >= 4 ? 0.8 : -0.8 + ((effectiveCount - 1) / 3) * 1.6;
    return { mood, bias: Math.round(bias * 10) / 10 };
  }, [completedActions.length, gachaMemories, personalityDrift]);

  type BehaviorEvent =
    | { type: 'checkin'; actionId: string }
    | { type: 'custom_checkin' }
    | { type: 'gacha_pull' }
    | { type: 'settle' };

  const handleBehaviorEvent = useCallback((event: BehaviorEvent) => {
    // Phase 1: Record to daily log (feeds Personality Drift)
    addDailyLog();

    // Phase 2+3: Dispatch to internal handler
    switch (event.type) {
      case 'checkin':
        setCompletedActions((prev) => {
          if (prev.includes(event.actionId)) return prev;
          return [...prev, event.actionId];
        });
        setGachaChances((prev) => prev + 1 + Math.floor(streak / 3));
        break;

      case 'custom_checkin': {
        const trimmed = customAction.trim();
        if (!trimmed) return;
        const customId = `custom_${Date.now()}`;
        setCompletedActions((prev) => [...prev, customId]);
        setGachaChances((prev) => prev + 1 + Math.floor(streak / 3));
        setCustomAction('');
        setShowCustomInput(false);
        break;
      }

      case 'gacha_pull': {
        if (gachaChances <= 0) return;
        setGachaChances((prev) => prev - 1);
        const roll = Math.random();
        const moodBias = lunaReaction.bias;
        const moodBoost = moodBias > 0 ? moodBias * 0.08 : 0;
        const driftBoost = personalityDrift.state === 'warm' ? 0.04 : 0;
        const lowMoodMercy = moodBias < -0.3 ? 0.03 : 0;

        let rarity: string;
        const rareThreshold = 0.07 + moodBoost + driftBoost + lowMoodMercy;
        const warmThreshold = rareThreshold + 0.22;
        const luminousThreshold = 0.04 + moodBoost * 0.5;
        if (roll < luminousThreshold) rarity = 'luminous';
        else if (roll < rareThreshold) rarity = 'rare';
        else if (roll < warmThreshold) rarity = 'warm';
        else rarity = 'gentle';

        if (rarity === 'luminous') {
          addDailyLog();
        }
        // Filter by conditions matching current emotional state
        const currentState = { mood: moodBias, drift: personalityDrift.state, strk: streak };
        const conditionMatch = (r: typeof emotionalPool[0]) => {
          const c = r.condition || {};
          if (c.moodMin !== undefined && currentState.mood < c.moodMin) return false;
          if (c.moodMax !== undefined && currentState.mood > c.moodMax) return false;
          if (c.driftState && c.driftState !== currentState.drift) return false;
          if (c.streakMin !== undefined && currentState.strk < c.streakMin) return false;
          if (c.streakMax !== undefined && currentState.strk > c.streakMax) return false;
          return true;
        };
        let pool = emotionalPool.filter((r) => r.rarity === rarity && conditionMatch(r));
        if (pool.length === 0) pool = emotionalPool.filter((r) => r.rarity === rarity);
        const reward = pool[Math.floor(Math.random() * pool.length)] || emotionalPool[0];
        const text = `${reward.emoji} ${reward.text}`;
        setGachaReward(text);
        setGachaRewardHistory((prev) => [text, ...prev].slice(0, 10));

        const memoryId = crypto.randomUUID ? crypto.randomUUID() : `gacha_${Date.now()}`;
        const memoryEntry = {
          id: memoryId, cardType: 'gacha_reward', reward: text,
          rarity: reward.rarity, emoji: reward.emoji,
          moodDelta: reward.moodDelta, driftDelta: reward.driftDelta,
          createdAt: Date.now(), bodyThoughts: reward.text,
        };
        setGachaMemories((prev) => [memoryEntry, ...prev]);
        try {
          const existing = JSON.parse(localStorage.getItem('lunartide_gacha_memories') || '[]');
          const todayKey = new Date().toISOString().slice(0, 10);
          const todayEntries = existing
            .filter((m: { createdAt: number }) => new Date(m.createdAt).toISOString().slice(0, 10) === todayKey)
            .concat(memoryEntry);
          localStorage.setItem('lunartide_gacha_memories', JSON.stringify(todayEntries));
        } catch {}
        break;
      }

      case 'settle': {
        const todayKey = new Date().toISOString().slice(0, 10);
        const snapshot = {
          date: todayKey,
          completedActions: [...completedActions],
          gachaChances,
          streak,
          driftState: personalityDrift.state,
          driftAvg: personalityDrift.avg,
          mood: lunaReaction.mood,
          moodBias: lunaReaction.bias,
          gachaHistory: [...gachaRewardHistory],
          gachaMemoriesCount: gachaMemories.length,
          settledAt: Date.now(),
        };
        try {
          const log = JSON.parse(localStorage.getItem('lunartide_settle_log') || '[]');
          log.push(snapshot);
          localStorage.setItem('lunartide_settle_log', JSON.stringify(log));
        } catch {}
        setCompletedActions([]);
        setGachaChances(0);
        break;
      }
    }
  }, [gachaChances, emotionalPool, personalityDrift, customAction, streak, completedActions, gachaRewardHistory, gachaMemories, lunaReaction]);

  // Re-import records from localStorage after importing from SleepImportSheet
  const refreshRecords = useCallback(() => {
    setRecords(loadSleepRecords());
  }, []);

  const filteredRecords = useMemo(() => {
    const { start, end } = computeViewDateRange(view);
    return records.filter((r) => r.date >= start && r.date <= end);
  }, [records, view]);

  const latest = (view === 'day' ? records.filter((r) => r.date === selectedDate) : filteredRecords)[0] ?? records[0] ?? null;

  const stageTotals = useMemo(() => {
    if (!latest) return { awake: 0, rem: 0, core: 0, deep: 0 };
    return latest.stages.reduce<Record<SleepStageType, number>>(
      (totals, stage) => ({ ...totals, [stage.type]: totals[stage.type] + stage.minutes }),
      { awake: 0, rem: 0, core: 0, deep: 0 },
    );
  }, [latest]);

  const handleSave = (form: SleepFormState) => {
    const totals = {
      awake: numberValue(form.awake),
      rem: numberValue(form.rem),
      core: numberValue(form.core),
      deep: numberValue(form.deep),
    };
    const stageSleepMinutes = totals.rem + totals.core + totals.deep;
    const averageHeartRate = numberValue(form.heartRate) || 57;
    const record = createSleepRecord({
      date: form.date,
      sleepStart: form.sleepStart,
      sleepEnd: form.sleepEnd,
      durationMinutes: stageSleepMinutes,
      stages: buildSleepStages(totals),
      heartRate: createHeartRate(averageHeartRate),
      steps: numberValue(form.steps),
      activeEnergy: numberValue(form.activeEnergy),
      restingHeartRate: Math.max(35, averageHeartRate - 2),
      appUsage: [],
      note: form.note.trim(),
      quality: form.quality,
    });
    setRecords(saveSleepRecord(record));
    // Bridge to HealthRecord for Life Graph
    const deepMin = totals.deep;
    addHealthRecord({
      type: 'sleep',
      date: form.date,
      source: 'manual',
      sleepStart: form.sleepStart,
      sleepEnd: form.sleepEnd,
      sleepDurationMinutes: stageSleepMinutes,
      deepSleepMinutes: deepMin,
      wakeCount: totals.awake > 10 ? 1 : 0,
      quality: form.quality === 'great' || form.quality === 'good' ? 'good' : form.quality === 'fair' ? 'normal' : 'poor',
      notes: form.note.trim() || undefined,
    });
    setFormOpen(false);
  };


  const selectedReceipt = useMemo(
    () => receiptDetailId ? sleepReceipts.find((r) => r.id === receiptDetailId) ?? null : null,
    [receiptDetailId, sleepReceipts],
  );

  const handleExportPNG = useCallback((receipt: SleepReceipt) => {
    exportSleepReceiptPNG(receipt).catch((err) => console.error('Sleep PNG export failed:', err));
  }, []);

  const handleExportPDF = useCallback((receipt: SleepReceipt) => {
    exportSleepReceiptPDF(receipt);
  }, []);

  /* ── Empty state ── */
  if (!latest && !formOpen) {
    return (
      <section className="sleep-center sleep-center--empty">
        <div className="sleep-empty-card">
          <div className="sleep-empty-orbit" aria-hidden="true">
            <div className="sleep-empty-orbit-core" />
            <div className="sleep-empty-orbit-ring" />
            <div className="sleep-empty-orbit-ring sleep-empty-orbit-ring--2" />
            <svg viewBox="0 0 24 24"><path d="M18 15.5A7.5 7.5 0 0 1 8.5 6a7.5 7.5 0 1 0 9.5 9.5Z" /></svg>
          </div>
          <span className="sleep-empty-eyebrow">Life Rhythm Center</span>
          <h2>尚無記錄</h2>
          <div className="sleep-empty-actions">
            <button type="button" className="sleep-empty-cta sleep-empty-cta--primary" onClick={() => setFormOpen(true)}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              新增記錄
            </button>
            <button type="button" className="sleep-empty-cta sleep-empty-cta--glass" onClick={() => setImportOpen(true)}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              導入日誌
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ── Dashboard ── */

  return (
    <section className="sleep-center" data-echo={lunaReaction.mood} data-drift={personalityDrift.state}>
        <div className="sleep-center-toolbar">
        <div>
          <span className="sleep-center-kicker">Life Rhythm Center</span>
          <h2>生活節奏</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="sleep-button sleep-button--glass" onClick={() => setImportOpen(true)}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            導入
          </button>
          <button type="button" className="sleep-button sleep-button--glass" onClick={() => handleBehaviorEvent({ type: 'settle' })}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            結算
          </button>
          <button type="button" className="sleep-button sleep-button--glass" onClick={() => setFormOpen(true)}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            新增
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <nav className="sleep-section-tabs">
        <button
          type="button"
          className={section === 'today' ? 'active' : ''}
          onClick={() => setSection('today')}
        >今日</button>
        <button
          type="button"
          className={section === 'archive' ? 'active' : ''}
          onClick={() => setSection('archive')}
        >歷史收據{sleepReceipts.length > 0 && <span>{sleepReceipts.length}</span>}</button>
        <button
          type="button"
          className={section === 'intelligence' ? 'active' : ''}
          onClick={() => setSection('intelligence')}
        >智慧分析</button>
      </nav>

      {/* ═══════════════════════════════════════════════
          STATE BAR — mood dominant, secondary metrics below
          ═══════════════════════════════════════════════ */}
      <article className="sleep-glass-card state-bar-card" data-drift={personalityDrift.state}>
        <div className="state-bar-primary">
          <span className={`state-bar-emoji state-bar-emoji--${lunaReaction.mood}`}>
            {lunaReaction.mood === 'calm' ? '🌿' : lunaReaction.mood === 'warm' ? '☀️' : '🌊'}
          </span>
          <span className="state-bar-bias">
            {lunaReaction.bias > 0 ? '+' : ''}{lunaReaction.bias}
          </span>
          <span className="state-bar-mood-label">
            {lunaReaction.mood === 'calm' ? '平靜' : lunaReaction.mood === 'warm' ? '晴朗' : '平穩'}
          </span>
        </div>
        <div className="state-bar-secondary">
          <span className={`state-bar-chip${streak > 0 ? ' state-bar-chip--has' : ''}`}>
            📆{streak}d
          </span>
          <span className={`state-bar-chip${gachaChances > 0 ? ' state-bar-chip--active' : ''}`}>
            ☆{gachaChances}
          </span>
          <span className={`state-bar-chip state-bar-chip--${personalityDrift.state}`}>
            {personalityDrift.state === 'calm' ? '🌙' : personalityDrift.state === 'warm' ? '🔥' : '✨'}
            {' '}{personalityDrift.avg.toFixed(1)}
          </span>
        </div>
      </article>

      {/* ── Today Dashboard ── */}
      {section === 'today' && (
        <>
          {/* View toggle */}
          <SleepViewToggle value={view} onChange={setView} />

      {latest && view === 'day' && (
        <div className="life-rhythm-dashboard">
          <section className="life-rhythm-level life-rhythm-level--metrics" aria-labelledby="life-rhythm-metrics-title">
            <button
              type="button"
              className="life-rhythm-collapse-toggle"
              onClick={() => setMetricsOpen((o) => !o)}
              aria-expanded={metricsOpen}
            >
              <div className="life-rhythm-level-heading">
                <span>Level 2</span>
                <h3 id="life-rhythm-metrics-title">Core Metrics</h3>
              </div>
              <svg className={`life-rhythm-chevron${metricsOpen ? ' open' : ''}`} viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className="life-rhythm-metrics-grid" style={{ display: metricsOpen ? undefined : 'none' }}>
              <article className="sleep-glass-card sleep-overview-card rhythm-data-card">
                <div className="sleep-card-heading">
                  <div>
                    <span>Rhythm Overview</span>
                    <h3>睡眠</h3>
                  </div>
                </div>
                <div className="rhythm-overview-value">
                  <strong>{formatDuration(latest.durationMinutes)}</strong>
                  <span>Duration</span>
                </div>
                <div className="rhythm-overview-data">
                  <div><span>Sleep</span><strong>{latest.sleepStart}</strong></div>
                  <div><span>Wake</span><strong>{latest.sleepEnd}</strong></div>
                  <div><span>REM</span><strong>{stageTotals.rem}m</strong></div>
                  <div><span>Deep</span><strong>{stageTotals.deep}m</strong></div>
                  <div><span>Core</span><strong>{stageTotals.core}m</strong></div>
                  <div><span>Cycle</span><strong>{periodSummary}</strong></div>
                </div>
              </article>

              {latest.heartRate.average > 0 && (
                <article className="sleep-glass-card sleep-vitals-card rhythm-data-card">
                  <div className="sleep-card-heading">
                    <div>
                      <span>Vitals</span>
                      <h3>Heart Rate</h3>
                    </div>
                  </div>
                  <div className="sleep-heart-value">
                    <strong>{latest.heartRate.average}</strong>
                    <span>bpm</span>
                  </div>
                  <svg className="sleep-heart-chart" viewBox="0 0 240 80" role="img" aria-label="睡眠心率折線">
                    <defs>
                      <linearGradient id="sleepHeartFade" x1="0" x2="1">
                        <stop offset="0" stopColor="var(--sleep-blue-soft)" stopOpacity="0.3" />
                        <stop offset="0.5" stopColor="var(--sleep-blue)" stopOpacity="1" />
                        <stop offset="1" stopColor="var(--sleep-lilac)" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>
                    <polyline points={heartRatePoints(latest)} fill="none" stroke="url(#sleepHeartFade)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="sleep-vitals-range">
                    <span>MIN <strong>{latest.heartRate.min}</strong></span>
                    <span>MAX <strong>{latest.heartRate.max}</strong></span>
                  </div>
                </article>
              )}

              <article className="sleep-glass-card sleep-activity-card rhythm-data-card">
                <div className="sleep-card-heading">
                  <div>
                    <span>Daily Rhythm</span>
                    <h3>Activity</h3>
                  </div>
                </div>
                <div className="sleep-activity-grid">
                  <div data-tone="sleep"><ActivityIcon type="sleep" /><span>Sleep</span><strong>{formatDuration(latest.durationMinutes)}</strong></div>
                  <div data-tone="steps"><ActivityIcon type="steps" /><span>Steps</span><strong>{latest.steps > 0 ? latest.steps.toLocaleString() : '—'}</strong></div>
                  <div data-tone="heart"><ActivityIcon type="heart" /><span>Resting HR</span><strong>{latest.restingHeartRate > 0 ? <>{latest.restingHeartRate}<small>bpm</small></> : '—'}</strong></div>
                  <div data-tone="energy"><ActivityIcon type="energy" /><span>Energy</span><strong>{latest.activeEnergy > 0 ? <>{latest.activeEnergy}<small>kcal</small></> : '—'}</strong></div>
                </div>
              </article>
            </div>
          </section>

          <section className="life-rhythm-level life-rhythm-level--actions" aria-labelledby="life-rhythm-actions-title">
            <div className="life-rhythm-level-heading">
              <span>Level 3</span>
              <h3 id="life-rhythm-actions-title">Actions</h3>
            </div>
            <div className="life-rhythm-actions-bar">
              {/* Compact check-in chips */}
              <div className="lr-action-chips">
                {checkinActions.map((action) => {
                  const done = completedActions.includes(action.id);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      className={`lr-chip${done ? ' lr-chip--done' : ''}`}
                      disabled={done}
                      onClick={() => handleBehaviorEvent({ type: 'checkin', actionId: action.id })}
                    >
                      <span className="lr-chip-emoji">{action.emoji}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="lr-chip lr-chip--custom"
                  onClick={() => setShowCustomInput((o) => !o)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>

              {/* Custom input inline */}
              {showCustomInput && (
                <div className="lr-custom-inline">
                  <input
                    type="text"
                    placeholder="自訂行為"
                    value={customAction}
                    onChange={(e) => setCustomAction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customAction.trim()) {
                        handleBehaviorEvent({ type: 'custom_checkin' });
                      }
                    }}
                    autoFocus
                  />
                  <button type="button" onClick={() => handleBehaviorEvent({ type: 'custom_checkin' })}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                </div>
              )}

              {/* Gacha pull button */}
              <button
                type="button"
                className={`lr-gacha-btn${gachaChances > 0 ? ' lr-gacha-btn--ready' : ''}`}
                disabled={gachaChances === 0}
                onClick={() => handleBehaviorEvent({ type: 'gacha_pull' })}
                title={`共鳴 ${gachaChances} 次`}
              >
                <span className="lr-gacha-icon">☆</span>
                <span className="lr-gacha-count">{gachaChances}</span>
              </button>
            </div>

            {/* Reward display */}
            {gachaReward && (
              <div className="lr-reward">{gachaReward}</div>
            )}
          </section>

          <section className="life-rhythm-level life-rhythm-level--feedback" aria-labelledby="life-rhythm-feedback-title">
            <div className="life-rhythm-level-heading">
              <span>Level 4</span>
              <h3 id="life-rhythm-feedback-title">Feedback</h3>
            </div>
            <div className="life-rhythm-feedback-prime">
              <article className={`lr-feedback-frame lr-reaction-panel lr-reaction--${lunaReaction.mood}`} aria-label="Luna Reaction">
                <div className="lr-reaction-rows">
                  <span className={`lr-mood-chip lr-mood-chip--${lunaReaction.mood}`}>
                    {lunaReaction.mood === 'calm' ? '🌿' : lunaReaction.mood === 'warm' ? '☀️' : '🌊'}
                    {' '}{lunaReaction.mood === 'calm' ? '平靜' : lunaReaction.mood === 'warm' ? '晴朗' : '平穩'}
                  </span>
                  <span className={`lr-drift-chip lr-drift-chip--${personalityDrift.state}`}>
                    {personalityDrift.state === 'calm' ? '🌙' : personalityDrift.state === 'warm' ? '🔥' : '✨'}
                    {' '}{personalityDrift.state === 'calm' ? '平靜節奏' : personalityDrift.state === 'warm' ? '活躍' : '平衡'}
                  </span>
                </div>
                <div className="lr-reaction-log">
                  {completedActions.map((id) => {
                    const action = checkinActions.find((item) => item.id === id);
                    return <span key={id} className="lr-log-chip">{action ? action.emoji : '✏️'}</span>;
                  })}
                  {gachaMemories.slice(0, 3).map((memory) => (
                    <span key={memory.id} className="lr-log-chip lr-log-chip--gacha">
                      {memory.emoji}
                      <small>+{memory.moodDelta?.toFixed(1)}</small>
                    </span>
                  ))}
                </div>
              </article>

              <article className="lr-feedback-frame lr-sleep-frame" aria-label="Night Flow">
                <SleepTimeline record={latest} />
              </article>
            </div>
          </section>
        </div>
      )}

      {/* ── 趨勢總覽 (週 / 月 / 6個月) ── */}
      {view !== 'day' && filteredRecords.length > 0 && (
        <SleepOverviewTrend records={filteredRecords} view={view} />
      )}

      {view !== 'day' && filteredRecords.length === 0 && (
        <div className="sleep-glass-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>無記錄</p>
        </div>
      )}
        </>
      )}

      {/* ── Archive Section ── */}
      {section === 'archive' && (
        <SleepReceiptArchive
          onOpenReceipt={(id) => setReceiptDetailId(id)}
          onExportPNG={handleExportPNG}
          onExportPDF={handleExportPDF}
          onSaveToSecondBrain={saveSleepReceiptAction}
          onDelete={deleteSleepReceiptAction}
        />
      )}

      {/* ── Intelligence Section ── */}
      {section === 'intelligence' && (
        <SleepIntelligence records={records} />
      )}

      {formOpen && (
        <SleepFormSheet
          onSave={handleSave}
          onClose={() => setFormOpen(false)}
        />
      )}

      {importOpen && (
        <SleepImportSheet
          onClose={() => setImportOpen(false)}
          onImported={() => {
            refreshRecords();
            const d = new Date();
            setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            setView('day');
          }}
        />
      )}

      {/* ── Detail Drawer ── */}
      {selectedReceipt && (
        <SleepReceiptDetailDrawer
          receipt={selectedReceipt}
          onClose={() => setReceiptDetailId(null)}
          onExportPNG={handleExportPNG}
          onExportPDF={handleExportPDF}
          onSaveToSecondBrain={saveSleepReceiptAction}
          onDelete={(id) => { deleteSleepReceiptAction(id); setReceiptDetailId(null); }}
        />
      )}

    </section>
  );
}

/* ══════════════════════════════════════
   SLEEP OVERVIEW TREND (week / month / 6M)
   ══════════════════════════════════════ */
function SleepOverviewTrend({ records, view }: { records: SleepRecord[]; view: SleepView }) {
  const avgDuration = useMemo(() => {
    if (records.length === 0) return 0;
    return Math.round(records.reduce((s, r) => s + r.durationMinutes, 0) / records.length);
  }, [records]);

  const avgStages = useMemo(() => {
    if (records.length === 0) return { awake: 0, rem: 0, core: 0, deep: 0 };
    const totals = { awake: 0, rem: 0, core: 0, deep: 0, count: 0 };
    for (const r of records) {
      const stages = r.stages.reduce<Record<SleepStageType, number>>(
        (t, s) => ({ ...t, [s.type]: t[s.type] + s.minutes }),
        { awake: 0, rem: 0, core: 0, deep: 0 },
      );
      totals.awake += stages.awake;
      totals.rem += stages.rem;
      totals.core += stages.core;
      totals.deep += stages.deep;
      totals.count++;
    }
    return {
      awake: Math.round(totals.awake / totals.count),
      rem: Math.round(totals.rem / totals.count),
      core: Math.round(totals.core / totals.count),
      deep: Math.round(totals.deep / totals.count),
    };
  }, [records]);

  // Daily mini bars sorted by date
  const dailyBars = useMemo(() => {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const maxDur = Math.max(...sorted.map(r => r.durationMinutes), 1);
    return sorted.map(r => ({
      date: r.date,
      duration: r.durationMinutes,
      pct: (r.durationMinutes / maxDur) * 100,
      quality: r.quality,
    }));
  }, [records]);

  const qualityCounts = useMemo(() => {
    const counts = { poor: 0, fair: 0, good: 0, great: 0 };
    for (const r of records) {
      if (counts[r.quality] !== undefined) counts[r.quality]++;
    }
    return counts;
  }, [records]);

  const viewLabel = view === 'week' ? '7' : view === 'month' ? '30' : '180';

  return (
    <div className="sleep-center-grid">
      {/* Avg overview */}
      <article className="sleep-glass-card sleep-overview-card">
        <div className="sleep-card-heading">
          <div>
            <span>{viewLabel}天趨勢</span>
            <h3>平均睡眠</h3>
          </div>
        </div>
        <div className="sleep-overview-main">
          <div className="sleep-overview-duration">
            <span>平均時長</span>
            <strong>{formatDuration(avgDuration)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <span className="sleep-quality-pill" style={{ fontSize: 9, padding: '3px 8px' }}>
              {records.length} 筆記錄
            </span>
          </div>
        </div>
      </article>

      {/* Avg stage breakdown */}
      <article className="sleep-glass-card">
        <div className="sleep-card-heading">
          <div><span>Average</span><h3>平均階段</h3></div>
        </div>
        <div className="sleep-stage-legend" style={{ marginTop: 12 }}>
          {([['awake', '清醒', 'var(--sleep-blue-soft)'], ['rem', 'REM', 'var(--sleep-blue-soft)'], ['core', '核心', 'var(--sleep-blue)'], ['deep', '深睡', 'var(--sleep-indigo)']] as const).map(([type, label, color]) => (
            <span key={type}>
              <i className="sleep-stage-key" style={{ background: color }} />
              {label}
              <strong>{avgStages[type as keyof typeof avgStages]}m</strong>
            </span>
          ))}
        </div>
      </article>

      {/* Daily mini bars */}
      <article className="sleep-glass-card" style={{ gridColumn: 'span 2' }}>
        <div className="sleep-card-heading">
          <div><span>Daily</span><h3>每日時長</h3></div>
        </div>
        <div className="sleep-trend-bars">
          {dailyBars.map((bar) => (
            <div key={bar.date} className="sleep-trend-bar-item" title={`${bar.date} ${formatDuration(bar.duration)}`}>
              <div className="sleep-trend-bar-track">
                <div
                  className="sleep-trend-bar-fill"
                  style={{ height: `${bar.pct}%` }}
                  data-quality={bar.quality}
                />
              </div>
              <span className="sleep-trend-bar-label">
                {bar.date.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </article>

      {/* Quality distribution */}
      <article className="sleep-glass-card" style={{ gridColumn: 'span 2' }}>
        <div className="sleep-card-heading">
          <div><span>Quality</span><h3>品質分佈</h3></div>
        </div>
        <div className="sleep-quality-dist">
          {(['great', 'good', 'fair', 'poor'] as const).map((q) => {
            const count = qualityCounts[q];
            const pct = records.length > 0 ? (count / records.length) * 100 : 0;
            const label = { great: 'great', good: 'good', fair: 'fair', poor: 'poor' }[q];
            return (
              <div key={q} className="sleep-quality-dist-item">
                <span className="sleep-quality-dist-label">{label}</span>
                <div className="sleep-quality-dist-track">
                  <div
                    className="sleep-quality-dist-fill"
                    style={{ width: `${pct}%` }}
                    data-tone={q}
                  />
                </div>
                <span className="sleep-quality-dist-count">{count}</span>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}

/* ══════════════════════════════════════
   SLEEP INTELLIGENCE (insights tab)
   ══════════════════════════════════════ */
function SleepIntelligence({ records }: { records: SleepRecord[] }) {
  const stats = useMemo(() => {
    if (records.length === 0) return null;
    const totalRecords = records.length;
    const avgDuration = Math.round(records.reduce((s, r) => s + r.durationMinutes, 0) / totalRecords);
    const avgDeep = Math.round(records.reduce((s, r) => {
      const d = r.stages.filter(st => st.type === 'deep').reduce((a, b) => a + b.minutes, 0);
      return s + d;
    }, 0) / totalRecords);
    const avgRem = Math.round(records.reduce((s, r) => {
      const d = r.stages.filter(st => st.type === 'rem').reduce((a, b) => a + b.minutes, 0);
      return s + d;
    }, 0) / totalRecords);
    const avgCore = Math.round(records.reduce((s, r) => {
      const d = r.stages.filter(st => st.type === 'core').reduce((a, b) => a + b.minutes, 0);
      return s + d;
    }, 0) / totalRecords);
    const avgScore = Math.round(records.reduce((s, r) => {
      const stages = r.stages.reduce<Record<string, number>>(
        (t, st) => ({ ...t, [st.type]: t[st.type] + st.minutes }),
        { awake: 0, rem: 0, core: 0, deep: 0 },
      );
      return s + computeSleepScore(r.durationMinutes, stages.deep, stages.rem, stages.awake);
    }, 0) / totalRecords);

    const qualityCounts = { poor: 0, fair: 0, good: 0, great: 0 };
    for (const r of records) qualityCounts[r.quality]++;

    const recentRecords = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const scoreTrend = recentRecords.map(r => {
      const stages = r.stages.reduce<Record<string, number>>(
        (t, st) => ({ ...t, [st.type]: t[st.type] + st.minutes }),
        { awake: 0, rem: 0, core: 0, deep: 0 },
      );
      return computeSleepScore(r.durationMinutes, stages.deep, stages.rem, stages.awake);
    });
    return { totalRecords, avgDuration, avgDeep, avgRem, avgCore, avgScore, qualityCounts, scoreTrend };
  }, [records]);

  const label = stats ? sleepScoreLabel(stats.avgScore) : 'N/A';

  if (!stats) {
    return (
      <div className="sleep-glass-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>無記錄</p>
      </div>
    );
  }

  return (
    <div className="sleep-center-grid">
      <article className="sleep-glass-card" style={{ gridColumn: 'span 2' }}>
        <div className="sleep-card-heading">
          <div><span>Intelligence</span><h3>睡眠總覽</h3></div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--text-3)', fontSize: 10, display: 'block' }}>平均分數</span>
            <strong style={{ fontFamily: 'var(--f-d)', fontSize: 36, fontWeight: 500, lineHeight: 1.1 }}>
              {stats.avgScore}
              <small style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>{label}</small>
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-3)', fontSize: 10, display: 'block' }}>記錄筆數</span>
            <strong style={{ fontFamily: 'var(--f-d)', fontSize: 36, fontWeight: 500, lineHeight: 1.1 }}>{stats.totalRecords}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-3)', fontSize: 10, display: 'block' }}>平均時長</span>
            <strong style={{ fontFamily: 'var(--f-d)', fontSize: 36, fontWeight: 500, lineHeight: 1.1 }}>
              {Math.floor(stats.avgDuration / 60)}h{stats.avgDuration % 60}m
            </strong>
          </div>
        </div>
      </article>

      <article className="sleep-glass-card" style={{ gridColumn: 'span 2' }}>
        <div className="sleep-card-heading">
          <div><span>Trend</span><h3>近期分數趨勢</h3></div>
        </div>
        <div className="sleep-trend-bars" style={{ height: 80, marginTop: 12 }}>
          {stats.scoreTrend.map((score, i) => {
            const pct = Math.max(8, (score / 100) * 100);
            const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--sleep-blue)' : score >= 40 ? 'var(--sleep-lilac)' : 'var(--danger)';
            return (
              <div key={i} className="sleep-trend-bar-item">
                <div className="sleep-trend-bar-track">
                  <div className="sleep-trend-bar-fill" style={{ height: `${pct}%`, background: color, borderRadius: '7px 7px 0 0' }} />
                </div>
                <span className="sleep-trend-bar-label">{score}</span>
              </div>
            );
          })}
        </div>
      </article>

      <article className="sleep-glass-card">
        <div className="sleep-card-heading">
          <div><span>Average</span><h3>平均階段</h3></div>
        </div>
        <div className="sleep-stage-legend" style={{ marginTop: 12 }}>
          {([['deep', '深睡', '#4a5d9e', stats.avgDeep], ['rem', 'REM', '#7fc1d9', stats.avgRem], ['core', '核心', '#5b8ec9', stats.avgCore]] as const).map(([type, label, color, value]) => (
            <span key={type as string}>
              <i className="sleep-stage-key" style={{ background: color as string }} />
              {label as string}
              <strong>{value as number}m</strong>
            </span>
          ))}
        </div>
      </article>

      <article className="sleep-glass-card">
        <div className="sleep-card-heading">
          <div><span>Quality</span><h3>品質分佈</h3></div>
        </div>
        <div className="sleep-quality-dist" style={{ marginTop: 12 }}>
          {(['great', 'good', 'fair', 'poor'] as const).map((q) => {
            const count = stats.qualityCounts[q];
            const pct = stats.totalRecords > 0 ? (count / stats.totalRecords) * 100 : 0;
            const qLabel = { great: 'great', good: 'good', fair: 'fair', poor: 'poor' }[q];
            return (
              <div key={q} className="sleep-quality-dist-item">
                <span className="sleep-quality-dist-label">{qLabel}</span>
                <div className="sleep-quality-dist-track">
                  <div className="sleep-quality-dist-fill" style={{ width: `${pct}%` }} data-tone={q} />
                </div>
                <span className="sleep-quality-dist-count">{count}</span>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}
