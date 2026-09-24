export interface WeekSlot {
  label: string;
  start: Date;
  end: Date;
  count: number;
  isCurrent: boolean;
}

/** Get Monday of the week containing d, using local time. */
export function getMonday(d: Date): Date {
  const m = new Date(d);
  const day = m.getDay();
  m.setDate(m.getDate() - ((day + 6) % 7));
  m.setHours(0, 0, 0, 0);
  return m;
}

/** Get Sunday (end of the week) for a given Monday, using local time. */
function getSunday(m: Date): Date {
  const s = new Date(m);
  s.setDate(s.getDate() + 6);
  s.setHours(23, 59, 59, 999);
  return s;
}

function fmtMd(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export interface JournalEntryLike {
  archived?: boolean;
  access?: string;
  visibility?: string | { hiddenFromOverview?: boolean };
  createdAt: string;
  occurredOn?: string;
}

/** Build 4 week slots from current week backward, using local dates.
 *  Each slot counts entries by local occurredOn when available, with createdAt as legacy fallback.
 */
export function buildLast4Weeks(entries: JournalEntryLike[]): WeekSlot[] {
  const active = entries.filter((e) => !e.archived
    && e.access !== 'private'
    && e.visibility !== 'private'
    && !(typeof e.visibility === 'object' && e.visibility.hiddenFromOverview));
  const now = new Date();
  const currentMonday = getMonday(now);
  const slots: WeekSlot[] = [];
  for (let i = 3; i >= 0; i--) {
    const mon = new Date(currentMonday);
    mon.setDate(mon.getDate() - i * 7);
    const sun = getSunday(mon);
    const startMs = mon.getTime();
    const endMs = sun.getTime() + 1;
    const count = active.filter((e) => {
      const t = e.occurredOn
        ? new Date(`${e.occurredOn}T12:00:00`).getTime()
        : new Date(e.createdAt).getTime();
      return t >= startMs && t < endMs;
    }).length;
    slots.push({ label: `${fmtMd(mon)} – ${fmtMd(sun)}`, start: mon, end: sun, count, isCurrent: i === 0 });
  }
  return slots;
}
