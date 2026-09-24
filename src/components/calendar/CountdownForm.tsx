import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { TimePickerSheet } from '@/components/ui/TimePickerSheet';
import { ClockIcon } from '@/components/icons/LunartideIcons';
import { t } from '@/i18n';
import type { CountdownItem } from '@/types';

function CalIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

interface CountdownFormProps {
  onDone: () => void;
}

const TYPE_OPTIONS: { value: CountdownItem['type']; labelKey: string }[] = [
  { value: 'anniversary', labelKey: 'countdown.anniversary' },
  { value: 'birthday', labelKey: 'countdown.birthday' },
  { value: 'deadline', labelKey: 'countdown.deadline' },
  { value: 'project', labelKey: 'countdown.project' },
  { value: 'custom', labelKey: 'countdown.custom' },
];

const COLOR_MAP: Record<CountdownItem['type'], string> = {
  anniversary: '#cc785c', birthday: '#e8a55a', deadline: '#c64545',
  project: '#cc785c', custom: '#5db8a6',
};

function formatZhDate(dateStr: string): string {
  if (!dateStr) return '選擇日期';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function CountdownForm({ onDone }: CountdownFormProps) {
  const addCountdown = useAppStore((s) => s.addCountdown);
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [type, setType] = useState<CountdownItem['type']>('custom');
  const [customLabel, setCustomLabel] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const canSave = title.trim().length > 0 && targetDate.length > 0
    && (type !== 'custom' || customLabel.trim().length > 0);

  const handleSave = () => {
    if (!canSave) {
      if (type === 'custom' && !customLabel.trim()) setError('請輸入自訂類型名稱');
      return;
    }
    addCountdown({
      title: title.trim(), targetDate, targetTime: targetTime || undefined,
      type, color: COLOR_MAP[type], pinned: false,
      customTypeLabel: type === 'custom' ? customLabel.trim() : undefined,
      note: note.trim() || undefined,
    });
    onDone();
  };

  return (
    <div className="drawer-form">
      <div>
        <label>{t('countdown.formTitle')}</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={t('countdown.formPlaceholder')} autoFocus />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>{t('countdown.formDate')}</label>
          <button
            type="button"
            className="drawer-trigger-btn"
            onClick={() => setDatePickerOpen(true)}
          >
            <CalIcon />
            <span className={targetDate ? '' : 'drawer-trigger-placeholder'}>{formatZhDate(targetDate)}</span>
          </button>
          <DatePickerSheet
            isOpen={datePickerOpen}
            value={targetDate}
            onConfirm={(d) => setTargetDate(d)}
            onCancel={() => setDatePickerOpen(false)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>{t('countdown.formTime')}</label>
          <button
            type="button"
            className="drawer-trigger-btn"
            onClick={() => setTimePickerOpen(true)}
          >
            <ClockIcon size={16} />
            <span className={targetTime ? '' : 'drawer-trigger-placeholder'}>{targetTime || '選擇時間'}</span>
          </button>
          <TimePickerSheet
            isOpen={timePickerOpen}
            value={targetTime}
            onConfirm={(t) => setTargetTime(t)}
            onCancel={() => setTimePickerOpen(false)}
          />
        </div>
      </div>

      <div>
        <label>{t('countdown.formType')}</label>
        <select value={type} onChange={(e) => { setType(e.target.value as CountdownItem['type']); setError(''); setCustomLabel(''); }}>
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>

      {type === 'custom' && (
        <div>
          <label>{t('countdown.customTypeName')}</label>
          <input type="text" value={customLabel} onChange={(e) => { setCustomLabel(e.target.value); setError(''); }}
            placeholder={t('countdown.customPlaceholder')} />
          {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
        </div>
      )}

      <div>
        <label>{t('todo.formNote')}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('todo.formNotePlaceholder')} />
      </div>

      <div className="drawer-form-actions">
        <button type="button" className="btn-ghost" onClick={onDone}>{t('sheet.cancel')}</button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={!canSave}>{t('todo.formAdd')}</button>
      </div>
    </div>
  );
}
