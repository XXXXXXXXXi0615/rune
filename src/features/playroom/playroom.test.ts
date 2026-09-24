import { describe, expect, it } from 'vitest';
import { GAME_REGISTRY, getPublicGames, getExperimentalGames, getVisibleGames } from './gameRegistry';
import { createGameInviteCard } from './chatGameBridge';
import type { GameSession } from './types';

describe('playroom registry and bridge', () => {
  it('contains phase one games and no retired games', () => {
    expect(GAME_REGISTRY.map(g => g.id)).toEqual(expect.arrayContaining(['free-roleplay', 'gomoku']));
    expect(GAME_REGISTRY.map(g => g.id)).not.toEqual(expect.arrayContaining(['fishing', 'market', 'shangzhuochifan']));
  });

  it('invite excludes private game state', () => {
    const session = {
      id: 's', gameDefinitionId: 'gomoku', title: '一局', status: 'active',
      participants: [], currentTurn: 0, publicState: {}, privateStateBySeat: { secret: { cards: [1] } },
      transcript: [], checkpoints: [], createdAt: 1, updatedAt: 1,
    } satisfies GameSession;
    expect(JSON.stringify(createGameInviteCard(session, '本地'))).not.toContain('cards');
  });

  describe('releaseChannel filtering', () => {
    it('getPublicGames returns only games with releaseChannel "public"', () => {
      const ids = getPublicGames().map(g => g.id);
      expect(ids).toContain('free-roleplay');
      expect(ids).toContain('gomoku');
      expect(ids).not.toContain('dou-dizhu');
      expect(ids).not.toContain('mahjong');
      expect(ids).not.toContain('werewolf-night');
      expect(ids).not.toContain('character-growth');
      expect(ids).not.toContain('scenario-simulator');
    });

    it('getExperimentalGames returns only experimental games that are playable', () => {
      const ids = getExperimentalGames().map(g => g.id);
      expect(ids).not.toContain('free-roleplay');
      expect(ids).not.toContain('gomoku');
      expect(ids).not.toContain('dou-dizhu');
      expect(ids).not.toContain('character-growth');
    });

    it('getVisibleGames(false) returns only public games', () => {
      const ids = getVisibleGames(false).map(g => g.id);
      expect(ids).toContain('free-roleplay');
      expect(ids).toContain('gomoku');
      expect(ids).not.toContain('dou-dizhu');
      expect(ids).not.toContain('mahjong');
      expect(ids).not.toContain('werewolf-night');
      expect(ids).not.toContain('character-growth');
    });

    it('getVisibleGames(true) returns all games for preview', () => {
      const ids = getVisibleGames(true).map(g => g.id);
      expect(ids.length).toBe(GAME_REGISTRY.length);
    });

    it('planned games have releaseChannel development, not public', () => {
      for (const g of GAME_REGISTRY) {
        if (g.status === 'planned') {
          expect(g.releaseChannel).toBe('development');
        }
      }
    });

    it('public games have status playable', () => {
      for (const g of getPublicGames()) {
        expect(g.status).toBe('playable');
      }
    });
  });
});
