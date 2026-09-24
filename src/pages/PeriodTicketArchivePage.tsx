import { useEffect, useMemo, useState } from 'react';
import { BackButton } from '@/components/layout/BackButton';
import { PeriodTicketModal } from '@/components/period/PeriodTicketModal';
import { type GeneratedPeriodTicket } from '@/features/period/ticketTypes';
import {
  groupTicketsByYearMonth, isTicketStale, loadArchiveTickets, ticketStackRotation,
} from '@/features/period/ticketStorage';
import { loadPeriodRecords, type PeriodRecord } from '@/utils/periodStorage';
import '@/styles/period-ticket-archive.css';

const TICKETS_UPDATED_EVENT = 'period-tickets-updated';
const RECORDS_UPDATED_EVENT = 'period-records-updated';

const STACK_MAX = 5;

/** Stable short date label (MM/DD) from a snapshot date (YYYY/MM/DD). */
function shortDate(dateLabel: string): string {
  const parts = dateLabel.split('/');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateLabel;
}

const MONTH_LABELS = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export function PeriodTicketArchivePage() {
  const [tickets, setTickets] = useState<GeneratedPeriodTicket[]>([]);
  const [openTicket, setOpenTicket] = useState<GeneratedPeriodTicket | null>(null);
  const [records, setRecords] = useState<PeriodRecord[]>(() => loadPeriodRecords());

  useEffect(() => {
    const refresh = () => {
      setTickets(loadArchiveTickets().tickets);
      setRecords(loadPeriodRecords());
    };
    refresh();
    window.addEventListener(TICKETS_UPDATED_EVENT, refresh);
    window.addEventListener(RECORDS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(TICKETS_UPDATED_EVENT, refresh);
      window.removeEventListener(RECORDS_UPDATED_EVENT, refresh);
    };
  }, []);

  const staleByTicket = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const ticket of tickets) {
      const record = records.find((r) => r.id === ticket.sourceRecordId);
      map.set(ticket.id, Boolean(record && isTicketStale(ticket, record)));
    }
    return map;
  }, [tickets, records]);

  const grouped = useMemo(() => groupTicketsByYearMonth(tickets), [tickets]);
  const years = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  const stackTickets = useMemo(() => tickets.slice(0, STACK_MAX), [tickets]);

  const isStale = (ticket: GeneratedPeriodTicket) => staleByTicket.get(ticket.id) ?? false;

  return (
    <section id="period-ticket-archive" className="view pta-view" data-testid="period-ticket-archive" data-ticket-count={tickets.length}>
      <header className="pta-header">
        <BackButton to="/period" />
        <div className="pta-heading">
          <h1>週期票根</h1>
          <p>留下一張張屬於你的紙張痕跡</p>
        </div>
        {tickets.length > 0 && <span className="pta-count">{tickets.length}</span>}
      </header>

      {tickets.length === 0 ? (
        <div className="pta-empty" data-testid="pta-empty">
          <div className="pta-empty-ticket" aria-hidden="true">
            <span className="pta-empty-brand">LUNARTIDE · PERIOD LOG</span>
            <span className="pta-empty-line" />
            <span className="pta-empty-line pta-empty-line--short" />
          </div>
          <p>還沒有留下票根。</p>
          <p className="pta-empty-sub">下一次記錄週期後，Rune 會替你收好。</p>
        </div>
      ) : (
        <div className="pta-content">
          {/* ── Ticket Stack ── */}
          <section className="pta-stack-section" aria-label="最近票根">
            <span className="pta-eyebrow">TICKET STACK</span>
            <div className="pta-stack" data-testid="pta-stack">
              {stackTickets.map((ticket, index) => {
                const rotation = ticketStackRotation(ticket.id);
                const isTop = index === 0;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`pta-stack-card${isTop ? ' is-top' : ''}`}
                    style={{ '--pta-rotate': `${rotation.toFixed(2)}deg`, '--pta-stack-depth': String(index) } as React.CSSProperties}
                    onClick={() => setOpenTicket(ticket)}
                    aria-label={`查看票根 ${ticket.snapshot.dateLabel}`}
                    aria-haspopup="dialog"
                  >
                    <span className="pta-stack-brand" aria-hidden="true">R</span>
                    <span className="pta-stack-date">{shortDate(ticket.snapshot.dateLabel)}</span>
                    {ticket.snapshot.flowLabel && <span className="pta-stack-flow">{ticket.snapshot.flowLabel}</span>}
                    {isStale(ticket) && <span className="pta-stack-stale">紀錄已有變更</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Grouped Browse ── */}
          <section className="pta-groups" aria-label="票根收藏">
            {years.map((year) => (
              <div className="pta-year" key={year}>
                <h2 className="pta-year-title">{year}</h2>
                {Object.keys(grouped[year]).sort((a, b) => b.localeCompare(a)).map((month) => (
                  <div className="pta-month" key={month}>
                    <h3 className="pta-month-title">{MONTH_LABELS[Number(month)] ?? `${month} 月`}</h3>
                    <div className="pta-grid">
                      {grouped[year][month].map((ticket) => (
                        <PeriodTicketPreview
                          key={ticket.id}
                          ticket={ticket}
                          stale={isStale(ticket)}
                          onOpen={() => setOpenTicket(ticket)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </div>
      )}

      {openTicket && (
        <PeriodTicketModal
          ticket={openTicket}
          dirty={isStale(openTicket)}
          onClose={() => setOpenTicket(null)}
        />
      )}
    </section>
  );
}

function PeriodTicketPreview({ ticket, stale, onOpen }: {
  ticket: GeneratedPeriodTicket;
  stale: boolean;
  onOpen: () => void;
}) {
  const rotation = ticketStackRotation(ticket.id);
  return (
    <button
      type="button"
      className="pta-preview"
      style={{ '--pta-rotate': `${rotation.toFixed(2)}deg` } as React.CSSProperties}
      onClick={onOpen}
      aria-label={`查看票根 ${ticket.snapshot.dateLabel}`}
      aria-haspopup="dialog"
      data-testid="pta-preview"
      data-stale={stale || undefined}
    >
      <span className="pta-preview-date">{ticket.snapshot.dateLabel}</span>
      <span className="pta-preview-dl">
        {ticket.snapshot.flowLabel && <span className="pta-preview-kv"><b>FLOW</b><span>{ticket.snapshot.flowLabel}</span></span>}
        {ticket.snapshot.moodLabel && <span className="pta-preview-kv"><b>MOOD</b><span>{ticket.snapshot.moodLabel}</span></span>}
        {ticket.snapshot.cycleDay != null && <span className="pta-preview-kv"><b>CYCLE</b><span>DAY {String(ticket.snapshot.cycleDay).padStart(2, '0')}</span></span>}
        {ticket.snapshot.phaseLabel && <span className="pta-preview-kv"><b>PHASE</b><span>{ticket.snapshot.phaseLabel}</span></span>}
      </span>
      {stale && <span className="pta-preview-stale">紀錄已有變更</span>}
    </button>
  );
}