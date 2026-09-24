import JSZip from 'jszip';
import { deleteAssets, saveAsset } from '@/store/assets';
import type { ComicBookDocument, ComicPage, ComicReadingDirection, ComicReadingMode, MoonReadBook } from '../types';

const IMAGE_EXTENSIONS = new Set(['jpg','jpeg','png','webp','avif']);
const MIME: Record<string,string> = { jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif' };
export interface ComicImportOptions { title: string; author?: string; series?: string; volume?: string; direction: ComicReadingDirection; mode: ComicReadingMode; coverIndex?: number; }
export interface ComicImportProgress { completed: number; total: number; failed: string[]; stage: 'extracting'|'saving'|'done'; }

export const naturalComicSort = (a:string,b:string) => a.localeCompare(b, undefined, { numeric:true, sensitivity:'base' });
export function isSupportedComicEntry(path:string) {
  const normalized=path.replace(/\\/g,'/'); const name=normalized.split('/').at(-1)||'';
  if (!name || normalized.startsWith('__MACOSX/') || name.startsWith('.') || /^(\.DS_Store|Thumbs\.db)$/i.test(name)) return false;
  return IMAGE_EXTENSIONS.has(name.split('.').at(-1)?.toLowerCase() || '');
}
export function parseComicInfo(xml:string) {
  try { const doc=new DOMParser().parseFromString(xml,'application/xml'); if(doc.querySelector('parsererror')) return {};
    const value=(tag:string)=>doc.querySelector(tag)?.textContent?.trim()||undefined;
    return { title:value('Title'),series:value('Series'),volume:value('Number'),author:value('Writer'),manga:value('Manga'),pageCount:Number(value('PageCount'))||undefined };
  } catch { return {}; }
}
async function dimensions(blob:Blob) { const bitmap=await createImageBitmap(blob); const value={width:bitmap.width,height:bitmap.height}; bitmap.close(); return value; }
function makeBook(document:ComicBookDocument, fileName:string):MoonReadBook { return { id:document.id,title:document.title,author:document.author||'未知作者',description:[document.series,document.volume&&`第 ${document.volume} 卷`].filter(Boolean).join(' · '),format:'cbz',sourceAssetId:document.pages[0]?.assetId||'',assetId:document.pages[0]?.assetId||'',fileName,wordCount:0,importedAt:document.createdAt,lastOpenedAt:document.createdAt,progress:0,coverAssetId:document.coverAssetId,tags:[],libraryState:'active',documentKind:'comic',comic:document }; }
async function persistPages(items:{name:string;blob:Blob}[], options:ComicImportOptions, onProgress?: (p:ComicImportProgress)=>void, signal?:AbortSignal) {
  const saved:string[]=[]; const pages:ComicPage[]=[]; const failed:string[]=[];
  try { for(let index=0;index<items.length;index++){ if(signal?.aborted) throw new DOMException('漫畫導入已取消','AbortError'); const item=items[index]; onProgress?.({completed:index,total:items.length,failed:[...failed],stage:'saving'}); if(signal?.aborted) throw new DOMException('漫畫導入已取消','AbortError');
      try { const size=await dimensions(item.blob); const assetId=await saveAsset(item.blob,item.blob.type); saved.push(assetId); pages.push({id:crypto.randomUUID(),index:pages.length,assetId,...size,isCover:index===(options.coverIndex||0)}); } catch { failed.push(item.name); }
    }
    if(!pages.length) throw new Error('圖片皆無法解碼'); const now=Date.now(); const cover=pages.find(page=>page.isCover)||pages[0];
    const document:ComicBookDocument={kind:'comic',id:crypto.randomUUID(),title:options.title||'未命名漫畫',author:options.author,series:options.series,volume:options.volume,coverAssetId:cover.assetId,pages,pageCount:pages.length,direction:options.direction,defaultReadingMode:options.mode,createdAt:now,updatedAt:now};
    onProgress?.({completed:items.length,total:items.length,failed,stage:'done'}); return document;
  } catch(error){ await deleteAssets(saved); throw error; }
}
export async function importComicArchive(file:File, overrides:Partial<ComicImportOptions>={}, onProgress?: (p:ComicImportProgress)=>void, signal?:AbortSignal):Promise<MoonReadBook> {
  if(!/\.(cbz|zip)$/i.test(file.name) && !['application/zip','application/x-zip-compressed'].includes(file.type)) throw new Error('僅支援 CBZ 或 ZIP 圖片包');
  const zip=await JSZip.loadAsync(file); const names=Object.keys(zip.files).filter(isSupportedComicEntry).sort(naturalComicSort); if(!names.length) throw new Error('壓縮檔內沒有可用圖片');
  const infoEntry=Object.keys(zip.files).find(name=>/(^|\/)ComicInfo\.xml$/i.test(name)); const info=infoEntry ? parseComicInfo(await zip.file(infoEntry)!.async('text')) : {};
  const items=[] as {name:string;blob:Blob}[]; for(let i=0;i<names.length;i++){if(signal?.aborted)throw new DOMException('漫畫導入已取消','AbortError');const name=names[i];const ext=name.split('.').at(-1)!.toLowerCase();items.push({name,blob:await zip.file(name)!.async('blob').then(blob=>new Blob([blob],{type:MIME[ext]}))});onProgress?.({completed:i+1,total:names.length,failed:[],stage:'extracting'});}
  const title=overrides.title||info.title||file.name.replace(/\.(cbz|zip)$/i,''); const manga=String(info.manga||'').toLowerCase(); const direction=overrides.direction||(manga==='yesandrighttoleft'||manga==='yes'?'rtl':'ltr');
  return makeBook(await persistPages(items,{title,author:overrides.author||info.author,series:overrides.series||info.series,volume:overrides.volume||info.volume,direction,mode:overrides.mode||'single',coverIndex:overrides.coverIndex},onProgress,signal),file.name);
}
export async function importComicImages(files:File[], options:ComicImportOptions, onProgress?: (p:ComicImportProgress)=>void, signal?:AbortSignal) { const items=files.filter(file=>isSupportedComicEntry(file.name)).map(file=>({name:file.name,blob:file})); if(!items.length)throw new Error('沒有支援的漫畫圖片'); return makeBook(await persistPages(items,options,onProgress,signal),`${options.title}.images`); }
