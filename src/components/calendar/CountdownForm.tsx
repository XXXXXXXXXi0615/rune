import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';
import type { CountdownItem } from '@/types';

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

export function CountdownForm({ onDone }: CountdownFormProps) {
  const addCountdown = useAppStore((s) => s.addCountdown);
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [type, setType] = useState<CountdownItem['type']>('custom');
  const [customLabel, setCustomLabel] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

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
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>{t('countdown.formTime')}</label>
          <input type="time" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} />
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
