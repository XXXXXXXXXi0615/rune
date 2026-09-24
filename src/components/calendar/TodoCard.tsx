// ================================================================
// TodoCard v2 — state-driven iOS dashboard card
//
// States: empty → normal → warning → urgent
// ================================================================

import { t } from '@/i18n';

export type CardState = 'empty' | 'normal' | 'warning' | 'urgent' | 'soon';

interface TodoCardProps {
  incompleteCount: number;
  totalCount: number;
  completedCount: number;
  state: CardState;
  onClick: () => void;
}

export function TodoCard({
  incompleteCount,
  totalCount,
  completedCount,
  state,
  onClick,
}: TodoCardProps) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <button
      type="button"
      className={`square-card card-state-${state}`}
      onClick={onClick}
    >
      <span className="square-card-label">{t('calendar.todoSection')}</span>
      <span className="square-card-count">{incompleteCount}</span>
      {totalCount > 0 && (
        <div className="square-card-progress">
          <div className="square-card-progress-bar">
            <div
              className={`square-card-progress-fill${state === 'urgent' ? ' fill-urgent' : state === 'warning' ? ' fill-warning' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="square-card-sub">
            {completedCount}/{totalCount} · {pct}%
          </span>
        </div>
      )}
    </button>
  );
}
