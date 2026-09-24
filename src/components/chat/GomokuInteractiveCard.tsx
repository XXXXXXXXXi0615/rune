import { useCallback, useMemo } from 'react';
import type { GomokuState } from '@/features/interactive/types';
import { applyGomokuAction, validateGomokuAction, getAiMove, indexToRowCol } from '@/features/interactive/gomokuAdapter';

interface Props {
  state: GomokuState;
  onAction: (state: GomokuState) => void;
  readOnly?: boolean;
  isParticipant?: boolean;
}

const CELL = 22; // px per cell
const PADDING = 4;

export function GomokuInteractiveCard({ state, onAction, readOnly, isParticipant }: Props) {
  const size = state.boardSize || 15;
  const boardPx = CELL * (size - 1) + PADDING * 2;
  const canAct = !readOnly && isParticipant && !state.winner;

  const handleCellClick = useCallback((index: number) => {
    if (!canAct) return;
    const action = { type: 'place' as const, version: state.history.length, index, player: state.currentTurn };
    const validation = validateGomokuAction(state, action);
    if (!validation.valid) return;

    let nextState = applyGomokuAction(state, action);

    // If game not over and it's AI's turn, request AI move
    if (!nextState.winner && nextState.currentTurn === 'W' && nextState.whitePlayer.kind === 'ai') {
      const aiIndex = getAiMove(nextState);
      const aiAction = { type: 'place' as const, version: nextState.history.length, index: aiIndex, player: 'W' as const };
      nextState = applyGomokuAction(nextState, aiAction);
    }

    onAction(nextState);
  }, [state, canAct, onAction]);

  const winnerLabel = state.winner === 'B' ? `${state.blackPlayer.displayName} 勝` : state.winner === 'W' ? `${state.whitePlayer.displayName} 勝` : state.winner === 'draw' ? '平局' : '';

  // Build cell display data
  const cells = useMemo(() => {
    const result: Array<{ index: number; stone: 'B' | 'W' | null; isLast: boolean }> = [];
    const lastMoveIndex = state.history.length > 0 ? state.history[state.history.length - 1].index : -1;
    for (let i = 0; i < size * size; i++) {
      const ch = state.board[i];
      result.push({ index: i, stone: ch === '.' ? null : (ch as 'B' | 'W'), isLast: i === lastMoveIndex });
    }
    return result;
  }, [state.board, state.history, size]);

  return (
    <div className="gomoku-card">
      <div className="gomoku-card__header">
        <span className="gomoku-card__title">五子棋</span>
        {state.winner && <span className="gomoku-card__result">{winnerLabel}</span>}
        {!state.winner && (
          <span className="gomoku-card__turn">
            <i className={`gomoku-turn-stone is-${state.currentTurn === 'B' ? 'black' : 'white'}`} aria-hidden="true" />
            {state.currentTurn === 'B' ? state.blackPlayer.displayName : state.whitePlayer.displayName} 回合
          </span>
        )}
      </div>

      <div
        className="gomoku-card__board"
        style={{ width: boardPx, height: boardPx, position: 'relative' }}
      >
        {/* Grid lines */}
        <svg width={boardPx} height={boardPx} style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: size }, (_, i) => {
            const pos = PADDING + i * CELL;
            return (
              <g key={i}>
                <line x1={PADDING} y1={pos} x2={PADDING + (size - 1) * CELL} y2={pos} stroke="var(--border)" strokeWidth={0.5} />
                <line x1={pos} y1={PADDING} x2={pos} y2={PADDING + (size - 1) * CELL} stroke="var(--border)" strokeWidth={0.5} />
              </g>
            );
          })}
          {/* Star points */}
          {[[3,3],[Math.floor(size/2),Math.floor(size/2)],[size-4,size-4]].filter(([r,c])=>r<size&&c<size).map(([r,c]) => (
            <circle key={`s${r}${c}`} cx={PADDING + c * CELL} cy={PADDING + r * CELL} r={2.5} fill="var(--border)" />
          ))}
        </svg>

        {/* Stones */}
        {cells.map(({ index, stone, isLast }) => {
          if (!stone) return null;
          const { row, col } = indexToRowCol(index, size);
          const cx = PADDING + col * CELL;
          const cy = PADDING + row * CELL;
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: cx - 8, top: cy - 8,
                width: 16, height: 16,
                borderRadius: '50%',
                background: stone === 'B'
                  ? 'radial-gradient(circle at 35% 35%, #555, #111)'
                  : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                boxShadow: isLast ? '0 0 0 2px var(--accent)' : '0 1px 2px rgba(0,0,0,.15)',
                pointerEvents: 'none',
              }}
            />
          );
        })}

        {/* Click targets */}
        {!readOnly && !state.winner && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {cells.map(({ index, stone }) => (
              <button
                key={index}
                type="button"
                aria-label={`棋盤第 ${indexToRowCol(index,size).row+1} 列第 ${indexToRowCol(index,size).col+1} 行`}
                onClick={() => { if (!stone) handleCellClick(index); }}
                style={{
                  position: 'absolute',
                  left: PADDING + indexToRowCol(index,size).col * CELL - CELL / 2,
                  top: PADDING + indexToRowCol(index,size).row * CELL - CELL / 2,
                  width: CELL, height: CELL,
                  cursor: !stone && canAct ? 'pointer' : 'default',
                  border: 0, background: 'transparent', padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {state.winner && state.lastAction?.type === 'resign' && (
        <div className="gomoku-card__footer">對手認輸</div>
      )}
    </div>
  );
}
