import { useMemo } from 'react';
import { calculateFlowDayClock, calendarDateTimeParts, getFlowDayBoundaryKeys, type FlowDayPillar } from '@/calendar/core';
import { useNow } from '@/hooks/useNow';
import { useAppStore } from '@/store/useAppStore';
import { useHomeClockStore } from '@/store/useHomeClockStore';

type PillarPriority = 'year' | 'month' | 'day' | 'hour';

function Pillar({ title, value, priority }: { title: string; value: FlowDayPillar; priority: PillarPriority }) {
  return (
    <div className="fdc-pillar-column" data-pillar={priority} aria-label={`${title}：${value.label}`}>
      <div className="fdc-glass-capsule">
        <div className="fdc-ganzhi-chars">
          <div className="fdc-char-box">
            <div className="fdc-char-text fdc-stem" data-element={value.stemElement} aria-hidden="true">{value.stem}</div>
          </div>
          <div className="fdc-capsule-divider" aria-hidden="true" />
          <div className="fdc-char-box">
            <div className="fdc-char-text fdc-branch" data-element={value.branchElement} aria-hidden="true">{value.branch}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MoonGlassClock({ compact = false }: { compact?: boolean }) {
  const now = useNow('second');
  const language = useAppStore((state) => state.language);
  const settings = useHomeClockStore((state) => state.settings);
  const locale = language === 'en' ? 'en' : 'zh-TW';
  const keys = getFlowDayBoundaryKeys(now);
  const model = useMemo(
    () => calculateFlowDayClock(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys.year, keys.month, keys.day, keys.hour],
  );
  const date = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

  // Flow Day has one presentation contract in every locale: 00–23, no day period.
  const time = calendarDateTimeParts(now, model.timezone);
  const hourStr = String(time.hour).padStart(2, '0');
  const minuteStr = String(time.minute).padStart(2, '0');
  const secondStr = settings.showSeconds ? String(time.second).padStart(2, '0') : '';

  const shichen = `${model.hourPillar.branch}時`;
  const ariaLabel = `${model.yearPillar.label}年、${model.monthPillar.label}月、${model.dayPillar.label}日、${model.hourPillar.label}時。${date} ${hourStr}:${minuteStr}${secondStr ? `:${secondStr}` : ''}`;
  const context = [settings.showSolarTerm ? model.solarTerm : null, settings.showShichen ? shichen : null].filter(Boolean).join(' · ');

  const fullClock = (
    <div className="home-clock-zone is-center">
      <section className="moon-glass-clock flow-day-clock" data-testid="moon-glass-clock" data-display-mode="flowday-primary" data-home-clock-fixed data-pet-safe-region data-pet-perch-surface="home-flow-clock" data-timezone={model.timezone} aria-label={ariaLabel}>
        <div className="fdc-decorative-layer" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}assets/home/flow-day-moon-orbit.png`} alt="" draggable="false" />
        </div>
        <div className="fdc-live-layer">
          <div className="fdc-digital-clock-wrapper" data-pet-safe-region>
            <time className="fdc-digital-clock" dateTime={now.toISOString()} data-testid="flow-day-digital-clock">
              <span className="fdc-time-hm">{hourStr}:{minuteStr}</span>
              {secondStr !== '' && <span className="fdc-time-secs">{secondStr}</span>}
            </time>
            <div className="fdc-date-line">{date}</div>
          </div>
          <div className="fdc-pillars-wrapper" data-pet-safe-region aria-label="四柱流日時鐘">
            <Pillar title="年柱" value={model.yearPillar} priority="year" />
            <Pillar title="月柱" value={model.monthPillar} priority="month" />
            <Pillar title="日柱" value={model.dayPillar} priority="day" />
            <Pillar title="時柱" value={model.hourPillar} priority="hour" />
          </div>
          {context && <div className="fdc-context-line">{context}</div>}
        </div>
      </section>
    </div>
  );
  if (!compact) return fullClock;
  const worldDate = `${time.year}/${String(time.month).padStart(2, '0')}/${String(time.day).padStart(2, '0')}`;
  return <details className="world-time" data-testid="world-time" onKeyDown={(event) => {
    if (event.key === 'Escape') {
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus();
    }
  }}>
    <summary className="world-time__hud" data-pet-safe-region="interactive" aria-label="世界時間，展開流日時鐘">
      <time dateTime={now.toISOString()}><span className="world-time__hm">{hourStr}:{minuteStr}</span>{secondStr && <small>{secondStr}</small>}</time>
      <span className="world-time__date">{worldDate}</span>
      <span className="world-time__context">{context}</span>
    </summary>
    <div className="world-time__detail" data-pet-safe-region="interactive">{fullClock}</div>
  </details>;
}
