/**
 * Interactive Chat Attachment Schema
 *
 * Versioned schema for interactive message cards (gomoku, poll, dice, timer, etc.)
 * AI agents must NOT directly overwrite the full state; they use structured actions.
 */

/** Versioned envelope for all interactive attachments. */
export interface InteractiveAttachment {
  version: number;       // schema version
  kind: InteractiveKind;
  state: InteractiveState;
  meta: InteractiveMeta;
}

export type InteractiveKind = 'gomoku' | 'poll' | 'dice' | 'timer';

export interface InteractiveMeta {
  gameId: string;          // unique per-attachment id
  createdAt: number;       // ms timestamp
  startedBy: string;       // participantId who created
  conversationId?: string; // owning conversation
}

/**
 * Gomoku (五子棋) state.
 * Board is 15×15, stored as a flat string of length 225.
 * Characters: '.' = empty, 'B' = black, 'W' = white
 */
export interface GomokuState {
  boardSize?: 9 | 13 | 15;
  board: string;           // 225 chars, row-major
  currentTurn: 'B' | 'W';
  blackPlayer: InteractivePlayer;
  whitePlayer: InteractivePlayer;
  winner: 'B' | 'W' | 'draw' | null;
  history: GomokuMove[];
  lastAction?: GomokuAction;
}

export interface PollState {
  pollId?: string;
  creatorIdentityId?: string;
  question: string;
  coverAssetId?: string;
  options: Array<{ id: string; label: string; votes: number; imageAssetId?: string }>;
  multiple: boolean;
  multipleLimit?: number;
  anonymous?: boolean;
  allowVoteChanges?: boolean;
  expiresAt?: number;
  resultVisibility?: 'immediate' | 'after-close' | 'creator-only';
  aiParticipation?: boolean;
  aiVoteTiming?: 'immediate' | 'after-user' | 'before-close';
  votesByIdentity?: Record<string, { optionIds: string[]; createdAt: number; updatedAt: number } | undefined>;
  settings?: Record<string, unknown>;
  votedOptionIds: string[];
}

export type DiceKind = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd24' | 'd-percent' | 'custom';
export type DiceTint = 'amber' | 'tide' | 'ivory' | 'midnight' | 'violet' | 'coral';

export interface DiceState {
  quantity: number;
  /** Legacy Phase 1 field; read-only fallback for persisted messages. */
  count?: number;
  kind: DiceKind;
  sides: number;
  faces: number;
  tint: DiceTint;
  results: number[];
  total: number;
  createdBy: string;
  timestamp: number;
  rolledAt?: number;
  animationVersion?: number;
  visualGeometryKind?: string;
  isVisualApproximation?: boolean;
}

export type DiceRollPhase = 'idle' | 'launching' | 'rolling' | 'landing' | 'settled';

export interface DiceFaceOrientation {
  result: number;
  quaternion: [number, number, number, number];
}

export interface TimerState {
  title: string;
  durationSeconds: number;
  targetTimestamp: number;
  running: boolean;
}

export interface InteractivePlayer {
  kind: 'human' | 'ai';
  participantId: string;   // matches ChatParticipant.identityId
  displayName: string;
}

export interface GomokuMove {
  index: number;           // 0-224 board index
  player: 'B' | 'W';
  timestamp: number;
}

/**
 * Structured actions the AI (or user) sends to modify state.
 * The game engine validates every action before applying.
 */
export type GomokuAction =
  | { type: 'place'; version: number; index: number; player: 'B' | 'W' }
  | { type: 'resign'; version: number; player: 'B' | 'W' }
  | { type: 'restart'; version: number }
  | { type: 'request_ai_move'; version: number; player: 'B' | 'W' };

export type InteractiveState = GomokuState | PollState | DiceState | TimerState;

export type InteractiveAction =
  | { type: 'gomoku_state'; state: GomokuState }
  | { type: 'poll_vote'; optionId: string; identityId?: string; now?: number }
  | { type: 'dice_roll'; results?: number[]; now?: number }
  | { type: 'timer_restart'; now: number };

/** Validation result for a gomoku action. */
export interface GomokuValidation {
  valid: boolean;
  reason?: string; // e.g. 'not_your_turn', 'cell_occupied', 'game_over'
}
