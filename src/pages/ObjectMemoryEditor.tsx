/**
 * ObjectMemoryEditor — add/edit editor for ObjectMemory.
 *
 * Uses ResizableEditorWindow: macOS-style draggable + resizable floating window,
 * fullscreen bottom sheet on mobile.
 *
 * Shared between Dashboard (add new) and Detail (edit existing).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useObjectMemoryStore } from '@/store/objectMemoryStore';
import { ResizableEditorWindow } from '@/components/ui/ResizableEditorWindow';
import { WheelPicker, type WheelColumnSpec } from '@/components/ui/WheelPicker';
import type { ObjectMemory, ObjectLifecycleState } from '@/types';
import {
  createCanonicalItem,
  updateCanonicalItem,
  findCanonicalItemEntry,
  getCanonicalIdForObjectMemory,
  resyncItemsStoreAfterWrite,
} from '@/features/lifeLedger/canonicalItemStore';
import './ObjectMemoryPage.css';

interface EditorProps {
  object?: ObjectMemory;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

const STATE_OPTIONS: { value: ObjectLifecycleState; label: string }[] = [
  { value: 'active',   label: '使用中' },
  { value: 'aging',    label: '漸老' },
  { value: 'farewell', label: '告別期' },
  { value: 'retired',  label: '已退役' },
];

const STATE_LABELS = STATE_OPTIONS.map((o) => o.label);
const STATE_VALUES = STATE_OPTIONS.map((o) => o.value);

/* ── Date helpers ── */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function parseIsoDateParts(value?: string): [number, number, number] {
  const fallback = todayIso();
  const [year, month, day] = (value || fallback).split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return fallback.split('-').map(Number) as [number, number, number];
  }
  return [year, month, day];
}

/** Build year list: ± 20 years from now. */
function buildYears(): string[] {
  const now = new Date().getFullYear();
  const years: string[] = [];
  for (let y = now + 10; y >= now - 20; y--) years.push(String(y));
  return years;
}
const YEARS = buildYears();

function buildMonths(): string[] {
  return Array.from({ length: 12 }, (_, i) => pad(i + 1));
}
const MONTHS = buildMonths();

function buildDays(year: number, month: number): string[] {
  const count = daysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => pad(i + 1));
}

/** Comparitor: true if any field differs from initial. */
function isDirty(initial: Record<string, unknown>, current: Record<string, unknown>): boolean {
  for (const key of Object.keys(current)) {
    if (String(current[key] ?? '') !== String(initial[key] ?? '')) return true;
  }
  return false;
}

export function ObjectMemoryEditor({ object, onClose, onSaved }: EditorProps) {
  const updateObject = useObjectMemoryStore((s) => s.updateObject);

  const isEdit = !!object;
  const nameRef = useRef<HTMLInputElement>(null);

  // Parse initial date values.
  const initDate = object?.startDate ?? todayIso();
  const [initYear, initMonth, initDay] = parseIsoDateParts(initDate);
  const endInit = object?.endDate ?? '';
  const [endInitYear, endInitMonth, endInitDay] = endInit ? parseIsoDateParts(endInit) : [0, 0, 0];

  const initName = object?.name ?? '';
  const initCategory = object?.category ?? '';
  const initLifecycleState = object?.lifecycleState ?? 'active';
  const initNotes = object?.notes ?? '';

  const [name, setName] = useState(initName);
  const [category, setCategory] = useState(initCategory);
  const [lifecycleState, setLifecycleState] = useState<ObjectLifecycleState>(initLifecycleState);
  const [notes, setNotes] = useState(initNotes);
  const [submitHint, setSubmitHint] = useState('');
  const [lifecycleOpen, setLifecycleOpen] = useState(false);

  // Date picker state.
  const [startYear, setStartYear] = useState(initYear);
  const [startMonth, setStartMonth] = useState(initMonth);
  const [startDay, setStartDay] = useState(initDay);
  const [endYear, setEndYear] = useState(endInitYear || initYear);
  const [endMonth, setEndMonth] = useState(endInitMonth || initMonth);
  const [endDay, setEndDay] = useState(endInitDay || initDay);

  const startDate = `${startYear}-${pad(startMonth)}-${pad(startDay)}`;
  const endDateStr = lifecycleState === 'retired'
    ? `${endYear}-${pad(endMonth)}-${pad(endDay)}`
    : '';
  const showEndDate = lifecycleState === 'retired';

  // Dirty tracking
  const dirty = isDirty(
    { name: initName, category: initCategory, notes: initNotes },
    { name, category, notes },
  );

  // Auto-focus name input
  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  // Day lists — recompute when year/month change.
  const startDays = useMemo(() => buildDays(startYear, startMonth), [startYear, startMonth]);
  const endDays = useMemo(() => buildDays(endYear, endMonth), [endYear, endMonth]);

  // Clamp day when month changes.
  useEffect(() => {
    const max = daysInMonth(startYear, startMonth);
    if (startDay > max) setStartDay(max);
  }, [startYear, startMonth, startDay]);
  useEffect(() => {
    const max = daysInMonth(endYear, endMonth);
    if (endDay > max) setEndDay(max);
  }, [endYear, endMonth, endDay]);

  // Build WheelPicker columns.
  const lifecycleColumn: WheelColumnSpec = {
    items: STATE_LABELS,
    selectedIndex: STATE_VALUES.indexOf(lifecycleState),
    onChange: (i) => setLifecycleState(STATE_VALUES[i]),
  };

  const startDateColumns: WheelColumnSpec[] = [
    {
      items: YEARS,
      selectedIndex: Math.max(0, YEARS.indexOf(String(startYear))),
      onChange: (i) => setStartYear(Number(YEARS[i])),
    },
    {
      items: MONTHS,
      selectedIndex: Math.max(0, startMonth - 1),
      onChange: (i) => setStartMonth(i + 1),
    },
    {
      items: startDays,
      selectedIndex: Math.max(0, Math.min(startDay - 1, startDays.length - 1)),
      onChange: (i) => setStartDay(Number(startDays[i])),
    },
  ];

  const endDateColumns: WheelColumnSpec[] = [
    {
      items: YEARS,
      selectedIndex: Math.max(0, YEARS.indexOf(String(endYear))),
      onChange: (i) => setEndYear(Number(YEARS[i])),
    },
    {
      items: MONTHS,
      selectedIndex: Math.max(0, endMonth - 1),
      onChange: (i) => setEndMonth(i + 1),
    },
    {
      items: endDays,
      selectedIndex: Math.max(0, Math.min(endDay - 1, endDays.length - 1)),
      onChange: (i) => setEndDay(Number(endDays[i])),
    },
  ];

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const safeName = name.trim();
    if (!safeName) {
      setSubmitHint('請先輸入物品名稱。');
      nameRef.current?.focus();
      return;
    }
    const safeStartDate = startDate || todayIso();
    const lifecycleMapping: Record<ObjectLifecycleState, 'active' | 'idle' | 'aging' | 'farewell' | 'retired'> = {
      'active': 'active',
      'aging': 'aging',
      'farewell': 'farewell',
      'retired': 'retired',
    };
    const canonicalLifecycle = lifecycleMapping[lifecycleState as ObjectLifecycleState] ?? 'active';
    if (isEdit && object) {
      const canonicalId = getCanonicalIdForObjectMemory(object.id);
      const entry = await findCanonicalItemEntry(canonicalId);
      if (entry) {
        const result = await updateCanonicalItem(canonicalId, entry.revision ?? 1, {
          name: safeName,
          category: category.trim() || '未分類',
          lifecycleState: canonicalLifecycle,
          startDate: safeStartDate,
          endDate: lifecycleState === 'retired' ? endDateStr : undefined,
          notes: notes.trim(),
        });
        if (result.status === 'conflict' || result.status === 'rejected') {
          setSubmitHint('儲存失敗，請稍後再試。');
          return;
        }
      } else {
        // Fallback: item not yet in canonical, use store directly
        updateObject(object.id, {
          name: safeName,
          category: category.trim() || '未分類',
          lifecycleState: lifecycleState as ObjectLifecycleState,
          startDate: safeStartDate,
          endDate: lifecycleState === 'retired' ? endDateStr : undefined,
          notes: notes.trim(),
        });
      }
      onSaved?.(object.id);
    } else {
      const result = await createCanonicalItem({
        name: safeName,
        category: category.trim() || '未分類',
        startDate: safeStartDate,
        endDate: lifecycleState === 'retired' ? endDateStr : undefined,
        lifecycleState: canonicalLifecycle,
        notes: notes.trim(),
      });
      if (result.status === 'rejected') {
        setSubmitHint('新增失敗，請稍後再試。');
        return;
      }
      onSaved?.(result.entryId ?? '');
    }
    onClose();
  };

  const formContent = (
    <>
      <div className="olm-field olm-field--primary">
        <label>物品名稱</label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSubmitHint(''); }}
          placeholder="這件物品叫什麼？"
        />
      </div>

      <div className="olm-field">
        <label>類別</label>
        <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="未分類" />
      </div>

      <div className="olm-field">
        <label>描述</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="先不用寫也可以，之後再補。" />
      </div>

      {/* Section: Collapsible Lifecycle Controls */}
      <div className="olm-lifecycle-collapse">
        <button
          type="button"
          className="olm-collapse-trigger"
          onClick={() => setLifecycleOpen((value) => !value)}
          aria-expanded={lifecycleOpen}
        >
          <span>
            <strong>生命旅程</strong>
            <small>{STATE_LABELS[STATE_VALUES.indexOf(lifecycleState)] || '使用中'} · {startDate}</small>
          </span>
          <b>{lifecycleOpen ? '收起' : '調整'}</b>
        </button>

        {lifecycleOpen && (
          <div className="olm-collapse-body">
            <div className="olm-field olm-picker-field">
              <label>生命狀態</label>
              <div className="olm-picker-frame">
                <WheelPicker columns={[lifecycleColumn]} height={156} itemHeight={36} />
              </div>
            </div>

            <div className="olm-field olm-picker-field">
              <label>開始日期</label>
              <div className="olm-date-value">{startDate}</div>
              <div className="olm-picker-frame">
                <WheelPicker columns={startDateColumns} height={156} itemHeight={36} />
              </div>
            </div>

            {showEndDate && (
              <div className="olm-field olm-picker-field">
                <label>結束日期（退役日）</label>
                <div className="olm-date-value">{endDateStr}</div>
                <div className="olm-picker-frame">
                  <WheelPicker columns={endDateColumns} height={156} itemHeight={36} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {submitHint && <div className="olm-submit-hint">{submitHint}</div>}
    </>
  );

  const footerContent = (
    <>
      <button type="button" onClick={onClose}>取消</button>
      <button type="submit" onClick={() => handleSubmit()}>
        {isEdit ? '儲存' : '確認收錄'}
      </button>
    </>
  );

  return (
    <ResizableEditorWindow
      open
      onClose={onClose}
      title={isEdit ? '編輯物品' : '加入物品'}
      subtitle={isEdit ? undefined : '記錄一件正在陪你的東西'}
      footer={footerContent}
      dirty={dirty}
    >
      {formContent}
    </ResizableEditorWindow>
  );
}
