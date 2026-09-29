import { describe, expect, it } from 'vitest';
import { RuneWorldActorRuntime, RUNE_WAVE_DURATION_MS, createRuneWanderSeededRandom } from './runeWorldActorRuntime';

describe('Rune check-in wave', () => {
  it('plays six frames once, restores facing, and resumes wander after idle', () => {
    const actor = new RuneWorldActorRuntime(createRuneWanderSeededRandom(7));
    actor.startWander(0);
    actor.setMovement(1, 0);
    actor.stop();
    actor.requestWave(100);
    expect(actor.getSnapshot()).toMatchObject({ reaction: 'wave', reactionFrame: 0, facing: 'down' });
    for (let frame = 1; frame < 6; frame++) {
      actor.advanceWander(100 + frame * 125);
      expect(actor.getSnapshot().reactionFrame).toBe(frame);
    }
    actor.requestWave(730);
    expect(actor.hasPendingWave()).toBe(false);
    actor.advanceWander(100 + RUNE_WAVE_DURATION_MS);
    expect(actor.getSnapshot()).toMatchObject({ reaction: 'none', reactionFrame: 0, facing: 'right', motion: 'idle' });
    expect(actor.getWanderSnapshot().idleUntil).toBeGreaterThan(850);
  });

  it('interrupts wander and coalesces pending wave until user arrival', () => {
    const actor = new RuneWorldActorRuntime(createRuneWanderSeededRandom(7));
    actor.startWander(0);
    const wake = actor.getWanderSnapshot().idleUntil;
    actor.advanceWander(wake);
    expect(actor.getWanderSnapshot().wanderPhase).toBe('walking');
    actor.requestWave(wake + 1);
    expect(actor.getSnapshot().reaction).toBe('wave');
    expect(actor.getWanderSnapshot().wanderTarget).toBeNull();
    actor.advanceWander(wake + 751);
    expect(actor.commandUserMove({ x: 455, y: 1024 }, wake + 752)).toBe(true);
    actor.requestWave(wake + 753);
    actor.requestWave(wake + 754);
    expect(actor.hasPendingWave()).toBe(true);
    let now = wake + 754;
    while (actor.getMovementCommandSnapshot().movementSource === 'user' && now < wake + 4000) {
      now += 16;
      actor.advanceWander(now);
    }
    expect(actor.getMovementCommandSnapshot().movementSource).toBe('wander');
    expect(actor.getSnapshot().reaction).toBe('wave');
    expect(actor.hasPendingWave()).toBe(false);
  });

  it('new user move cancels an active wave without replay', () => {
    const actor = new RuneWorldActorRuntime();
    actor.startWander(0);
    actor.requestWave(100);
    expect(actor.commandUserMove({ x: 455, y: 1024 }, 200)).toBe(true);
    expect(actor.getSnapshot()).toMatchObject({ reaction: 'none', motion: 'walking' });
    expect(actor.hasPendingWave()).toBe(false);
  });
});
