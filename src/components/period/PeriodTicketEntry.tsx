import { useEffect, useMemo, useRef, useState } from 'react';
import type { PeriodRecord } from '@/utils/periodStorage';
import type { GeneratedPeriodTicket } from '@/features/period/ticketTypes';
import { buildGeneratedPeriodTicket, findActiveTicketForRecord, isTicketStale, saveGeneratedPeriodTicket } from '@/features/period/ticketStorage';
import { PeriodTicketModal } from '@/components/period/PeriodTicketModal';
import './PeriodTicketEntry.css';

const TICKETS_UPDATED_EVENT = 'period-tickets-updated';

export interface PeriodTicketEntryProps {
  record: PeriodRecord;
  phaseLabel?: string;
  cycleDay?: number;
  variant?: 'row' | 'hero';
}

/**
 * Compact saved-state action for period tickets.
 * 生成今日票根 → creates; after generation → 查看今日票根; when the source
 * record changed after generation → light 「紀錄已有變更」 notice + 重新生成.
 */
export function PeriodTicketEntry({ record, phaseLabel, cycleDay, variant = 'row' }: PeriodTicketEntryProps) {
  const [ticket, setTicket] = useState<GeneratedPeriodTicket | null>(() => findActiveTicketForRecord(record.id));
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const stale = useMemo(() => Boolean(ticket && isTicketStale(ticket, record)), [record, ticket]);

  useEffect(() => {
    const refresh = () => setTicket(findActiveTicketForRecord(record.id));
    refresh();
    window.addEventListener(TICKETS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(TICKETS_UPDATED_EVENT, refresh);
  }, [record.id]);

  const generate = () => {
    const next = buildGeneratedPeriodTicket(record, { phaseLabel, cycleDay });
    saveGeneratedPeriodTicket(next);
    setTicket(next);
    setOpen(true);
  };

  const regenerate = () => {
    const next = buildGeneratedPeriodTicket(record, { phaseLabel, cycleDay });
    saveGeneratedPeriodTicket(next);
    setTicket(next);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const closeModal = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div className={`period-ticket-entry is-${variant}`} data-testid="period-ticket-entry">
      {ticket ? (
        <>
          <button type="button" ref={triggerRef} className="period-ticket-entry__action" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
            查看今日票根
          </button>
          {stale && (
            <>
              <span className="period-ticket-entry__stale-note" role="status">紀錄已有變更</span>
              <button type="button" className="period-ticket-entry__action period-ticket-entry__action--slim" onClick={regenerate} data-testid="ticket-regenerate">
                重新生成
              </button>
            </>
          )}
        </>
      ) : (
        <button type="button" ref={triggerRef} className="period-ticket-entry__action" onClick={generate} data-testid="ticket-generate" aria-haspopup="dialog">
          生成今日票根
        </button>
      )}

      {open && ticket && <PeriodTicketModal ticket={ticket} dirty={stale} onClose={closeModal} />}
    </div>
  );
}
