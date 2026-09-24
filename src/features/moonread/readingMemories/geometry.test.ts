import { describe, expect, it } from 'vitest';
import { canMoveDecoration, normalizeZIndices, resizeWithAspect, restoreTransformOnPointerCancel, screenDeltaToBoard, snapDecoration } from './geometry';
import type { ReadingBoardDecoration } from './types';
const item=(patch:Partial<ReadingBoardDecoration>={}):ReadingBoardDecoration=>({id:'decor-a',type:'image',assetId:'asset-a',x:100,y:100,width:200,height:100,rotation:0,opacity:1,zIndex:3,locked:false,aspectMode:'contain',...patch});
describe('reading memory geometry',()=>{
  it('normalizes screen movement into reference coordinates',()=>expect(screenDeltaToBoard(120,.5)).toBe(240));
  it('orders zIndex deterministically',()=>expect(normalizeZIndices([item({id:'b',zIndex:8}),item({id:'a',zIndex:2})]).map(v=>[v.id,v.zIndex])).toEqual([['a',1],['b',2]]));
  it('keeps aspect ratio while resizing',()=>expect(resizeWithAspect(200,100,100,1,true)).toEqual({width:300,height:150}));
  it('supports free aspect resize',()=>expect(resizeWithAspect(200,100,20,40,false)).toEqual({width:220,height:140}));
  it('restores safe state on pointer cancel',()=>{const start=item();const restored=restoreTransformOnPointerCancel(start);expect(restored).toEqual(start);expect(restored).not.toBe(start)});
  it('prevents locked image movement',()=>expect(canMoveDecoration(item({locked:true}))).toBe(false));
  it('snaps to board center without changing persisted scale',()=>{const result=snapDecoration(item({x:276}),750,1334,30);expect(result.item.x).toBe(275);expect(result.guideX).toBe(375)});
});
