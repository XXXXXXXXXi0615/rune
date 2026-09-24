import { useEffect, useMemo, useRef, useState } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import type { MomentMediaCrop, MomentMediaItem, MomentPost } from '@/features/moments/domain';
import { MOMENT_IMAGE_ACCEPT, MOMENT_IMAGE_MAX_COUNT, MomentMediaError, releaseMomentMedia, storeMomentMediaItems, validateMomentImageFiles } from '@/features/moments/media';
import { useMomentsStore } from '@/features/moments/store';
import { MomentImageAdjustSheet } from './MomentImageAdjustSheet';
import { useMomentMediaUrl } from './MomentMediaGrid';

type ComposerItem = MomentMediaItem & { file?: File; previewUrl?: string };

function ComposerThumbnail({ item, index, total, onRemove, onEdit, onMove, onPointerDown, onPointerMove, onPointerUp }: { item: ComposerItem; index: number; total: number; onRemove: () => void; onEdit: () => void; onMove: (delta: number) => void; onPointerDown: () => void; onPointerMove: (event: React.PointerEvent) => void; onPointerUp: () => void }) {
  const storedUrl = useMomentMediaUrl(item.file ? '' : item.assetId);
  const url = item.previewUrl ?? storedUrl;
  const crop = item.crop;
  return <div className="moments-compose-preview" data-media-index={index} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))} onDragOver={(event) => event.preventDefault()} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label={`圖片 ${index + 1}，共 ${total} 張`}>
    <button type="button" className="moments-preview-edit" onClick={onEdit} aria-label={`調整圖片 ${index + 1}`}><img src={url} alt="" draggable={false} style={crop ? { objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` } : undefined} /></button>
    <button type="button" className="moments-preview-remove" onClick={onRemove} aria-label={`移除圖片 ${index + 1}`}>×</button>
    <div className="moments-preview-reorder"><button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`將圖片 ${index + 1} 前移`}>←</button><button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={`將圖片 ${index + 1} 後移`}>→</button></div>
  </div>;
}

export function MomentsComposerSheet({ onClose, post }: { onClose: () => void; post?: MomentPost }) {
  const publishPost = useMomentsStore((state) => state.publishPost); const updatePost = useMomentsStore((state) => state.updatePost);
  const [text, setText] = useState(post?.text ?? '');
  const [items, setItems] = useState<ComposerItem[]>(() => post?.media.map((item) => ({ ...item })) ?? []);
  const [visibility, setVisibility] = useState<'everyone' | 'only-me'>(post?.visibility ?? 'everyone');
  const [error, setError] = useState(''); const [publishing, setPublishing] = useState(false); const [adjustingId, setAdjustingId] = useState<string>();
  const inputRef = useRef<HTMLTextAreaElement>(null); const fileRef = useRef<HTMLInputElement>(null); const dragIndex = useRef<number | undefined>(undefined);
  const adjusting = items.find((item) => item.id === adjustingId);
  const reorder = (from: number, to: number) => setItems((current) => { if (to < 0 || to >= current.length || from === to) return current; const next = [...current]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next.map((item, order) => ({ ...item, order })); });

  useEffect(() => { inputRef.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !publishing && !adjustingId) onClose(); }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [onClose, publishing, adjustingId]);
  useEffect(() => () => { items.forEach((item) => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); }); }, []);

  const handleFiles = (incoming: File[]) => {
    try { validateMomentImageFiles(incoming); if (items.length + incoming.length > MOMENT_IMAGE_MAX_COUNT) throw new MomentMediaError('每則動態最多 9 張圖片');
      setItems((current) => [...current, ...incoming.map((file, offset) => ({ id: crypto.randomUUID(), assetId: '', order: current.length + offset, file, previewUrl: URL.createObjectURL(file) }))]); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '圖片無法加入'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    if ((!text.trim() && items.length === 0) || publishing) return;
    setPublishing(true); setError(''); let created: MomentMediaItem[] = [];
    try {
      const files = items.filter((item): item is ComposerItem & { file: File } => Boolean(item.file));
      created = await storeMomentMediaItems(files.map((item) => item.file)); let createdIndex = 0;
      const media = items.map((item, order) => item.file ? { ...created[createdIndex++], order, crop: item.crop } : { ...item, order }).map(({ file: _file, previewUrl: _previewUrl, ...item }) => item);
      if (post) await updatePost(post.id, { text, media, visibility }); else await publishPost({ text, media, visibility }); onClose();
    } catch (reason) { if (created.length) await releaseMomentMedia(created.map((item) => item.assetId)).catch(() => {}); setError(reason instanceof Error ? reason.message : '動態儲存失敗'); setPublishing(false); }
  };

  const adjustUrl = useMemo(() => adjusting?.previewUrl, [adjusting]);
  return <MobileShellOverlay variant="dialog" onClose={() => { if (!publishing && !adjustingId) onClose(); }} className="moments-overlay"><section className="moments-compose-sheet" role="dialog" aria-modal="true" aria-labelledby="moments-compose-title" data-pet-safe-region="interactive">
    <header><button type="button" onClick={onClose} disabled={publishing}>取消</button><h2 id="moments-compose-title">{post ? '編輯動態' : '發一條動態'}</h2><button type="button" className="is-primary" onClick={save} disabled={publishing || (!text.trim() && items.length === 0)}>{publishing ? '儲存中' : post ? '儲存' : '發佈'}</button></header>
    <textarea ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} placeholder="記下此刻想留下的片段…" aria-label="動態內容" maxLength={2000} />
    <div className="moments-compose-previews" onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); const target = (event.target as HTMLElement).closest<HTMLElement>('[data-media-index]'); if (target) reorder(from, Number(target.dataset.mediaIndex)); }}>
      {items.map((item, index) => <ComposerThumbnail key={item.id} item={item} index={index} total={items.length} onEdit={() => setAdjustingId(item.id)} onRemove={() => setItems((current) => current.filter((entry) => entry.id !== item.id).map((entry, order) => ({ ...entry, order })))} onMove={(delta) => reorder(index, index + delta)} onPointerDown={() => { dragIndex.current = index; }} onPointerUp={() => { dragIndex.current = undefined; }} onPointerMove={(event) => { if (!(event.buttons & 1) || dragIndex.current === undefined) return; event.preventDefault(); const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-media-index]'); if (target) { const to = Number(target.dataset.mediaIndex); reorder(dragIndex.current, to); dragIndex.current = to; } }} />)}
      {items.length < 9 && <button type="button" className="moments-compose-add" onClick={() => fileRef.current?.click()} aria-label="加入圖片"><span>＋</span><small>{items.length}/9</small></button>}
    </div>
    <div className="moments-compose-tools"><input ref={fileRef} type="file" accept={MOMENT_IMAGE_ACCEPT} multiple onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} /><label>誰可以看<select value={visibility} onChange={(event) => setVisibility(event.target.value as 'everyone' | 'only-me')}><option value="everyone">所有人</option><option value="only-me">僅自己</option></select></label></div>{error && <p className="moments-form-error" role="alert">{error}</p>}
    {adjusting && (adjustUrl || !adjusting.file) && <AdjustExisting item={adjusting} fallbackUrl={adjustUrl} onChange={(crop) => setItems((current) => current.map((item) => item.id === adjusting.id ? { ...item, crop } : item))} onClose={() => setAdjustingId(undefined)} />}
  </section></MobileShellOverlay>;
}

function AdjustExisting({ item, fallbackUrl, onChange, onClose }: { item: ComposerItem; fallbackUrl?: string; onChange: (crop: MomentMediaCrop) => void; onClose: () => void }) {
  const storedUrl = useMomentMediaUrl(item.file ? '' : item.assetId); const url = fallbackUrl ?? storedUrl; return url ? <MomentImageAdjustSheet url={url} crop={item.crop} onChange={onChange} onClose={onClose} /> : null;
}
