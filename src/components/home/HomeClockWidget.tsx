import { useState, useEffect } from 'react';
import { useHomeClockStore } from '@/store/useHomeClockStore';
import { toLocalDateString } from '@/utils/date';
import type { HomeWidgetSize } from '@/features/home/types';

const DAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
function pad(n: number) { return String(n).padStart(2, '0'); }

export function HomeClockWidget({ size }: { size: HomeWidgetSize }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const h = now.getHours();
  const m = now.getMinutes();
  const dateKey = toLocalDateString(now);
  const tSize = 'clamp(28px,5vw,44px)';
  const tMuted = 12;

  if (size === 'wide') {
    return (
      <div className="hwg-widget hwg-widget--clock" data-home-widget-id="home-clock"
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 14px' }}>
        <div style={{ fontSize: tSize, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: 'var(--hwg-text)' }}>
          {pad(h)}:{pad(m)}
        </div>
        <div style={{ fontSize: tMuted, color: 'var(--hwg-text-muted)', marginTop: 3 }}>
          {dateKey} · {DAYS[now.getDay()]} · {h < 12 ? 'AM' : 'PM'}
        </div>
      </div>
    );
  }

  // medium (default)
  return (
    <div className="hwg-widget hwg-widget--clock" data-home-widget-id="home-clock"
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '18px 20px' }}>
      <div style={{ fontSize: size === 'large' ? 'clamp(40px,7vw,58px)' : 'clamp(34px,5vw,48px)', fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, color: 'var(--hwg-text)' }}>
        {pad(h)}:{pad(m)}
      </div>
      <div style={{ fontSize: tMuted, color: 'var(--hwg-text-muted)', marginTop: 4 }}>
        {dateKey} · {DAYS[now.getDay()]} · {h < 12 ? 'AM' : 'PM'}
      </div>
      {size === 'large' && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--hwg-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--hwg-accent)' }} />
          歡迎回來
        </div>
      )}
    </div>
  );
}
