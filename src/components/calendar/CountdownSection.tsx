import type { CountdownItem } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useDrawer } from '@/hooks/useDrawer';
import { t } from '@/i18n';

function calcDays(targetDate: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(targetDate + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function daysLabel(days: number): string {
  if (days === 0) return t('countdown.today');
  if (days < 0) return `+${Math.abs(days)}`;
  return `${days}`;
}

function daysUnit(days: number): string {
  if (days === 0) return '';
  if (days < 0) return t('countdown.daysAgo');
  return t('countdown.days');
}

const TYPE_COLORS: Record<string, string> = {
  anniversary: 'rgba(255, 154, 162, 0.2)',
  birthday:   'rgba(255, 198, 134, 0.2)',
  deadline:   'rgba(224, 122, 110, 0.2)',
  project:    'rgba(162, 174, 255, 0.2)',
  custom:     'rgba(141, 215, 190, 0.2)',
};

const TYPE_TEXT: Record<string, string> = {
  anniversary: 'var(--rose)',
  birthday:   'var(--adhd)',
  deadline:   'var(--danger)',
  project:    'var(--coral)',
  custom:     'var(--teal)',
};

interface CountdownSectionProps {
  countdowns: CountdownItem[];
}

export function CountdownSection({ countdowns }: CountdownSectionProps) {
  const togglePin = useAppStore((s) => s.togglePinCountdown);
  const deleteCountdown = useAppStore((s) => s.deleteCountdown);
  const countdownDrawer = useDrawer('countdown');

  const sorted = [...countdowns].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return calcDays(a.targetDate) - calcDays(b.targetDate);
  });

  return (
    <div>
      <div className="calendar-section-header">
        <span className="calendar-section-title">{t('calendar.countdownSection')}</span>
        <button
          className="calendar-section-add"
          onClick={countdownDrawer.open}
          aria-label={t('calendar.addCountdown')}
        >
          +
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="calendar-empty">{t('calendar.noCountdowns')}</p>
      ) : (
        <div className="countdown-list">
          {sorted.map((c) => {
            const days = calcDays(c.targetDate);
            return (
              <div key={c.id} className="countdown-card">
                <div
                  className="countdown-badge"
                  style={{
                    background: TYPE_COLORS[c.type] || TYPE_COLORS.custom,
                    color: TYPE_TEXT[c.type] || TYPE_TEXT.custom,
                  }}
                >
                  <span className="countdown-badge-num">{daysLabel(days)}</span>
                  <span className="countdown-badge-label">{daysUnit(days)}</span>
                </div>
                <div className="countdown-info">
                  <div className="countdown-title">{c.title}</div>
                  <div className="countdown-date">
                    {c.type === 'custom' && c.customTypeLabel ? `${c.customTypeLabel} · ` : ''}
                    {c.targetDate}
                    {c.targetTime ? ` ${c.targetTime}` : ''}
                  </div>
                </div>
                <div className="countdown-actions">
                  <button
                    className={`countdown-pin ${c.pinned ? 'pinned' : ''}`}
                    onClick={() => togglePin(c.id)}
                    aria-label={c.pinned ? t('calendar.unpin') : t('calendar.pin')}
                  >
                    <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                      <line x1="12" y1="17" x2="12" y2="22" />
                      <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z" />
                    </svg>
                  </button>
                  <button
                    className="countdown-pin"
                    onClick={() => deleteCountdown(c.id)}
                    aria-label={t('calendar.deleteCountdown')}
                    style={{ color: 'var(--text-3)' }}
                  >
                    <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
