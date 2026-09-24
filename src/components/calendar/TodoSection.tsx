import type { TodoItem } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { LowPriorityIcon, MediumPriorityIcon, HighPriorityIcon, TodoIcon } from '@/components/icons/LunartideIcons';
import { t } from '@/i18n';

const PRIORITY_ICONS: Record<TodoItem['priority'], { icon: typeof LowPriorityIcon; color: string; labelKey: string; rank: number }> = {
  high: { icon: HighPriorityIcon, color: 'var(--danger)', labelKey: 'todo.priorityHigh', rank: 0 },
  medium: { icon: MediumPriorityIcon, color: 'var(--amber)', labelKey: 'todo.priorityMedium', rank: 1 },
  low: { icon: LowPriorityIcon, color: 'var(--teal)', labelKey: 'todo.priorityLow', rank: 2 },
};

interface TodoSectionProps {
  todos: TodoItem[];
  selectedDate: string;
  onAddTodo: () => void;
  onEditTodo: (todo: TodoItem) => void;
}

function isTodoOverdue(todo: TodoItem): boolean {
  if (todo.completed) return false;
  const deadline = new Date(`${todo.date}T${todo.time || '23:59'}:00`);
  return deadline.getTime() < Date.now();
}

export function TodoSection({ todos, selectedDate, onAddTodo, onEditTodo }: TodoSectionProps) {
  const toggleTodo = useAppStore((state) => state.toggleTodo);
  const deleteTodo = useAppStore((state) => state.deleteTodo);

  const dateTodos = todos
    .filter((todo) => todo.date === selectedDate)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityDifference = PRIORITY_ICONS[a.priority].rank - PRIORITY_ICONS[b.priority].rank;
      if (priorityDifference !== 0) return priorityDifference;
      return (a.time || '23:59').localeCompare(b.time || '23:59');
    });
  const incompleteCount = dateTodos.filter((todo) => !todo.completed).length;

  return (
    <div>
      <div className="calendar-section-header">
        <span className="calendar-section-title">
          {t('calendar.todoSection')}
          {incompleteCount > 0 && <span className="calendar-section-count">{incompleteCount}</span>}
        </span>
        <button className="calendar-section-add" onClick={onAddTodo} aria-label={t('calendar.addTodo')}>
          +
        </button>
      </div>

      {dateTodos.length === 0 ? (
        <div className="calendar-empty-card">
          <span className="calendar-empty-icon"><TodoIcon size={28} /></span>
          <p className="calendar-empty-text">今天還沒有安排任何事情。</p>
          <button type="button" className="calendar-empty-btn" onClick={onAddTodo}>新增待辦</button>
        </div>
      ) : (
        <div className="todo-list">
          {dateTodos.map((todo) => {
            const priority = PRIORITY_ICONS[todo.priority];
            const PriorityIcon = priority.icon;
            const overdue = isTodoOverdue(todo);
            return (
              <article
                key={todo.id}
                className={`todo-row priority-${todo.priority}${todo.completed ? ' completed' : ''}${overdue ? ' overdue' : ''}`}
              >
                <button
                  type="button"
                  className={`todo-check ${todo.completed ? 'done' : ''}`}
                  onClick={() => toggleTodo(todo.id)}
                  aria-label={todo.completed ? t('calendar.markUndone') : t('calendar.markDone')}
                >
                  {todo.completed && (
                    <svg viewBox="0 0 24 24" fill="none">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                <button type="button" className="todo-body" onClick={() => onEditTodo(todo)}>
                  <div className={`todo-title ${todo.completed ? 'done' : ''}`}>{todo.title}</div>
                  <div className="todo-meta">
                    <span className="todo-priority-icon" style={{ color: priority.color }} aria-label={t(priority.labelKey)}>
                      <PriorityIcon size={14} />
                    </span>
                    <span className={`todo-category-badge category-${todo.category}`}>{t(`todo.category.${todo.category}`)}</span>
                    {todo.time && <span>{todo.time}</span>}
                    {todo.repeat !== 'none' && <span>{t(`todo.repeat.${todo.repeat}`)}</span>}
                    {overdue && <span className="todo-overdue-label">{t('todo.overdue')}</span>}
                  </div>
                  {todo.notes && <p className="todo-notes">{todo.notes}</p>}
                </button>

                <div className="todo-actions">
                  <button type="button" className="todo-action" onClick={() => onEditTodo(todo)} aria-label={t('todo.edit')}>
                    <svg className="icon" viewBox="0 0 24 24">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button type="button" className="todo-action danger" onClick={() => deleteTodo(todo.id)} aria-label={t('calendar.deleteTodo')}>
                    <svg className="icon" viewBox="0 0 24 24">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
