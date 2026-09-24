import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PeriodCycleHero, PeriodCycleTrend } from '@/components/period/PeriodAnalytics';
import { PeriodRecordSheet } from '@/components/period/PeriodRecordSheet';
import { getCycleSnapshot } from '@/features/period/getCycleSnapshot';
import { getCyclePhaseLabel } from '@/features/period/periodLabels';
import { loadPeriodRecords, type PeriodRecord } from '@/utils/periodStorage';

export function HealthPeriodPage() {
  const [records, setRecords] = useState<PeriodRecord[]>(() => loadPeriodRecords());
  const [view, setView] = useState<'trend' | 'week'>('trend');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PeriodRecord | null>(null);
  const snapshot = useMemo(() => getCycleSnapshot(), [records]);
  const today = new Date().toLocaleDateString('sv-SE');
  const todayRecord = records.find((record) => record.startDate <= today && record.endDate >= today) ?? null;
  const recent = useMemo(() => [...records].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 6), [records]);
  const openRecord = (record: PeriodRecord | null) => { setEditingRecord(record); setEditorOpen(true); };

  return <section className="health-period-page" data-testid="health-period-page">
    <PeriodCycleHero snapshot={snapshot} onRecord={() => openRecord(todayRecord)}/>
    <section className="health-period-metrics" aria-label="週期統計">
      <article className="moon-health-card"><span>目前階段</span><strong>{snapshot.status === 'no-data' ? '未記錄' : getCyclePhaseLabel(snapshot.status)}</strong></article>
      <article className="moon-health-card"><span>歷史平均週期</span><strong data-testid="health-period-average">{snapshot.cycleLength ? `${snapshot.cycleLength} 天` : '等待紀錄'}</strong></article>
      <article className="moon-health-card"><span>最近開始日</span><strong>{snapshot.lastPeriodStart ?? '尚無'}</strong></article>
    </section>
    <PeriodCycleTrend snapshot={snapshot} view={view} onViewChange={setView}/>
    <article className="moon-health-card health-period-records">
      <header><div><span className="health-period-eyebrow">RECORDS</span><h2>最近週期紀錄</h2></div><button type="button" onClick={() => openRecord(todayRecord)}>記錄今天</button></header>
      {recent.length === 0 ? <p className="health-period-empty">尚無週期紀錄。</p> : <ul>{recent.map((record) => <li key={record.id}><button type="button" onClick={() => openRecord(record)}><span>{record.startDate}{record.endDate !== record.startDate ? ` – ${record.endDate}` : ''}</span><small>{record.flowLevel || '未標示經量'} · 編輯</small></button></li>)}</ul>}
    </article>
    <p className="health-period-boundary">週期資料仍由 Period domain 管理。<Link to="/calendar">前往日曆快速記錄</Link></p>
    <PeriodRecordSheet open={editorOpen} date={today} record={editingRecord} onClose={() => setEditorOpen(false)} onChanged={setRecords}/>
  </section>;
}
