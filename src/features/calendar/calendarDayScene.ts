import { deleteAsset, getAsset, saveAsset } from '@/store/assets';
import { useAppStore } from '@/store/useAppStore';
import type { CalendarDayElement, CalendarDaySnapshot, CalendarEvent, CalendarNote } from '@/types';

export const DAY_PAGE_WIDTH = 1000;
export const DAY_PAGE_HEIGHT = 1400;
export const DAY_HEADER_HEIGHT = 170;

export interface CalendarDayScene {
  dateKey: string;
  revision: number;
  events: Array<{ id: string; event: CalendarEvent; x: number; y: number; width: number; height: number }>;
  notes: Array<{ id: string; note: CalendarNote; x: number; y: number; width: number; height: number; rotation: number; zIndex: number }>;
  decorations: CalendarDayElement[];
}

const hash = (value: string) => [...value].reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 2166136261);

export function deterministicNotePlacement(note: CalendarNote, index: number) {
  const seed = hash(`${note.dateKey}:${note.id}`);
  const column = seed % 3;
  const row = Math.floor(seed / 3 + index) % 4;
  return { x: 80 + column * 292, y: 710 + row * 150, width: 245, height: 125, rotation: ((seed % 9) - 4) * .65 };
}

export function getCalendarDayRevision(dateKey: string): number {
  return useAppStore.getState().calendarDayRevisions?.find((item) => item.dateKey === dateKey)?.contentRevision || 0;
}

export function markCalendarDayDirty(dateKey: string): number {
  const next = getCalendarDayRevision(dateKey) + 1;
  useAppStore.setState((state) => ({ calendarDayRevisions: [...(state.calendarDayRevisions || []).filter((item) => item.dateKey !== dateKey), { dateKey, contentRevision: next }] }));
  return next;
}

export function buildCalendarDayScene(dateKey: string): CalendarDayScene {
  const state = useAppStore.getState();
  const events = (state.customEvents || []).filter((event) => !event.deletedAt && event.date === dateKey).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map((event, index) => ({ id: event.id, event, x: 70, y: DAY_HEADER_HEIGHT + 40 + index * 112, width: 860, height: 86 }));
  const notes = (state.calendarNotes || []).filter((note) => !note.deletedAt && note.dateKey === dateKey).map((note, index) => ({ id: note.id, note, ...deterministicNotePlacement(note, index), ...(note.x === undefined ? {} : { x: note.x }), ...(note.y === undefined ? {} : { y: note.y }), ...(note.width === undefined ? {} : { width: note.width }), rotation: note.rotation ?? deterministicNotePlacement(note, index).rotation, zIndex: note.zIndex ?? (100 + index * 10) }));
  const decorations = (state.calendarDayElements || []).filter((item) => !item.deletedAt && item.dateKey === dateKey).sort((a, b) => a.zIndex - b.zIndex);
  return { dateKey, revision: getCalendarDayRevision(dateKey), events, notes, decorations };
}

export function addCalendarDayElement(element: Omit<CalendarDayElement, 'id' | 'createdAt' | 'updatedAt'>): CalendarDayElement {
  const now = Date.now();
  const item = { ...element, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  useAppStore.setState((state) => ({ calendarDayElements: [...(state.calendarDayElements || []), item] }));
  markCalendarDayDirty(item.dateKey);
  return item;
}

export function updateCalendarDayElement(id: string, patch: Partial<Pick<CalendarDayElement, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex'>>): boolean {
  const item = useAppStore.getState().calendarDayElements?.find((entry) => entry.id === id && !entry.deletedAt);
  if (!item) return false;
  useAppStore.setState((state) => ({ calendarDayElements: (state.calendarDayElements || []).map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: Date.now() } : entry) }));
  markCalendarDayDirty(item.dateKey);
  return true;
}

export function deleteCalendarDayElement(id: string): boolean {
  const item=useAppStore.getState().calendarDayElements?.find(entry=>entry.id===id&&!entry.deletedAt);if(!item)return false;useAppStore.setState(state=>({calendarDayElements:(state.calendarDayElements||[]).map(entry=>entry.id===id?{...entry,deletedAt:Date.now(),updatedAt:Date.now()}:entry)}));markCalendarDayDirty(item.dateKey);return true;
}

export function reorderCalendarDayElement(id: string, direction: 'top'|'up'|'down'|'bottom'): boolean {
  const state=useAppStore.getState();const items=(state.calendarDayElements||[]).filter(item=>!item.deletedAt);const target=items.find(item=>item.id===id);if(!target)return false;const ordered=[...items].sort((a,b)=>a.zIndex-b.zIndex);const index=ordered.findIndex(item=>item.id===id);const nextIndex=direction==='top'?ordered.length-1:direction==='bottom'?0:direction==='up'?Math.min(ordered.length-1,index+1):Math.max(0,index-1);ordered.splice(index,1);ordered.splice(nextIndex,0,target);const z=new Map(ordered.map((item,i)=>[item.id,(i+1)*10]));useAppStore.setState(current=>({calendarDayElements:(current.calendarDayElements||[]).map(item=>z.has(item.id)?{...item,zIndex:z.get(item.id)!,updatedAt:Date.now()}:item)}));markCalendarDayDirty(target.dateKey);return true;
}

export function updateCalendarNotePresentation(id: string, patch: Pick<CalendarNote, 'x' | 'y' | 'width' | 'rotation' | 'zIndex'>): boolean {
  const note = useAppStore.getState().calendarNotes?.find((entry) => entry.id === id && !entry.deletedAt);
  if (!note) return false;
  useAppStore.setState((state) => ({ calendarNotes: (state.calendarNotes || []).map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry) }));
  markCalendarDayDirty(note.dateKey);
  return true;
}

export function addUserCalendarNote(dateKey: string, content: string): CalendarNote {
  const now = new Date().toISOString();
  const note: CalendarNote = {
    id: crypto.randomUUID(),
    dateKey,
    content: content.trim(),
    author: 'user',
    createdAt: now,
    updatedAt: now,
    styleVariant: 'cream',
  };
  useAppStore.setState((state) => ({ calendarNotes: [...(state.calendarNotes || []), note] }));
  markCalendarDayDirty(dateKey);
  return note;
}

export function updateUserCalendarNote(id: string, content: string): boolean {
  const note = useAppStore.getState().calendarNotes?.find((entry) => entry.id === id && !entry.deletedAt);
  if (!note || note.author !== 'user' || !content.trim()) return false;
  useAppStore.setState((state) => ({
    calendarNotes: (state.calendarNotes || []).map((entry) => entry.id === id
      ? { ...entry, content: content.trim(), updatedAt: new Date().toISOString() }
      : entry),
  }));
  markCalendarDayDirty(note.dateKey);
  return true;
}

export function deleteUserCalendarNote(id: string): boolean {
  const note = useAppStore.getState().calendarNotes?.find((entry) => entry.id === id && !entry.deletedAt);
  if (!note || note.author !== 'user') return false;
  const now = new Date().toISOString();
  useAppStore.setState((state) => ({
    calendarNotes: (state.calendarNotes || []).map((entry) => entry.id === id
      ? { ...entry, deletedAt: now, updatedAt: now }
      : entry),
  }));
  markCalendarDayDirty(note.dateKey);
  return true;
}

function drawSticker(ctx: CanvasRenderingContext2D, item: CalendarDayElement) {
  ctx.strokeStyle = '#4e918b'; ctx.fillStyle = '#d8eeea'; ctx.lineWidth = 9;
  if (item.stickerId === 'star') { ctx.beginPath(); for (let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5;const r=i%2?item.width*.2:item.width*.44;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)} ctx.closePath();ctx.fill();ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(0,0,item.width*.38,0,Math.PI*2); ctx.stroke(); ctx.beginPath();ctx.arc(item.width*.14,-item.width*.08,item.width*.34,0,Math.PI*2);ctx.fillStyle='#fffaf0';ctx.fill(); }
}

async function loadImage(assetId: string): Promise<HTMLImageElement | null> {
  const blob = await getAsset(assetId); if (!blob) return null;
  const url = URL.createObjectURL(blob); const image = new Image(); image.src = url;
  try { await image.decode(); return image; } catch { return null; } finally { URL.revokeObjectURL(url); }
}

export async function renderCalendarDayScene(scene: CalendarDayScene): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas'); canvas.width = DAY_PAGE_WIDTH; canvas.height = DAY_PAGE_HEIGHT;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle='#fbf4e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(73,111,107,.09)';ctx.lineWidth=1;for(let y=190;y<1400;y+=38){ctx.beginPath();ctx.moveTo(50,y);ctx.lineTo(950,y);ctx.stroke()}
  ctx.fillStyle='#2e2924';ctx.font='56px serif';ctx.fillText(scene.dateKey,70,105);ctx.fillStyle='#4e918b';ctx.font='700 18px sans-serif';ctx.fillText('USER × LUNARIS · SHARED DAY',72,142);
  for(const node of scene.events){ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillRect(node.x,node.y,node.width,node.height);ctx.fillStyle=node.event.author==='lunaris'?'#397e78':'#6b5b4d';ctx.font='700 15px sans-serif';ctx.fillText((node.event.author||'user').toUpperCase(),node.x+20,node.y+27);ctx.fillStyle='#2e2924';ctx.font='700 26px sans-serif';ctx.fillText(`${node.event.startTime||'全天'}  ${node.event.title}`,node.x+20,node.y+62)}
  const layers=[...scene.notes.map(n=>({kind:'note' as const,z:n.zIndex,node:n})),...scene.decorations.map(node=>({kind:'element' as const,z:node.zIndex,node}))].sort((a,b)=>a.z-b.z);
  for (const layer of layers) {
    ctx.save(); const node = layer.node; ctx.translate(node.x + node.width / 2, node.y + node.height / 2); ctx.rotate(node.rotation * Math.PI / 180);
    if (layer.kind === 'note') {
      const noteNode = layer.node as CalendarDayScene['notes'][number];
      ctx.fillStyle = noteNode.note.styleVariant === 'teal' ? '#dceeea' : '#fff1c9'; ctx.fillRect(-noteNode.width / 2, -noteNode.height / 2, noteNode.width, noteNode.height); ctx.fillStyle = '#40372f'; ctx.font = '24px sans-serif'; ctx.fillText(noteNode.note.content.slice(0, 34), -noteNode.width / 2 + 18, -5); ctx.fillStyle = '#397e78'; ctx.font = '700 13px sans-serif'; ctx.fillText(noteNode.note.author.toUpperCase(), -noteNode.width / 2 + 18, noteNode.height / 2 - 15);
    } else {
      const item = layer.node as CalendarDayElement;
      if (item.type === 'sticker') drawSticker(ctx, item);
      else if (item.assetId) { const image = await loadImage(item.assetId); if (image) { ctx.fillStyle = '#fff'; ctx.fillRect(-item.width / 2 - 10, -item.height / 2 - 10, item.width + 20, item.height + (item.frame === 'polaroid' ? 55 : 20)); ctx.drawImage(image, -item.width / 2, -item.height / 2, item.width, item.height); } else { ctx.fillStyle = '#e9ded0'; ctx.fillRect(-item.width / 2, -item.height / 2, item.width, item.height); } }
    }
    ctx.restore();
  }
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('snapshot encode failed')),'image/png'));
}

export function getSnapshotStatus(dateKey: string): { status: 'missing' | 'fresh' | 'stale'; snapshot?: CalendarDaySnapshot } {
  const snapshot=useAppStore.getState().calendarDaySnapshots?.find(item=>item.dateKey===dateKey);if(!snapshot)return{status:'missing'};return{status:snapshot.renderedRevision===getCalendarDayRevision(dateKey)?'fresh':'stale',snapshot};
}

export async function ensureCalendarDaySnapshot(dateKey: string): Promise<{ status: 'fresh' | 'stale' | 'missing'; snapshot?: CalendarDaySnapshot }> {
  const previous=getSnapshotStatus(dateKey);const scene=buildCalendarDayScene(dateKey);
  if(previous.status==='fresh')return previous;
  try{const blob=await renderCalendarDayScene(scene);const assetId=await saveAsset(blob,'image/png');const next:CalendarDaySnapshot={dateKey,assetId,contentRevision:scene.revision,renderedRevision:scene.revision,renderedAt:Date.now(),width:DAY_PAGE_WIDTH,height:DAY_PAGE_HEIGHT,mimeType:'image/png'};useAppStore.setState(state=>({calendarDaySnapshots:[...(state.calendarDaySnapshots||[]).filter(item=>item.dateKey!==dateKey),next]}));if(previous.snapshot?.assetId)void deleteAsset(previous.snapshot.assetId);return{status:'fresh',snapshot:next}}catch(error){if(previous.snapshot)return{status:'stale',snapshot:{...previous.snapshot,renderError:error instanceof Error?error.message:String(error)}};return{status:'missing'}}
}
