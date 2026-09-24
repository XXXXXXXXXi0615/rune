import { useMemo, useRef, useState, type FormEvent } from 'react';
import { CalendarCreateSheet } from '@/components/calendar/CalendarCreateSheet';
import { useHealthStore } from '@/store/useHealthStore';
import type { HealthRecordType } from '@/features/health/healthDomain';
import { usePetRecede } from '@/hooks/usePetRecede';
import '@/styles/moon-health.css';

const today = () => new Date().toLocaleDateString('sv-SE');
const HEALTH_DRAFT_KEY = 'lunartide-health-form-draft';
function loadHealthDraft(): Record<string, string> { try { return JSON.parse(sessionStorage.getItem(HEALTH_DRAFT_KEY) || '{}') } catch { return {} } }
function saveHealthDraft(fields: Record<string, string>) { try { sessionStorage.setItem(HEALTH_DRAFT_KEY, JSON.stringify(fields)) } catch { /* ignore */ } }

/** `YYYY-MM-DD` → `YYYY / MM / DD` (presentation only). */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${year} / ${month} / ${day}` : iso;
}

/** `YYYY-MM-DD` plus one local day — used only to compose sleep timestamps. */
function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Canonical sleep records store `YYYY-MM-DDTHH:mm`; clock fields keep the time part. */
const clock = (value: string) => (value.includes('T') ? value.slice(11, 16) : value);

/** Body workspace content (embedded-safe, no page shell).
 *  Domain: canonical HealthStore records — the store is the only owner. */
export function BodyWorkspace({ selectedDate }: { selectedDate?: string }) {
  usePetRecede(true);
  const records = useHealthStore((s) => s.records);
  const addRecord = useHealthStore((s) => s.addRecord);
  const updateRecord = useHealthStore((s) => s.updateRecord);
  const deleteRecord = useHealthStore((s) => s.deleteRecord);
  const unit = useHealthStore((s) => s.weightUnit);
  const setUnit = useHealthStore((s) => s.setWeightUnit);
  const [type, setType] = useState<Extract<HealthRecordType, 'weight' | 'blood_pressure' | 'sleep' | 'symptom'>>('weight');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(selectedDate || today());
  const [fields, setFields] = useState<Record<string, string>>(() => loadHealthDraft());
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const field = (key: string, label: string, inputType = 'number') => <label><span>{label}</span><input name={key} type={inputType === 'number' ? 'text' : inputType} inputMode={inputType === 'number' ? 'decimal' : undefined} value={fields[key] || ''} onChange={e => { const next={...fields,[key]:e.target.value}; saveHealthDraft(next); setFields(next) }} /></label>;
  const reset = () => { saveHealthDraft({}); setFields({}); setEditingId(null); setError('') };
  const closeComposer = () => { setComposerOpen(false); setError(''); };
  const openNew = () => { setEditingId(null); setDate(selectedDate || today()); setFields(loadHealthDraft()); setError(''); setComposerOpen(true); };
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); try {
    const form = e.currentTarget;
    const read = (k: string) => form.querySelector<HTMLInputElement>(`[name="${k}"]`)?.value ?? fields[k] ?? '';
    const n = (k: string) => Number(read(k));
    let value;
    if (type === 'weight') value = { kind: type, kilograms: unit === 'lb' ? n('weight') / 2.2046226218 : n('weight') } as const;
    else if (type === 'blood_pressure') value = { kind: type, systolic: n('sys'), diastolic: n('dia'), pulse: read('pulse') ? n('pulse') : undefined } as const;
    else if (type === 'symptom') value = { kind: type, name: read('name'), severity: n('severity') as 1 | 2 | 3 | 4 | 5 } as const;
    else {
      // Clock-only presentation: compose canonical timestamps from the record date.
      // A wake time that is not after the sleep time rolls the wake day over.
      const sleptClock = read('sleptAt'), wokeClock = read('wokeAt');
      const wokeOn = sleptClock && wokeClock && wokeClock > sleptClock ? date : nextDay(date);
      const sleptAt = `${date}T${sleptClock}`, wokeAt = `${wokeOn}T${wokeClock}`;
      value = { kind: type, sleptAt, wokeAt, durationMinutes: Math.round((new Date(wokeAt).getTime() - new Date(sleptAt).getTime()) / 60000), quality: n('quality') as 1 | 2 | 3 | 4 | 5 } as const;
    }
    const record = { occurredOn: date, occurredAt: type === 'blood_pressure' ? read('time') : undefined, type, value, source: 'manual' as const, note: read('note').trim() || undefined };
    if (editingId) updateRecord(editingId, record); else addRecord(record); reset(); setComposerOpen(false);
  } catch (err) { setError(err instanceof Error ? err.message : '無法儲存') } };
  const edit = (id: string) => { const r = records.find(x => x.id === id); if (!r || r.type === 'hydration') return; setEditingId(id); setType(r.type as typeof type); setDate(r.occurredOn); const v = r.value; const f: Record<string, string> = { note: r.note || '', time: r.occurredAt || '' }; if (v.kind === 'weight') f.weight = String(unit === 'lb' ? v.kilograms * 2.2046226218 : v.kilograms); if (v.kind === 'blood_pressure') { f.sys = String(v.systolic); f.dia = String(v.diastolic); f.pulse = v.pulse ? String(v.pulse) : '' } if (v.kind === 'symptom') { f.name = v.name; f.severity = String(v.severity) } if (v.kind === 'sleep') { f.sleptAt = clock(v.sleptAt); f.wokeAt = clock(v.wokeAt); f.quality = String(v.quality) } saveHealthDraft(f); setFields(f); setError(''); setComposerOpen(true) };
  const dirty = useMemo(() => editingId !== null || Object.values(fields).some(Boolean) || date !== (selectedDate || today()), [date, editingId, fields, selectedDate]);
  return <div className="moon-health-body" data-testid="body-workspace">
    <header className="health-record-list-head">
      <div>
        <h2>身體紀錄</h2>
        {selectedDate && <p className="health-panel-meta">日曆選取日期 <b>{selectedDate}</b></p>}
      </div>
      <button type="button" onClick={openNew}>新增身體紀錄</button>
    </header>
    <div className="health-record-list" data-testid="health-record-list">{records.length === 0
      ? <p className="moon-health-empty">尚無身體紀錄。</p>
      : <>{records.map(r => <article className="moon-health-card" data-record-type={r.type} key={r.id}><div className="health-record-main"><strong>{labelRecord(r)}</strong><span>{r.occurredOn}</span></div><div className="health-record-actions">{r.type !== 'hydration' && <button onClick={() => edit(r.id)}>修改</button>}<button onClick={() => { if (window.confirm(`刪除「${labelRecord(r)}」？`)) deleteRecord(r.id) }}>刪除</button></div></article>)}{records.length > 1 && <p className="health-record-count">共 {records.length} 筆</p>}</>}</div>
    <p className="health-panel-footnote">身體資料由 HealthStore 管理，不會複製到 Calendar。</p>
    <CalendarCreateSheet isOpen={composerOpen} onClose={closeComposer} onConfirm={() => formRef.current?.requestSubmit()} typeLabel="Body Record" title={editingId ? '修改身體紀錄' : '新增身體紀錄'} subtitle="記下這一天的身體狀態。" confirmLabel="儲存" dirty={dirty} showClose testId="body-record-composer" className="body-record-composer">
      <form ref={formRef} className="health-record-form" onSubmit={submit}><div className="health-type-tabs" role="tablist" aria-label="身體紀錄類型">{([['weight', '體重'], ['blood_pressure', '血壓'], ['sleep', '睡眠'], ['symptom', '症狀']] as const).map(([v, l]) => <button type="button" role="tab" aria-selected={type === v} className={type === v ? 'active' : ''} onClick={() => { setType(v); reset(); }} key={v}>{l}</button>)}</div>
        <label><span>日期</span><input name="date" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        {type === 'weight' && <><div className="unit-toggle" role="group" aria-label="體重單位"><button type="button" className={unit === 'kg' ? 'active' : ''} onClick={() => setUnit('kg')}>kg</button><button type="button" className={unit === 'lb' ? 'active' : ''} onClick={() => setUnit('lb')}>lb</button></div>{field('weight', `體重 (${unit})`)}</>}
        {type === 'blood_pressure' && <>{field('sys', '收縮壓 (mmHg)')}{field('dia', '舒張壓 (mmHg)')}{field('pulse', '脈搏 (次/分)')} {field('time', '測量時間', 'time')}</>}
        {type === 'sleep' && <><p className="health-sleep-date">日期 <b>{formatDay(date)}</b></p>{field('sleptAt', '入睡時間', 'time')}{field('wokeAt', '醒來時間', 'time')}{field('quality', '主觀品質 (1–5)')}</>}
        {type === 'symptom' && <>{field('name', '症狀名稱', 'text')}{field('severity', '程度 (1–5)')}</>}{field('note', '備註', 'text')}{error && <p role="alert" className="health-error">{error}</p>}</form>
    </CalendarCreateSheet>
  </div>;
}

function labelRecord(r: ReturnType<typeof useHealthStore.getState>['records'][number]) {
  const v = r.value;
  if (v.kind === 'weight') return `體重 ${v.kilograms.toFixed(1)} kg`;
  if (v.kind === 'blood_pressure') return `血壓 ${v.systolic}/${v.diastolic}`;
  if (v.kind === 'sleep') return `睡眠 ${Math.floor(v.durationMinutes / 60)} 小時 ${v.durationMinutes % 60} 分`;
  if (v.kind === 'hydration') return `飲水 ${v.milliliters} ml`;
  if (v.kind === 'symptom') return `${v.name} · 程度 ${v.severity}`;
  return r.type;
}
