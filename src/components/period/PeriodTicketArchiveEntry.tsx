import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PeriodTicketModal } from '@/components/period/PeriodTicketModal';
import { type GeneratedPeriodTicket } from '@/features/period/ticketTypes';
import { loadArchiveTickets, ticketStackRotation } from '@/features/period/ticketStorage';
import '@/styles/period-ticket-archive.css';

const TICKETS_UPDATED_EVENT = 'period-tickets-updated';
const RECORDS_UPDATED_EVENT = 'period-records-updated';

const RECENT_MAX = 3;

function shortDate(dateLabel: string): string {
  const parts = dateLabel.split('/');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateLabel;
}

/**
 * Phase 3D §3 — 「週期票根」 preview on the Period canonical surface.
 * Shows the most recent 3 exact ticket artifacts (never fake demo data) with a
 * 「查看全部 →」 link into the full archive. Clicking a preview opens the
 * existing PeriodTicketModal.
 */
export function PeriodTicketArchiveEntry() {
  const [tickets, setTickets] = useState<GeneratedPeriodTicket[]>(() => loadArchiveTickets().tickets.slice(0, RECENT_MAX));
  const [openTicket, setOpenTicket] = useState<GeneratedPeriodTicket | null>(null);

  useEffect(() => {
    const refresh = () => setTickets(loadArchiveTickets().tickets.slice(0, RECENT_MAX));
    refresh();
    window.addEventListener(TICKETS_UPDATED_EVENT, refresh);
    window.addEventListener(RECORDS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(TICKETS_UPDATED_EVENT, refresh);
      window.removeEventListener(RECORDS_UPDATED_EVENT, refresh);
    };
  }, []);

  if (tickets.length === 0) return null;

  return (
    <article className="pta-entry" data-testid="pta-entry">
      <header className="pta-entry-head">
        <div>
          <span className="pta-eyebrow">PERIOD TICKETS</span>
          <h3 className="pta-entry-title">週期票根</h3>
        </div>
        <Link to="/period/tickets" className="pta-entry-all">查看全部{' '}-&gt;</Link>
      </header>
      <div className="pta-entry-row" data-testid="pta-entry-row">
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            className="pta-entry-ticket"
            style={{ '--pta-rotate': `${ticketStackRotation(ticket.id, 2).toFixed(2)}deg` } as React.CSSProperties}
            onClick={() => setOpenTicket(ticket)}
            aria-label={`查看票根 ${ticket.snapshot.dateLabel}`}
            aria-haspopup="dialog"
          >
            <span className="pta-entry-brand" aria-hidden="true">R</span>
            <span className="pta-entry-date">{shortDate(ticket.snapshot.dateLabel)}</span>
            {ticket.snapshot.flowLabel && <span className="pta-entry-flow">{ticket.snapshot.flowLabel}</span>}
          </button>
        ))}
      </div>

      {openTicket && <PeriodTicketModal ticket={openTicket} onClose={() => setOpenTicket(null)} />}
    </article>
  );
}