import { LUNARTIDE_MARK_NODES, LUNARTIDE_MARK_PATHS, LUNARTIDE_MARK_VIEWBOX } from './lunartideMarkGeometry';

interface LunartideMarkProps { size?: number; className?: string; decorative?: boolean; ariaLabel?: string; }

export function LunartideMark({ size = 40, className, decorative = false, ariaLabel = 'Lunartide 月潮' }: LunartideMarkProps) {
  return <svg width={size} height={size} viewBox={LUNARTIDE_MARK_VIEWBOX} fill="none" className={className} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : ariaLabel} aria-hidden={decorative || undefined}>
    <path className="luna-left-surface" d={LUNARTIDE_MARK_PATHS.leftSurface} /><path className="luna-right-surface" d={LUNARTIDE_MARK_PATHS.rightSurface} />
    <path className="luna-left-outline" d={LUNARTIDE_MARK_PATHS.leftOutline} /><path className="luna-right-outline" d={LUNARTIDE_MARK_PATHS.rightOutline} />
    <path className="luna-left-flow" d={LUNARTIDE_MARK_PATHS.leftFlow} /><path className="luna-right-flow" d={LUNARTIDE_MARK_PATHS.rightFlow} />
    <path className="luna-center-crescent" d={LUNARTIDE_MARK_PATHS.centerCrescent} />
    <circle className="luna-node-left" {...LUNARTIDE_MARK_NODES.left} /><circle className="luna-node-right" {...LUNARTIDE_MARK_NODES.right} />
  </svg>;
}
