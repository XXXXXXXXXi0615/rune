import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createCheckpoint, restoreCheckpoint } from '@/features/playroom/sessionEngine';
import type { GameParticipant, GameSession } from '@/features/playroom/types';

type NewSession = Pick<GameSession, 'gameDefinitionId' | 'title'> & Partial<Pick<GameSession, 'linkedConversationId' | 'participants' | 'publicState' | 'privateStateBySeat'>>;
interface GameSessionStore { sessions: Record<string, GameSession>; activeSessionId?: string; createSession: (input: NewSession) => GameSession; updateSession: (id: string, patch: Partial<GameSession>) => void; pauseSession: (id: string) => void; checkpoint: (id: string, label?: string) => void; rollback: (id: string, checkpointId: string) => void; renameSession: (id: string, title: string) => void; deleteSession: (id: string) => void; duplicateSession: (id: string) => GameSession | undefined; setActive: (id?: string) => void }
const user: GameParticipant = { seatId: 'seat-user', participantType: 'human', displayName: '我', connectionStatus: 'local' };
export const useGameSessionStore = create<GameSessionStore>()(persist((set, get) => ({
  sessions: {}, activeSessionId: undefined,
  createSession: (input) => { const now = Date.now(); const session: GameSession = { id: crypto.randomUUID(), gameDefinitionId: input.gameDefinitionId, title: input.title, status: 'active', linkedConversationId: input.linkedConversationId, participants: input.participants || [user], currentTurn: 0, currentSeatId: input.participants?.[0]?.seatId || user.seatId, publicState: input.publicState || {}, privateStateBySeat: input.privateStateBySeat || {}, transcript: [], checkpoints: [], createdAt: now, updatedAt: now }; set(s => ({ sessions: { ...s.sessions, [session.id]: session }, activeSessionId: session.id })); return session; },
  updateSession: (id, patch) => set(s => s.sessions[id] ? ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], ...patch, updatedAt: Date.now() } } }) : s),
  pauseSession: id => get().updateSession(id, { status: 'paused' }),
  checkpoint: (id, label) => set(s => { const session = s.sessions[id]; if (!session) return s; return { sessions: { ...s.sessions, [id]: { ...session, checkpoints: [...session.checkpoints, createCheckpoint(session, label)].slice(-30), updatedAt: Date.now() } } }; }),
  rollback: (id, checkpointId) => set(s => { const session = s.sessions[id]; const point = session?.checkpoints.find(c => c.id === checkpointId); return session && point ? { sessions: { ...s.sessions, [id]: restoreCheckpoint(session, point) } } : s; }),
  renameSession: (id, title) => get().updateSession(id, { title: title.trim() || '未命名游戏' }),
  deleteSession: id => set(s => { const sessions = { ...s.sessions }; delete sessions[id]; return { sessions, activeSessionId: s.activeSessionId === id ? undefined : s.activeSessionId }; }),
  duplicateSession: id => { const source = get().sessions[id]; if (!source) return; const copy = structuredClone(source); copy.id = crypto.randomUUID(); copy.title = `${source.title} 副本`; copy.createdAt = copy.updatedAt = Date.now(); set(s => ({ sessions: { ...s.sessions, [copy.id]: copy }, activeSessionId: copy.id })); return copy; },
  setActive: activeSessionId => set({ activeSessionId }),
}), { name: 'lunartide-game-sessions-v1', version: 1 }));
