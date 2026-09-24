import { describe, expect, it } from 'vitest';
import { chooseBotMove, createBoard, legalMoves, playMove, validateModelMove } from './gomokuEngine';
describe('gomoku deterministic engine',()=>{
  it('detects five in a row',()=>{ let board=createBoard(); let result; for(let col=0;col<5;col++){ result=playMove(board,{row:7,col},'black'); board=result.board; } expect(result?.winner).toBe('black'); });
  it('bot only selects a legal move',()=>{ const board=createBoard(); board[7][7]='black'; const move=chooseBotMove(board); expect(legalMoves(board)).toContainEqual(move); });
  it('rejects model actions outside legalMoves',()=>{ const board=createBoard(); board[2][3]='white'; expect(validateModelMove(board,{row:2,col:3})).toBeNull(); expect(validateModelMove(board,{row:2,col:4})).toEqual({row:2,col:4}); });
});
