import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCompanionBoardStore, getBoardStorageSize, type BoardItem, type BoardItemType } from '@/store/useCompanionBoardStore';
import { useToastStore } from '@/store/useToastStore';
import { processBoardImage } from '@/features/home/boardImageProcessing';
import './HomeCompanionBoard.css';

const ITEM_LABEL: Record<BoardItemType, string> = { image: '圖片卡', note: '便箋', mixed: '圖文卡片' };

export function BoardEditor({ type, item, onClose }: { type: BoardItemType; item?: BoardItem; onClose: () => void }) {
  const addBoardItem = useCompanionBoardStore((state) => state.addBoardItem);
  const updateBoardItem = useCompanionBoardStore((state) => state.updateBoardItem);
  const showToast = useToastStore((state) => state.showToast);
  const [title, setTitle] = useState(item?.title ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [mimeType, setMimeType] = useState(item?.mimeType ?? '');
  const [hasAlpha, setHasAlpha] = useState(item?.hasAlpha);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const supportsImage = type === 'image' || type === 'mixed';
  const needsImage = type === 'image';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickImage = useCallback(async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const processed = await processBoardImage(file);
      setImageUrl(processed.imageUrl);
      setMimeType(processed.mimeType);
      setHasAlpha(processed.hasAlpha);
    }
    finally { setBusy(false); }
  }, []);

  const submit = useCallback(() => {
    if (needsImage && !imageUrl) return;
    if (!title.trim() && !note.trim() && !imageUrl) return;
    const payload = { type, title: title.trim(), note: note.trim(), imageUrl: imageUrl || undefined, mimeType: imageUrl ? mimeType || undefined : undefined, hasAlpha: imageUrl ? hasAlpha : undefined };
    if (item) updateBoardItem(item.id, payload);
    else addBoardItem(payload);
    const usedMB = getBoardStorageSize() / 1024 / 1024;
    showToast(item ? '留言已更新' : `${ITEM_LABEL[type]}已加入`);
    if (usedMB > 4) window.setTimeout(() => showToast(`留言板已使用 ${Math.round(usedMB)}MB，建議清理舊圖片`), 700);
    onClose();
  }, [addBoardItem, hasAlpha, imageUrl, item, mimeType, needsImage, note, onClose, showToast, title, type, updateBoardItem]);

  return createPortal(
    <div className="companion-board-editor__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="companion-board-editor" role="dialog" aria-modal="true" aria-labelledby="companion-board-editor-title" data-pet-safe-region="interactive">
        <header>
          <div><small>MEMO BOARD</small><h2 id="companion-board-editor-title">{item ? '編輯留言' : `新增${ITEM_LABEL[type]}`}</h2></div>
          <button type="button" onClick={onClose} aria-label="關閉編輯器">×</button>
        </header>
        <div className="companion-board-editor__fields">
          <label>標題<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={48} placeholder="寫一個短標題" /></label>
          <label>內容<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={5} placeholder="留下一段話…" /></label>
          {supportsImage && <div className="companion-board-editor__image-field">
            <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(event) => { void pickImage(event.target.files?.[0]); event.target.value = ''; }} />
            {imageUrl ? <div className="companion-board-editor__preview" data-image-loaded="true" data-image-mime={mimeType} data-has-alpha={hasAlpha === true ? 'true' : 'false'}>
              <img src={imageUrl} alt="卡片圖片預覽" />
              <span className="companion-board-editor__image-status">圖片已載入 · {mimeType.replace('image/', '').toUpperCase()}{hasAlpha ? ' · 透明背景' : ''}</span>
              <div className="companion-board-editor__image-actions"><button type="button" onClick={() => fileRef.current?.click()}>更換圖片</button><button type="button" onClick={() => { setImageUrl(''); setMimeType(''); setHasAlpha(undefined); }}>移除圖片</button></div>
            </div> : <button type="button" className="companion-board-editor__picker" onClick={() => fileRef.current?.click()}>＋ 選擇 PNG、WebP 或 JPEG</button>}
          </div>}
        </div>
        <footer><button type="button" onClick={onClose}>取消</button><button type="button" className="is-primary" disabled={busy || (needsImage && !imageUrl) || (!title.trim() && !note.trim() && !imageUrl)} onClick={submit}>{busy ? '處理圖片中…' : item ? '儲存變更' : '加入留言板'}</button></footer>
      </section>
    </div>,
    document.body,
  );
}

function AddMenu({ onSelect, onClose }: { onSelect: (type: BoardItemType) => void; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) onClose(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onPointer); window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return <div ref={menuRef} className="companion-board-add-menu" role="menu" aria-label="新增留言板項目" data-pet-safe-region="interactive">
    {(['image', 'note', 'mixed'] as const).map((type) => <button key={type} type="button" role="menuitem" onClick={() => onSelect(type)}><span aria-hidden="true">{type === 'image' ? '▧' : type === 'note' ? '≡' : '▣'}</span>{type === 'image' ? '新增圖片' : type === 'note' ? '新增便箋' : '新增圖文卡片'}</button>)}
  </div>;
}

function BoardCard({ item, index, total, onEdit }: { item: BoardItem; index: number; total: number; onEdit: () => void }) {
  const togglePinned = useCompanionBoardStore((state) => state.toggleBoardItemPinned);
  const deleteItem = useCompanionBoardStore((state) => state.deleteBoardItem);
  const moveItem = useCompanionBoardStore((state) => state.moveBoardItem);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  return <article className={`companion-board-card is-${item.type}${item.pinned ? ' is-pinned' : ''}`} data-board-item-id={item.id} data-board-item-type={item.type} style={{ '--card-rotation': `${((item.id.charCodeAt(0) % 5) - 2) * .45}deg` } as React.CSSProperties}>
    <span className="companion-board-card__pin" aria-hidden="true" />
    <div className="companion-board-card__menu-wrap" ref={menuRef}>
      <button type="button" className="companion-board-card__more" aria-label={`操作：${item.title || ITEM_LABEL[item.type]}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>•••</button>
      {menuOpen && <div className="companion-board-card__menu" role="menu">
        <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }}>編輯</button>
        <button type="button" role="menuitem" onClick={() => { togglePinned(item.id); setMenuOpen(false); }}>{item.pinned ? '取消釘選' : '釘選'}</button>
        <button type="button" role="menuitem" disabled={index === 0} onClick={() => { moveItem(item.id, -1); setMenuOpen(false); }}>往前移</button>
        <button type="button" role="menuitem" disabled={index === total - 1} onClick={() => { moveItem(item.id, 1); setMenuOpen(false); }}>往後移</button>
        <button type="button" role="menuitem" className="is-danger" onClick={() => { if (window.confirm('刪除這則留言？刪除後無法復原。')) deleteItem(item.id); }}>刪除</button>
      </div>}
    </div>
    {item.imageUrl && <div className="companion-board-card__image" data-has-alpha={item.hasAlpha === true ? 'true' : 'false'} data-mime-type={item.mimeType}><img src={item.imageUrl} alt="" /></div>}
    <div className="companion-board-card__body">
      <small>{ITEM_LABEL[item.type]}{item.pinned ? ' · 已釘選' : ''}</small>
      <h3>{item.title || '未命名留言'}</h3>
      {item.note && <p>{item.note}</p>}
    </div>
  </article>;
}

export function HomeCompanionBoard() {
  const boardItems = useCompanionBoardStore((state) => state.boardItems);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editor, setEditor] = useState<{ type: BoardItemType; item?: BoardItem } | null>(null);

  const startAdd = (type: BoardItemType) => { setAddMenuOpen(false); setEditor({ type }); };

  return <section className="home-companion-board" aria-label="Memo Board 留言板" data-testid="companion-board">
    <div className="companion-board-workspace">
      {boardItems.length === 0 ? <div className="companion-board-empty">
        <span aria-hidden="true">✦</span><h2>還沒有留言</h2><p>放一張圖片，或留一句只給自己看的話。</p>
        <button type="button" onClick={() => setAddMenuOpen(true)}>＋ 新增第一則</button>
      </div> : <div className="companion-board-grid">{boardItems.map((item, index) => <BoardCard key={item.id} item={item} index={index} total={boardItems.length} onEdit={() => setEditor({ type: item.type, item })} />)}</div>}

      <div className="companion-board-add-anchor">
        <button type="button" className="companion-board-add" aria-label="新增留言板項目" aria-haspopup="menu" aria-expanded={addMenuOpen} onClick={() => setAddMenuOpen((open) => !open)} data-pet-safe-region="interactive">＋</button>
        {addMenuOpen && <AddMenu onSelect={startAdd} onClose={() => setAddMenuOpen(false)} />}
      </div>
    </div>
    {editor && <BoardEditor type={editor.type} item={editor.item} onClose={() => setEditor(null)} />}
  </section>;
}
