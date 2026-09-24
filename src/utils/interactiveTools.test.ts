import { describe, expect, it, vi } from 'vitest';
import { InteractiveToolRegistry } from '@/features/interactive/InteractiveToolRegistry';
import type { InteractiveAttachment } from '@/features/interactive/types';

const attachment = (kind: InteractiveAttachment['kind'], state: InteractiveAttachment['state']): InteractiveAttachment => ({
  version: 1, kind, state, meta: { gameId: 'test', createdAt: 1, startedBy: 'me' },
});

describe('InteractiveToolRegistry', () => {
  it('registers only the controlled Phase 1 tools with render/config/reducer contracts', () => {
    expect(Object.keys(InteractiveToolRegistry)).toEqual(['gomoku', 'poll', 'dice', 'timer']);
    for (const tool of Object.values(InteractiveToolRegistry)) {
      expect(tool.schema).toBe(tool.type === 'poll' ? 2 : 1);
      expect(tool.configurationComponent).toBeTypeOf('function');
      expect(tool.messageRenderer).toBeTypeOf('function');
      expect(tool.stateReducer).toBeTypeOf('function');
    }
  });

  it('uses crypto values for dice and keeps every result in range', () => {
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint32Array)[0] = 11;
      return array;
    });
    const before = attachment('dice', { quantity: 3, kind: 'd6', sides: 6, faces: 6, tint: 'tide', results: [], total: 0, createdBy: '測試者', timestamp: 1 });
    const after = InteractiveToolRegistry.dice.stateReducer(before, { type: 'dice_roll' });
    expect(after.state).toMatchObject({ results: [6, 6, 6], total: 18, quantity: 3, faces: 6, createdBy: '測試者' });
    expect(random).toHaveBeenCalledTimes(3);
    random.mockRestore();
  });

  it('restarts timers from an absolute target timestamp', () => {
    const before = attachment('timer', { title: 'Tea', durationSeconds: 90, targetTimestamp: 1000, running: true });
    const after = InteractiveToolRegistry.timer.stateReducer(before, { type: 'timer_restart', now: 5000 });
    expect(after.state).toMatchObject({ targetTimestamp: 95000, durationSeconds: 90 });
  });
});
