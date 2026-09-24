import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackButton } from '@/components/layout/BackButton';
import { Card } from '@/components/ui/Card';
import { UniversalSheet } from '@/components/ui/UniversalSheet';
import { CalendarPopup } from '@/components/ui/CalendarPopup';
import { MemoryParticleHeatmap } from '@/components/home/MemoryParticleHeatmap';
import { MoodIcon } from '@/components/memory/MoodIcon';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { loadPeriodRecords, type PeriodRecord } from '@/utils/periodStorage';
import { compressImageFile } from '@/utils/imageCompression';
import { t } from '@/i18n';
import type { MemoryEntry, DiaryEntry, TodoItem, HealthRecord } from '@/types';

/* ── Types ── */

type EventType = 'birthday' | 'anniversary' | 'important';
type Reminder = 'none' | 'same_day' | 'day_before' | 'three_days_before' | 'week_before' | 'two_weeks_before' | 'one_month_before';
type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: string; // YYYY-MM-DD
  note?: string;
  color?: string;
  reminder: Reminder;
  recurrence: Recurrence;
  cover?: string;
  createdAt: number;
}

const EVENT_STORAGE_KEY = 'lunartide_calendar_events_v1';

const EVENT_LABELS: Record<EventType, string> = {
  birthday:     '\u{1F382} 生日',
  anniversary: '\u{1F389} 紀念日',
  important:   '\u{2B50} 重要日',
};

const EVENT_COLORS: Record<EventType, string> = {
  birthday:     '#f59e0b',
  anniversary: '#ec4899',
  important:   '#6366f1',
};

const REMINDER_LABELS: Record<Reminder, string> = {
  none:              '無',
  same_day:          '當天',
  day_before:        '1天前',
  three_days_before: '3天前',
  week_before:       '1週前',
  two_weeks_before:  '2週前',
  one_month_before:  '1月前',
};

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none:    '不重複',
  weekly:  '每週',
  monthly: '每月',
  yearly:  '每年',
};

/* ── Helpers ── */

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function loadEvents(): CalendarEvent[] {
  try {
    const data = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
    return data.map((ev: any) => ({ reminder: 'none' as const, recurrence: 'none' as const, ...ev }));
  } catch {
    return [];
  }
}

function saveEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events));
  } catch { /* unavailable */ }
}

function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(ds: string): string {
  if (!ds) return '';
  const [y, m, d] = ds.split('-');
  return `${parseInt(y)}年${parseInt(m)}月${parseInt(d)}日`;
}

/* ── Mood mapping (for calendar stats bar, kept from original) ── */

function memoryMapMood(entry: MemoryEntry): 'joy' | 'sad' | 'anger' | 'tired' | 'music' {
  const text = `${entry.scene} ${entry.triggerText} ${entry.bodyThoughts}`.toLowerCase();
  if (/音樂|歌曲|歌單|耳機|旋律|music|song/.test(text)) return 'music';
  if (entry.anxietyLevel >= 7) return 'sad';
  if (entry.anxietyLevel >= 5) return 'anger';
  if (entry.anxietyLevel >= 3) return 'joy';
  return 'tired';
}

/* ══════════════════════════════════════
   Event Form Modal
   ══════════════════════════════════════ */

function EventForm({ editing, onSave, onClose }: {
  editing: CalendarEvent | null;
  onSave: (data: { type: EventType; title: string; date: string; note?: string; color?: string; reminder: Reminder; recurrence: Recurrence; cover?: string }) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<EventType>(editing?.type || 'important');
  const [title, setTitle] = useState(editing?.title || '');
  const [date, setDate] = useState(editing?.date || '');
  const [note, setNote] = useState(editing?.note || '');
  const [reminder, setReminder] = useState<Reminder>(editing?.reminder || 'none');
  const [recurrence, setRecurrence] = useState<Recurrence>(editing?.recurrence || 'none');
  const [cover, setCover] = useState(editing?.cover || '');
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const handleSave = () => {
    setSubmitted(true);
    if (!title.trim() || !date.trim()) return;
    onSave({
      type,
      title: title.trim(),
      date: date.trim(),
      note: note.trim() || undefined,
      color: EVENT_COLORS[type],
      reminder,
      recurrence,
      cover: cover || undefined,
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImageFile(file, {
        maxWidth: 512, maxHeight: 512, outputType: 'image/webp', quality: 0.75,
      });
      const reader = new FileReader();
      reader.onload = () => setCover(reader.result as string);
      reader.readAsDataURL(blob);
    } catch {
      // fallback
    }
    setUploading(false);
  };

  const REMINDER_OPTIONS: { value: Reminder; label: string }[] = [
    { value: 'none', label: '無' },
    { value: 'same_day', label: '當天' },
    { value: 'day_before', label: '1天前' },
    { value: 'three_days_before', label: '3天前' },
    { value: 'week_before', label: '1週前' },
    { value: 'two_weeks_before', label: '2週前' },
    { value: 'one_month_before', label: '1月前' },
  ];

  const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
    { value: 'none', label: '不重複' },
    { value: 'weekly', label: '每週' },
    { value: 'monthly', label: '每月' },
    { value: 'yearly', label: '每年' },
  ];

  const fmtDate = (d: string) => {
    if (!d) return '選擇日期';
    const parts = d.split('-');
    return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  };

  return (
    <UniversalSheet
      title={editing ? '編輯事件' : '新增事件'}
      onClose={onClose}
      saveDisabled={!title.trim() || !date.trim()}
      saveLabel={editing ? '儲存' : '新增'}
      onSave={handleSave}
    >
      {/* Title */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label" htmlFor="cal-event-title-input">標題 *</label>
        <input
          id="cal-event-title-input"
          className={`calendar-event-sheet-input${submitted && !title.trim() ? ' error' : ''}`}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="事件名稱"
          autoFocus
        />
      </div>

      {/* Type — Luna tags */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">類型</label>
        <div className="cal-event-tag-row">
          {(Object.keys(EVENT_COLORS) as EventType[]).map(t => (
            <button
              key={t}
              type="button"
              className={`cal-event-tag${type === t ? ' active' : ''}`}
              data-type={t}
              onClick={() => setType(t)}
            >
              {EVENT_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Date — CalendarPopup */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">日期 *</label>
        <div className="cal-event-date-wrapper">
          <div
            className={`cal-event-date-trigger${submitted && !date.trim() ? ' error' : ''}`}
            onClick={() => setShowCalendar(v => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowCalendar(v => !v); } }}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className={`cal-event-date-text${!date ? ' placeholder' : ''}`}>
              {date ? fmtDate(date) : '選擇日期'}
            </span>
            <svg className={`cal-event-date-chevron${showCalendar ? ' open' : ''}`} viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {showCalendar && (
            <CalendarPopup
              value={date}
              onSelect={d => { setDate(d); setShowCalendar(false); }}
              onClose={() => setShowCalendar(false)}
            />
          )}
        </div>
      </div>

      {/* Reminder — Luna tags */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">提醒</label>
        <div className="cal-event-tag-row">
          {REMINDER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`cal-event-tag cal-event-reminder-tag${reminder === opt.value ? ' active' : ''}`}
              onClick={() => setReminder(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recurrence — Luna tags */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">重複</label>
        <div className="cal-event-tag-row">
          {RECURRENCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`cal-event-tag cal-event-reminder-tag${recurrence === opt.value ? ' active' : ''}`}
              onClick={() => setRecurrence(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cover */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">封面圖片</label>
        <div className="cal-event-cover-row">
          {cover ? (
            <div className="cal-event-cover-preview">
              <img src={cover} alt="" className="cal-event-cover-img" />
              <button type="button" className="cal-event-cover-remove" onClick={() => setCover('')} aria-label="移除封面">&#x2715;</button>
            </div>
          ) : (
            <label className="cal-event-cover-add">
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>{uploading ? '壓縮中…' : '上傳封面'}</span>
              <input type="file" accept="image/*" onChange={handleCoverUpload} hidden />
            </label>
          )}
        </div>
      </div>

      {/* Note */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label" htmlFor="cal-event-note-input">備註</label>
        <textarea
          id="cal-event-note-input"
          className="calendar-event-sheet-input calendar-event-sheet-textarea"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="備註…"
          rows={2}
        />
      </div>
    </UniversalSheet>
  );
}

/* ══════════════════════════════════════
   Main Page
   ══════════════════════════════════════ */

export function MemoryPage() {
  const memoryEntries = useAppStore(s => s.memoryEntries);
  const diaryEntries = useAppStore(s => s.diaryEntries);
  const todos = useAppStore(s => s.todos);
  const healthRecords = useAppStore(s => s.healthRecords);
  const showToast = useToastStore(s => s.showToast);

  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);
  const [periodRecords, setPeriodRecords] = useState<PeriodRecord[]>(() => {
    try { return loadPeriodRecords(); } catch { return []; }
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const persistEvents = (next: CalendarEvent[]) => {
    setEvents(next);
    saveEvents(next);
  };

  /* ── Calendar stats (kept from original) ── */
  const calStats = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthDays = new Set<string>();
    for (const e of memoryEntries) {
      const key = dateKey(e.createdAt);
      if (key.startsWith(ym)) monthDays.add(key);
    }
    let streak = 0;
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (;;) {
      const key = dateKey(cursor.getTime());
      if (monthDays.has(key) || (streak === 0 && dateKey(now.getTime()) === key && monthDays.has(key))) {
        if (monthDays.has(key)) streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        if (streak === 0 && dateKey(now.getTime()) === key) {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        break;
      }
    }
    const recent = [...memoryEntries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 7);
    const moodCounts = new Map<string, number>();
    for (const e of recent) {
      const m = memoryMapMood(e);
      moodCounts.set(m, (moodCounts.get(m) || 0) + 1);
    }
    let recentMood: string | null = null;
    let max = 0;
    for (const [m, c] of moodCounts) { if (c > max) { max = c; recentMood = m; } }
    return { monthDays: monthDays.size, streak, recentMood };
  }, [memoryEntries]);

  /* ── Date detail ── */
  const dateDetail = useMemo(() => {
    if (!selectedDate) return null;
    const dateDiary = diaryEntries.filter(e => e.date === selectedDate);
    const dateTodos = todos.filter(e => e.date === selectedDate);
    const dateSleep = healthRecords.filter(
      r => r.type === 'sleep' && r.date === selectedDate
    );
    const datePeriod = periodRecords.filter(
      r => selectedDate >= r.startDate && selectedDate <= r.endDate
    );
    return { diary: dateDiary, todos: dateTodos, sleep: dateSleep, period: datePeriod };
  }, [selectedDate, diaryEntries, todos, healthRecords, periodRecords]);

  /* ── Events for selected date ── */
  const dateEvents = useMemo(() => {
    if (!selectedDate) return [];
    // Show events on selected date, sorted by MM-DD (recurring annually)
    const selectedMd = selectedDate.slice(5);
    return events
      .filter(e => e.date === selectedDate || e.date.slice(5) === selectedMd)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [selectedDate, events]);

  /* ── Current month events ── */
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthEvents = useMemo(() =>
    events
      .filter(e => e.date.startsWith(currentMonth))
      .sort((a, b) => a.date.localeCompare(b.date)),
  [events, currentMonth]);

  /* ── Date click handler ── */
  const handleDayClick = useCallback((dk: string) => {
    setSelectedDate(prev => prev === dk ? null : dk);
  }, []);

  /* ── Event actions ── */
  const handleAddEvent = (data: { type: EventType; title: string; date: string; note?: string; color?: string; reminder: Reminder; recurrence: Recurrence; cover?: string }) => {
    const ev: CalendarEvent = { id: uid(), ...data, createdAt: Date.now() };
    persistEvents([ev, ...events]);
    setEventModalOpen(false);
    showToast('已新增事件');
  };

  const handleEditEvent = (id: string, data: { type: EventType; title: string; date: string; note?: string; color?: string; reminder: Reminder; recurrence: Recurrence; cover?: string }) => {
    persistEvents(events.map(e => e.id === id ? { ...e, ...data } : e));
    setEditingEvent(null);
    setEventModalOpen(false);
    showToast('已更新事件');
  };

  const handleDeleteEvent = (id: string) => {
    persistEvents(events.filter(e => e.id !== id));
    showToast('已刪除事件');
  };

  /* ── Render ── */
  return (
    <section id="memory-view" className="view">
      <header className="memory-page-header">
        <BackButton to="/" />
        <div className="memory-page-heading">
          <h1>{t('calendar.title')}</h1>
        </div>
        <div style={{ width: 44 }} />
      </header>

      <div className="calendar-scroll">
        {/* Calendar */}
        <Card className="memory-calendar-card memory-calendar-main">
          <div className="cal-stats-bar">
            <div className="cal-stat-item">
              <span className="cal-stat-value">{calStats.monthDays}</span>
              <span className="cal-stat-label">{t('memory.calMonthDays')}</span>
            </div>
            <div className="cal-stat-divider" />
            <div className="cal-stat-item">
              <span className="cal-stat-value">{calStats.streak}</span>
              <span className="cal-stat-label">{t('memory.calStreak')}</span>
            </div>
            <div className="cal-stat-divider" />
            <div className="cal-stat-item">
              <span className="cal-stat-value cal-stat-mood">
                {calStats.recentMood
                  ? <MoodIcon mood={calStats.recentMood as any} size={18} />
                  : '—'}
              </span>
              <span className="cal-stat-label">{t('memory.calRecentMood')}</span>
            </div>
          </div>
          <MemoryParticleHeatmap onDayClick={handleDayClick} />
        </Card>

        {/* Date Detail Panel */}
        {selectedDate && (
          <Card className="calendar-detail-card">
            <div className="calendar-detail-header">
              <h3 className="calendar-detail-title">
                {formatDateDisplay(selectedDate)}
                <span className="calendar-detail-weekday">
                  {new Date(selectedDate).toLocaleDateString('zh-TW', { weekday: 'long' })}
                </span>
              </h3>
              <button type="button" className="calendar-detail-close" onClick={() => setSelectedDate(null)} aria-label="關閉詳情">&#x2715;</button>
            </div>

            {dateDetail && (
              <div className="calendar-detail-body">
                {/* Events on this date */}
                {dateEvents.length > 0 && (
                  <div className="calendar-detail-section">
                    <div className="calendar-detail-section-title">事件</div>
                    {dateEvents.map(ev => (
                      <div key={ev.id} className="calendar-detail-event">
                        <span className="calendar-detail-event-tag" style={{ background: ev.color || EVENT_COLORS[ev.type] }}>
                          {EVENT_LABELS[ev.type]}
                        </span>
                        <span className="calendar-detail-event-title">{ev.title}</span>
                        {ev.note && <span className="calendar-detail-event-note">{ev.note}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Diary */}
                <div className="calendar-detail-section">
                  <div className="calendar-detail-section-title">
                    日記
                    {dateDetail.diary.length > 0 && <span className="calendar-detail-badge">{dateDetail.diary.length}</span>}
                  </div>
                  {dateDetail.diary.length === 0 ? (
                    <div className="calendar-detail-empty">尚無日記</div>
                  ) : dateDetail.diary.map(entry => (
                    <div key={entry.id} className="calendar-detail-item">
                      <div className="calendar-detail-item-title">{entry.title || '（無標題）'}</div>
                      {entry.content && <div className="calendar-detail-item-body">{entry.content.slice(0, 120)}{entry.content.length > 120 ? '…' : ''}</div>}
                    </div>
                  ))}
                </div>

                {/* Todos */}
                <div className="calendar-detail-section">
                  <div className="calendar-detail-section-title">
                    待辦
                    {dateDetail.todos.length > 0 && <span className="calendar-detail-badge">{dateDetail.todos.length}</span>}
                  </div>
                  {dateDetail.todos.length === 0 ? (
                    <div className="calendar-detail-empty">尚無待辦</div>
                  ) : dateDetail.todos.map(todo => (
                    <div key={todo.id} className={`calendar-detail-item${todo.completed ? ' done' : ''}`}>
                      <span className="calendar-detail-item-check">{todo.completed ? '✓' : '○'}</span>
                      <span className="calendar-detail-item-title">{todo.title}</span>
                    </div>
                  ))}
                </div>

                {/* Sleep */}
                <div className="calendar-detail-section">
                  <div className="calendar-detail-section-title">
                    睡眠
                    {dateDetail.sleep.length > 0 && <span className="calendar-detail-badge">{dateDetail.sleep.length}</span>}
                  </div>
                  {dateDetail.sleep.length === 0 ? (
                    <div className="calendar-detail-empty">尚無睡眠記錄</div>
                  ) : dateDetail.sleep.map(rec => (
                    <div key={rec.id} className="calendar-detail-item">
                      <span className="calendar-detail-item-title">
                        睡眠 {rec.sleepDurationMinutes != null ? `${Math.floor(rec.sleepDurationMinutes / 60)}h${rec.sleepDurationMinutes % 60}m` : '—'}
                      </span>
                      {rec.sleepStart && <span className="calendar-detail-item-meta">{rec.sleepStart} ~ {rec.sleepEnd}</span>}
                    </div>
                  ))}
                </div>

                {/* Period */}
                <div className="calendar-detail-section">
                  <div className="calendar-detail-section-title">
                    生理期
                    {dateDetail.period.length > 0 && <span className="calendar-detail-badge">{dateDetail.period.length}</span>}
                  </div>
                  {dateDetail.period.length === 0 ? (
                    <div className="calendar-detail-empty">尚無生理期記錄</div>
                  ) : dateDetail.period.map(rec => (
                    <div key={rec.id} className="calendar-detail-item">
                      <span className="calendar-detail-item-title">
                        {rec.startDate} ~ {rec.endDate}
                      </span>
                      {rec.symptoms.length > 0 && (
                        <div className="calendar-detail-item-meta">{rec.symptoms.join('、')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Events Section — Timeline */}
        <Card className="calendar-timeline-card-section">
          <div className="calendar-timeline-header">
            <h3 className="calendar-timeline-title">事件</h3>
            <button
              type="button"
              className="calendar-timeline-add"
              onClick={() => { setEditingEvent(null); setEventModalOpen(true); }}
              aria-label="新增事件"
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {currentMonthEvents.length === 0 ? (
            <div className="calendar-timeline-empty">本月尚無事件</div>
          ) : (
            <div className="calendar-timeline">
              <div className="calendar-timeline-rail" />
              {currentMonthEvents.map(ev => (
                <div key={ev.id} className="calendar-timeline-card" onClick={() => { setEditingEvent(ev); setEventModalOpen(true); }}>
                  <div className="calendar-timeline-dot" style={{ background: ev.color || EVENT_COLORS[ev.type] }} />
                  <div className="calendar-timeline-body">
                    <div className="calendar-timeline-meta">
                      <span className="calendar-timeline-date">{formatDateDisplay(ev.date)}</span>
                      <span className="calendar-timeline-tag" style={{ background: ev.color || EVENT_COLORS[ev.type] }}>
                        {EVENT_LABELS[ev.type]}
                      </span>
                      {ev.reminder && ev.reminder !== 'none' && (
                        <span className="calendar-timeline-reminder">{REMINDER_LABELS[ev.reminder]}</span>
                      )}
                      {ev.recurrence && ev.recurrence !== 'none' && (
                        <span className="calendar-timeline-reminder">{RECURRENCE_LABELS[ev.recurrence]}</span>
                      )}
                    </div>
                    <div className="calendar-timeline-card-title">{ev.title}</div>
                    {ev.cover && (
                      <div className="calendar-timeline-cover-wrap">
                        <img src={ev.cover} alt="" className="calendar-timeline-cover" />
                      </div>
                    )}
                    {ev.note && <div className="calendar-timeline-note">{ev.note}</div>}
                  </div>
                  <button
                    type="button"
                    className="calendar-timeline-del"
                    onClick={e => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                    aria-label="刪除事件"
                  >&#x2715;</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Event modal */}
      {eventModalOpen && (
        <EventForm
          editing={editingEvent}
          onSave={editingEvent ? (data) => handleEditEvent(editingEvent.id, data) : handleAddEvent}
          onClose={() => { setEditingEvent(null); setEventModalOpen(false); }}
        />
      )}
    </section>
  );
}
