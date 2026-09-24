import type { ComicReadingDirection } from '../types';
export function normalizeComicPage(index:number,pageCount:number){return Math.max(0,Math.min(Math.max(0,pageCount-1),Math.round(index)));}
export function arrowPageDelta(key:'ArrowLeft'|'ArrowRight',direction:ComicReadingDirection){const physical=key==='ArrowRight'?1:-1;return direction==='rtl'?-physical:physical;}
