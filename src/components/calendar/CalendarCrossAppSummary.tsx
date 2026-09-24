import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestStore } from '@/store/useQuestStore';
import {
  LIFE_LEDGER_CHANGED_EVENT,
  loadLifeLedgerSummariesForDate,
  selectQuestSummariesForDate,
  type CalendarLinkedSummary,
} from '@/features/integration/calendarCrossAppAdapters';

export function CalendarCrossAppSummary({ date }: { date: string }) {
  const navigate = useNavigate();
  const quests = useQuestStore((state) => state.quests);
  const questItems = selectQuestSummariesForDate(quests, date);
  const [ledgerItems, setLedgerItems] = useState<CalendarLinkedSummary[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => void loadLifeLedgerSummariesForDate(date).then((items) => { if (alive) setLedgerItems(items); });
    refresh();
    window.addEventListener(LIFE_LEDGER_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => { alive = false; window.removeEventListener(LIFE_LEDGER_CHANGED_EVENT, refresh); window.removeEventListener('focus', refresh); };
  }, [date]);

  const groups = [
    { id: 'quests', title: '任務', items: questItems },
    { id: 'life-ledger', title: '生活紀錄', items: ledgerItems },
  ];

  return <section className="calendar-cross-app-summary" data-testid="calendar-cross-app-summary" aria-label="Life System 摘要">
    <div className="timehub-day-section-head"><h2>Life System</h2></div>
    {groups.map((group) => <div key={group.id} className="calendar-cross-app-group" data-source-app={group.id}>
      <h3>{group.title}</h3>
      {group.items.length === 0 ? <p className="timehub-empty-line">這一天沒有{group.title}。</p> : group.items.map((item) =>
        <button key={`${item.reference.sourceApp}:${item.reference.entityId}`} type="button" className="calendar-cross-app-link" onClick={() => navigate(item.route)}>
          <strong>{item.title}</strong><small>{item.subtitle}</small>
        </button>)}
    </div>)}
  </section>;
}
