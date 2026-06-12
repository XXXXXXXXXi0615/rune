import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { LowPriorityIcon, MediumPriorityIcon, HighPriorityIcon } from '@/components/icons/LunartideIcons';
import { t } from '@/i18n';
import { toLocalDateString } from '@/utils/date';

interface TodoFormProps {
  onDone: () => void;
}

const today = toLocalDateString();

const PRIORITIES = [
  { value: 'low' as const, icon: LowPriorityIcon, color: 'var(--teal)', aria: t('todo.priorityLow') },
  { value: 'medium' as const, icon: MediumPriorityIcon, color: 'var(--amber)', aria: t('todo.priorityMedium') },
  { value: 'high' as const, icon: HighPriorityIcon, color: 'var(--danger)', aria: t('todo.priorityHigh') },
];

export function TodoForm({ onDone }: TodoFormProps) {
  const addTodo = useAppStore((s) => s.addTodo);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>{t('todo.formTime')}</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
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
