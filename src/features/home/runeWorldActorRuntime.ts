import { RUNE_WORLD_ACTOR } from './runeWorldActor';

export type RuneFacing = 'down' | 'up' | 'left' | 'right';
export type RuneMotion = 'idle' | 'walking';

export interface RuneActorSnapshot {
  worldX: number;
  worldY: number;
  facing: RuneFacing;
  motion: RuneMotion;
  animationFrame: number;
  reaction: 'none' | 'wave';
  reactionFrame: number;
}

export const RUNE_WAVE_FPS = 8;
export const RUNE_WAVE_FRAMES = 6;
export const RUNE_WAVE_DURATION_MS = RUNE_WAVE_FRAMES * 1000 / RUNE_WAVE_FPS;

export const RUNE_WALK_SPEED_WORLD_UNITS_PER_SECOND = 80;
export const RUNE_WALK_BOUNDS = { minX: 420, maxX: 540, minY: 980, maxY: 1080 } as const;
export const RUNE_WANDER_ZONE = [
  { x: 452, y: 982 }, { x: 482, y: 983 }, { x: 490, y: 1008 },
  { x: 477, y: 1030 }, { x: 451, y: 1043 }, { x: 435, y: 1034 },
  { x: 439, y: 1009 },
] as const;
export const RUNE_WANDER_IDLE_MS = { min: 2000, max: 5000 } as const;
export const RUNE_WANDER_DISTANCE = { min: 14, max: 32 } as const;
export const RUNE_WANDER_ARRIVAL_THRESHOLD = 0.75;

type WorldPoint = { x: number; y: number };
export interface RuneWanderSnapshot {
  wanderPhase: 'idle' | 'walking';
  wanderTarget: WorldPoint | null;
  idleUntil: number;
}
export interface RuneMovementCommandSnapshot {
  movementSource: 'wander' | 'user';
  target: WorldPoint | null;
}

export function isInRuneWanderZone(point: WorldPoint) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  return RUNE_WANDER_ZONE.every((start, index) => {
    const end = RUNE_WANDER_ZONE[(index + 1) % RUNE_WANDER_ZONE.length];
    return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x) >= -0.000001;
  });
}

export function createRuneWanderSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export class RuneWorldActorRuntime {
  private current: RuneActorSnapshot = {
    worldX: RUNE_WORLD_ACTOR.spawn.worldX,
    worldY: RUNE_WORLD_ACTOR.spawn.worldY,
    facing: 'down',
    motion: 'idle',
    animationFrame: 0,
    reaction: 'none',
    reactionFrame: 0,
  };
  private inputX = 0;
  private inputY = 0;
  private frameRemainderMs = 0;
  private listeners = new Set<(snapshot: RuneActorSnapshot) => void>();
  private wander: RuneWanderSnapshot = { wanderPhase: 'idle', wanderTarget: null, idleUntil: 0 };
  private wanderStarted = false;
  private lastWanderTime = 0;
  private pausedAt: number | null = null;
  private readonly random: () => number;
  private movementSource: RuneMovementCommandSnapshot['movementSource'] = 'wander';
  private userTarget: WorldPoint | null = null;
  private pendingWave = false;
  private waveStartedAt: number | null = null;
  private previousFacing: RuneFacing = 'down';

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  getSnapshot = () => this.current;
  getWanderSnapshot = (): RuneWanderSnapshot => ({
    ...this.wander,
    wanderTarget: this.wander.wanderTarget && { ...this.wander.wanderTarget },
  });
  getMovementCommandSnapshot = (): RuneMovementCommandSnapshot => ({
    movementSource: this.movementSource,
    target: this.movementSource === 'user'
      ? this.userTarget && { ...this.userTarget }
      : this.wander.wanderTarget && { ...this.wander.wanderTarget },
  });
  isWanderStarted = () => this.wanderStarted;
  hasPendingWave = () => this.pendingWave;

  requestWave(nowMs: number) {
    if (!Number.isFinite(nowMs) || this.pendingWave || this.current.reaction === 'wave') return;
    if (this.movementSource === 'user') {
      this.pendingWave = true;
      return;
    }
    this.beginWave(nowMs);
  }

  private beginWave(nowMs: number) {
    this.pendingWave = false;
    this.previousFacing = this.current.facing;
    this.waveStartedAt = nowMs;
    this.wander = { wanderPhase: 'idle', wanderTarget: null, idleUntil: 0 };
    this.stop();
    this.publish({ ...this.current, facing: 'down', reaction: 'wave', reactionFrame: 0 });
  }

  cancelWave(nowMs: number, restoreFacing = true) {
    if (this.current.reaction !== 'wave') return;
    this.waveStartedAt = null;
    this.publish({ ...this.current, facing: restoreFacing ? this.previousFacing : this.current.facing, reaction: 'none', reactionFrame: 0 });
    this.wander.idleUntil = nowMs + this.idleDuration();
    this.lastWanderTime = nowMs;
  }

  private advanceWave(nowMs: number) {
    if (this.waveStartedAt === null) return;
    const elapsed = Math.max(0, nowMs - this.waveStartedAt);
    if (elapsed >= RUNE_WAVE_DURATION_MS) {
      this.cancelWave(nowMs);
      return;
    }
    const frame = Math.min(RUNE_WAVE_FRAMES - 1, Math.floor(elapsed * RUNE_WAVE_FPS / 1000));
    if (frame !== this.current.reactionFrame) this.publish({ ...this.current, reactionFrame: frame });
  }

  subscribe = (listener: (snapshot: RuneActorSnapshot) => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(next: RuneActorSnapshot) {
    this.current = next;
    this.listeners.forEach((listener) => listener(next));
  }

  setMovement(deltaX: number, deltaY: number) {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    const length = Math.hypot(deltaX, deltaY);
    if (length === 0) {
      this.stop();
      return;
    }
    this.inputX = deltaX / length;
    this.inputY = deltaY / length;
    const facing: RuneFacing = Math.abs(deltaX) > Math.abs(deltaY)
      ? deltaX < 0 ? 'left' : 'right'
      : deltaY < 0 ? 'up' : 'down';
    const changed = this.current.motion !== 'walking' || this.current.facing !== facing;
    if (changed) {
      this.frameRemainderMs = 0;
      this.publish({ ...this.current, facing, motion: 'walking', animationFrame: 0 });
    }
  }

  stop() {
    this.inputX = 0;
    this.inputY = 0;
    this.frameRemainderMs = 0;
    if (this.current.motion !== 'idle') {
      this.publish({ ...this.current, motion: 'idle', animationFrame: 0 });
    }
  }

  step(deltaMs: number) {
    if (this.current.motion !== 'walking' || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    const distance = RUNE_WALK_SPEED_WORLD_UNITS_PER_SECOND * deltaMs / 1000;
    const worldX = Math.min(RUNE_WALK_BOUNDS.maxX, Math.max(RUNE_WALK_BOUNDS.minX, this.current.worldX + this.inputX * distance));
    const worldY = Math.min(RUNE_WALK_BOUNDS.maxY, Math.max(RUNE_WALK_BOUNDS.minY, this.current.worldY + this.inputY * distance));
    const frameDurationMs = 1000 / RUNE_WORLD_ACTOR.walk.fps;
    const elapsed = this.frameRemainderMs + deltaMs;
    const frameSteps = Math.floor(elapsed / frameDurationMs);
    this.frameRemainderMs = elapsed - frameSteps * frameDurationMs;
    this.publish({
      ...this.current,
      worldX,
      worldY,
      animationFrame: (this.current.animationFrame + frameSteps) % RUNE_WORLD_ACTOR.walk.framesPerDirection,
    });
  }

  private idleDuration() {
    const value = this.random();
    if (!Number.isFinite(value)) return RUNE_WANDER_IDLE_MS.min;
    return RUNE_WANDER_IDLE_MS.min + Math.min(1, Math.max(0, value)) * (RUNE_WANDER_IDLE_MS.max - RUNE_WANDER_IDLE_MS.min);
  }

  private selectNearbyTarget(): WorldPoint | null {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const angleSample = this.random();
      const distanceSample = this.random();
      if (!Number.isFinite(angleSample) || !Number.isFinite(distanceSample)) return null;
      const angle = angleSample * Math.PI * 2;
      const distance = RUNE_WANDER_DISTANCE.min + Math.min(1, Math.max(0, distanceSample)) * (RUNE_WANDER_DISTANCE.max - RUNE_WANDER_DISTANCE.min);
      const point = {
        x: this.current.worldX + Math.cos(angle) * distance,
        y: this.current.worldY + Math.sin(angle) * distance,
      };
      if (isInRuneWanderZone(point)) return point;
    }
    return null;
  }

  startWander(nowMs: number) {
    if (!Number.isFinite(nowMs) || this.wanderStarted) return;
    this.stop();
    this.wanderStarted = true;
    this.lastWanderTime = nowMs;
    this.wander = { wanderPhase: 'idle', wanderTarget: null, idleUntil: nowMs + this.idleDuration() };
  }

  pauseWander(nowMs: number) {
    if (this.wanderStarted && this.pausedAt === null && Number.isFinite(nowMs)) this.pausedAt = nowMs;
  }

  resumeWander(nowMs: number) {
    if (this.pausedAt === null || !Number.isFinite(nowMs)) return;
    if (this.waveStartedAt !== null) this.waveStartedAt += Math.max(0, nowMs - this.pausedAt);
    if (this.wander.wanderPhase === 'idle') this.wander.idleUntil += Math.max(0, nowMs - this.pausedAt);
    this.lastWanderTime = nowMs;
    this.pausedAt = null;
  }

  commandUserMove(target: WorldPoint, nowMs: number) {
    if (!Number.isFinite(nowMs) || !isInRuneWanderZone(target)
      || !isInRuneWanderZone({ x: this.current.worldX, y: this.current.worldY })) return false;
    this.pendingWave = false;
    if (this.current.reaction === 'wave') this.cancelWave(nowMs, false);
    if (!this.wanderStarted) this.startWander(nowMs);
    if (this.pausedAt !== null) this.resumeWander(nowMs);
    this.wander = { wanderPhase: 'idle', wanderTarget: null, idleUntil: 0 };
    this.lastWanderTime = nowMs;
    const distance = Math.hypot(target.x - this.current.worldX, target.y - this.current.worldY);
    if (distance <= RUNE_WANDER_ARRIVAL_THRESHOLD) {
      this.userTarget = null;
      this.movementSource = 'wander';
      this.stop();
      this.wander.idleUntil = nowMs + this.idleDuration();
      return true;
    }
    this.userTarget = { ...target };
    this.movementSource = 'user';
    this.setMovement(target.x - this.current.worldX, target.y - this.current.worldY);
    return true;
  }

  advanceWander(nowMs: number) {
    if (!this.wanderStarted || this.pausedAt !== null || !Number.isFinite(nowMs) || nowMs < this.lastWanderTime) return;
    if (this.current.reaction === 'wave') {
      this.advanceWave(nowMs);
      return;
    }
    if (this.movementSource === 'user') {
      this.advanceToTarget(this.userTarget, nowMs);
      return;
    }
    if (this.wander.wanderPhase === 'idle') {
      if (nowMs < this.wander.idleUntil) return;
      const target = this.selectNearbyTarget();
      this.lastWanderTime = nowMs;
      if (!target) {
        this.wander.idleUntil = nowMs + this.idleDuration();
        return;
      }
      this.wander = { wanderPhase: 'walking', wanderTarget: target, idleUntil: 0 };
      this.setMovement(target.x - this.current.worldX, target.y - this.current.worldY);
      return;
    }

    this.advanceToTarget(this.wander.wanderTarget, nowMs);
  }

  private advanceToTarget(target: WorldPoint | null, nowMs: number) {
    if (!target || !isInRuneWanderZone(target) || !isInRuneWanderZone({ x: this.current.worldX, y: this.current.worldY })) {
      this.stop();
      this.userTarget = null;
      this.movementSource = 'wander';
      this.wander = { wanderPhase: 'idle', wanderTarget: null, idleUntil: nowMs + this.idleDuration() };
      this.lastWanderTime = nowMs;
      if (this.pendingWave) this.beginWave(nowMs);
      return;
    }
    const deltaX = target.x - this.current.worldX;
    const deltaY = target.y - this.current.worldY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance > RUNE_WANDER_ARRIVAL_THRESHOLD) {
      this.setMovement(deltaX, deltaY);
      this.step(Math.min(nowMs - this.lastWanderTime, distance / RUNE_WALK_SPEED_WORLD_UNITS_PER_SECOND * 1000));
    }
    this.lastWanderTime = nowMs;
    if (Math.hypot(target.x - this.current.worldX, target.y - this.current.worldY) <= RUNE_WANDER_ARRIVAL_THRESHOLD) {
      // Correct only sub-pixel arrival error; all travel above used the Phase 1B step implementation.
      this.publish({ ...this.current, worldX: target.x, worldY: target.y });
      this.stop();
      this.userTarget = null;
      this.movementSource = 'wander';
      this.wander = { wanderPhase: 'idle', wanderTarget: null, idleUntil: nowMs + this.idleDuration() };
      if (this.pendingWave) this.beginWave(nowMs);
    }
  }
}
