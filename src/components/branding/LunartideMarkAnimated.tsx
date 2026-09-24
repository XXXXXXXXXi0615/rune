import { useEffect, useRef } from 'react';
import { LUNARTIDE_MARK_NODES, LUNARTIDE_MARK_PATHS, LUNARTIDE_MARK_VIEWBOX } from './lunartideMarkGeometry';

interface LunartideMarkAnimatedProps { size?: number; className?: string; active?: boolean; decorative?: boolean; ariaLabel?: string; }

export function LunartideMarkAnimated({ size = 44, className, active = true, decorative = true, ariaLabel = 'Lunartide 月潮思考中' }: LunartideMarkAnimatedProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof SVGPathElement === 'undefined') return;
    svg.querySelectorAll<SVGPathElement>('[data-luna-measure]').forEach((path) => {
      try { path.style.setProperty('--luna-path-length', `${path.getTotalLength()}`); } catch { path.style.setProperty('--luna-path-length', '96'); }
    });
  }, []);
  return <svg ref={svgRef} width={size} height={size} viewBox={LUNARTIDE_MARK_VIEWBOX} fill="none" className={`luna-mark-animated${active ? ' is-active' : ''} ${className ?? ''}`.trim()} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : ariaLabel} aria-hidden={decorative || undefined}>
    <path className="luna-left-surface" d={LUNARTIDE_MARK_PATHS.leftSurface} /><path className="luna-right-surface" d={LUNARTIDE_MARK_PATHS.rightSurface} />
    <path id="luna-left-outline" data-luna-measure className="luna-left-outline" d={LUNARTIDE_MARK_PATHS.leftOutline} /><path id="luna-right-outline" data-luna-measure className="luna-right-outline" d={LUNARTIDE_MARK_PATHS.rightOutline} />
    <path id="luna-left-flow" data-luna-measure className="luna-left-flow" d={LUNARTIDE_MARK_PATHS.leftFlow} /><path id="luna-right-flow" data-luna-measure className="luna-right-flow" d={LUNARTIDE_MARK_PATHS.rightFlow} />
    <path id="luna-center-crescent" className="luna-center-crescent" d={LUNARTIDE_MARK_PATHS.centerCrescent} />
    <circle id="luna-node-left" className="luna-node-left" {...LUNARTIDE_MARK_NODES.left} /><circle id="luna-node-right" className="luna-node-right" {...LUNARTIDE_MARK_NODES.right} />
  </svg>;
}
