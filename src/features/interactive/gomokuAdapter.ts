/**
 * Gomoku adapter — bridges the existing gomoku engine (2D board) with
 * the flat 225-char board used by InteractiveAttachment.
 */
import { playMove, chooseBotMove, type Stone, type Cell, type Move } from '@/features/playroom/gomokuEngine';
import type { GomokuState, GomokuAction, GomokuValidation, InteractivePlayer } from './types';

export const BOARD_SIZE = 15;

/** Convert 2D board to flat 225-char string. */
export function boardToString(board: Cell[][]): string {
  return board.flatMap(row => row.map(c => c === 'black' ? 'B' : c === 'white' ? 'W' : '.')).join('');
}

/** Convert flat 225-char string to 2D board. */
export function stringToBoard(s: string, size = BOARD_SIZE): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < size; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < size; c++) {
      const ch = s[r * size + c];
      row.push(ch === 'B' ? 'black' : ch === 'W' ? 'white' : null);
    }
    board.push(row);
  }
  return board;
}

/** Create initial flat board string. */
export function createFlatBoard(size = BOARD_SIZE): string {
  return '.'.repeat(size * size);
}

export function createGomokuState(black: InteractivePlayer, white: InteractivePlayer, boardSize: 9 | 13 | 15 = 15): GomokuState {
  return {
    board: createFlatBoard(boardSize),
    boardSize,
    currentTurn: 'B',
    blackPlayer: black,
    whitePlayer: white,
    winner: null,
    history: [],
  };
}

/** Validate a gomoku action against the current state. */
export function validateGomokuAction(state: GomokuState, action: GomokuAction): GomokuValidation {
  // Version check — must match current state version
  // (version is the history length, i.e. number of moves made)
  const stateVersion = state.history.length;
  if (action.version !== stateVersion) {
    return { valid: false, reason: 'version_mismatch' };
  }

  if (state.winner) {
    return { valid: false, reason: 'game_over' };
  }

  switch (action.type) {
    case 'place':
      if (action.player !== state.currentTurn) {
        return { valid: false, reason: 'not_your_turn' };
      }
      const size = state.boardSize || BOARD_SIZE;
      if (action.index < 0 || action.index >= size * size) {
        return { valid: false, reason: 'invalid_coordinate' };
      }
      if (state.board[action.index] !== '.') {
        return { valid: false, reason: 'cell_occupied' };
      }
      break;
    case 'resign':
      if (action.player !== 'B' && action.player !== 'W') {
        return { valid: false, reason: 'invalid_player' };
      }
      break;
    case 'restart':
    case 'request_ai_move':
      break;
    default:
      return { valid: false, reason: 'unknown_action' };
  }

  return { valid: true };
}

/** Apply a validated gomoku action to produce the next state. */
export function applyGomokuAction(state: GomokuState, action: GomokuAction): GomokuState {
  const next = { ...state, history: [...state.history], lastAction: action };

  switch (action.type) {
    case 'place': {
      const size = state.boardSize || BOARD_SIZE;
      const board2D = stringToBoard(state.board, size);
      const row = Math.floor(action.index / size);
      const col = action.index % size;
      const stone: Stone = action.player === 'B' ? 'black' : 'white';
      const result = playMove(board2D, { row, col }, stone);
      next.board = boardToString(result.board);
      next.history = [...state.history, { index: action.index, player: action.player, timestamp: Date.now() }];
      next.currentTurn = action.player === 'B' ? 'W' : 'B';
      if (result.winner === 'black') next.winner = 'B';
      else if (result.winner === 'white') next.winner = 'W';
      else if (result.draw) next.winner = 'draw';
      break;
    }
    case 'resign': {
      next.winner = action.player === 'B' ? 'W' : 'B';
      break;
    }
    case 'restart': {
      next.board = createFlatBoard(state.boardSize || BOARD_SIZE);
      next.currentTurn = 'B';
      next.winner = null;
      next.history = [];
      break;
    }
    case 'request_ai_move': {
      // AI move will be handled by the calling code — state is unchanged
      break;
    }
  }

  return next;
}

/** Get the AI's next move as a board index. */
export function getAiMove(state: GomokuState): number {
  const board2D = stringToBoard(state.board, state.boardSize || BOARD_SIZE);
  const move: Move = chooseBotMove(board2D);
  return move.row * (state.boardSize || BOARD_SIZE) + move.col;
}

/** Convert board index to row/col for display. */
export function indexToRowCol(index: number, size = BOARD_SIZE): { row: number; col: number } {
  return { row: Math.floor(index / size), col: index % size };
}
