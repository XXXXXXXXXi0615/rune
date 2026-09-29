import { describe, expect, it } from 'vitest';
import { RUNE_WALK_BOUNDS, RUNE_WALK_SPEED_WORLD_UNITS_PER_SECOND, RUNE_WANDER_DISTANCE, RUNE_WANDER_IDLE_MS, RUNE_WANDER_ZONE, RuneWorldActorRuntime, createRuneWanderSeededRandom, isInRuneWanderZone } from './runeWorldActorRuntime';

describe('RuneWorldActorRuntime', () => {
  it('walks four frames at 8 FPS and returns to the last facing idle', () => {
    const actor = new RuneWorldActorRuntime();
    expect(actor.getSnapshot()).toMatchObject({ worldX: 480, worldY: 1020, facing: 'down', motion: 'idle', animationFrame: 0 });
    actor.setMovement(1, 0);
    expect(actor.getSnapshot()).toMatchObject({ facing: 'right', motion: 'walking', animationFrame: 0 });
    for (const frame of [1, 2, 3, 0]) {
      actor.step(125);
      expect(actor.getSnapshot().animationFrame).toBe(frame);
    }
    actor.stop();
    expect(actor.getSnapshot()).toMatchObject({ facing: 'right', motion: 'idle', animationFrame: 0 });
  });

  it('resolves all directions and uses vertical facing for diagonal ties', () => {
    const actor = new RuneWorldActorRuntime();
    for (const [dx, dy, facing] of [[-1, 0, 'left'], [0, -1, 'up'], [0, 1, 'down'], [2, -1, 'right'], [1, -1, 'up']] as const) {
      actor.setMovement(dx, dy);
      expect(actor.getSnapshot().facing).toBe(facing);
      actor.stop();
      expect(actor.getSnapshot().facing).toBe(facing);
    }
  });

  it('uses elapsed time rather than frame rate and clamps to conservative map bounds', () => {
    const regular = new RuneWorldActorRuntime();
    const uneven = new RuneWorldActorRuntime();
    regular.setMovement(1, 0);
    uneven.setMovement(1, 0);
    for (let index = 0; index < 30; index += 1) regular.step(1000 / 60);
    for (const elapsed of [17, 83, 11, 139, 150, 100]) uneven.step(elapsed);
    expect(regular.getSnapshot().worldX).toBeCloseTo(uneven.getSnapshot().worldX, 6);
    expect(regular.getSnapshot().worldX).toBeCloseTo(520, 6);
    expect(RUNE_WALK_SPEED_WORLD_UNITS_PER_SECOND).toBe(80);
    regular.step(10000);
    expect(regular.getSnapshot().worldX).toBe(RUNE_WALK_BOUNDS.maxX);
    regular.setMovement(0, -1);
    regular.step(10000);
    expect(regular.getSnapshot().worldY).toBe(RUNE_WALK_BOUNDS.minY);
  });

  it('cycles idle, nearby target, existing walk, arrival and a second target inside the safe polygon', () => {
    const actor = new RuneWorldActorRuntime(createRuneWanderSeededRandom(0x1c2026));
    actor.startWander(0);
    const firstWait = actor.getWanderSnapshot().idleUntil;
    expect(firstWait).toBeGreaterThanOrEqual(RUNE_WANDER_IDLE_MS.min);
    expect(firstWait).toBeLessThanOrEqual(RUNE_WANDER_IDLE_MS.max);
    actor.advanceWander(firstWait - 1);
    expect(actor.getSnapshot().motion).toBe('idle');
    actor.advanceWander(firstWait);
    const firstTarget = actor.getWanderSnapshot().wanderTarget!;
    expect(actor.getWanderSnapshot().wanderPhase).toBe('walking');
    expect(isInRuneWanderZone(firstTarget)).toBe(true);
    const firstDistance = Math.hypot(firstTarget.x - 480, firstTarget.y - 1020);
    expect(firstDistance).toBeGreaterThanOrEqual(RUNE_WANDER_DISTANCE.min);
    expect(firstDistance).toBeLessThanOrEqual(RUNE_WANDER_DISTANCE.max);
    let now = firstWait;
    for (let index = 0; index < 100 && actor.getWanderSnapshot().wanderPhase === 'walking'; index += 1) {
      now += 16;
      actor.advanceWander(now);
      expect(isInRuneWanderZone({ x: actor.getSnapshot().worldX, y: actor.getSnapshot().worldY })).toBe(true);
    }
    expect(actor.getWanderSnapshot()).toMatchObject({ wanderPhase: 'idle', wanderTarget: null });
    expect(actor.getSnapshot()).toMatchObject({ motion: 'idle', worldX: firstTarget.x, worldY: firstTarget.y });
    const lastFacing = actor.getSnapshot().facing;
    const secondWait = actor.getWanderSnapshot().idleUntil;
    expect(secondWait - now).toBeGreaterThanOrEqual(RUNE_WANDER_IDLE_MS.min);
    expect(secondWait - now).toBeLessThanOrEqual(RUNE_WANDER_IDLE_MS.max);
    actor.advanceWander(secondWait);
    expect(actor.getWanderSnapshot().wanderPhase).toBe('walking');
    expect(actor.getWanderSnapshot().wanderTarget).not.toEqual(firstTarget);
    expect(actor.getSnapshot().facing).toBeDefined();
    expect(lastFacing).toBeDefined();
  });

  it('keeps the polygon convex, pauses its clock, and fails soft on unusable random values', () => {
    const crosses = RUNE_WANDER_ZONE.map((point, index) => {
      const next = RUNE_WANDER_ZONE[(index + 1) % RUNE_WANDER_ZONE.length];
      const after = RUNE_WANDER_ZONE[(index + 2) % RUNE_WANDER_ZONE.length];
      return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x);
    });
    expect(crosses.every((cross) => cross > 0)).toBe(true);
    expect(isInRuneWanderZone({ x: 480, y: 1020 })).toBe(true);
    const actor = new RuneWorldActorRuntime(() => 0.5);
    actor.startWander(0);
    const oldWait = actor.getWanderSnapshot().idleUntil;
    actor.pauseWander(1000);
    actor.advanceWander(10000);
    expect(actor.getWanderSnapshot().wanderPhase).toBe('idle');
    actor.resumeWander(11000);
    expect(actor.getWanderSnapshot().idleUntil).toBe(oldWait + 10000);
    const invalid = new RuneWorldActorRuntime(() => Number.NaN);
    invalid.startWander(0);
    invalid.advanceWander(RUNE_WANDER_IDLE_MS.min);
    expect(invalid.getWanderSnapshot()).toMatchObject({ wanderPhase: 'idle', wanderTarget: null });
    expect(invalid.getSnapshot().motion).toBe('idle');
  });

  it('lets a valid user command replace wander and the latest user target win', () => {
    const actor = new RuneWorldActorRuntime(createRuneWanderSeededRandom(0x1c2026));
    actor.startWander(0);
    const firstWait = actor.getWanderSnapshot().idleUntil;
    actor.advanceWander(firstWait);
    expect(actor.getWanderSnapshot().wanderTarget).not.toBeNull();
    expect(actor.commandUserMove({ x: 455, y: 1024 }, firstWait)).toBe(true);
    expect(actor.getWanderSnapshot()).toMatchObject({ wanderTarget: null, idleUntil: 0 });
    expect(actor.getMovementCommandSnapshot()).toEqual({ movementSource: 'user', target: { x: 455, y: 1024 } });
    actor.advanceWander(firstWait + 125);
    const moving = actor.getSnapshot();
    expect(isInRuneWanderZone({ x: moving.worldX, y: moving.worldY })).toBe(true);
    expect(actor.commandUserMove({ x: 447, y: 1020 }, firstWait + 125)).toBe(true);
    expect(actor.getMovementCommandSnapshot().target).toEqual({ x: 447, y: 1020 });
    expect(actor.commandUserMove({ x: 100, y: 100 }, firstWait + 125)).toBe(false);
    expect(actor.getMovementCommandSnapshot().target).toEqual({ x: 447, y: 1020 });
    let now = firstWait + 125;
    for (let index = 0; index < 100 && actor.getMovementCommandSnapshot().movementSource === 'user'; index += 1) {
      now += 16;
      actor.advanceWander(now);
      expect(isInRuneWanderZone({ x: actor.getSnapshot().worldX, y: actor.getSnapshot().worldY })).toBe(true);
    }
    expect(actor.getMovementCommandSnapshot()).toEqual({ movementSource: 'wander', target: null });
    expect(actor.getSnapshot()).toMatchObject({ worldX: 447, worldY: 1020, motion: 'idle' });
    expect(actor.getWanderSnapshot().idleUntil - now).toBeGreaterThanOrEqual(RUNE_WANDER_IDLE_MS.min);
    expect(actor.getWanderSnapshot().idleUntil - now).toBeLessThanOrEqual(RUNE_WANDER_IDLE_MS.max);
    actor.advanceWander(actor.getWanderSnapshot().idleUntil - 1);
    expect(actor.getSnapshot().motion).toBe('idle');
    actor.advanceWander(actor.getWanderSnapshot().idleUntil);
    expect(actor.getWanderSnapshot().wanderPhase).toBe('walking');
  });
});
