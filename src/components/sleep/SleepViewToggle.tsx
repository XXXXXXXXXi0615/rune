export type SleepView = 'day' | 'week' | 'month' | 'halfYear';

interface SleepViewToggleProps {
  value: SleepView;
  onChange: (v: SleepView) => void;
}

const VIEWS: { key: SleepView; label: string }[] = [
  { key: 'day', label: '日' },
  { key: 'week', label: '週' },
  { key: 'month', label: '月' },
  { key: 'halfYear', label: '6個月' },
];

export function SleepViewToggle({ value, onChange }: SleepViewToggleProps) {
  return (
    <div className="sleep-view-toggle">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          className={`sleep-view-toggle-btn${value === v.key ? ' active' : ''}`}
          onClick={() => onChange(v.key)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function computeViewDateRange(view: SleepView): { start: string; end: string } {
  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const start = new Date(now);
  if (view === 'day') {
    // Keep same day
  } else if (view === 'week') {
    start.setDate(start.getDate() - 6);
  } else if (view === 'month') {
    start.setDate(start.getDate() - 29);
  } else if (view === 'halfYear') {
    start.setDate(start.getDate() - 179);
  }
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return { start: startStr, end };
}
