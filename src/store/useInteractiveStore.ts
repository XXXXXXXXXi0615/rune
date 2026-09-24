import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GomokuState } from '@/features/interactive/types';

export interface InteractiveGame {
  id: string;
  kind: 'gomoku';
  state: GomokuState;
  conversationId: string;
  messageId: string; // references the chat message
  createdAt: number;
  updatedAt: number;
}

interface State {
  games: Record<string, InteractiveGame>;
  addGame: (game: InteractiveGame) => void;
  updateGameState: (gameId: string, state: GomokuState) => void;
  getGameByMessageId: (messageId: string) => InteractiveGame | undefined;
}

export const useInteractiveStore = create<State>()(
  persist(
    (set, get) => ({
      games: {},

      addGame: (game) =>
        set((s) => ({ games: { ...s.games, [game.id]: game } })),

      updateGameState: (gameId, state) =>
        set((s) => {
          const existing = s.games[gameId];
          if (!existing) return s;
          return {
            games: {
              ...s.games,
              [gameId]: { ...existing, state, updatedAt: Date.now() },
            },
          };
        }),

      getGameByMessageId: (messageId) =>
        Object.values(get().games).find((g) => g.messageId === messageId),
    }),
    { name: 'lunartide-interactive-games-v1', version: 1 },
  ),
);
