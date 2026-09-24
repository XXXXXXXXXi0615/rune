/**
 * TIDEWATCH — milestones (Tidemarks).
 *
 * When a cumulative threshold is crossed, reachedAt is written exactly once.
 * Reload must never trigger the same milestone twice.
 *
 * Store counts-at-moment: userCountAtMoment, agentCountAtMoment.
 * Do NOT integrate Calendar anniversaries in Phase 1A — only create the future seam.
 */
import type { Milestone, MilestoneScope, MilestoneDefinition, WritingTelemetryEvent } from './types';
import { saveMilestones, loadAllMilestones } from './repository';
import { lifetimeStats } from './aggregation';

// ---------------------------------------------------------------------------
// Default thresholds
// ---------------------------------------------------------------------------

const SCOPE_LABELS: Record<MilestoneScope, string> = {
  user: 'USER',
  agent: 'Agent',
  combined: 'Combined',
};

function formatThreshold(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return String(n);
}

const DEFAULT_THRESHOLDS = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

export function buildDefaultMilestoneDefinitions(): MilestoneDefinition[] {
  const defs: MilestoneDefinition[] = [];
  for (const scope of ['user', 'agent', 'combined'] as MilestoneScope[]) {
    for (const threshold of DEFAULT_THRESHOLDS) {
      defs.push({
        name: `${SCOPE_LABELS[scope]} ${formatThreshold(threshold)}`,
        scope,
        threshold,
      });
    }
  }
  return defs;
}

// ---------------------------------------------------------------------------
// Runtime check
// ---------------------------------------------------------------------------

function getCountForScope(
  stats: { userInput: number; userCommitted: number; agentCommitted: number },
  scope: MilestoneScope,
): number {
  switch (scope) {
    case 'user': return stats.userCommitted;
    case 'agent': return stats.agentCommitted;
    case 'combined': return stats.userCommitted + stats.agentCommitted;
  }
}

/**
 * Check all milestone definitions against current stats.
 * Returns newly crossed milestones (reachedAt set for the first time).
 * Reload-safe: only milestones with undefined reachedAt are candidates.
 */
export async function checkMilestones(
  events: WritingTelemetryEvent[],
): Promise<Milestone[]> {
  const existing = await loadAllMilestones();
  const existingMap = new Map(existing.map((m) => [`${m.scope}:${m.threshold}`, m]));
  const stats = lifetimeStats(events);
  const defs = buildDefaultMilestoneDefinitions();
  const newlyReached: Milestone[] = [];

  for (const def of defs) {
    const key = `${def.scope}:${def.threshold}`;
    const existingMilestone = existingMap.get(key);
    const currentCount = getCountForScope(stats, def.scope);

    if (existingMilestone?.reachedAt) continue; // already reached

    if (currentCount >= def.threshold) {
      const milestone: Milestone = {
        id: key,
        ...def,
        reachedAt: Date.now(),
        userCountAtMoment: stats.userCommitted,
        agentCountAtMoment: stats.agentCommitted,
      };
      existingMap.set(key, milestone);
      newlyReached.push(milestone);
    }
  }

  if (newlyReached.length > 0) {
    await saveMilestones(Array.from(existingMap.values()));
  }

  return newlyReached;
}

/**
 * Load all milestones with their current state.
 */
export async function loadMilestones(): Promise<Milestone[]> {
  const defs = buildDefaultMilestoneDefinitions();
  const existing = await loadAllMilestones();
  const existingMap = new Map(existing.map((m) => [`${m.scope}:${m.threshold}`, m]));

  return defs.map((def) => {
    const key = `${def.scope}:${def.threshold}`;
    return existingMap.get(key) ?? { id: key, ...def };
  });
}
