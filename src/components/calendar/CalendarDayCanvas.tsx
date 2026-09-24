import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { saveAsset } from '@/store/assets';
import { useAppStore } from '@/store/useAppStore';
import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';
import type { CalendarDayElement } from '@/types';
import {
  addCalendarDayElement, addUserCalendarNote, buildCalendarDayScene,
  DAY_PAGE_HEIGHT, DAY_PAGE_WIDTH, deleteCalendarDayElement, deleteUserCalendarNote,
  ensureCalendarDaySnapshot, updateCalendarDayElement,
  updateCalendarNotePresentation, updateUserCalendarNote,
} from '@/features/calendar/calendarDayScene';
import { canvasTransformStyle, memoVariant, pinVariant, ScenePhoto, SceneSticker, tapeVariant } from '@/features/calendar/calendarDayScenePresentation';
import { useAnchoredPopover } from '@/hooks/useAnchoredPopover';
import { AnchoredPopoverSurface } from '@/components/common/AnchoredPopoverSurface';

type InteractionMode = 'idle' | 'selected' | 'pressing' | 'dragging';
type Target = { kind: 'note' | 'element'; id: string };
type Transform = { x: number; y: number; width: number; height: number; rotation: number; zIndex: number };

/**
 * C3-C — the artboard is the canonical 1000 × 1400 page rendered at a derived
 * presentation scale, so the whole page fits inside the host panel (the Quick
 * Float, or the Day Inspector sheet on phone) without the host having to scroll.
 * Only the rendered box is scaled: persisted x/y, the drag conversion and the
 * percentage geometry all stay canonical.
 */
const ARTBOARD_FIT_GAP = 10; // `.calendar-day-canvas-shell` row gap
const MIN_PRESENTATION_SCALE = 0.22;

/** Nearest ancestor that scrolls or clips — the box the artboard must fit in. */
function findFitBox(start: HTMLElement | null): HTMLElement | null {
  let node = start?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') && node.clientHeight > 0) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Phase C1/C2 — the shared day canvas. The compact quick presentation is the
 * only presentation: hosts render this inside the Day Inspector's Canvas Quick
 * Float (desktop) or the inspector sheet (phone). The canonical
 * `calendarDayScene` document, element geometry, x/y persistence, selection,
 * drag, delete and the note/sticker/photo actions are unchanged.
 */
export function CalendarDayCanvas({ dateKey }: { dateKey: string }) {
  const elements = useAppStore((state) => state.calendarDayElements || []);
  const notes = useAppStore((state) => state.calendarNotes || []);
  const events = useAppStore((state) => state.customEvents || []);
  const scene = useMemo(() => buildCalendarDayScene(dateKey), [dateKey, elements, notes, events]);
  const pageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const origin = useRef<{ px: number; py: number; base: Transform; target: Target; mode: InteractionMode } | null>(null);
  const draftRef = useRef<Transform | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [mode, setMode] = useState<InteractionMode>('idle');
  const [draft, setDraft] = useState<Transform | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [stickerPickerOpen,setStickerPickerOpen]=useState(false);
  const [viewerAssetId,setViewerAssetId]=useState<string|null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const stickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [presentationScale, setPresentationScale] = useState<number | null>(null);

  // C3-D: the sticker picker is portalled (see the render) so the Quick Float's
  // `overflow: hidden` and its `backdrop-filter` containing block cannot clip it.
  const stickerPicker = useAnchoredPopover({
    open: stickerPickerOpen,
    anchorRef: stickerTriggerRef,
    align: 'start',
    gap: 6,
    onRequestClose: () => setStickerPickerOpen(false),
  });

  const begin = (event: PointerEvent, target: Target, transform: Transform, nextMode: InteractionMode) => {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setSelected(target); setMode(nextMode); setDraft(transform); draftRef.current = transform;
    origin.current = { px: event.clientX, py: event.clientY, base: transform, target, mode: nextMode };
  };
  const move = (event: PointerEvent) => {
    const initial = origin.current; const rect = pageRef.current?.getBoundingClientRect();
    if (!initial || !rect) return;
    const dx = (event.clientX - initial.px) * DAY_PAGE_WIDTH / rect.width;
    const dy = (event.clientY - initial.py) * DAY_PAGE_HEIGHT / rect.height;
    const next = { ...initial.base, x: Math.max(0, Math.min(DAY_PAGE_WIDTH - initial.base.width, initial.base.x + dx)), y: Math.max(0, Math.min(DAY_PAGE_HEIGHT - initial.base.height, initial.base.y + dy)) };
    draftRef.current = next; setDraft(next);
  };
  const commit = () => {
    const initial = origin.current;
    const committedDraft = draftRef.current;
    if (!initial || !committedDraft) return;
    const patch = { x: committedDraft.x, y: committedDraft.y, width: committedDraft.width, height: committedDraft.height, rotation: committedDraft.rotation, zIndex: committedDraft.zIndex };
    if (initial.target.kind === 'note') updateCalendarNotePresentation(initial.target.id, patch);
    else updateCalendarDayElement(initial.target.id, patch);
    origin.current = null; draftRef.current = null; setMode('selected');
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { origin.current = null; draftRef.current = null; setDraft(null); setViewerAssetId(null); setMode(selected ? 'selected' : 'idle'); return; }
      if (!selected) return;
      const step=event.shiftKey?8:1;
      const sceneTarget=selected.kind==='note'?scene.notes.find((item)=>item.id===selected.id):scene.decorations.find((item)=>item.id===selected.id);
      if (!sceneTarget) return;
      if (event.key==='Delete'||event.key==='Backspace'){event.preventDefault();if(selected.kind==='note')deleteUserCalendarNote(selected.id);else deleteCalendarDayElement(selected.id);setSelected(null);return;}
      const delta=event.key==='ArrowLeft'?[-step,0]:event.key==='ArrowRight'?[step,0]:event.key==='ArrowUp'?[0,-step]:event.key==='ArrowDown'?[0,step]:null;
      if(delta){event.preventDefault();const patch={x:sceneTarget.x+delta[0],y:sceneTarget.y+delta[1],width:sceneTarget.width,rotation:sceneTarget.rotation,zIndex:sceneTarget.zIndex};if(selected.kind==='note')updateCalendarNotePresentation(selected.id,patch);else updateCalendarDayElement(selected.id,{...patch,height:sceneTarget.height});}
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [selected,scene]);
  useEffect(() => { const timer = window.setTimeout(() => void ensureCalendarDaySnapshot(dateKey), 1100); return () => window.clearTimeout(timer); }, [dateKey, scene.revision]);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void ensureCalendarDaySnapshot(dateKey); };
    document.addEventListener('visibilitychange', flush);
    return () => { document.removeEventListener('visibilitychange', flush); void ensureCalendarDaySnapshot(dateKey); };
  }, [dateKey]);

  // C3-C — derive the presentation scale from the host panel. The fit box is the
  // nearest scrolling/clipping ancestor (the Quick Float body, or the inspector
  // sheet body). Width and height are both honoured so the 5:7 page is always
  // fully visible; the scale never exceeds 1, so the artboard is never upscaled
  // beyond canonical size and never widened past the panel.
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const fitBox = findFitBox(shell);
    if (!shell || !fitBox) return;
    const measure = () => {
      const boxStyle = getComputedStyle(fitBox);
      const num = (value: string) => Number.parseFloat(value) || 0;
      // The artboard sits inside a bordered wrap, so the wrap's border box — not
      // the artboard box — is what has to fit the panel.
      const wrap = pageRef.current?.parentElement ?? null;
      const wrapStyle = wrap ? getComputedStyle(wrap) : null;
      const wrapBorderX = wrapStyle ? num(wrapStyle.borderLeftWidth) + num(wrapStyle.borderRightWidth) : 0;
      const wrapBorderY = wrapStyle ? num(wrapStyle.borderTopWidth) + num(wrapStyle.borderBottomWidth) : 0;

      const availWidth = fitBox.clientWidth - num(boxStyle.paddingLeft) - num(boxStyle.paddingRight) - wrapBorderX;
      const boxContentTop = fitBox.getBoundingClientRect().top + num(boxStyle.borderTopWidth) + num(boxStyle.paddingTop);
      const usedAbove = shell.getBoundingClientRect().top - boxContentTop;
      const availHeight = fitBox.clientHeight - num(boxStyle.paddingTop) - num(boxStyle.paddingBottom)
        - usedAbove - (barRef.current?.offsetHeight ?? 0) - ARTBOARD_FIT_GAP - wrapBorderY;
      if (availWidth <= 0 || availHeight <= 0) return;
      const next = Math.max(
        MIN_PRESENTATION_SCALE,
        Math.min(availWidth / DAY_PAGE_WIDTH, availHeight / DAY_PAGE_HEIGHT, 1),
      );
      // Threshold guard: a sub-pixel change must never re-enter the observer.
      setPresentationScale((prev) => (prev !== null && Math.abs(prev - next) < 0.002 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(fitBox);
    if (barRef.current) observer.observe(barRef.current);
    return () => observer.disconnect();
  }, []);

  const addSticker = (stickerId: CalendarDayElement['stickerId']) => {
    const stickerCount = scene.decorations.filter((item) => item.type === 'sticker').length;
    addCalendarDayElement({ dateKey, type: 'sticker', stickerId, x: 650 + (stickerCount % 2) * 150, y: 220 + Math.floor(stickerCount / 2) * 140, width: 120, height: 120, rotation: stickerCount % 2 === 0 ? -8 : 7, zIndex: 200 + stickerCount, createdBy: 'user' });
    setStickerPickerOpen(false);
  };
  const addPhoto = async (file?: File) => { if (file) { const assetId = await saveAsset(file, file.type || 'image/jpeg'); addCalendarDayElement({ dateKey, type: 'photo', assetId, frame: 'polaroid', x: 650, y: 850, width: 280, height: 230, rotation: 3, zIndex: 210, createdBy: 'user' }); } };
  const styleFor = (target: Target, transform: Transform) => {
    const active = selected?.kind === target.kind && selected.id === target.id && draft ? draft : transform;
    return canvasTransformStyle(active);
  };
  const selectedNote = selected?.kind === 'note' ? scene.notes.find((item) => item.id === selected.id)?.note : undefined;
  const isEmpty=scene.events.length===0&&scene.notes.length===0&&scene.decorations.length===0;

  const pageBox = presentationScale === null
    ? null
    : { width: DAY_PAGE_WIDTH * presentationScale, height: DAY_PAGE_HEIGHT * presentationScale };

  return <section ref={shellRef} className="calendar-day-canvas-shell" data-variant="quick" data-interaction-mode={mode} data-presentation-scale={presentationScale === null ? 'pending' : presentationScale.toFixed(4)}>
    <div ref={barRef} className="calendar-day-canvas-quick-bar">
      <form onSubmit={(event) => { event.preventDefault(); if (noteDraft.trim()) { const note = addUserCalendarNote(dateKey, noteDraft); setNoteDraft(''); setSelected({ kind: 'note', id: note.id }); } }}><input aria-label="便箋內容" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="寫一張便箋" /><button type="submit" disabled={!noteDraft.trim()}>新增便箋</button></form>
      <span className="calendar-sticker-picker-wrap"><button ref={stickerTriggerRef} type="button" aria-haspopup="menu" aria-expanded={stickerPickerOpen} onClick={()=>setStickerPickerOpen((value)=>!value)}>貼紙</button></span><button type="button" onClick={() => fileRef.current?.click()}>加入照片</button>
      {selectedNote?.author === 'user' && <><button type="button" onClick={() => { const content = window.prompt('編輯便箋', selectedNote.content); if (content) updateUserCalendarNote(selectedNote.id, content); }}>編輯便箋</button><button type="button" onClick={() => { deleteUserCalendarNote(selectedNote.id); setSelected(null); }}>刪除便箋</button></>}
      {selected?.kind === 'element' && <button type="button" onClick={() => { deleteCalendarDayElement(selected.id); setSelected(null); }}>刪除</button>}
    </div>
    <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => void addPhoto(event.target.files?.[0])} />
    <div className="calendar-day-artboard-wrap" style={pageBox === null ? undefined : { width: pageBox.width }}><div ref={pageRef} className="calendar-day-artboard" style={pageBox ?? undefined} onPointerMove={move} onPointerUp={commit} onPointerCancel={() => { origin.current = null; draftRef.current = null; setDraft(null); setMode(selected ? 'selected' : 'idle'); }} onClick={(event) => { if (event.target === event.currentTarget) { setSelected(null); setMode('idle'); } }}>
      <div className="calendar-day-paper-header"><span>USER × LUNARIS</span><b>{dateKey.replaceAll('-','.')}</b></div>
      <svg className="calendar-canvas-watermark" viewBox="0 0 180 120" aria-hidden="true"><path d="M35 76c25-47 61-48 86-9 12 19 24 21 42 8"/><path d="M113 19c-24 3-37 25-29 45 9 22 36 29 56 13-14 2-28-6-34-19-7-15-3-29 7-39Z"/><circle cx="154" cy="25" r="3"/><path d="m24 26 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z"/></svg>
      {isEmpty&&<div className="calendar-canvas-empty"><strong>今天還很安靜。</strong><p>留下一張便籤，<br/>或把一張照片貼在今天。</p></div>}
      {scene.events.map((node) => <article key={node.id} className={`calendar-canvas-event is-${node.event.author || 'user'}`} style={{ left: `${node.x / 10}%`, top: `${node.y / 14}%`, width: `${node.width / 10}%`, height: `${node.height / 14}%` }}><small>{(node.event.author || 'user').toUpperCase()} · {node.event.startTime || '全天'}</small><strong>{node.event.title}</strong></article>)}
      {scene.notes.map((node) => { const transform = { x: node.x, y: node.y, width: node.width, height: node.height, rotation: node.rotation, zIndex: node.zIndex }; const target: Target = { kind: 'note', id: node.id }; const variant=memoVariant(node.id); return <article key={node.id} data-memo-variant={variant} tabIndex={0} className={`calendar-canvas-note is-${node.note.author}${selected?.id === node.id ? ' is-selected' : ''} is-${variant}`} style={styleFor(target, transform)} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => begin(event, target, transform, 'dragging')}><span className={`calendar-tape is-${tapeVariant(node.id)}`}/><span className={`calendar-pin is-${pinVariant(node.id)}`}/><small>{node.note.author.toUpperCase()}</small><p>{node.note.content}</p></article>; })}
      {scene.decorations.map((item) => { const transform = { x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, zIndex: item.zIndex }; const target: Target = { kind: 'element', id: item.id }; return <div key={item.id} tabIndex={0} className={`calendar-canvas-element is-${item.type}${selected?.id === item.id ? ' is-selected' : ''}`} style={styleFor(target, transform)} onClick={(event) => event.stopPropagation()} onDoubleClick={()=>item.type==='photo'&&item.assetId&&setViewerAssetId(item.assetId)} onPointerDown={(event) => begin(event, target, transform, 'dragging')}>{item.type === 'photo' ? <ScenePhoto item={item} /> : <SceneSticker id={item.stickerId} />}</div>; })}
    </div></div>
    {stickerPickerOpen && (
      <AnchoredPopoverSurface
        popoverRef={stickerPicker.popoverRef}
        position={stickerPicker.position}
        className="calendar-canvas-portal calendar-sticker-picker"
        role="menu"
        aria-label="貼紙選擇"
      >
        <button type="button" role="menuitem" onClick={()=>addSticker('crescent')}>月牙貼紙</button>
        <button type="button" role="menuitem" onClick={()=>addSticker('star')}>星星貼紙</button>
        <button type="button" role="menuitem" onClick={()=>addSticker('tide-wave')}>潮浪貼紙</button>
      </AnchoredPopoverSurface>
    )}
    {viewerAssetId&&<CalendarPhotoViewer assetId={viewerAssetId} onClose={()=>setViewerAssetId(null)}/>}
  </section>;
}

/**
 * C3-D — portalled to `document.body`. The Quick Float carries `backdrop-filter`
 * and `overflow: hidden`, which makes it the containing block for fixed
 * descendants; rendered in place the overlay was clipped to the panel instead of
 * covering the viewport, and its close button inherited the paper ink (dark on
 * the dark scrim). Both are resolved by leaving the canvas subtree.
 */
function CalendarPhotoViewer({assetId,onClose}:{assetId:string;onClose:()=>void}){const url=useAssetBlobUrl(assetId);return createPortal(<div className="calendar-photo-viewer" role="dialog" aria-modal="true" aria-label="日曆照片預覽" onClick={onClose}><button type="button" aria-label="關閉照片" onClick={onClose}>×</button>{url&&<img src={url} alt="日曆照片原圖"/>}</div>, document.body);}
