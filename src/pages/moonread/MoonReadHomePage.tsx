import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n';
import { useMoonReadStore } from '@/features/moonread/useMoonReadStore';
import { formatMoonReadWordCount, estimateMoonReadReadMinutes, loadMoonReadCover } from '@/features/moonread/assetHelper';
import { saveMoonReadCover } from '@/features/moonread/assetHelper';
import { BookshelfContextMenu } from '@/components/moonread/BookshelfContextMenu';
import { RemoveBookDialog } from '@/components/moonread/RemoveBookDialog';
import type { MoonReadBook } from '@/features/moonread/types';
import { useModalStore } from '@/store/useModalStore';
import { useDrawerStore } from '@/store/useDrawerStore';
import '@/styles/moonread.css';

type SortMode = 'recent' | 'added' | 'title';
type LibraryFilter = 'all' | 'novel' | 'comic' | 'completed' | 'reading';

export function MoonReadHomePage() {
  const navigate = useNavigate();
  const books = useMoonReadStore((s) => s.books);
  const openBook = useMoonReadStore((s) => s.openBook);
  const removeBook = useMoonReadStore((s) => s.removeBook);
  const updateBook = useMoonReadStore((s) => s.updateBook);
  const importStatus = useMoonReadStore((s) => s.importStatus);
  const importingBook = useMoonReadStore((s) => s.importingBook);
  const activeModal = useModalStore((s) => s.activeModal);
  const activeSheet = useModalStore((s) => s.activeSheet);
  const activeDrawer = useDrawerStore((s) => s.activeDrawer);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverBookId, setCoverBookId] = useState<string | null>(null);
  const [view, setView] = useState<'covers' | 'spines'>('covers');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const comicInputRef = useRef<HTMLInputElement>(null);
  const comicImagesRef = useRef<HTMLInputElement>(null);
  const [comicProgress, setComicProgress] = useState('');
  const comicAbortRef = useRef<AbortController | null>(null);
  const [comicDraftFiles, setComicDraftFiles] = useState<File[]>([]);

  // Context menu state
  const [contextBook, setContextBook] = useState<MoonReadBook | null>(null);
  const [contextAnchorRect, setContextAnchorRect] = useState<DOMRect | null>(null);
  const [contextIsMobile, setContextIsMobile] = useState(false);

  // Remove dialog state
  const [removeBook_target, setRemoveBook_target] = useState<MoonReadBook | null>(null);

  // Edit dialog state
  const [editBook, setEditBook] = useState<MoonReadBook | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');

  const sortedBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Filter to only show active books
    const activeBooks = books.filter((b) => b.libraryState === 'active');
    const list = activeBooks.filter((b) => {
      if(filter==='novel' && b.documentKind==='comic') return false;
      if(filter==='comic' && b.documentKind!=='comic') return false;
      if(filter==='completed' && b.progress<1) return false;
      if(filter==='reading' && !(b.progress>0&&b.progress<1)) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
    return list.sort((a, b) => {
      if (sort === 'recent') return b.lastOpenedAt - a.lastOpenedAt;
      if (sort === 'added') return b.importedAt - a.importedAt;
      return a.title.localeCompare(b.title, 'zh-Hant');
    });
  }, [books, query, sort, filter]);
  const removedBooks = useMemo(() => books.filter((book) => book.libraryState === 'removed'), [books]);

  const continueBook = useMemo(() => {
    const activeBooks = books.filter((b) => b.libraryState === 'active');
    if (activeBooks.length === 0) return null;
    return [...activeBooks].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0];
  }, [books]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const importBook = useMoonReadStore.getState().importBook;
      const result = await importBook(file);
      if ('code' in result) {
        setImportError(result.message);
      } else {
        navigate(`/moonread/read/${result.book.id}`);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '匯入失敗');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleContinue = (book: MoonReadBook) => {
    navigate(`/moonread/book/${book.id}`);
  };

  // Context menu handlers
  const handleContextMenu = useCallback((book: MoonReadBook, rect: DOMRect, isMobile: boolean) => {
    setContextBook(book);
    setContextAnchorRect(rect);
    setContextIsMobile(isMobile);
  }, []);

  const handleContextAction = useCallback((actionId: string) => {
    if (!contextBook) return;

    switch (actionId) {
      case 'continue':
        openBook(contextBook.id);
        navigate(`/moonread/read/${contextBook.id}`);
        break;
      case 'restart':
        useMoonReadStore.getState().restartBook(contextBook.id);
        navigate(`/moonread/read/${contextBook.id}?position=0`);
        break;
      case 'wantlist':
        updateBook(contextBook.id, { wishlist: !(contextBook.wishlist ?? contextBook.tags.includes('wantlist')) });
        break;
      case 'favorite':
        updateBook(contextBook.id, { favorite: !(contextBook.favorite ?? contextBook.tags.includes('favorite')) });
        break;
      case 'mark-read':
        if (contextBook.progress >= 1) useMoonReadStore.getState().markUnread(contextBook.id);
        else useMoonReadStore.getState().markComplete(contextBook.id);
        break;
      case 'edit':
        setEditBook(contextBook);
        setEditTitle(contextBook.title);
        setEditAuthor(contextBook.author);
        break;
      case 'cover':
        setCoverBookId(contextBook.id);
        setTimeout(() => coverInputRef.current?.click());
        break;
      case 'reparse':
        // Implement reparse with data preservation
        handleReparse(contextBook);
        break;
      case 'remove':
        setRemoveBook_target(contextBook);
        break;
    }

    setContextBook(null);
  }, [contextBook, openBook, navigate, updateBook]);

  const handleRemoveConfirm = useCallback(async (keepData: boolean) => {
    if (!removeBook_target) return;

    if (keepData) {
      // Soft remove - keep data but hide from shelf
      useMoonReadStore.getState().softRemoveBook(removeBook_target.id);
    } else {
      // Permanent delete - remove all data
      try { await useMoonReadStore.getState().permanentDeleteBook(removeBook_target.id); }
      catch { setImportError('永久刪除失敗，書籍與引用已完整恢復。'); setRemoveBook_target(null); return; }
    }

    setRemoveBook_target(null);
  }, [removeBook_target]);

  const handleEditSave = useCallback(() => {
    if (!editBook) return;
    updateBook(editBook.id, { title: editTitle, author: editAuthor });
    setEditBook(null);
  }, [editBook, editTitle, editAuthor, updateBook]);

  const handleReparse = useCallback(async (book: MoonReadBook) => {
    try {
      const { loadMoonReadFile } = await import('@/features/moonread/assetHelper');
      const { blob, text } = await loadMoonReadFile(book.sourceAssetId || book.assetId);
      if (book.format === 'epub' && blob) {
        const { parseEpub } = await import('@/features/moonread/epubParser');
        const { normalizeHtmlBlocks } = await import('@/features/moonread/contentModel');
        const parsed = await parseEpub(new File([blob], book.fileName, { type: 'application/epub+zip' }));
        const reanchorBlocks = parsed.chapters.flatMap((chapter) => normalizeHtmlBlocks(chapter.html));
        parsed.resolver.dispose();
        updateBook(book.id, { title: parsed.manifest.metadata.title || book.title, author: parsed.manifest.metadata.creator || book.author, wordCount: parsed.chapters.reduce((sum, chapter) => sum + chapter.charCount, 0), importStatus: 'ready' });
        useMoonReadStore.getState().reanchorAnnotations(book.id, reanchorBlocks);
      } else if (text != null) {
        const { countMoonReadWords } = await import('@/features/moonread/importBook');
        const { normalizeTextBlocks } = await import('@/features/moonread/contentModel');
        updateBook(book.id, { wordCount: countMoonReadWords(text), importStatus: 'ready' });
        useMoonReadStore.getState().reanchorAnnotations(book.id, normalizeTextBlocks(text, book.format === 'md'));
      }
      setImportError(null);
    } catch {
      setImportError('重新解析失敗；原書籍、進度與批註均已保留。');
    }
  }, [updateBook]);

  const isImporting = importStatus !== 'idle' && importStatus !== 'ready' && importStatus !== 'failed' && importStatus !== 'duplicate';

  return (
    <div className="moonread-page" data-testid="moonread-bookshelf" data-overlay-snapshot={JSON.stringify({ activeModal, activeSheet, activeDrawer })}>
      <header className="moonread-header">
        <div>
          <h1>{t('moonread.title')}</h1>
          <p className="moonread-subtitle">{t('moonread.subtitle')}</p>
        </div>
        <div className="moonread-header-actions"><button
          type="button"
          className="moonread-import-btn"
          onClick={handleImportClick}
          disabled={isImporting}
          aria-label={t('moonread.import')}
        >
          {isImporting ? '匯入中…' : t('moonread.import')}
        </button><button type="button" className="moonread-comic-import-btn" onClick={()=>comicInputRef.current?.click()}>匯入漫畫（CBZ / ZIP）</button><button type="button" className="moonread-memories-link" onClick={() => navigate('/moonread/memories')}>共讀足跡</button></div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.epub"
          onChange={handleFileChange}
          className="sr-only"
          aria-hidden
        />
        <input ref={comicInputRef} type="file" accept=".cbz,.zip,application/zip" className="sr-only" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const controller=new AbortController();comicAbortRef.current=controller;try{setComicProgress('正在解壓…');const book=await useMoonReadStore.getState().importComic(file,{},p=>setComicProgress(`${p.stage==='extracting'?'解壓':'保存'} ${p.completed}/${p.total}${p.failed.length?` · ${p.failed.length} 頁失敗`:''}`),controller.signal);setComicProgress('');navigate(`/moonread/read/${book.id}`);}catch(error){setImportError(error instanceof Error?error.message:'漫畫導入失敗');setComicProgress('');}finally{comicAbortRef.current=null;}e.target.value='';}}/>
        <input ref={comicImagesRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={e=>{const files=[...(e.target.files||[])];if(files.length)setComicDraftFiles(files);e.target.value='';}}/>
      </header>
      {comicProgress&&<div className="moonread-toast" role="status">{comicProgress} <button onClick={()=>comicAbortRef.current?.abort()}>取消導入</button></div>}

      {importError && (
        <div className="moonread-toast" role="alert">
          {importError}
        </div>
      )}

      {/* Processing card */}
      {importingBook && (
        <div className="moonread-processing-card" data-testid="moonread-processing">
          <div className="moonread-processing-spinner" />
          <div className="moonread-processing-info">
            <span className="moonread-processing-status">正在整理這本書……</span>
            <span className="moonread-processing-name">{importingBook.fileName}</span>
          </div>
        </div>
      )}

      <section className="moonread-library">
        <div className="moonread-library-toolbar">
          <h2>{t('moonread.library')}</h2>
          <div className="moonread-search-sort">
            <select aria-label="書架篩選" value={filter} onChange={e=>setFilter(e.target.value as LibraryFilter)}><option value="all">全部</option><option value="novel">小說</option><option value="comic">漫畫</option><option value="completed">已讀</option><option value="reading">閱讀中</option></select>
            <div className="moonread-view-toggle"><button className={view === 'spines' ? 'active' : ''} onClick={() => setView('spines')}>書脊</button><button className={view === 'covers' ? 'active' : ''} onClick={() => setView('covers')}>封面</button></div>
            <input
              type="search"
              className="moonread-search"
              placeholder={t('moonread.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="moonread-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              aria-label="排序"
            >
              <option value="recent">{t('moonread.sortRecent')}</option>
              <option value="added">{t('moonread.sortAdded')}</option>
              <option value="title">{t('moonread.sortTitle')}</option>
            </select>
          </div>
        </div>

        {sortedBooks.length === 0 && !importingBook ? (
          <div className="moonread-empty">
            <div className="moonread-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3a9 9 0 1 0 9 9c0-4.5-4-8-9-9Z" />
                <path d="M12 6c2.5 1 4.5 3 5 6" opacity={0.72} />
                <path d="M7 14.5c1.5 2 4 3 6 2.5" opacity={0.72} />
              </svg>
            </div>
            <p className="moonread-empty-title">{t('moonread.empty')}</p>
            <p className="moonread-empty-hint">{t('moonread.emptyHint')}</p>
            <button
              type="button"
              className="moonread-import-btn"
              onClick={handleImportClick}
              disabled={isImporting}
            >
              {t('moonread.import')}
            </button>
          </div>
        ) : (
          <div className={`moonread-shelf-sections is-${view}`}>
            {[
              ['正在共讀', sortedBooks.filter((b) => b.progress > 0 && b.progress < 1 && useMoonReadStore.getState().annotations.some((a) => a.bookId === b.id))],
              ['最近閱讀', sortedBooks.filter((b) => b.progress > 0 && b.progress < 1).slice(0, 6)],
              ['我的書架', sortedBooks.filter((b) => !(b.wishlist ?? b.tags.includes('wantlist')) && b.progress < 1)],
              ['想讀清單', sortedBooks.filter((b) => b.wishlist ?? b.tags.includes('wantlist'))],
              ['已讀完', sortedBooks.filter((b) => b.progress >= 1)],
            ].map(([label, shelf]) => <section className="moonread-shelf-row" key={label as string}><div className="moonread-shelf-heading"><h3>{label as string}</h3><span>{(shelf as MoonReadBook[]).length} 本</span></div>{(shelf as MoonReadBook[]).length ? <div className="moonread-bookshelf" role="list" aria-label={label as string}>{(shelf as MoonReadBook[]).map((book) => <BookCard key={`${label}-${book.id}`} book={book} onOpen={() => handleContinue(book)} onContextMenu={handleContextMenu}/>)}</div> : <p className="moonread-shelf-empty">尚無書籍</p>}</section>)}
          </div>
        )}
        {removedBooks.length > 0 && <details className="moonread-removed-books"><summary>已移除書籍（{removedBooks.length}）</summary><ul>{removedBooks.map((book) => <li key={book.id}><span>{book.title} · {book.author}</span><button onClick={() => useMoonReadStore.getState().restoreBook(book.id)}>恢復至書架</button></li>)}</ul></details>}
      </section>
      <input ref={coverInputRef} className="sr-only" type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file || !coverBookId) return; const assetId = await saveMoonReadCover(file, books.find((b) => b.id === coverBookId)?.title || 'cover'); updateBook(coverBookId, { coverAssetId: assetId }); setCoverBookId(null); e.target.value = ''; }}/>

      {/* Context Menu */}
      {contextBook && (
        <BookshelfContextMenu
          book={contextBook}
          open={true}
          anchorRect={contextAnchorRect}
          isMobile={contextIsMobile}
          onClose={() => setContextBook(null)}
          onAction={handleContextAction}
          returnFocusRef={fileInputRef}
        />
      )}

      {/* Remove Dialog */}
      {removeBook_target && (
        <RemoveBookDialog
          book={removeBook_target}
          open={true}
          onClose={() => setRemoveBook_target(null)}
          onConfirm={handleRemoveConfirm}
        />
      )}

      {/* Edit Dialog */}
      {editBook && (
        <div className="moonread-dialog-backdrop" onClick={() => setEditBook(null)}>
          <div
            className="moonread-dialog"
            role="dialog"
            aria-label="編輯書籍資料"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <div className="moonread-dialog-header">
              <h3 className="moonread-dialog-title">編輯書籍資料</h3>
              <button
                type="button"
                className="moonread-dialog-close"
                onClick={() => setEditBook(null)}
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div className="moonread-dialog-body">
              <div className="moonread-dialog-field">
                <label className="moonread-dialog-label" htmlFor="edit-title">書名</label>
                <input
                  id="edit-title"
                  type="text"
                  className="moonread-dialog-input"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>

              <div className="moonread-dialog-field">
                <label className="moonread-dialog-label" htmlFor="edit-author">作者</label>
                <input
                  id="edit-author"
                  type="text"
                  className="moonread-dialog-input"
                  value={editAuthor}
                  onChange={e => setEditAuthor(e.target.value)}
                />
              </div>
            </div>

            <div className="moonread-dialog-footer">
              <button
                type="button"
                className="moonread-dialog-btn moonread-dialog-btn--cancel"
                onClick={() => setEditBook(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="moonread-dialog-btn moonread-dialog-btn--confirm"
                onClick={handleEditSave}
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
      {!!comicDraftFiles.length&&<ComicImageImportDialog files={comicDraftFiles} onClose={()=>setComicDraftFiles([])} onImport={async(files,options)=>{const controller=new AbortController();comicAbortRef.current=controller;try{setComicDraftFiles([]);const book=await useMoonReadStore.getState().importComicImages(files,options,p=>setComicProgress(`保存 ${p.completed}/${p.total}${p.failed.length?` · ${p.failed.length} 頁失敗`:''}`),controller.signal);setComicProgress('');navigate(`/moonread/read/${book.id}`);}catch(error){setImportError(error instanceof Error?error.message:'漫畫導入失敗');setComicProgress('');}finally{comicAbortRef.current=null;}}}/>}
    </div>
  );
}

function ComicImageImportDialog({files:initial,onClose,onImport}:{files:File[];onClose:()=>void;onImport:(files:File[],options:{title:string;direction:'ltr'|'rtl';mode:'single';coverIndex:number})=>void}){const [files,setFiles]=useState(initial);const [title,setTitle]=useState(initial[0]?.name.replace(/\.[^.]+$/,'')||'未命名漫畫');const [direction,setDirection]=useState<'ltr'|'rtl'>('ltr');const [cover,setCover]=useState(0);const move=(index:number,delta:number)=>{const target=index+delta;if(target<0||target>=files.length)return;setFiles(items=>{const next=[...items];[next[index],next[target]]=[next[target],next[index]];return next;});setCover(value=>value===index?target:value===target?index:value);};return <div className="moonread-dialog-backdrop"><div className="moonread-dialog comic-import-dialog" role="dialog" aria-label="導入漫畫圖片"><div className="moonread-dialog-header"><h3>導入漫畫圖片</h3><button onClick={onClose}>×</button></div><label>書名<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>閱讀方向<select value={direction} onChange={e=>setDirection(e.target.value as 'ltr'|'rtl')}><option value="ltr">左至右</option><option value="rtl">右至左</option></select></label><div className="comic-import-pages">{files.map((file,index)=><div key={`${file.name}-${file.lastModified}`}><ComicDraftPreview file={file}/><strong>{index+1}</strong><span>{file.name}</span><button disabled={index===0} onClick={()=>move(index,-1)}>上移</button><button disabled={index===files.length-1} onClick={()=>move(index,1)}>下移</button><button onClick={()=>setCover(index)}>{cover===index?'封面':'設為封面'}</button><button onClick={()=>setFiles(items=>items.filter((_,i)=>i!==index))}>刪除</button></div>)}</div><div className="moonread-dialog-footer"><button onClick={onClose}>取消</button><button disabled={!files.length||!title.trim()} onClick={()=>onImport(files,{title:title.trim(),direction,mode:'single',coverIndex:cover})}>開始導入</button></div></div></div>}
function ComicDraftPreview({file}:{file:File}){const url=useMemo(()=>URL.createObjectURL(file),[file]);useEffect(()=>()=>URL.revokeObjectURL(url),[url]);return <img src={url} alt=""/>}

interface BookCardProps {
  book: MoonReadBook;
  onOpen: () => void;
  onContextMenu: (book: MoonReadBook, rect: DOMRect, isMobile: boolean) => void;
}

function BookCard({ book, onOpen, onContextMenu }: BookCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      onContextMenu(book, rect, window.innerWidth < 768);
    }
  }, [book, onContextMenu]);

  const handleMoreClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = moreBtnRef.current?.getBoundingClientRect();
    if (rect) {
      onContextMenu(book, rect, window.innerWidth < 768);
    }
  }, [book, onContextMenu]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) {
        onContextMenu(book, rect, window.innerWidth < 768);
      }
    }
  }, [book, onContextMenu]);

  // Long press for mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (window.innerWidth >= 768) return;
    longPressTimer.current = setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) {
        onContextMenu(book, rect, true);
      }
    }, 500);
  }, [book, onContextMenu]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  return (
    <div
      ref={cardRef}
      className="moonread-book-card"
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="listitem"
      style={{ '--moonread-spine-width': `${46 + (book.title.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 23)}px` } as React.CSSProperties}
    >
      <button type="button" className="moonread-book-open" onClick={onOpen} aria-label={`${book.title} - ${book.author}`}>
      <div className="moonread-book-cover">
        <BookCover book={book} />
      </div>
      <div className="moonread-book-info">
        <h3 className="moonread-book-title">{book.title}</h3>
        <p className="moonread-book-author">{book.author}</p>
        <div className="moonread-book-meta-row">
          <span className="moonread-book-words">{book.documentKind==='comic'?`漫畫 · ${book.comic?.pageCount||0} 頁`:formatMoonReadWordCount(book.wordCount)}</span>
          <span className="moonread-book-time">{book.documentKind==='comic'?[book.comic?.series,book.comic?.volume&&`第 ${book.comic.volume} 卷`].filter(Boolean).join(' · '):`約 ${estimateMoonReadReadMinutes(book.wordCount)} 分鐘`}</span>
        </div>
        <div className="moonread-book-progress">
          <div
            className="moonread-book-progress-fill"
            style={{ width: `${book.progress * 100}%` }}
          />
        </div>
        {book.lastOpenedAt > 0 && (
          <span className="moonread-book-last-read">
            {formatRelativeTime(book.lastOpenedAt)}
          </span>
        )}
      </div>
      </button>
      <button
        ref={moreBtnRef}
        type="button"
        className="moonread-book-more"
        onClick={handleMoreClick}
        aria-label="更多操作"
        aria-haspopup="menu"
      >
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={12} cy={5} r={1.5} fill="currentColor" />
          <circle cx={12} cy={12} r={1.5} fill="currentColor" />
          <circle cx={12} cy={19} r={1.5} fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '剛才';
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (hours < 24) return `${hours} 小時前`;
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 週前`;
  return new Date(timestamp).toLocaleDateString('zh-TW');
}

function BookCover({ book }: { book: MoonReadBook }) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const initials = book.title.slice(0, 1) || '書';
  const hue = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < book.title.length; i++) {
      hash = book.title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }, [book.title]);

  useEffect(() => {
    if (!book.coverAssetId) return;

    let cancelled = false;
    loadMoonReadCover(book.coverAssetId)
      .then((blob) => {
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        setCoverUrl(url);
      })
      .catch(() => {
        // Silently fail, use fallback
      });

    return () => {
      cancelled = true;
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    };
  }, [book.coverAssetId]);

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt=""
        className="moonread-cover-img"
        loading="lazy"
      />
    );
  }

  return (
    <div
      className="moonread-cover"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 24%), hsl(${hue} 50% 12%))` }}
      aria-hidden="true"
    >
      <span className="moonread-cover-initial">{initials}</span>
    </div>
  );
}
