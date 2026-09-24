import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { TimePickerSheet } from '@/components/ui/TimePickerSheet';
import { LowPriorityIcon, MediumPriorityIcon, HighPriorityIcon, ClockIcon } from '@/components/icons/LunartideIcons';
import { t } from '@/i18n';
import { toLocalDateString } from '@/utils/date';

/* Simple calendar SVG inline — avoids extra icon export */
function CalIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

interface TodoFormProps {
  onDone: () => void;
}

const today = toLocalDateString();

const PRIORITIES = [
  { value: 'low' as const, icon: LowPriorityIcon, color: 'var(--teal)', aria: t('todo.priorityLow') },
  { value: 'medium' as const, icon: MediumPriorityIcon, color: 'var(--amber)', aria: t('todo.priorityMedium') },
  { value: 'high' as const, icon: HighPriorityIcon, color: 'var(--danger)', aria: t('todo.priorityHigh') },
];

function formatZhDate(dateStr: string): string {
  if (!dateStr) return '選擇日期';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function TodoForm({ onDone }: TodoFormProps) {
  const addTodo = useAppStore((s) => s.addTodo);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    addTodo({
      title: title.trim(),
      date,
      time: time || undefined,
      priority,
      category: category.trim() === '工作' ? 'work' : 'life',
      notes: note.trim() || undefined,
      repeat: 'none',
    });
    onDone();
  };

  return (
    <div className="drawer-form">
      <div>
        <label>{t('todo.formTitle')}</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('todo.formPlaceholder')} autoFocus />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>{t('todo.formDate')}</label>
          <button
            type="button"
            className="drawer-trigger-btn"
            onClick={() => setDatePickerOpen(true)}
          >
            <CalIcon />
            <span className={date ? '' : 'drawer-trigger-placeholder'}>{formatZhDate(date)}</span>
          </button>
          <DatePickerSheet
            isOpen={datePickerOpen}
            value={date}
            onConfirm={(d) => setDate(d)}
            onCancel={() => setDatePickerOpen(false)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>{t('todo.formTime')}</label>
          <button
            type="button"
            className="drawer-trigger-btn"
            onClick={() => setTimePickerOpen(true)}
          >
            <ClockIcon size={16} />
            <span className={time ? '' : 'drawer-trigger-placeholder'}>{time || '選擇時間'}</span>
          </button>
          <TimePickerSheet
            isOpen={timePickerOpen}
            value={time}
            onConfirm={(t) => setTime(t)}
            onCancel={() => setTimePickerOpen(false)}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>{t('todo.formPriority')}</label>
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            {PRIORITIES.map((p) => {
              const Icon = p.icon;
              const isActive = priority === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  className={`mood-icon-btn ${isActive ? 'active' : ''}`}
                  style={{ '--mood-color': p.color } as React.CSSProperties}
                  onClick={() => setPriority(p.value)}
                  aria-label={p.aria}
                  data-tooltip={p.aria}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label>{t('todo.formCategory')}</label>
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('todo.formCategoryPlaceholder')} />
        </div>
      </div>
      <div>
        <label>{t('todo.formNote')}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('todo.formNotePlaceholder')} />
      </div>
      <div className="drawer-form-actions">
        <button type="button" className="btn-ghost" onClick={onDone}>{t('sheet.cancel')}</button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={!canSave}>{t('todo.formAdd')}</button>
      </div>
    </div>
  );
}
