import { useState, type FormEvent } from 'react';
import { UniversalSheet } from '@/components/ui/UniversalSheet';
import { CalendarPopup } from '@/components/ui/CalendarPopup';
import { TimePickerPopup } from '@/components/ui/TimePickerPopup';
import { useAppStore } from '@/store/useAppStore';
import { LowPriorityIcon, MediumPriorityIcon, HighPriorityIcon } from '@/components/icons/LunartideIcons';
import { t } from '@/i18n';
import type { TodoItem } from '@/types';

const PRIORITY_OPTIONS: { value: TodoItem['priority']; label: string; Icon: typeof LowPriorityIcon; color: string }[] = [
  { value: 'high', label: '高', Icon: HighPriorityIcon, color: 'var(--danger)' },
  { value: 'medium', label: '中', Icon: MediumPriorityIcon, color: 'var(--amber)' },
  { value: 'low', label: '低', Icon: LowPriorityIcon, color: 'var(--teal)' },
];

interface TodoSheetProps {
  initialDate: string;
  todo?: TodoItem;
  onClose: () => void;
}

const CATEGORIES: { value: TodoItem['category']; label: string }[] = [
  { value: 'life', label: '生活' },
  { value: 'work', label: '工作' },
  { value: 'study', label: '學習' },
  { value: 'health', label: '健康' },
  { value: 'lunartide', label: '開發' },
  { value: 'shopping', label: '購物' },
  { value: 'other', label: '其他' },
];

const REPEATS: { value: TodoItem['repeat']; label: string }[] = [
  { value: 'none', label: '不重複' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
];

const REMINDER_PRESETS: { value: string; label: string }[] = [
  { value: '', label: '無' },
  { value: 'same_day', label: '當天' },
  { value: 'day_before', label: '1天前' },
  { value: 'three_days_before', label: '3天前' },
  { value: 'week_before', label: '1週前' },
  { value: 'two_weeks_before', label: '2週前' },
  { value: 'one_month_before', label: '1月前' },
];

function computeRemindAt(date: string, time: string, preset: string): string | undefined {
  if (!preset || preset === 'same_day') return date + (time ? `T${time}` : 'T00:00:00');
  const map: Record<string, number> = {
    day_before: -1, three_days_before: -3, week_before: -7,
    two_weeks_before: -14, one_month_before: -30,
  };
  const offset = map[preset];
  if (!offset) return undefined;
  const d = new Date(date + (time ? `T${time}` : 'T00:00:00'));
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export function TodoSheet({ initialDate, todo, onClose }: TodoSheetProps) {
  const addTodo = useAppStore((state) => state.addTodo);
  const updateTodo = useAppStore((state) => state.updateTodo);

  const [title, setTitle] = useState(todo?.title ?? '');
  const [date, setDate] = useState(todo?.date ?? initialDate);
  const [time, setTime] = useState(todo?.time ?? '');
  const [priority, setPriority] = useState<TodoItem['priority']>(todo?.priority ?? 'medium');
  const [category, setCategory] = useState<TodoItem['category']>(todo?.category ?? 'life');
  const [repeat, setRepeat] = useState<TodoItem['repeat']>(todo?.repeat ?? 'none');
  const [notes, setNotes] = useState(todo?.notes ?? '');
  const [remindAtPreset, setRemindAtPreset] = useState('');
  const [error, setError] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const presetsDate: { label: string; getValue: () => string }[] = [
    { label: '今天', getValue: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } },
    { label: '明天', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } },
    { label: '後天', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } },
  ];

  const HOUR_MS = 3600000;
  const MIN_MS = 60000;

  const presetsTime: { label: string; getValue: () => string }[] = [
    { label: '現在', getValue: () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } },
    { label: '30分鐘後', getValue: () => { const d = new Date(Date.now() + 30 * MIN_MS); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } },
    { label: '1小時後', getValue: () => { const d = new Date(Date.now() + HOUR_MS); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } },
    { label: '今晚', getValue: () => '21:00' },
  ];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('todo.titleRequired'));
      return;
    }

    const remindAt = computeRemindAt(date, time, remindAtPreset);

    const values = {
      title: trimmedTitle,
      date,
      time: time || undefined,
      dueDate: date,
      dueTime: time || undefined,
      priority,
      category,
      notes: notes.trim() || undefined,
      remindAt,
      reminderAt: remindAt,
      countdownEnabled: true,
      status: todo?.completed ? 'done' as const : 'pending' as const,
      repeat,
    };

    if (todo) {
      updateTodo(todo.id, values);
    } else {
      addTodo(values);
    }
    onClose();
  };

  const fmtDate = (d: string) => {
    if (!d) return '選擇日期';
    const parts = d.split('-');
    return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  };

  const isToday = (d: string) => {
    const n = new Date();
    const k = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    return d === k;
  };

  const isTomorrow = (d: string) => {
    const n = new Date();
    n.setDate(n.getDate() + 1);
    const k = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    return d === k;
  };

  const dayAfterTomorrow = (d: string) => {
    const n = new Date();
    n.setDate(n.getDate() + 2);
    const k = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    return d === k;
  };

  return (
    <UniversalSheet
      title={todo ? t('todo.editTitle') : t('todo.formAdd')}
      eyebrow={t('calendar.todoSection')}
      onClose={onClose}
      saveDisabled={!title.trim()}
      saveLabel={todo ? t('todo.saveChanges') : t('todo.formAdd')}
      as="form"
      onSubmit={handleSubmit}
    >
      {/* Title */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label" htmlFor="todo-title-input">要做什麼？</label>
        <input
          id="todo-title-input"
          className={`calendar-event-sheet-input${error ? ' error' : ''}`}
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setError(''); }}
          placeholder={t('todo.formPlaceholder')}
          autoFocus
        />
        {error && <small style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</small>}
      </div>

      {/* Date — quick presets + calendar popup */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">日期</label>
        <div className="cal-event-tag-row" style={{ marginBottom: 6 }}>
          {presetsDate.map(p => {
            const v = p.getValue();
            const active = date === v;
            return (
              <button
                key={p.label}
                type="button"
                className={`cal-event-tag${active ? ' active' : ''}`}
                onClick={() => { setDate(v); }}
                data-type={p.label === '今天' ? 'birthday' : p.label === '明天' ? 'anniversary' : 'important'}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="cal-event-date-wrapper">
          <div
            className="cal-event-date-trigger"
            onClick={() => setShowDatePicker(v => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowDatePicker(v => !v); } }}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className={`cal-event-date-text${!date ? ' placeholder' : ''}`}>
              {fmtDate(date)}
            </span>
            <svg className={`cal-event-date-chevron${showDatePicker ? ' open' : ''}`} viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {showDatePicker && (
            <CalendarPopup
              value={date}
              onSelect={d => { setDate(d); setShowDatePicker(false); }}
              onClose={() => setShowDatePicker(false)}
            />
          )}
        </div>
      </div>

      {/* Time — quick presets + time picker popup */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">時間（選填）</label>
        <div className="cal-event-tag-row" style={{ marginBottom: 6 }}>
          {presetsTime.map(p => {
            const v = p.getValue();
            const active = time === v;
            return (
              <button
                key={p.label}
                type="button"
                className={`cal-event-tag${active ? ' active' : ''}`}
                onClick={() => setTime(v)}
                data-type="birthday"
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="cal-event-date-wrapper">
          <div
            className="cal-event-date-trigger"
            onClick={() => setShowTimePicker(v => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTimePicker(v => !v); } }}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className={`cal-event-date-text${!time ? ' placeholder' : ''}`}>
              {time || '自訂時間'}
            </span>
            <svg className={`cal-event-date-chevron${showTimePicker ? ' open' : ''}`} viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {showTimePicker && (
            <TimePickerPopup
              value={time}
              onSelect={t => { setTime(t); setShowTimePicker(false); }}
              onClose={() => setShowTimePicker(false)}
            />
          )}
        </div>
        {time && (
          <button
            type="button"
            className="cal-event-tag"
            onClick={() => setTime('')}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            清除時間
          </button>
        )}
      </div>

      {/* Priority — emoji buttons */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">優先級</label>
        <div className="cal-event-tag-row">
          {PRIORITY_OPTIONS.map((opt) => {
            const Icon = opt.Icon;
            return (
              <button
                key={opt.value}
                type="button"
                className={`cal-event-tag${priority === opt.value ? ' active' : ''}`}
                onClick={() => setPriority(opt.value)}
                data-type={opt.value === 'high' ? 'important' : opt.value === 'medium' ? 'birthday' : 'anniversary'}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span style={{ color: opt.color, display: 'flex' }}><Icon size={14} /></span>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category — Luna tags (single-select) */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">分類</label>
        <div className="cal-event-tag-row">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              className={`cal-event-tag${category === c.value ? ' active' : ''}`}
              onClick={() => setCategory(c.value)}
              data-type={c.value === 'life' ? 'birthday' : c.value === 'work' ? 'anniversary' : 'important'}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Repeat — Luna tags */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">重複</label>
        <div className="cal-event-tag-row">
          {REPEATS.map(r => (
            <button
              key={r.value}
              type="button"
              className={`cal-event-tag${repeat === r.value ? ' active' : ''}`}
              onClick={() => setRepeat(r.value)}
              data-type={r.value === 'none' ? 'birthday' : 'important'}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reminder — Luna tags */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label">提醒時間</label>
        <div className="cal-event-tag-row">
          {REMINDER_PRESETS.map(r => (
            <button
              key={r.value}
              type="button"
              className={`cal-event-tag cal-event-reminder-tag${remindAtPreset === r.value ? ' active' : ''}`}
              onClick={() => setRemindAtPreset(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="calendar-event-sheet-field">
        <label className="calendar-event-sheet-label" htmlFor="todo-notes-input">備註</label>
        <textarea
          id="todo-notes-input"
          className="calendar-event-sheet-input calendar-event-sheet-textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('todo.formNotePlaceholder')}
          rows={2}
        />
      </div>
    </UniversalSheet>
  );
}
