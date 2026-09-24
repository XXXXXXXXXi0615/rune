import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPeriodRecord, deletePeriodRecord, savePeriodRecord, loadPeriodRecords, type PeriodRecord } from '@/utils/periodStorage';
import {
  autoGenerateTicketForRecord, buildGeneratedPeriodTicket, compareArchiveTickets, deleteTicketsForRecord,
  findActiveTicketForRecord, groupTicketsByYearMonth, isTicketStale, loadArchiveTickets,
  loadGeneratedPeriodTickets, saveGeneratedPeriodTicket, sourceRevisionOf, ticketIdForRecord, ticketStackRotation,
} from '@/features/period/ticketStorage';

function record(partial: Partial<ReturnType<typeof createPeriodRecord>> = {}) {
  return {
    ...createPeriodRecord('2026-09-01', '2026-09-01', [], '', 'calm', '平潮', '中', { symptomRawText: '腹痛', symptomTags: ['腹痛'] }),
    id: 'period_test_0001',
    ...partial,
  };
}

describe('ticketStorage — persistence, idempotency, stale detection', () => {
  beforeEach(() => {
    localStorage.clear();
    window.dispatchEvent = window.dispatchEvent; // jsdom always has it
  });

  it('builds a ticket with deterministic id per source record', () => {
    const source = record();
    const ticket = buildGeneratedPeriodTicket(source, { cycleDay: 2, phaseLabel: '經期中' });
    expect(ticket.id).toBe(ticketIdForRecord(source.id));
    expect(ticket.id).toBe('period_ticket_period_test_0001');
    expect(ticket.sourceRecordId).toBe(source.id);
    expect(ticket.template).toBe('boarding-pass-v1');
    expect(ticket.snapshot.dateLabel).toBe('2026/09/01');
    expect(ticket.snapshot.flowLabel).toBe('中');
    expect(ticket.snapshot.moodLabel).toBe('平穩');
    expect(ticket.snapshot.phaseLabel).toBe('經期中');
    expect(ticket.snapshot.cycleDay).toBe(2);
  });

  it('regenerate same record replaces instead of duplicating', () => {
    const source = record({ mood: 'calm' });
    const first = buildGeneratedPeriodTicket(source);
    saveGeneratedPeriodTicket(first);
    expect(loadGeneratedPeriodTickets()).toHaveLength(1);

    const regenerated = buildGeneratedPeriodTicket({ ...source, mood: 'gentle', flowLevel: '重' });
    saveGeneratedPeriodTicket(regenerated);
    const tickets = loadGeneratedPeriodTickets();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe(first.id);
    expect(tickets[0].sourceRevision).toBe(regenerated.sourceRevision);
    expect(tickets[0].body).toContain('經量為重');
  });

  it('save enforces one active ticket per sourceRecordId even with foreign ids', () => {
    const source = record();
    saveGeneratedPeriodTicket({ ...buildGeneratedPeriodTicket(source), id: 'stale_double' });
    saveGeneratedPeriodTicket(buildGeneratedPeriodTicket(source));
    const tickets = loadGeneratedPeriodTickets().filter((t) => t.sourceRecordId === source.id);
    expect(tickets).toHaveLength(1);
  });

  it('stale detection: revision changes when source edits', () => {
    const source = record();
    const ticket = buildGeneratedPeriodTicket(source);
    expect(isTicketStale(ticket, source)).toBe(false);

    const edited: PeriodRecord = { ...source, mood: 'stormy', notes: '加了一行' };
    expect(isTicketStale(ticket, edited)).toBe(true);
    expect(sourceRevisionOf(source)).not.toBe(sourceRevisionOf(edited));
  });

  it('stale detection: regeneration produces a fresh (non-stale) ticket', () => {
    const source = record();
    const first = buildGeneratedPeriodTicket(source);
    saveGeneratedPeriodTicket(first);
    const edited: PeriodRecord = { ...source, flowLevel: '輕', symptomRawText: '腰痛' };
    savePeriodRecord(edited);
    expect(isTicketStale(findActiveTicketForRecord(source.id)!, edited)).toBe(true);

    const fresh = buildGeneratedPeriodTicket(edited);
    saveGeneratedPeriodTicket(fresh);
    const stored = findActiveTicketForRecord(source.id)!;
    expect(stored.sourceRevision).toBe(sourceRevisionOf(edited));
    expect(isTicketStale(stored, edited)).toBe(false);
    expect(stored.body).toContain('經量為輕');
  });

  it('source record delete cascade removes associated tickets', () => {
    const source = record();
    saveGeneratedPeriodTicket(buildGeneratedPeriodTicket(source));
    savePeriodRecord(source);
    expect(loadGeneratedPeriodTickets()).toHaveLength(1);
    expect(findActiveTicketForRecord(source.id)).not.toBeNull();

    deleteTicketsForRecord(source.id);
    deletePeriodRecord(source.id);
    expect(loadGeneratedPeriodTickets()).toHaveLength(0);
    expect(findActiveTicketForRecord(source.id)).toBeNull();
  });

  it('deleteTicketsForRecord only removes the matched source', () => {
    const saver = (id2: string, date: string) => {
      const src = record({ id: id2 });
      const t = buildGeneratedPeriodTicket({ ...src, startDate: date, endDate: date });
      saveGeneratedPeriodTicket(t);
    };
    saver('period_a', '2026-09-01');
    saver('period_b', '2026-10-01');
    expect(loadGeneratedPeriodTickets()).toHaveLength(2);
    deleteTicketsForRecord('period_a');
    const rest = loadGeneratedPeriodTickets();
    expect(rest).toHaveLength(1);
    expect(rest[0].sourceRecordId).toBe('period_b');
  });

  it('load: corrupt storage falls back to empty list without throwing', () => {
    localStorage.setItem('lunartide_period_tickets_v1', '{{not json');
    expect(loadGeneratedPeriodTickets()).toEqual([]);
    localStorage.setItem('lunartide_period_tickets_v1', JSON.stringify([{ garbage: true }]));
    expect(loadGeneratedPeriodTickets()).toEqual([]);
  });

  it('ticket snapshot never duplicates the full record schema', () => {
    const source = record({ flowLevel: '點滴', mood: 'radiant', symptomRawText: '疲倦' });
    const ticket = buildGeneratedPeriodTicket(source);
    expect(Object.keys(ticket.snapshot).sort()).toEqual(['cycleDay', 'dateLabel', 'flowLabel', 'moodLabel', 'phaseLabel']);
  });

  it('auto (Phase 3C): new record commit → ticket generated and saved exactly once', () => {
    const source = record({ flowLevel: '中', mood: 'gentle' });
    savePeriodRecord(source); // canonical commit first (summary: success)
    const ticket = autoGenerateTicketForRecord(source, { cycleDay: 2, phaseLabel: '經期中' });
    expect(ticket.sourceRecordId).toBe(source.id);
    expect(ticket.body).toContain('週期第 2 天');
    expect(loadGeneratedPeriodTickets()).toHaveLength(1);

    // duplicate save of the same record commit must never duplicate the ticket
    autoGenerateTicketForRecord(source, { cycleDay: 2 });
    expect(loadGeneratedPeriodTickets()).toHaveLength(1);
  });

  it('auto (Phase 3C): ticket storage failure throws; canonical record remains', () => {
    const source = record({ flowLevel: '重' });
    savePeriodRecord(source);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => autoGenerateTicketForRecord(source)).toThrow('quota');
    spy.mockRestore();
    // canonical record survives, ticket not persisted
    expect(loadPeriodRecords().find((r) => r.id === source.id)?.flowLevel).toBe('重');
    expect(loadGeneratedPeriodTickets()).toHaveLength(0);
  });

  it('auto (Phase 3C): runs strictly after the canonical commit (records key written first)', () => {
    const source = record();
    const seen: string[] = [];
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      seen.push(key);
      return originalSetItem(key, value);
    });
    savePeriodRecord(source); // canonical commit (simulated commit succeeded)
    autoGenerateTicketForRecord(source);
    spy.mockRestore();
    const ticketIndex = seen.indexOf('lunartide_period_tickets_v1');
    const recordIndex = seen.indexOf('lunartide_period_records_v1');
    expect(recordIndex).toBeGreaterThanOrEqual(0);
    expect(ticketIndex).toBeGreaterThanOrEqual(0);
    expect(recordIndex).toBeLessThan(ticketIndex);
  });
});

describe('ticketStorage — Phase 3D archive query', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function saveTicket(source: Partial<ReturnType<typeof createPeriodRecord>> & { id: string; date: string; gen?: number }) {
    const src = { ...record({ id: source.id }), startDate: source.date, endDate: source.date };
    const ticket = buildGeneratedPeriodTicket(src);
    saveGeneratedPeriodTicket({ ...ticket, generatedAt: source.gen ?? Date.now() });
    return src;
  }

  it('compareArchiveTickets sorts startDate DESC with createdAt DESC tie-break', () => {
    savePeriodRecord(record({ id: 'p_a' }));
    savePeriodRecord(record({ id: 'p_b' }));
    savePeriodRecord(record({ id: 'p_c' }));
    const a = buildGeneratedPeriodTicket(record({ id: 'p_a', startDate: '2026-09-01', endDate: '2026-09-01' }));
    const b = buildGeneratedPeriodTicket(record({ id: 'p_b', startDate: '2026-09-01', endDate: '2026-09-01' }));
    const c = buildGeneratedPeriodTicket(record({ id: 'p_c', startDate: '2026-10-05', endDate: '2026-10-05' }));
    // a and b share startDate → tie-break by generatedAt DESC
    const aa = { ...a, generatedAt: 100 };
    const bb = { ...b, generatedAt: 300 };
    const cc = { ...c, generatedAt: 200 };
    const sorted = [aa, cc, bb].sort(compareArchiveTickets);
    expect(sorted.map((t) => t.snapshot.dateLabel)).toEqual(['2026/10/05', '2026/09/01', '2026/09/01']);
    expect(sorted[1].generatedAt).toBe(300); // newer createdAt first among same date
  });

  it('loadArchiveTickets excludes orphaned tickets (no source record) without mutating storage', () => {
    const src = saveTicket({ id: 'live', date: '2026-09-01' });
    savePeriodRecord(src);
    // orphan: ticket referencing a record id that was never saved
    saveGeneratedPeriodTicket({ ...buildGeneratedPeriodTicket(record({ id: 'ghost', startDate: '2026-08-01', endDate: '2026-08-01' })), generatedAt: 1 });

    const { tickets, orphanCount } = loadArchiveTickets();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].sourceRecordId).toBe('live');
    expect(orphanCount).toBe(1);
    // storage untouched — the orphan still physically exists
    expect(loadGeneratedPeriodTickets()).toHaveLength(2);
  });

  it('groupTicketsByYearMonth buckets by year then month, each sorted DESC', () => {
    saveTicket({ id: 'sep1', date: '2026-09-01', gen: 1 });
    saveTicket({ id: 'aug', date: '2026-08-27', gen: 2 });
    saveTicket({ id: 'sep2', date: '2026-09-16', gen: 3 });
    for (const id of ['sep1', 'aug', 'sep2']) savePeriodRecord(record({ id, startDate: `2026-0${id === 'aug' ? '8' : '9'}-0${id === 'sep1' ? '1' : '16'}` }));

    const grouped = groupTicketsByYearMonth(loadArchiveTickets().tickets);
    expect(Object.keys(grouped)).toEqual(['2026']);
    const months2026 = Object.keys(grouped['2026']);
    expect(months2026).toContain('09');
    expect(months2026).toContain('08');
    expect(grouped['2026']['09'].map((t) => t.snapshot.dateLabel)).toEqual(['2026/09/16', '2026/09/01']);
    expect(grouped['2026']['08'].map((t) => t.snapshot.dateLabel)).toEqual(['2026/08/27']);
  });

  it('ticketStackRotation is deterministic and bounded to ±3deg', () => {
    const first = ticketStackRotation('period_ticket_p1');
    const second = ticketStackRotation('period_ticket_p1');
    const other = ticketStackRotation('period_ticket_p2');
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(-3);
    expect(first).toBeLessThanOrEqual(3);
    expect(other).toBeGreaterThanOrEqual(-3);
    expect(other).toBeLessThanOrEqual(3);
    // distinct ids generally diverge
    expect(first).not.toBe(other);
  });

  it('source delete cascade (Phase 3D §9): canonical delete removes linked ticket; no orphan remains', () => {
    const src = saveTicket({ id: 'doomed', date: '2026-09-05' });
    savePeriodRecord(src);
    expect(findActiveTicketForRecord('doomed')).not.toBeNull();

    deleteTicketsForRecord('doomed');
    deletePeriodRecord('doomed');
    const { tickets, orphanCount } = loadArchiveTickets();
    expect(findActiveTicketForRecord('doomed')).toBeNull();
    expect(loadGeneratedPeriodTickets()).toHaveLength(0);
    expect(tickets).toHaveLength(0);
    expect(orphanCount).toBe(0);
  });

  it('merge-edit path removes the merged-away record ticket too (no orphan)', () => {
    const victim = record({ id: 'victim', startDate: '2026-09-01', endDate: '2026-09-01' });
    savePeriodRecord(victim);
    saveGeneratedPeriodTicket(buildGeneratedPeriodTicket(victim));
    const survivor = record({ id: 'survivor', startDate: '2026-09-01', endDate: '2026-09-03' });
    savePeriodRecord(survivor);
    saveGeneratedPeriodTicket(buildGeneratedPeriodTicket(survivor));
    expect(loadGeneratedPeriodTickets()).toHaveLength(2);

    // victim deleted by merge-edit contract — must cascade its ticket
    deleteTicketsForRecord(victim.id);
    deletePeriodRecord(victim.id);
    const { tickets, orphanCount } = loadArchiveTickets();
    expect(tickets.map((t) => t.sourceRecordId)).toEqual(['survivor']);
    expect(orphanCount).toBe(0);
  });

  it('isEmpty archive view: zero tickets renders empty cleanly', () => {
    const { tickets, orphanCount } = loadArchiveTickets();
    expect(tickets).toEqual([]);
    expect(orphanCount).toBe(0);
  });
});
