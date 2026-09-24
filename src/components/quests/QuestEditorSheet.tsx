import { useMemo, useState } from 'react';
import { CalendarCreateSheet } from '@/components/calendar/CalendarCreateSheet';
import { AppSwitch } from '@/components/ui/AppPrimitives';
import { PickerField } from '@/components/ui/PickerField';
import { DatePickerPopover } from '@/components/ui/DatePickerPopover';
import { TimeWheelPicker } from '@/components/ui/TimeWheelPicker';
import { DurationPicker } from '@/components/ui/DurationPicker';
import { splitDate } from '@/components/ui/pickerUtils';
import { useQuestStore, type QuestPriority, type QuestRewardTier } from '@/store/useQuestStore';

const DURATION_OPTIONS = [
  { label: '15分', value: 15 },
  { label: '25分', value: 25 },
  { label: '45分', value: 45 },
  { label: '60分', value: 60 },
  { label: '90分', value: 90 },
  { label: '120分', value: 120 },
];

const PRIORITY_OPTIONS: Array<{ label: string; value: QuestPriority }> = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
];

export function QuestEditorSheet({ defaultDate, onClose }: { defaultDate?: string; onClose: () => void }) {
  const createQuest = useQuestStore((state) => state.createQuest);
  const claimQuest = useQuestStore((state) => state.claimQuest);
  const initDate = defaultDate || todayLocalStr();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initDate);
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<QuestPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState(25);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('life');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [reminder, setReminder] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | undefined>();

  const dirty = title !== ''
    || date !== initDate
    || time !== ''
    || priority !== 'medium'
    || estimatedMinutes !== 25
    || description !== ''
    || categoryId !== 'life'
    || subtasks.length > 0
    || repeat !== 'none'
    || reminder
    || note !== '';

  const rewardTier = useMemo<QuestRewardTier>(() => priority === 'high' || estimatedMinutes >= 60 ? 'large' : priority === 'low' && estimatedMinutes <= 20 ? 'light' : 'normal', [priority, estimatedMinutes]);
  const reward = rewardTier === 'large' ? 10 : rewardTier === 'normal' ? 5 : 2;

  const save = (claim: boolean) => {
    setSubmitted(true);
    if (!title.trim()) { setError('請先替任務命名。'); return; }
    const due = new Date(`${date}T${time || '23:59'}:00`);
    const id = createQuest({
      title: title.trim(), description: description.trim() || undefined, categoryId,
      priority, status: claim ? 'claimed' : 'available', dueAt: due.toISOString(), estimatedMinutes,
      subtasks: subtasks.map((item) => ({ id: crypto.randomUUID(), title: item, completed: false })),
      recurrence: repeat === 'none' ? undefined : { frequency: repeat, interval: 1 },
      reminderAt: reminder ? due.toISOString() : undefined, note: note.trim() || undefined,
      rewardTier, source: 'manual', claimedAt: claim ? new Date().toISOString() : undefined,
    });
    if (claim) claimQuest(id);
    onClose();
  };

  const handleOpenDatePicker = () => {
    const el = document.querySelector('.cal-picker-field');
    if (el) setTriggerRect(el.getBoundingClientRect());
    setDatePickerOpen(true);
  };

  const handleOpenTimePicker = () => {
    const el = document.querySelector('.cal-picker-field');
    if (el) setTriggerRect(el.getBoundingClientRect());
    setTimePickerOpen(true);
  };

  const handleOpenDurationPicker = () => {
    const el = document.querySelector('.cal-duration-options button:last-child');
    if (el) setTriggerRect(el.getBoundingClientRect());
    setDurationPickerOpen(true);
  };

  const dateDisplay = date ? (() => {
    const { year, month, day } = splitDate(date);
    return `${year} 年 ${month} 月 ${day} 日`;
  })() : '';

  return (
    <CalendarCreateSheet
      isOpen
      onClose={onClose}
      onConfirm={() => save(false)}
      typeLabel="Quest"
      title="建立任務"
      confirmLabel="創建任務"
      confirmDisabled={submitted && !title.trim()}
      dirty={dirty}
    >
      <div className="cal-field">
        <label>任務名稱</label>
        <input autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setError(''); setSubmitted(false); }} placeholder="今天準備推進什麼？" />
        {error && <small style={{ color: 'var(--danger)', fontSize: 11 }}>{error}</small>}
      </div>

      <div>
        <div className="cal-date-presets">
          {[0, 1, 2].map((offset) => {
            const next = new Date();
            next.setDate(next.getDate() + offset);
            const value = todayLocalStr(next);
            return <button type="button" key={offset} className={date === value ? 'active' : ''} onClick={() => setDate(value)}>{['今天', '明天', '後天'][offset]}</button>;
          })}
        </div>
        <div className="cal-field-row" style={{ marginTop: 8 }}>
          <PickerField
            label="日期"
            value={dateDisplay}
            placeholder="選擇日期"
            onOpen={handleOpenDatePicker}
          >
            <DatePickerPopover
              isOpen={datePickerOpen}
              value={date}
              triggerRect={triggerRect}
              onConfirm={(d) => { setDate(d); setSubmitted(false); setDatePickerOpen(false); }}
              onCancel={() => setDatePickerOpen(false)}
            />
          </PickerField>
          <PickerField
            label="時間（可選）"
            value={time}
            placeholder="選擇時間"
            onOpen={handleOpenTimePicker}
          >
            <TimeWheelPicker
              isOpen={timePickerOpen}
              value={time}
              triggerRect={triggerRect}
              onConfirm={(t) => { setTime(t); setSubmitted(false); setTimePickerOpen(false); }}
              onCancel={() => setTimePickerOpen(false)}
            />
          </PickerField>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 11, fontWeight: 700, marginBottom: 5 }}>優先級</label>
        <div className="cal-segmented-control">
          {PRIORITY_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={priority === opt.value ? 'active' : ''} onClick={() => setPriority(opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 11, fontWeight: 700, marginBottom: 5 }}>預計時長 · {estimatedMinutes} 分鐘</label>
        <div className="cal-duration-options">
          {DURATION_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={estimatedMinutes === opt.value ? 'active' : ''} onClick={() => setEstimatedMinutes(opt.value)}>
              {opt.label}
            </button>
          ))}
          <button type="button" className={!DURATION_OPTIONS.some(o => o.value === estimatedMinutes) ? 'active' : ''} onClick={handleOpenDurationPicker}>自訂</button>
        </div>
        <DurationPicker
          isOpen={durationPickerOpen}
          value={estimatedMinutes}
          triggerRect={triggerRect}
          onConfirm={(m) => { setEstimatedMinutes(m); setDurationPickerOpen(false); }}
          onCancel={() => setDurationPickerOpen(false)}
        />
      </div>

      <div className="cal-reward-card">
        <span>完成獎勵預覽</span>
        <strong>+{reward} 月印</strong>
      </div>

      <button type="button" className="cal-more-toggle" onClick={() => setMoreOpen((v) => !v)}>
        <span>更多設定</span>
        <svg className={moreOpen ? 'open' : ''} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {moreOpen && (
        <div className="cal-more-section">
          <div className="cal-field">
            <label>描述</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="cal-field">
            <label>分類</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="life">生活</option>
              <option value="work">工作</option>
              <option value="study">學習</option>
              <option value="health">健康</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div className="cal-field">
            <label>子任務</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={subtaskDraft} onChange={(e) => setSubtaskDraft(e.target.value)} placeholder="加入一個步驟" style={{ flex: 1 }} />
              <button type="button" className="cal-create-cancel-btn" style={{ minHeight: 36 }} onClick={() => { if (subtaskDraft.trim()) { setSubtasks((items) => [...items, subtaskDraft.trim()]); setSubtaskDraft(''); } }}>加入</button>
            </div>
          </div>
          {subtasks.map((item, index) => (
            <div key={`${item}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{ flex: 1, fontSize: 13 }}>{item}</span>
              <button type="button" className="cal-create-cancel-btn" style={{ minHeight: 28, padding: '0 10px', fontSize: 11 }} onClick={() => setSubtasks((items) => items.filter((_, i) => i !== index))}>移除</button>
            </div>
          ))}
          <div className="cal-field">
            <label>重複規則</label>
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}>
              <option value="none">不重複</option>
              <option value="daily">每天</option>
              <option value="weekly">每週</option>
              <option value="monthly">每月</option>
            </select>
          </div>
          <div className="cal-toggle-row">
            <span>提醒</span>
            <AppSwitch checked={reminder} onChange={setReminder} />
          </div>
          <div className="cal-field">
            <label>備註</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
      )}
    </CalendarCreateSheet>
  );
}

function todayLocalStr(date?: Date): string {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
