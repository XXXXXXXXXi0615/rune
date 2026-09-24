import { describe, it, expect } from 'vitest';
import type { WritingTelemetryEvent } from './types';
import {
  aggregatePeriod,
  todayStats,
  currentWeekStats,
  lifetimeStats,
  surfaceBreakdown,
  dailyBreakdown,
  computeWeeklyWordTrace,
} from './aggregation';

function makeEvent(overrides: Partial<WritingTelemetryEvent> & { timestamp: number }): WritingTelemetryEvent {
  return {
    id: crypto.randomUUID(),
    actor: 'user',
    surface: 'chat',
    inputChars: 100,
    committedChars: 80,
    ...overrides,
  };
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

describe('aggregatePeriod', () => {
  it('sums user input and committed chars', () => {
    const now = Date.now();
    const events: WritingTelemetryEvent[] = [
      makeEvent({ timestamp: now - 1000, actor: 'user', inputChars: 500, committedChars: 200 }),
      makeEvent({ timestamp: now, actor: 'user', inputChars: 300, committedChars: 150 }),
    ];
    const stats = aggregatePeriod(events, now - 5000, now + 1000);
    expect(stats.userInput).toBe(800);
    expect(stats.userCommitted).toBe(350);
    expect(stats.agentCommitted).toBe(0);
    expect(stats.combinedCommitted).toBe(350);
  });

  it('sums agent committed chars (inputChars = 0)', () => {
    const now = Date.now();
    const events: WritingTelemetryEvent[] = [
      makeEvent({ timestamp: now, actor: 'agent', inputChars: 0, committedChars: 1000 }),
    ];
    const stats = aggregatePeriod(events, now - 1000, now + 1000);
    expect(stats.userInput).toBe(0);
    expect(stats.agentCommitted).toBe(1000);
    expect(stats.combinedCommitted).toBe(1000);
  });

  it('excludes events outside the range', () => {
    const now = Date.now();
    const events: WritingTelemetryEvent[] = [
      makeEvent({ timestamp: now - 100000, committedChars: 999 }),
      makeEvent({ timestamp: now, committedChars: 100 }),
    ];
    const stats = aggregatePeriod(events, now - 1000, now + 1000);
    expect(stats.combinedCommitted).toBe(100);
  });

  it('returns zeros for empty events', () => {
    const stats = aggregatePeriod([], Date.now() - 1000, Date.now() + 1000);
    expect(stats.userInput).toBe(0);
    expect(stats.userCommitted).toBe(0);
    expect(stats.agentCommitted).toBe(0);
    expect(stats.combinedCommitted).toBe(0);
  });
});

describe('todayStats', () => {
  it('counts only today events', () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const events: WritingTelemetryEvent[] = [
      makeEvent({ timestamp: todayStart + 1000, committedChars: 100 }),
      makeEvent({ timestamp: todayStart + 2000, actor: 'agent', committedChars: 200 }),
    ];
    const stats = todayStats(events);
    expect(stats.userCommitted).toBe(100);
    expect(stats.agentCommitted).toBe(200);
    expect(stats.combinedCommitted).toBe(300);
  });
});

describe('lifetimeStats', () => {
  it('returns zeros for empty events', () => {
    const stats = lifetimeStats([]);
    expect(stats.combinedCommitted).toBe(0);
  });

  it('counts all events regardless of date', () => {
    const events: WritingTelemetryEvent[] = [
      makeEvent({ timestamp: Date.now() - 86400000 * 365, committedChars: 500 }),
      makeEvent({ timestamp: Date.now(), committedChars: 300 }),
    ];
    const stats = lifetimeStats(events);
    expect(stats.combinedCommitted).toBe(800);
  });
});

describe('surfaceBreakdown', () => {
  it('groups by surface and calculates percentages', () => {
    const now = Date.now();
    const events: WritingTelemetryEvent[] = [
      makeEvent({ timestamp: now, surface: 'chat', committedChars: 60 }),
      makeEvent({ timestamp: now, surface: 'moments', committedChars: 30 }),
      makeEvent({ timestamp: now, surface: 'moonread', committedChars: 10 }),
    ];
    const breakdown = surfaceBreakdown(events, now - 1000, now + 1000);
    expect(breakdown).toHaveLength(3);
    expect(breakdown[0].surface).toBe('chat');
    expect(breakdown[0].percentage).toBe(60);
    expect(breakdown[1].surface).toBe('moments');
    expect(breakdown[1].percentage).toBe(30);
  });

  it('returns empty for zero total', () => {
    expect(surfaceBreakdown([], 0, Date.now())).toEqual([]);
  });
});

describe('dailyBreakdown', () => {
  it('returns 7 days of breakdown', () => {
    const result = dailyBreakdown([], 7);
    expect(result).toHaveLength(7);
    expect(result[0]).toHaveProperty('date');
    expect(result[0]).toHaveProperty('userChars');
    expect(result[0]).toHaveProperty('agentChars');
    expect(result[0]).toHaveProperty('combinedChars');
  });
});

describe('computeWeeklyWordTrace', () => {
  it('computes weekly stats with daily breakdown', () => {
    const now = Date.now();
    const events: WritingTelemetryEvent[] = [
      makeEvent({ timestamp: now, actor: 'user', committedChars: 500 }),
      makeEvent({ timestamp: now, actor: 'agent', committedChars: 300 }),
    ];
    const trace = computeWeeklyWordTrace(events);
    expect(trace.userChars).toBe(500);
    expect(trace.agentChars).toBe(300);
    expect(trace.combinedChars).toBe(800);
    expect(trace.dailyBreakdown).toHaveLength(7);
    expect(trace.surfaceBreakdown).toBeDefined();
    expect(typeof trace.changeVsPreviousWeek).toBe('number');
  });
});
