import { describe, expect, it, vi } from 'vitest';
vi.mock('@/store/assets',()=>({deleteAsset:vi.fn(),saveAsset:vi.fn()}));
import { deleteAsset } from '@/store/assets';
import { deleteReadingMemoryAssetIfUnreferenced, isAssetReferenced } from './assets';
import type { ReadingMemoryBoard } from './types';
const board=(assetId:string):ReadingMemoryBoard=>({id:'board',title:'Board',templateId:'reading-timeline-v2',designWidth:750,designHeight:1334,entries:[],imageLayers:[{id:'decor',type:'image',assetId,x:0,y:0,width:10,height:10,rotation:0,opacity:1,zIndex:1,locked:false,aspectMode:'contain'}],createdAt:1,updatedAt:1});
describe('reading memory asset references',()=>{it('does not delete an asset while another board references it',async()=>{expect(isAssetReferenced('shared',[board('shared')])).toBe(true);expect(await deleteReadingMemoryAssetIfUnreferenced('shared',[board('shared')])).toBe(false);expect(deleteAsset).not.toHaveBeenCalled()});it('deletes only after references are gone',async()=>{expect(await deleteReadingMemoryAssetIfUnreferenced('orphan',[])).toBe(true);expect(deleteAsset).toHaveBeenCalledWith('orphan')})});
