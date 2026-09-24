import { PERIOD_MOODS, type PeriodMood } from '@/utils/periodStorage';

const DEFAULT_MOOD_INDEX = 0;

export function PeriodMoodSlider({
  value,
  onChange,
  label,
}: {
  value?: PeriodMood;
  onChange: (value: PeriodMood) => void;
  label: string;
}) {
  const selectedIndex = Math.max(0, PERIOD_MOODS.findIndex((item) => item.key === value));
  const currentIndex = value ? selectedIndex : DEFAULT_MOOD_INDEX;
  const current = PERIOD_MOODS[currentIndex];

  const setIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(PERIOD_MOODS.length - 1, index));
    onChange(PERIOD_MOODS[nextIndex].key);
  };

  return (
    <div className="period-mood-slider-wrap">
      <div className="period-mood-ruler">
        <div className="period-mood-ticks" aria-hidden="true">
          {PERIOD_MOODS.map((mood, index) => <span key={mood.key} className={index === currentIndex ? 'is-active' : ''} />)}
        </div>
        <input
          className="period-mood-slider"
          type="range"
          min={0}
          max={PERIOD_MOODS.length - 1}
          step={1}
          value={currentIndex}
          onChange={(event) => setIndex(Number(event.currentTarget.value))}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={PERIOD_MOODS.length - 1}
          aria-valuenow={currentIndex}
          aria-valuetext={current.label}
        />
      </div>
      <div className="period-mood-slider-ends" aria-hidden="true">
        <span>{PERIOD_MOODS[0].label}</span>
        <span>{PERIOD_MOODS[PERIOD_MOODS.length - 1].label}</span>
      </div>
      <output className="period-mood-slider-value" aria-live="polite">
        {current.label}
      </output>
    </div>
  );
}
