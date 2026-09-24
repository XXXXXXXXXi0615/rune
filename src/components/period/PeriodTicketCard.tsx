import { useMemo } from 'react';
import type { GeneratedPeriodTicket } from '@/features/period/ticketTypes';
import './PeriodTicketCard.css';

function serialFor(ticket: GeneratedPeriodTicket): string {
  const hash = ticket.sourceRecordId.split('').reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0) % 1_000_000, 7);
  const monthDay = ticket.snapshot.dateLabel.replace(/\D/g, '').slice(4, 8) || '0000';
  return `LT-P${monthDay}-${String(hash).padStart(4, '0')}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

function ticketDateLabel(snapshotDate: string): string {
  const [y = '', m = '', d = ''] = snapshotDate.split('/');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (!Number.isFinite(date.getTime())) return snapshotDate;
  return DATE_FORMATTER.format(date).toUpperCase();
}

export function PeriodTicketCard({ ticket, dirty }: { ticket: GeneratedPeriodTicket; dirty?: boolean }) {
  const label = useMemo(() => ({
    date: ticketDateLabel(ticket.snapshot.dateLabel),
    cycleDay: ticket.snapshot.cycleDay != null ? String(ticket.snapshot.cycleDay).padStart(2, '0') : null,
    flow: ticket.snapshot.flowLabel ?? null,
    mood: ticket.snapshot.moodLabel ?? null,
    phase: ticket.snapshot.phaseLabel ?? null,
    serial: serialFor(ticket),
  }), [ticket]);

  return (
    <article className="period-ticket" data-testid="period-ticket-card" data-phase-label={ticket.snapshot.phaseLabel ?? undefined}>
      <header className="period-ticket__brand">
        <span className="period-ticket__brand-mark" aria-hidden="true">R</span>
        <span className="period-ticket__brand-name">LUNARTIDE · PERIOD LOG</span>
        {dirty && <span className="period-ticket__stale-badge">紀錄已有變更</span>}
      </header>

      <div className="period-ticket__meta">
        <div className="period-ticket__date">
          <strong>{label.date}</strong>
          {label.cycleDay && <span>CYCLE DAY {label.cycleDay}</span>}
        </div>
        {label.phase && <span className="period-ticket__phase">{label.phase}</span>}
      </div>

      <dl className="period-ticket__fields">
        {label.flow && <div><dt>FLOW</dt><dd>{label.flow}</dd></div>}
        {label.mood && <div><dt>MOOD</dt><dd>{label.mood}</dd></div>}
      </dl>

      <div className="period-ticket__perforation" aria-hidden="true" />

      <div className="period-ticket__body">
        <span className="period-ticket__eyebrow">今日紀錄</span>
        <p>{ticket.body}</p>
      </div>

      <footer className="period-ticket__footer">
        <div className="period-ticket__serial" aria-hidden="true">#{label.serial}</div>
        <div className="period-ticket__barcode" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      </footer>
    </article>
  );
}
