// ================================================================
// CountdownEditorSheet v2 — self-contained sheet with themed styles.
// Desktop: clamp(600px, 56vw, 680px). Mobile: bottom sheet.
// ================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveAsset, getAsset } from '@/store/assets';
import {
  type CountdownDirection,
  type CountdownEvent,
  type CountdownRecurrence,
  detectLocalTimezone,
  resolveCountdownDisplay,
  formatLocalDateKey,
} from '@/features/countdown/countdownEngine';
import { type CountdownEventDraft, useCountdownStore } from '@/features/countdown/useCountdownStore';
import { useNow } from '@/hooks/useNow';
import { LunartideDatePickerPopover } from './LunartideDatePickerPopover';
import { LunartideTimePickerPopover } from './LunartideTimePickerPopover';
import { COUNTDOWN_COLOR_TOKENS, COUNTDOWN_ICON_NAMES, CountdownGlyph } from './countdownVisuals';
import './CountdownEditor.css';

/* ── Props ── */
interface CountdownEditorSheetProps {
  event: CountdownEvent | null;
  defaultDate?: string;
  onClose: () => void;
}

/* ── Config ── */
const DIRECTION_CARDS = [
  { value: 'auto' as CountdownDirection, label: '自動', help: '未到→還有 N 天；已過→已經過 N 天' },
  { value: 'until' as CountdownDirection, label: '只倒數', help: '到期後顯示「已到期」' },
  { value: 'since' as CountdownDirection, label: '紀念日', help: '已過顯示天數；未到→尚未開始' },
];

const RECURRENCE_CHIPS = [
  { value: 'none' as CountdownRecurrence['type'], label: '不重複' },
  { value: 'monthly' as CountdownRecurrence['type'], label: '每月' },
  { value: 'yearly' as CountdownRecurrence['type'], label: '每年' },
];

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

/* ── Helpers ── */
function formatDisplayDate(yyyymmdd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyymmdd)) return yyyymmdd;
  const d = new Date(yyyymmdd + 'T00:00:00');
  if (isNaN(d.getTime())) return yyyymmdd;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = WEEKDAY_LABELS[d.getDay()];
  return `${y} 年 ${m} 月 ${day} 日（${wd}）`;
}

function isDirty(orig: CountdownEvent | null, draft: {
  title: string; targetAt: string; targetTime: string; direction: CountdownDirection;
  recurrence: CountdownRecurrence; includeTargetDay: boolean; showTime: boolean;
  pinnedToHome: boolean; colorToken?: string; iconId?: string; coverAssetId?: string;
}): boolean {
  if (!orig) {
    return draft.title.trim() !== '' || draft.direction !== 'auto' || draft.recurrence.type !== 'none'
      || draft.includeTargetDay !== false || draft.showTime !== false || draft.pinnedToHome !== false
      || draft.colorToken !== undefined || draft.iconId !== undefined || draft.coverAssetId !== undefined;
  }
  return draft.title !== (orig.title ?? '')
    || draft.targetAt !== orig.targetAt
    || draft.targetTime !== (orig.targetTime ?? '')
    || draft.direction !== (orig.direction ?? 'auto')
    || draft.recurrence.type !== (orig.recurrence?.type ?? 'none')
    || draft.includeTargetDay !== (orig.includeTargetDay ?? false)
    || draft.showTime !== (orig.showTime ?? false)
    || draft.pinnedToHome !== (orig.pinnedToHome ?? false)
    || draft.colorToken !== orig.colorToken
    || draft.iconId !== orig.iconId
    || draft.coverAssetId !== orig.coverAssetId;
}

/* ── Preview Pill ── */
function PreviewPill({ event, now }: { event: CountdownEvent; now: Date }) {
  const d = resolveCountdownDisplay(event, now);
  return (
    <div className="cde-preview-cap" data-mode={d.mode}>
      <span className="cde-preview-cap-icon">
        {event.iconId ? <CountdownGlyph name={event.iconId} size={16} /> : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l2.5 2.5" />
          </svg>
        )}
      </span>
      <span className="cde-preview-cap-meta">
        <strong>{event.title.trim() || '預覽'}</strong>
        <span>{d.mode === 'today' ? '就是今天' : d.mode === 'upcoming' ? '即將到來' : '已過去'}</span>
      </span>
      <span className="cde-preview-cap-count">
        {d.mode === 'today' ? '今天' : `${d.dayCount} 天`}
      </span>
    </div>
  );
}

/* ── Main ── */
export function CountdownEditorSheet({ event, defaultDate, onClose }: CountdownEditorSheetProps) {
  const addEvent = useCountdownStore((s) => s.addEvent);
  const updateEvent = useCountdownStore((s) => s.updateEvent);
  const deleteEvent = useCountdownStore((s) => s.deleteEvent);
  // `pinnedToHome` is written by the draft itself; `pinToWidget` only syncs the
  // widget's canonical main slot (never flips the event's pin state).
  const widgetPinnedEventId = useCountdownStore((s) => s.widgetConfig.pinnedEventId);
  const pinToWidget = useCountdownStore((s) => s.pinToWidget);
  const now = useNow('minute');

  const todayKey = formatLocalDateKey(now);
  const initialDate = event?.targetAt ?? defaultDate ?? todayKey;

  const [title, setTitle] = useState(event?.title ?? '');
  const [targetAt, setTargetAt] = useState(initialDate);
  const [targetTime, setTargetTime] = useState(event?.targetTime ?? '');
  const [direction, setDirection] = useState<CountdownDirection>(event?.direction ?? 'auto');
  const [recurrence, setRecurrence] = useState<CountdownRecurrence>(event?.recurrence ?? { type: 'none' });
  const [includeTargetDay, setIncludeTargetDay] = useState(event?.includeTargetDay ?? false);
  const [showTime, setShowTime] = useState(event?.showTime ?? false);
  const [pinnedToHome, setPinnedToHome] = useState(event?.pinnedToHome ?? false);
  const [colorToken, setColorToken] = useState<string | undefined>(event?.colorToken);
  const [iconId, setIconId] = useState<string | undefined>(event?.iconId);
  const [coverAssetId, setCoverAssetId] = useState<string | undefined>(event?.coverAssetId);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const dateCardRef = useRef<HTMLLabelElement>(null);
  const timeCardRef = useRef<HTMLDivElement>(null);

  // Detect coarse pointer (touch) vs fine pointer (desktop)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsCoarsePointer(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Dirty state
  const draftState = useMemo(() => ({
    title, targetAt, targetTime, direction, recurrence, includeTargetDay, showTime, pinnedToHome, colorToken, iconId, coverAssetId,
  }), [title, targetAt, targetTime, direction, recurrence, includeTargetDay, showTime, pinnedToHome, colorToken, iconId, coverAssetId]);
  const dirty = isDirty(event, draftState);

  const handleCancel = useCallback(() => {
    if (dirty) {
      if (!window.confirm('尚未儲存，確定要離開嗎？')) return;
    }
    onClose();
  }, [dirty, onClose]);

  // Field-level validation errors
  const errors = useMemo(() => {
    const e: string[] = [];
    if (submitted || title.length > 0) {
      if (!title.trim()) e.push('請輸入標題');
    }
    if (submitted || targetAt.length > 0) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetAt)) e.push('請選擇有效日期');
    }
    if (targetTime && !/^\d{2}:\d{2}$/.test(targetTime)) e.push('時間格式應為 HH:mm');
    return e;
  }, [submitted, title, targetAt, targetTime]);

  const isValid = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(targetAt);

  const previewDraft: CountdownEvent = useMemo(() => ({
    id: 'preview',
    title: title.trim() || '預覽',
    targetAt,
    targetTime: targetTime || undefined,
    timezone: event?.timezone || detectLocalTimezone(),
    direction,
    recurrence,
    includeTargetDay,
    showTime,
    pinnedToHome,
    colorToken,
    iconId,
    coverAssetId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }), [title, targetAt, targetTime, direction, recurrence, includeTargetDay, showTime, pinnedToHome, colorToken, iconId, coverAssetId, event?.timezone]);

  // Load cover preview
  useEffect(() => {
    if (!coverAssetId) { setCoverPreviewUrl(null); return; }
    let cancelled = false; let url: string | null = null;
    (async () => {
      try {
        const blob = await getAsset(coverAssetId);
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setCoverPreviewUrl(url);
      } catch { if (!cancelled) setCoverPreviewUrl(null); }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [coverAssetId]);

  const handleCoverFile = useCallback(async (file: File) => {
    try { setCoverAssetId(await saveAsset(file, file.type)); }
    catch { /* ignore */ }
  }, []);

  // ── Date change handler ──
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetAt(e.target.value);
    setSubmitted(false);
  }, []);

  // ── Time change handler: auto-enable showTime ──
  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTargetTime(val);
    setSubmitted(false);
    if (val) {
      setShowTime(true);
    }
  }, []);

  const handleClearTime = useCallback(() => {
    setTargetTime('');
  }, []);

  // Open time picker: popover on desktop, native on touch
  const handleTimeTrigger = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    if (isCoarsePointer) return;
    e.preventDefault();
    setTimePickerOpen(true);
  }, [isCoarsePointer]);

  const handleTimeSelect = useCallback((t: string) => {
    setTargetTime(t);
    setTimePickerOpen(false);
    if (t) setShowTime(true);
    timeCardRef.current?.focus();
  }, []);

  // Open date picker: popover on desktop, native on touch
  const handleDateTrigger = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    if (isCoarsePointer) return; // let native picker handle
    e.preventDefault();
    setDatePickerOpen(true);
  }, [isCoarsePointer]);

  const handleDateSelect = useCallback((d: string) => {
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setTargetAt(d);
    }
    setDatePickerOpen(false);
    dateCardRef.current?.focus();
  }, []);

  const handleSave = useCallback(() => {
    setSubmitted(true);
    if (!isValid) return;
    if (saving) return;
    setSaving(true);
    const draft: CountdownEventDraft = {
      title: title.trim(), targetAt, targetTime: targetTime || undefined,
      direction, recurrence, includeTargetDay, showTime,
      colorToken, iconId, coverAssetId, pinnedToHome,
    };
    if (event) {
      updateEvent(event.id, draft);
      if (pinnedToHome) pinToWidget(event.id);
      else if (widgetPinnedEventId === event.id) pinToWidget(null);
    } else {
      const id = addEvent(draft);
      if (pinnedToHome) pinToWidget(id);
    }
    onClose();
  }, [isValid, saving, title, targetAt, targetTime, direction, recurrence, includeTargetDay, showTime, pinnedToHome, colorToken, iconId, coverAssetId, event, addEvent, updateEvent, pinToWidget, widgetPinnedEventId, onClose]);

  const handleDelete = useCallback(() => {
    if (!event) return;
    if (!window.confirm(`確定退潮「${event.title}」？`)) return;
    deleteEvent(event.id);
    onClose();
  }, [event, deleteEvent, onClose]);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleCancel]);

  return createPortal(
    <div className="cde-backdrop" onClick={handleCancel}>
      <div className="cde-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={event ? '編輯倒數' : '建立倒數'}>

        {/* ═══ Header ═══ */}
        <header className="cde-header">
          <div className="cde-header-left">
            <span className="cde-eyebrow">TIDECOUNT</span>
            <h2>{event ? '編輯倒數' : '建立倒數'}</h2>
          </div>
        </header>

        {/* ═══ Body ═══ */}
        <div className="cde-body">
          {/* 1. Live Preview Capsule */}
          <PreviewPill event={previewDraft} now={now} />

          {/* 2. Basic Info */}
          <div className="cde-section">
            <span className="cde-section-label">基本資料</span>
            <input
              type="text"
              className={`cde-input${(submitted && !title.trim()) ? ' error' : ''}`}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setSubmitted(false); }}
              placeholder="例如：在一起紀念日"
              maxLength={200}
              autoFocus
            />
            {submitted && !title.trim() && <span className="cde-field-error">請輸入標題</span>}
          </div>

          {/* 3. Date + Time pickers (native inputs) */}
          <div className="cde-section">
            <span className="cde-section-label">目標日期與時間</span>
            <div className="cde-trigger-row">
              {/* ── Date ── */}
              <label
                ref={dateCardRef}
                className={`cde-trigger cde-trigger--date${(submitted && !/^\d{4}-\d{2}-\d{2}$/.test(targetAt)) ? ' error' : ''}`}
                onClick={handleDateTrigger}
                onKeyDown={(e) => { if (!isCoarsePointer && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDatePickerOpen(true); } }}
                tabIndex={isCoarsePointer ? undefined : 0}
                role={isCoarsePointer ? undefined : 'button'}
                aria-haspopup={isCoarsePointer ? undefined : 'dialog'}
                aria-expanded={isCoarsePointer ? undefined : datePickerOpen}
              >
                <span className="cde-trigger-label">日期</span>
                <span className="cde-trigger-value">{formatDisplayDate(targetAt)}</span>
                {!isCoarsePointer && (
                  <span className="cde-trigger-chevron">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </span>
                )}
                <input
                  ref={dateInputRef}
                  type="date"
                  className="cde-native-input"
                  value={targetAt}
                  onChange={handleDateChange}
                  aria-label="選擇日期"
                  tabIndex={-1}
                />
              </label>
              <LunartideDatePickerPopover
                isOpen={datePickerOpen && !isCoarsePointer}
                value={targetAt}
                onSelect={handleDateSelect}
                onClose={() => { setDatePickerOpen(false); dateCardRef.current?.focus(); }}
                anchorRef={dateCardRef}
              />

              {/* ── Time ── */}
              <div
                ref={timeCardRef}
                className={`cde-trigger cde-trigger--time${(submitted && targetTime && !/^\d{2}:\d{2}$/.test(targetTime)) ? ' error' : ''}`}
                onClick={handleTimeTrigger}
                onKeyDown={(e) => { if (!isCoarsePointer && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setTimePickerOpen(true); } }}
                tabIndex={isCoarsePointer ? undefined : 0}
                role={isCoarsePointer ? undefined : 'button'}
                aria-haspopup={isCoarsePointer ? undefined : 'dialog'}
                aria-expanded={isCoarsePointer ? undefined : timePickerOpen}
              >
                <label className="cde-time-inner">
                  <span className="cde-trigger-label">時間</span>
                  <span className={`cde-trigger-value${targetTime ? '' : ' placeholder'}`}>
                    {targetTime || '不設定時間'}
                  </span>
                  <input
                    ref={timeInputRef}
                    type="time"
                    className="cde-native-input"
                    value={targetTime}
                    onChange={handleTimeChange}
                    aria-label="選擇時間"
                    tabIndex={-1}
                  />
                </label>
                {targetTime && (
                  <button
                    type="button"
                    className="cde-time-clear"
                    onClick={(e) => { e.stopPropagation(); handleClearTime(); }}
                    aria-label="清除時間"
                    title="清除時間"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <LunartideTimePickerPopover
                isOpen={timePickerOpen && !isCoarsePointer}
                value={targetTime}
                onSelect={handleTimeSelect}
                onClose={() => { setTimePickerOpen(false); timeCardRef.current?.focus(); }}
                anchorRef={timeCardRef}
              />
            </div>
            {submitted && !/^\d{4}-\d{2}-\d{2}$/.test(targetAt) && <span className="cde-field-error">請選擇有效日期</span>}
            {submitted && targetTime && !/^\d{2}:\d{2}$/.test(targetTime) && <span className="cde-field-error">時間格式應為 HH:mm</span>}
          </div>

          {/* 4. Direction Cards */}
          <div className="cde-section">
            <span className="cde-section-label">顯示方式</span>
            <div className="cde-direction-cards">
              {DIRECTION_CARDS.map((card) => (
                <button
                  key={card.value}
                  type="button"
                  className={`cde-dir-card${direction === card.value ? ' active' : ''}`}
                  onClick={() => setDirection(card.value)}
                  aria-pressed={direction === card.value}
                >
                  <strong>{card.label}</strong>
                  <small>{card.help}</small>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Recurrence */}
          <div className="cde-section">
            <span className="cde-section-label">重複</span>
            <div className="cde-chip-row">
              {RECURRENCE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  className={`cde-chip${recurrence.type === chip.value ? ' active' : ''}`}
                  onClick={() => setRecurrence({ type: chip.value })}
                  aria-pressed={recurrence.type === chip.value}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Toggles — compact settings card with dividers */}
          <div className="cde-section">
            <span className="cde-section-label">細節</span>
            <div className="cde-settings-card">
              {/* 包含目標日 */}
              <label className="cde-settings-row">
                <div className="cde-settings-row-text">
                  <strong>包含目標日</strong>
                  <small>將目標日期計為第 1 天</small>
                </div>
                <span className="cde-settings-toggle">
                  <input type="checkbox" checked={includeTargetDay} onChange={(e) => setIncludeTargetDay(e.target.checked)} />
                </span>
              </label>

              <div className="cde-settings-divider" />

              {/* 顯示時間 */}
              <label className="cde-settings-row">
                <div className="cde-settings-row-text">
                  <strong>顯示時間</strong>
                  <small>{targetTime ? targetTime : '未設定時間'}</small>
                </div>
                <span className="cde-settings-toggle">
                  <input type="checkbox" checked={showTime} onChange={(e) => setShowTime(e.target.checked)} />
                </span>
              </label>

              <div className="cde-settings-divider" />

              {/* 置頂到月潮首頁 */}
              <label className="cde-settings-row">
                <div className="cde-settings-row-text">
                  <strong>置頂到月潮首頁</strong>
                  <small>顯示於首頁倒數 Widget</small>
                </div>
                <span className="cde-settings-toggle">
                  <input type="checkbox" checked={pinnedToHome} onChange={(e) => setPinnedToHome(e.target.checked)} />
                </span>
              </label>
            </div>
          </div>

          {/* 7. Color */}
          <div className="cde-section">
            <span className="cde-section-label">外觀 · 顏色</span>
            <div className="cde-color-row">
              {COUNTDOWN_COLOR_TOKENS.map((c) => (
                <button
                  key={c.token}
                  type="button"
                  className={`cde-color-swatch${colorToken === c.token ? ' active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setColorToken(colorToken === c.token ? undefined : c.token)}
                  aria-label={c.label}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* 8. Icon */}
          <div className="cde-section">
            <span className="cde-section-label">外觀 · 圖示</span>
            <div className="cde-icon-row">
              {COUNTDOWN_ICON_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`cde-icon-btn${iconId === name ? ' active' : ''}`}
                  onClick={() => setIconId(iconId === name ? undefined : name)}
                  aria-label={name}
                >
                  <CountdownGlyph name={name} />
                </button>
              ))}
            </div>
          </div>

          {/* 9. Cover */}
          <div className="cde-section">
            <span className="cde-section-label">自訂封面</span>
            {coverPreviewUrl ? (
              <div className="cde-cover-card-has">
                <img src={coverPreviewUrl} alt="封面預覽" />
                <div className="cde-cover-card-has-meta">
                  <strong>已選擇封面</strong>
                  <small>用於首頁 Widget 展示</small>
                </div>
                <div className="cde-cover-card-actions">
                  <label className="cde-cover-card-btn">
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCoverFile(f); e.currentTarget.value = ''; }} />
                    更換
                  </label>
                  <button type="button" className="cde-cover-card-btn danger" onClick={() => setCoverAssetId(undefined)}>移除</button>
                </div>
              </div>
            ) : (
              <label className="cde-cover-card">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCoverFile(f); e.currentTarget.value = ''; }} />
                <span className="cde-cover-card-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" /><circle cx="17" cy="8" r="2" /><path d="M21 14l-3.5-3.5L10 18H3l5-6 2 2" /></svg>
                </span>
                <div className="cde-cover-card-text">
                  <strong>上傳封面圖片</strong>
                  <small>JPG、PNG、WebP 或 AVIF</small>
                </div>
              </label>
            )}
          </div>

          {/* Validation summary */}
          {errors.length > 0 && (
            <div className="cde-section" role="alert">
              {errors.map((err, i) => (
                <span key={i} className="cde-field-error">{err}</span>
              ))}
            </div>
          )}

          {/* 10. Danger Zone */}
          {event && (
            <div className="cde-danger">
              <button type="button" className="cde-danger-btn" onClick={handleDelete}>刪除此倒數</button>
            </div>
          )}
        </div>

        {/* ═══ Footer ═══ */}
        <footer className="cde-footer">
          <button type="button" className="cde-footer-btn" onClick={handleCancel}>取消</button>
          <button
            type="button"
            className="cde-footer-btn primary"
            onClick={handleSave}
            disabled={(submitted && !isValid) || saving}
          >
            {event ? '更新' : '建立'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
