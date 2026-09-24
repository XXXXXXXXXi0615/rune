// ================================================================
// CountdownCard v2 — state-driven iOS dashboard card
//
// States: empty → normal → soon
// ================================================================

import { t } from '@/i18n';
import type { CardState } from './TodoCard';

interface CountdownCardProps {
  eventCount: number;
  nextEventTitle?: string;
  state: CardState;
  onClick: () => void;
}

export function CountdownCard({ eventCount, nextEventTitle, state, onClick }: CountdownCardProps) {
  return (
    <button
      type="button"
      className={`square-card card-state-${state}`}
      onClick={onClick}
    >
      <span className="square-card-label">{t('calendar.countdownSection')}</span>
      <span className="square-card-count">{eventCount}</span>
      {eventCount > 0 && nextEventTitle && (
        <span className="square-card-sub">{nextEventTitle}</span>
      )}
    </button>
  );
}
