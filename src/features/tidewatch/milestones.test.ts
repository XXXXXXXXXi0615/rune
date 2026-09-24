import { describe, it, expect } from 'vitest';
import { buildDefaultMilestoneDefinitions } from './milestones';

describe('buildDefaultMilestoneDefinitions', () => {
  it('creates 18 definitions (3 scopes × 6 thresholds)', () => {
    const defs = buildDefaultMilestoneDefinitions();
    expect(defs).toHaveLength(18);
  });

  it('includes all three scopes', () => {
    const defs = buildDefaultMilestoneDefinitions();
    const scopes = new Set(defs.map((d) => d.scope));
    expect(scopes).toEqual(new Set(['user', 'agent', 'combined']));
  });

  it('includes all default thresholds', () => {
    const defs = buildDefaultMilestoneDefinitions();
    const thresholds = new Set(defs.map((d) => d.threshold));
    expect(thresholds).toEqual(new Set([10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]));
  });

  it('each definition has a name', () => {
    const defs = buildDefaultMilestoneDefinitions();
    for (const def of defs) {
      expect(def.name).toBeTruthy();
      expect(typeof def.name).toBe('string');
    }
  });

  it('names follow pattern: SCOPE THRESHOLD', () => {
    const defs = buildDefaultMilestoneDefinitions();
    expect(defs[0].name).toBe('USER 10K');
    expect(defs[6].name).toBe('Agent 10K');
    expect(defs[12].name).toBe('Combined 10K');
  });
});
