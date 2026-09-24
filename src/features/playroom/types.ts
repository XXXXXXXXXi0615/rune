export type GameCategory = 'story-simulation' | 'board-card' | 'social-deduction' | 'casual' | 'custom';
export type GameStatus = 'playable' | 'experimental' | 'planned';
export type ReleaseChannel = 'public' | 'experimental' | 'development';

export interface GameDefinition {
  id: string; title: string; description: string; category: GameCategory; engineType: string;
  playerRange: { min: number; max: number };
  supportsOfflineBot: boolean; supportsModelAgent: boolean; supportsChatInvite: boolean; supportsHumanOnline: boolean;
  route: string; coverAssetId: string; status: GameStatus; releaseChannel: ReleaseChannel; scenarioVersion: number;
}

export type ParticipantType = 'human' | 'local-bot' | 'model-agent' | 'future-human';
export interface PersonaSnapshot { name: string; avatar?: string; personality?: string; speakingStyle?: string; providerId?: string; modelId?: string }
export interface GameParticipant { seatId: string; participantType: ParticipantType; displayName: string; avatar?: string; personaSnapshot?: PersonaSnapshot; providerId?: string; modelId?: string; botDifficulty?: 'simple' | 'standard'; connectionStatus: 'local' | 'ready' | 'offline' }
export interface GameTranscriptEntry { id: string; turn: number; actorSeatId?: string; kind: 'action' | 'dialogue' | 'system'; content: string; createdAt: number }
export interface GameCheckpoint { id: string; label: string; turn: number; publicState: Record<string, unknown>; privateStateBySeat: Record<string, unknown>; createdAt: number }
export interface GameSession {
  id: string; gameDefinitionId: string; title: string; status: 'lobby' | 'active' | 'paused' | 'completed' | 'abandoned'; linkedConversationId?: string;
  participants: GameParticipant[]; currentTurn: number; currentSeatId?: string; publicState: Record<string, unknown>; privateStateBySeat: Record<string, unknown>;
  transcript: GameTranscriptEntry[]; checkpoints: GameCheckpoint[]; createdAt: number; updatedAt: number;
}
