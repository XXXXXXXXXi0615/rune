import type { CheckIn } from '@/features/tidewatch/types';
import { resolveRunePresentationAsset } from '@/components/branding/runeBrandAssets';
import { formatCheckInAgeZh } from './checkInPresentation';

export function CheckInNudge({ latest, onOpen, onDismiss, onSnooze, onSuppress }: { latest: CheckIn; onOpen: () => void; onDismiss: () => void; onSnooze: () => void; onSuppress: () => void }) {
  const asset = resolveRunePresentationAsset('tidewatch-checkin-neutral');
  const visualHeight = 'var(--checkin-nudge-rune-height)';
  const visualWidthRatio = asset.visualBounds.width / asset.visualBounds.height;
  const canvasWidthRatio = asset.canvas.width / asset.visualBounds.height;
  const canvasHeightRatio = asset.canvas.height / asset.visualBounds.height;
  const visualOffsetXRatio = asset.visualBounds.x / asset.visualBounds.height;
  const visualOffsetYRatio = asset.visualBounds.y / asset.visualBounds.height;
  return <aside className="checkin-nudge" data-testid="checkin-nudge" aria-label="Check-in 提醒">
    <span className="checkin-nudge__art" aria-hidden="true" data-testid="checkin-nudge-rune" style={{ width: `calc(${visualHeight} * ${visualWidthRatio})`, height: visualHeight } as React.CSSProperties}><img src={asset.src} alt="" draggable={false} style={{ width: `calc(${visualHeight} * ${canvasWidthRatio})`, height: `calc(${visualHeight} * ${canvasHeightRatio})`, left: `calc(${visualHeight} * ${-visualOffsetXRatio})`, top: `calc(${visualHeight} * ${-visualOffsetYRatio})` }} /></span>
    <button type="button" className="checkin-nudge__close" aria-label="關閉 Check-in 提醒" onClick={onDismiss}>×</button>
    <strong>該報備一下了。</strong><span>上次 · {formatCheckInAgeZh(latest.createdAt)}</span>
    <div><button type="button" className="is-primary" onClick={onOpen}>去打卡</button><button type="button" onClick={onSnooze}>稍後</button></div>
    <button type="button" className="checkin-nudge__suppress" onClick={onSuppress}>不感興趣</button>
  </aside>;
}
