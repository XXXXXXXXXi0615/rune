import { resolveRuneBrandAsset, type RuneBrandMood } from '@/components/branding/runeBrandAssets';

export function resolveCheckInReactionMood(mood: number | null): RuneBrandMood {
  return mood != null && mood >= 4 ? 'smug' : 'neutral';
}

/** Decorative preview only; semantic Check-in text remains the accessible truth. */
export function RuneCheckInReaction({ mood }: { mood: number | null }) {
  const reaction = resolveCheckInReactionMood(mood);
  return <span className="checkin-reaction" aria-hidden="true" data-testid="checkin-rune-reaction" data-reaction={reaction}>
    <img src={resolveRuneBrandAsset(reaction)} alt="" draggable={false} />
  </span>;
}
