import { FLOW_LEVELS } from '@/utils/periodStorage';

/** Canonical values stay the repo enum: 無/點滴/輕/中/重 (stored as-is). */
export const PERIOD_FLOW_VALUES = FLOW_LEVELS;

/**
 * Asset seam — a canonical transparent Rune Flow Orb PNG set may replace the
 * CSS/SVG orb visual later without touching this component's contract.
 * Returns null today → CSS orb rendering is used.
 */
export function resolvePeriodFlowOrbAsset(_value: string): string | null {
  return null;
}

/** Orb intensity stages share one reusable item; value drives the art only. */
export const PERIOD_ORB_INTENSITY: Record<string, number> = {
  '無': 0,
  '點滴': 1,
  '輕': 2,
  '中': 3,
  '重': 4,
};

/** Keyless Rune-style orb art — one reusable presentation driven by intensity. */
function OrbArt({ intensity }: { intensity: number }) {
  return (
    <span className="pf-orb-visual" data-intensity={intensity} aria-hidden="true">
      <span className="pf-orb-ring" />
      {intensity >= 2 && <span className={`pf-orb-core${intensity >= 4 ? ' pf-orb-core--full' : ''}`} />}
      {intensity === 1 && <span className="pf-orb-dot" />}
      {intensity >= 3 && <span className="pf-orb-ring2" />}
      {intensity >= 4 && <span className="pf-orb-halo" />}
    </span>
  );
}

/** Five-level Rune Flow Orb selector (radiogroup semantics, 44px targets). */
export function PeriodFlowOrbSelector({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="period-flow-orbs" role="radiogroup" aria-label={label} data-testid="period-flow-orbs">
      {PERIOD_FLOW_VALUES.map((item) => {
        const checked = value === item;
        return (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={checked}
            className={`period-flow-orb${checked ? ' is-selected' : ''}`}
            onClick={() => onChange(checked ? '' : item)}
          >
            <OrbArt intensity={PERIOD_ORB_INTENSITY[item] ?? 0} />
            <span className="period-flow-orb-label">{item}</span>
          </button>
        );
      })}
    </div>
  );
}
