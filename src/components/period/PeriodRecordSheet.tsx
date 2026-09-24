import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createPeriodRecord, deletePeriodRecord, loadPeriodRecords, savePeriodRecord,
  type PeriodMood, type PeriodRecord,
} from '@/utils/periodStorage';
import { autoGenerateTicketForRecord } from '@/features/period/ticketStorage';
import { deleteTicketsForRecord } from '@/features/period/ticketStorage';
import { getCycleDateProjection } from '@/features/period/getCycleSnapshot';
import { getCyclePhaseLabel } from '@/features/period/periodLabels';
import type { GeneratedPeriodTicket } from '@/features/period/ticketTypes';
import { CalendarCreateSheet } from '@/components/calendar/CalendarCreateSheet';
import { PeriodFlowOrbSelector } from '@/components/period/PeriodFlowOrbSelector';
import { PeriodMoodSlider } from '@/components/period/PeriodMoodSlider';
import { PeriodTicketReveal } from '@/components/period/PeriodTicketReveal';
import { PeriodTicketModal } from '@/components/period/PeriodTicketModal';
import { DateWheelPicker } from '@/components/ui/DateWheelPicker';
import { PickerField } from '@/components/ui/PickerField';
import { formatDateLabel } from '@/components/ui/pickerUtils';
import '@/styles/period-composer.css';

type DuplicateChoice = 'update-existing' | 'force-create' | 'merge-edit' | 'keep-both';

export function PeriodRecordSheet({ open, date, record, onClose, onChanged }: {
  open: boolean;
  date: string;
  record?: PeriodRecord | null;
  onClose: () => void;
  onChanged: (records: PeriodRecord[]) => void;
}) {
  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState(date);
  const [flowLevel, setFlowLevel] = useState('');
  const [mood, setMood] = useState<PeriodMood | undefined>();
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<PeriodRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | undefined>();
  const [reveal, setReveal] = useState<GeneratedPeriodTicket | null>(null);
  const [revealFailed, setRevealFailed] = useState(false);
  const [revealViewOpen, setRevealViewOpen] = useState(false);
  const startDateRef = useRef<HTMLButtonElement>(null);
  const endDateRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setStartDate(record?.startDate ?? date);
    setEndDate(record?.endDate ?? date);
    setFlowLevel(record?.flowLevel ?? '');
    setMood(record?.mood);
    setError(''); setDuplicate(null); setDeleteConfirm(false);
    setDatePickerTarget(null);
    setReveal(null); setRevealFailed(false); setRevealViewOpen(false);
  }, [date, open, record]);

  const dirty = useMemo(() => JSON.stringify({ startDate, endDate, flowLevel, mood }) !== JSON.stringify({
    startDate: record?.startDate ?? date, endDate: record?.endDate ?? date, flowLevel: record?.flowLevel ?? '', mood: record?.mood,
  }), [date, endDate, flowLevel, mood, record, startDate]);

  if (!open) {
    if (!reveal && !revealFailed) return null;
    return (
      <>
        <PeriodTicketReveal
          ticket={reveal}
          failed={revealFailed}
          onDismiss={() => { setReveal(null); setRevealFailed(false); setRevealViewOpen(false); }}
          onOpenTicket={() => setRevealViewOpen(true)}
        />
        {revealViewOpen && reveal && (
          <PeriodTicketModal
            ticket={reveal}
            onClose={() => setRevealViewOpen(false)}
          />
        )}
      </>
    );
  }

  const validate = () => {
    if (!startDate || !endDate) return '請選擇開始與結束日期';
    if (startDate > endDate) return '結束日期不能早於開始日期';
    return null;
  };
  const payload = () => ({ startDate, endDate, flowLevel, mood, tideLevel: record?.tideLevel ?? '平潮' });
  const finish = () => {
    const next = loadPeriodRecords();
    window.dispatchEvent(new CustomEvent('period-records-updated'));
    onChanged(next);
    onClose();
  };
  const commit = (choice?: DuplicateChoice) => {
    const validation = validate();
    if (validation) { setError(validation); return; }
    const records = loadPeriodRecords();
    const collision = records.find((item) => item.startDate === startDate && item.endDate === endDate && item.id !== record?.id);
    if (collision && !choice) { setDuplicate(collision); return; }
    const next = payload();
    let committed: PeriodRecord | null = null;
    if (choice === 'update-existing' && collision) savePeriodRecord({ ...collision, ...next });
    else if (choice === 'merge-edit' && collision && record) { savePeriodRecord({ ...collision, ...next }); deleteTicketsForRecord(record.id); deletePeriodRecord(record.id); }
    else if (record) savePeriodRecord({ ...record, ...next });
    else {
      const created = createPeriodRecord(startDate, endDate, [], '', mood, '平潮', flowLevel);
      savePeriodRecord(created);
      committed = created;
    }
    // Phase 3C: auto-generate ONLY for brand-new records, AFTER commit success.
    // Edit commits never overwrite an existing ticket (stale contract applies).
    if (committed) {
      const projection = getCycleDateProjection(committed.startDate);
      try {
        setReveal(autoGenerateTicketForRecord(committed, {
          cycleDay: projection.cycleDay ?? undefined,
          phaseLabel: getCyclePhaseLabel(projection.phase),
        }));
        setRevealFailed(false);
      } catch {
        // Ticket generation/storage failure — canonical record stays saved.
        setReveal(null);
        setRevealFailed(true);
      }
    }
    finish();
  };
  const remove = () => {
    if (!record) return;
    deleteTicketsForRecord(record.id);
    deletePeriodRecord(record.id);
    finish();
  };

  const dateInvalid = !startDate || !endDate || startDate > endDate;
  const openDatePicker = (target: 'start' | 'end') => {
    setTriggerRect((target === 'start' ? startDateRef.current : endDateRef.current)?.getBoundingClientRect());
    setDatePickerTarget(target);
  };

  return (
    <CalendarCreateSheet
      isOpen
      onClose={onClose}
      onConfirm={() => commit()}
      typeLabel="Period Record"
      title={record ? '編輯生理周期' : '記錄生理周期'}
      subtitle="記下今天的周期狀態。"
      confirmLabel="儲存"
      confirmDisabled={!dirty || dateInvalid}
      dirty={dirty}
      showClose
      testId="period-record-sheet"
      className="period-composer"
      deleteButton={record ? (deleteConfirm ? (
        <>
          <button type="button" className="cal-create-danger-btn" onClick={remove}>確認刪除</button>
          <button type="button" className="cal-create-cancel-btn" onClick={() => setDeleteConfirm(false)}>保留紀錄</button>
        </>
      ) : (
        <button type="button" className="cal-create-danger-btn" onClick={() => setDeleteConfirm(true)}>刪除</button>
      )) : undefined}
    >
      {duplicate && (
        <div className="pc-duplicate" role="alert">
          <p>{record ? '已有另一筆相同日期範圍的紀錄。' : '已存在相同日期範圍的紀錄。'}</p>
          <div className="pc-duplicate-actions">
            {record ? (
              <>
                <button type="button" className="cal-create-confirm-btn" onClick={() => commit('merge-edit')}>合併並更新</button>
                <button type="button" className="cal-create-cancel-btn" onClick={() => commit('keep-both')}>保留兩筆</button>
              </>
            ) : (
              <>
                <button type="button" className="cal-create-confirm-btn" onClick={() => commit('update-existing')}>更新原紀錄</button>
                <button type="button" className="cal-create-cancel-btn" onClick={() => commit('force-create')}>仍然新增</button>
              </>
            )}
            <button type="button" className="cal-create-cancel-btn" onClick={() => setDuplicate(null)}>取消</button>
          </div>
        </div>
      )}

      <div className="pc-field">
        <span className="pc-label" id="pc-date-label">日期</span>
        <div className="pc-date-row" role="group" aria-labelledby="pc-date-label">
          <PickerField label="開始日期" value={formatDateLabel(startDate)} onOpen={() => openDatePicker('start')} expanded={datePickerTarget === 'start'} buttonRef={startDateRef} />
          <span className="pc-date-arrow" aria-hidden="true">→</span>
          <PickerField label="結束日期" value={formatDateLabel(endDate)} onOpen={() => openDatePicker('end')} expanded={datePickerTarget === 'end'} buttonRef={endDateRef} />
        </div>
        <DateWheelPicker
          isOpen={datePickerTarget !== null}
          value={datePickerTarget === 'end' ? endDate : startDate}
          title={datePickerTarget === 'end' ? '選擇結束日期' : '選擇開始日期'}
          triggerRect={triggerRect}
          onConfirm={(nextDate) => {
            const nextStart = datePickerTarget === 'start' ? nextDate : startDate;
            const nextEnd = datePickerTarget === 'end' ? nextDate : endDate;
            if (datePickerTarget === 'end') setEndDate(nextDate);
            else setStartDate(nextDate);
            setError(nextStart > nextEnd ? '結束日期不能早於開始日期' : '');
            setDatePickerTarget(null);
          }}
          onCancel={() => setDatePickerTarget(null)}
        />
      </div>

      <div className="pc-field">
        <span className="pc-label" id="pc-flow-label">經量</span>
        <PeriodFlowOrbSelector value={flowLevel} onChange={setFlowLevel} label="經量" />
      </div>

      <div className="pc-field">
        <span className="pc-label" id="pc-mood-label">情緒刻度</span>
        <PeriodMoodSlider value={mood} onChange={setMood} label="心情" />
      </div>

      {error && <p role="alert" className="pc-error">{error}</p>}
    </CalendarCreateSheet>
  );
}
