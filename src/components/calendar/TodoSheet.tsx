import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { LowPriorityIcon, MediumPriorityIcon, HighPriorityIcon } from '@/components/icons/LunartideIcons';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';
import type { TodoItem } from '@/types';

interface TodoSheetProps {
  initialDate: string;
  todo?: TodoItem;
  onClose: () => void;
}

const PRIORITIES = [
  { value: 'low' as const, icon: LowPriorityIcon, color: 'var(--teal)', labelKey: 'todo.priorityLow' },
  { value: 'medium' as const, icon: MediumPriorityIcon, color: 'var(--amber)', labelKey: 'todo.priorityMedium' },
  { value: 'high' as const, icon: HighPriorityIcon, color: 'var(--danger)', labelKey: 'todo.priorityHigh' },
];

const CATEGORIES: TodoItem['category'][] = ['life', 'work', 'study', 'health', 'lunartide'];
const REPEATS: TodoItem['repeat'][] = ['none', 'daily', 'weekly', 'monthly'];

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
  const [remindAt, setRemindAt] = useState(todo?.remindAt ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('todo.titleRequired'));
      return;
    }

    const values = {
      title: trimmedTitle,
      date,
      time: time || undefined,
      priority,
      category,
      notes: notes.trim() || undefined,
      remindAt: remindAt || undefined,
      repeat,
    };

    if (todo) {
      updateTodo(todo.id, values);
    } else {
      addTodo(values);
    }
    onClose();
  };

  return createPortal(
    <div className="todo-sheet-overlay" onClick={onClose}>
      <form className="todo-sheet" onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
        <div className="todo-sheet-handle" />
        <header className="todo-sheet-header">
          <div>
            <div className="todo-sheet-eyebrow">{t('calendar.todoSection')}</div>
            <h2>{todo ? t('todo.editTitle') : t('todo.addTitle')}</h2>
          </div>
          <button type="button" className="todo-sheet-close" onClick={onClose} aria-label={t('sheet.cancel')}>×</button>
        </header>

        <div className="todo-sheet-body">
          <label className="todo-field">
            <span>{t('todo.formTitle')}</span>
            <input
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError('');
              }}
              placeholder={t('todo.formPlaceholder')}
              autoFocus
            />
            {error && <small className="todo-field-error">{error}</small>}
          </label>

          <div className="todo-field-grid">
            <label className="todo-field">
              <span>{t('todo.formDate')}</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
            <label className="todo-field">
              <span>{t('todo.formTime')}</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>

          <fieldset className="todo-field todo-priority-field">
            <legend>{t('todo.formPriority')}</legend>
            <div className="todo-priority-picker">
              {PRIORITIES.map((item) => {
                const PriorityIcon = item.icon;
                const active = priority === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`todo-priority-option ${active ? 'active' : ''}`}
                    style={{ '--priority-color': item.color } as React.CSSProperties}
                    onClick={() => setPriority(item.value)}
                    aria-label={t(item.labelKey)}
                    aria-pressed={active}
                  >
                    <PriorityIcon size={20} />
                    <span>{t(item.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="todo-field-grid">
            <label className="todo-field">
              <span>{t('todo.formCategory')}</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as TodoItem['category'])}>
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>{t(`todo.category.${value}`)}</option>
                ))}
              </select>
            </label>
            <label className="todo-field">
              <span>{t('todo.formRepeat')}</span>
              <select value={repeat} onChange={(event) => setRepeat(event.target.value as TodoItem['repeat'])}>
                {REPEATS.map((value) => (
                  <option key={value} value={value}>{t(`todo.repeat.${value}`)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="todo-field">
            <span>{t('todo.formReminder')}</span>
            <input type="datetime-local" value={remindAt} onChange={(event) => setRemindAt(event.target.value)} />
          </label>

          <label className="todo-field">
            <span>{t('todo.formNotes')}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('todo.formNotePlaceholder')} rows={4} />
          </label>
        </div>

        <footer className="todo-sheet-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('sheet.cancel')}</button>
          <button type="submit" className="btn-primary">{todo ? t('todo.saveChanges') : t('todo.formAdd')}</button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
