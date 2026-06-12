import { useState, type FormEvent } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { TodoIcon, LowPriorityIcon, MediumPriorityIcon, HighPriorityIcon } from '@/components/icons/LunartideIcons';
import { t } from '@/i18n';
import { toLocalDateString } from '@/utils/date';

interface QuickTodoSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITIES = [
  { value: 'low' as const, icon: LowPriorityIcon, color: 'var(--teal)', ariaKey: 'todo.priorityLow' },
  { value: 'medium' as const, icon: MediumPriorityIcon, color: 'var(--amber)', ariaKey: 'todo.priorityMedium' },
  { value: 'high' as const, icon: HighPriorityIcon, color: 'var(--danger)', ariaKey: 'todo.priorityHigh' },
];

export function QuickTodoSheet({ isOpen, onClose }: QuickTodoSheetProps) {
  const addTodo = useAppStore((s) => s.addTodo);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) { setError(t('sheet.todoError')); return; }
    addTodo({
      title: trimmed,
      date: toLocalDateString(),
      priority,
      category: 'life',
      repeat: 'none',
    });
    setTitle(''); setPriority('medium'); setError(''); setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 600);
  };

  const handleBackdrop = () => {
    setTitle(''); setPriority('medium'); setError(''); setSaved(false); onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`quick-sheet-overlay ${isOpen ? 'active' : ''}`} onClick={handleBackdrop}>
      <form className={`quick-sheet ${saved ? 'saved' : ''}`} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <div className="quick-sheet-head-icon"><TodoIcon size={20} /></div>
          <span className="quick-sheet-title">{t('sheet.newTodo')}</span>
        </div>
        <div className="quick-sheet-body">
          <input className={`quick-sheet-input ${error ? 'has-error' : ''}`} type="text"
            placeholder={t('sheet.todoPlaceholder')} value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }} autoFocus />
          {error && <span className="quick-sheet-error">{error}</span>}

          <div className="quick-sheet-field">
            <span className="quick-sheet-label">{t('sheet.priority')}</span>
            <div className="mood-icons">
              {PRIORITIES.map((p) => {
                const Icon = p.icon;
                const isActive = priority === p.value;
                return (
                  <button key={p.value} type="button"
                    className={`mood-icon-btn ${isActive ? 'active' : ''}`}
                    style={{ '--mood-color': p.color } as React.CSSProperties}
                    onClick={() => setPriority(p.value)}
                    aria-label={t(p.ariaKey)} data-tooltip={t(p.ariaKey)}>
                    <Icon size={20} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={handleBackdrop}>{t('sheet.cancel')}</button>
          <button type="submit" className="btn-primary">{saved ? t('sheet.saved') : t('sheet.save')}</button>
        </div>
      </form>
    </div>
  );
}
