import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useRuneStashStore,
  type RuneStashColorCollectionItem,
  type RuneStashColorSwatch,
} from '@/features/stash/useRuneStashStore';
import {
  RUNE_COLOR_COLLECTION_MAX_FILE_BYTES,
  colorCollectionCssVariables,
  colorCollectionFilename,
  colorCollectionHexList,
  colorCollectionMarkdown,
  parseColorCollectionDocument,
  serializeColorCollection,
  type RuneColorCollectionDocument,
} from '@/features/stash/colorCollectionPortable';

const VALID_HEX = /^#[0-9A-F]{6}$/i;
const freshSwatch = (): RuneStashColorSwatch => ({ id: crypto.randomUUID(), name: '', hex: '#DDEBF2' });
const foregroundFor = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = [r, g, b].map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .48 ? '#243743' : '#FFFFFF';
};

export function ColorCollectionPreview({ item, onOpen, onEdit, onDelete }: {
  item: RuneStashColorCollectionItem;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return <article className="stash-color-collection-preview" data-stash-id={item.id} data-testid="color-collection-preview">
    <button type="button" className="stash-color-collection-preview__open" onClick={onOpen} aria-label={`開啟配色集 ${item.title || item.value}`}>
      <span className="stash-color-collection-preview__strip">{item.swatches.slice(0, 6).map((swatch) => <i key={swatch.id} style={{ background: swatch.hex }} />)}</span>
      <span className="stash-color-collection-preview__copy"><strong>{item.title || item.value}</strong>{item.note && <small>{item.note}</small>}<em>{item.swatches.length} 色</em></span>
    </button>
    {item.tags.length > 0 && <p>{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</p>}
    <footer><button type="button" onClick={onEdit}>編輯</button><button type="button" className="is-danger" onClick={onDelete}>刪除</button></footer>
  </article>;
}

export function ColorCollectionEditor({ item, onClose }: { item: RuneStashColorCollectionItem | null; onClose: () => void }) {
  const addItem = useRuneStashStore((state) => state.addItem);
  const updateItem = useRuneStashStore((state) => state.updateItem);
  const [title, setTitle] = useState(item?.title || '');
  const [subtitle, setSubtitle] = useState(item?.note || '');
  const [tags, setTags] = useState(item?.tags.join(', ') || '');
  const [swatches, setSwatches] = useState<RuneStashColorSwatch[]>(item?.swatches || [freshSwatch()]);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  const valid = Boolean(title.trim()) && swatches.length > 0 && swatches.every((swatch) => swatch.name.trim() && VALID_HEX.test(swatch.hex));
  const patch = (id: string, next: Partial<RuneStashColorSwatch>) => setSwatches((current) => current.map((swatch) => swatch.id === id ? { ...swatch, ...next } : swatch));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const draft = { type: 'color_collection' as const, title, value: title, note: subtitle, tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), swatches };
    if (item) updateItem(item.id, draft); else addItem(draft);
    onClose();
  };
  return createPortal(<div className="stash-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="stash-dialog stash-collection-editor" role="dialog" aria-modal="true" aria-labelledby="collection-editor-title" onSubmit={save} data-pet-safe-region="critical">
      <header><div><span className="stash-eyebrow">COLOR COLLECTION</span><h2 id="collection-editor-title">{item ? '編輯配色集' : '新增配色集'}</h2></div><button type="button" className="stash-close" onClick={onClose} aria-label="關閉">×</button></header>
      <div className="stash-collection-editor__body">
        <label>名稱<input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>副標題 <small>選填</small><input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} /></label>
        <label>標籤 <small>選填，逗號分隔</small><input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
        <fieldset><legend>色票</legend>{swatches.map((swatch, index) => <div className="stash-swatch-editor" key={swatch.id}>
          <input type="color" aria-label={`色票 ${index + 1} 顏色`} value={VALID_HEX.test(swatch.hex) ? swatch.hex : '#DDEBF2'} onChange={(event) => patch(swatch.id, { hex: event.target.value.toUpperCase() })} />
          <label>名稱<input aria-label={`色票 ${index + 1} 名稱`} value={swatch.name} onChange={(event) => patch(swatch.id, { name: event.target.value })} /></label>
          <label>HEX<input aria-label={`色票 ${index + 1} HEX`} value={swatch.hex} onChange={(event) => patch(swatch.id, { hex: event.target.value.toUpperCase() })} /></label>
          <span className="stash-swatch-editor__order"><button type="button" disabled={index === 0} aria-label={`色票 ${index + 1} 上移`} onClick={() => setSwatches((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>↑</button><button type="button" disabled={index === swatches.length - 1} aria-label={`色票 ${index + 1} 下移`} onClick={() => setSwatches((current) => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}>↓</button></span>
          <button type="button" aria-label={`移除色票 ${index + 1}`} onClick={() => setSwatches((current) => current.filter(({ id }) => id !== swatch.id))}>移除</button>
        </div>)}</fieldset>
        <button type="button" className="stash-add-swatch" onClick={() => setSwatches((current) => [...current, freshSwatch()])}>＋ 新增色票</button>
      </div>
      <footer><button type="button" onClick={onClose}>取消</button><button type="submit" className="is-primary" disabled={!valid}>儲存</button></footer>
    </form>
  </div>, document.body);
}

export function ColorCollectionDetail({ item, onClose, onEdit }: { item: RuneStashColorCollectionItem; onClose: () => void; onEdit: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const title = useMemo(() => item.title || item.value, [item]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  const copy = async (swatch: RuneStashColorSwatch) => {
    await navigator.clipboard.writeText(swatch.hex);
    setCopied(swatch.id);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 900);
  };
  const copyExport = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setActionsOpen(false);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 900);
  };
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([serializeColorCollection(item)], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = colorCollectionFilename(item);
    anchor.click();
    queueMicrotask(() => URL.revokeObjectURL(url));
    setCopied('json');
    setActionsOpen(false);
  };
  return createPortal(<div className="stash-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="stash-collection-detail" role="dialog" aria-modal="true" aria-labelledby="collection-detail-title" data-pet-safe-region="critical">
      <header><div><span className="stash-eyebrow">PALETTE BOARD</span><h2 id="collection-detail-title">{title}</h2>{item.note && <p>{item.note}</p>}</div><div className="stash-collection-detail__actions"><button type="button" onClick={onEdit}>編輯</button><div className="stash-export-wrap"><button type="button" aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)}>匯出 / 分享</button>{actionsOpen && <div className="stash-export-menu" role="menu" aria-label="匯出與分享"><button type="button" role="menuitem" onClick={() => void copyExport('hex', colorCollectionHexList(item))}>複製全部 HEX</button><button type="button" role="menuitem" onClick={() => void copyExport('css', colorCollectionCssVariables(item))}>複製 CSS Variables</button><button type="button" role="menuitem" onClick={() => void copyExport('markdown', colorCollectionMarkdown(item))}>複製 Markdown</button><button type="button" role="menuitem" onClick={downloadJson}>匯出 JSON</button></div>}</div><button type="button" className="stash-close" onClick={onClose} aria-label="關閉">×</button></div></header>
      <div className="stash-collection-board">{item.swatches.map((swatch) => <article key={swatch.id} style={{ background: swatch.hex, color: foregroundFor(swatch.hex) }}>
        <div><strong>{swatch.name}</strong><button type="button" onClick={() => copy(swatch)} aria-label={`複製 ${swatch.name} ${swatch.hex}`}><code>{swatch.hex}</code></button></div>
      </article>)}</div>
      <p className="stash-collection-copy-feedback" aria-live="polite">{copied === 'json' ? '✓ 已匯出' : copied ? '✓ 已複製' : '\u00a0'}</p>
    </section>
  </div>, document.body);
}

export function ColorCollectionImportDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const addItem = useRuneStashStore((state) => state.addItem);
  const [importedDocument, setImportedDocument] = useState<RuneColorCollectionDocument | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { fileRef.current?.focus(); const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  const selectFile = async (file?: File) => {
    setImportedDocument(null); setError('');
    if (!file) return;
    if (file.size > RUNE_COLOR_COLLECTION_MAX_FILE_BYTES) { setError('檔案過大，請選擇 256 KB 以下的 Rune 色卡集。'); return; }
    if (!file.name.toLowerCase().endsWith('.json')) { setError('請選擇 Rune 色卡集 JSON 檔案。'); return; }
    try { setImportedDocument(parseColorCollectionDocument(await file.text())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '無法讀取色卡集。'); }
  };
  const save = () => {
    if (!importedDocument) return;
    const { collection } = importedDocument;
    const id = addItem({
      type: 'color_collection', value: collection.title, title: collection.title,
      note: collection.subtitle, tags: collection.tags,
      swatches: collection.swatches.map((swatch) => ({ id: crypto.randomUUID(), ...swatch })),
    });
    onSaved(id);
  };
  return createPortal(<div className="stash-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="stash-dialog stash-collection-import" role="dialog" aria-modal="true" aria-labelledby="collection-import-title" data-pet-safe-region="critical">
      <header><div><span className="stash-eyebrow">RUNE COLORS</span><h2 id="collection-import-title">匯入色卡集</h2></div><button type="button" className="stash-close" onClick={onClose} aria-label="關閉">×</button></header>
      <div className="stash-collection-import__body">
        <label className="stash-import-picker">選擇 JSON 檔案<input ref={fileRef} type="file" accept="application/json,.json" onChange={(event) => { void selectFile(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
        {error && <p className="stash-field-error" role="alert">{error}</p>}
        {importedDocument && <section className="stash-import-preview" aria-label="匯入預覽"><span className="stash-eyebrow">PREVIEW</span><h3>{importedDocument.collection.title}</h3>{importedDocument.collection.subtitle && <p>{importedDocument.collection.subtitle}</p>}<div>{importedDocument.collection.swatches.map((swatch, index) => <span key={`${swatch.name}-${index}`} title={`${swatch.name} ${swatch.hex}`} style={{ background: swatch.hex }} />)}</div><small>{importedDocument.collection.swatches.length} 色{importedDocument.collection.tags.length ? ` · ${importedDocument.collection.tags.map((tag) => `#${tag}`).join(' ')}` : ''}</small></section>}
      </div>
      <footer><button type="button" onClick={onClose}>取消</button><button type="button" className="is-primary" disabled={!importedDocument} onClick={save}>儲存</button></footer>
    </section>
  </div>, document.body);
}
