import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMoonReadStore } from '@/features/moonread/useMoonReadStore';
import { useAppStore, selectAgentDisplayName } from '@/store/useAppStore';
import { loadMoonReadFile } from '@/features/moonread/assetHelper';
import { parseEpub } from '@/features/moonread/epubParser';
import { hashMoonReadText, MOONREAD_PARSER_VERSION, normalizeHtmlBlocks, normalizeTextBlocks, type MoonReadBlock } from '@/features/moonread/contentModel';
import { useMeasuredPagination } from '@/features/moonread/useMeasuredPagination';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import type { EpubChapter } from '@/features/moonread/types';
import type { EpubResourceResolver } from '@/features/moonread/epub/EpubResourceResolver';
import '@/styles/moonread.css';

export function MoonReadReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const agentName = selectAgentDisplayName(useAppStore((s) => s.partner));
  const books = useMoonReadStore((s) => s.books);
  const allAnnotations = useMoonReadStore((s) => s.annotations);
  const book = useMemo(() => books.find((item) => item.id === bookId), [books, bookId]);
  const annotations = useMemo(() => allAnnotations.filter((a) => a.bookId === bookId), [allAnnotations, bookId]);
  const updateSession = useMoonReadStore((s) => s.updateSession);
  const addAnnotation = useMoonReadStore((s) => s.addAnnotation);
  const focusStatus = useFocusSessionStore((s) => s.status);
  const [chapters, setChapters] = useState<EpubChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [blocks, setBlocks] = useState<MoonReadBlock[]>([]);
  const [fontSize, setFontSize] = useState(17);
  const [pageIndex, setPageIndex] = useState(0);
  const [mobile, setMobile] = useState(() => innerWidth < 700);
  const [showNotes, setShowNotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const resolver = useRef<EpubResourceResolver | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => setMobile(innerWidth < 700);
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);
  useEffect(() => { document.body.classList.add('moonread-reader-active'); return () => document.body.classList.remove('moonread-reader-active'); }, []);

  useEffect(() => {
    if (!book) return;
    useMoonReadStore.getState().openBook(book.id);
    loadMoonReadFile(book.sourceAssetId || book.assetId).then(async ({ blob, text }) => {
      if (book.format === 'epub' && blob) {
        const parsed = await parseEpub(new File([blob], book.fileName, { type: 'application/epub+zip' }));
        resolver.current = parsed.resolver;
        setChapters(parsed.chapters);
        const saved = useMoonReadStore.getState().sessions[book.id];
        const nextChapter = params.get('position') === '0' ? 0 : Math.min(saved?.sectionIndex || 0, Math.max(0, parsed.chapters.length - 1));
        setChapterIndex(nextChapter);
        setBlocks(normalizeHtmlBlocks(parsed.chapters[nextChapter]?.html || ''));
      } else {
        setBlocks(normalizeTextBlocks(text || '', book.format === 'md'));
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : '無法載入書籍'));
    return () => resolver.current?.dispose();
  }, [book?.id]);

  const { pages, measureRef } = useMeasuredPagination(blocks, fontSize, mobile);
  const spread = mobile ? 1 : 2;
  const maxStart = Math.max(0, Math.ceil(pages.length / spread) * spread - spread);
  useEffect(() => setPageIndex((value) => Math.min(value, maxStart)), [maxStart, fontSize]);
  useEffect(() => { if (book && blocks.length) useMoonReadStore.getState().reanchorAnnotations(book.id, blocks); }, [book?.id, blocks]);

  const go = useCallback((direction: -1 | 1) => {
    const next = pageIndex + direction * spread;
    if (next >= 0 && next <= maxStart) { setPageIndex(next); return; }
    if (!chapters.length) return;
    const nextChapter = chapterIndex + direction;
    if (nextChapter < 0 || nextChapter >= chapters.length) return;
    setChapterIndex(nextChapter);
    setBlocks(normalizeHtmlBlocks(chapters[nextChapter].html));
    setPageIndex(direction > 0 ? 0 : 99999);
  }, [chapterIndex, chapters, maxStart, pageIndex, spread]);

  useEffect(() => {
    if (!book || !pages.length) return;
    const absolute = pageIndex;
    updateSession(book.id, absolute, pages.length, chapterIndex);
  }, [book?.id, chapterIndex, pageIndex, pages.length]);

  if (!book || error) return <div className="moonread-reader"><div className="moonread-reader-empty"><h2>{error || '找不到這本書'}</h2><button className="moonread-continue-btn" onClick={() => navigate('/moonread')}>返回書架</button></div></div>;

  const addNode = (kind: 'bookmark' | 'node-comment' | 'lunaris-note') => {
    const block = pages[pageIndex]?.find((item) => item.type !== 'image');
    const exactText = block ? block.text.slice(0, Math.min(24, block.text.length)) : `第 ${pageIndex + 1} 頁`;
    addAnnotation({ bookId: book.id, start: 0, end: exactText.length, quote: exactText, note: kind === 'node-comment' ? comment : '', colorIndex: kind === 'lunaris-note' ? 6 : 0, kind, locator: `${chapterIndex}:${pageIndex}`, anchor: block ? { chapterId: chapters[chapterIndex]?.id || 'document', stableBlockId: block.stableBlockId.split(':')[0], exactText, prefix: '', suffix: block.text.slice(exactText.length, exactText.length + 16), offsets: { start: 0, end: exactText.length }, parserVersion: MOONREAD_PARSER_VERSION, contentHash: hashMoonReadText(block.text) } : undefined });
    setComment('');
  };

  return <div className="moonread-reader" data-testid="moonread-reader" data-focus-active={focusStatus === 'running'}>
    <header className="moonread-reader-bar">
      <button className="moonread-reader-back" onClick={() => navigate('/moonread')}>‹ 書架</button>
      <div className="moonread-reader-heading"><strong>{mobile ? chapters[chapterIndex]?.title || '閱讀中' : book.title}</strong>{!mobile && <span>{chapters[chapterIndex]?.title || '閱讀中'}</span>}</div>
      <div className="moonread-reader-actions">
        {!mobile && <><button aria-label="縮小字體" onClick={() => setFontSize((v) => Math.max(13, v - 1))}>A−</button><button aria-label="放大字體" onClick={() => setFontSize((v) => Math.min(25, v + 1))}>A＋</button><button aria-label="共讀筆記" onClick={() => setShowNotes((v) => !v)}>批註</button></>}
        {mobile && <button className="moonread-reader-settings-btn" aria-label="閱讀設定" onClick={() => setShowSettings(true)}>Aa</button>}
      </div>
    </header>
    <main className="moonread-book-stage" onTouchStart={(e) => { const x = e.touches[0].clientX; touchX.current = x < 24 || x > innerWidth - 24 ? null : x; }} onTouchEnd={(e) => { if (touchX.current == null || showSettings || showNotes) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); touchX.current = null; }}>
      <button className="moonread-page-turn prev" onClick={() => go(-1)} aria-label="上一頁">‹</button>
      <div className={`moonread-open-book${mobile ? ' is-mobile' : ''}`} style={{ '--reader-font-size': `${fontSize}px` } as React.CSSProperties}>
        <ReaderPage blocks={pages[pageIndex] || []} number={pageIndex + 1} annotations={annotations} onCreateAnnotation={(block, exactText, offsets, prefix, suffix) => addAnnotation({ bookId: book.id, start: offsets.start, end: offsets.end, quote: exactText, note: `${agentName} 批註`, colorIndex: 6, kind: 'lunaris-note', locator: `${chapterIndex}:${pageIndex}`, anchor: { chapterId: chapters[chapterIndex]?.id || 'document', stableBlockId: block.stableBlockId.split(':')[0], exactText, prefix, suffix, offsets, parserVersion: MOONREAD_PARSER_VERSION, contentHash: hashMoonReadText(block.text) } })}/>
        {!mobile && <ReaderPage blocks={pages[pageIndex + 1] || []} number={Math.min(pages.length, pageIndex + 2)} right annotations={annotations} onCreateAnnotation={(block, exactText, offsets, prefix, suffix) => addAnnotation({ bookId: book.id, start: offsets.start, end: offsets.end, quote: exactText, note: `${agentName} 批註`, colorIndex: 6, kind: 'lunaris-note', locator: `${chapterIndex}:${pageIndex + 1}`, anchor: { chapterId: chapters[chapterIndex]?.id || 'document', stableBlockId: block.stableBlockId.split(':')[0], exactText, prefix, suffix, offsets, parserVersion: MOONREAD_PARSER_VERSION, contentHash: hashMoonReadText(block.text) } })}/>}
        <div ref={measureRef} className="moonread-paper moonread-page-measurer" aria-hidden="true" />
      </div>
      <button className="moonread-page-turn next" onClick={() => go(1)} aria-label="下一頁">›</button>
    </main>
    <footer className="moonread-reader-footer"><span>{pageIndex + 1}{!mobile && pages[pageIndex + 1] ? `–${pageIndex + 2}` : ''} / {pages.length}</span><span>{Math.round(book.progress * 100)}%</span></footer>
    {showNotes && <aside className="moonread-coreading-panel"><div><strong>共讀節點</strong><button onClick={() => setShowNotes(false)}>×</button></div><button onClick={() => addNode('bookmark')}>加入書籤</button><button onClick={() => addNode('lunaris-note')}>新增 {agentName} 批註</button><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="在這個閱讀節點留言…"/><button disabled={!comment.trim()} onClick={() => addNode('node-comment')}>儲存留言</button><small>本頁已有 {annotations.filter((a) => a.locator === `${chapterIndex}:${pageIndex}`).length} 則記錄</small>{annotations.some((annotation) => annotation.orphaned) && <section className="moonread-orphans"><strong>失去定位的批註</strong>{annotations.filter((annotation) => annotation.orphaned).map((annotation) => <div key={annotation.id}><q>{annotation.quote}</q><button onClick={() => { const block = pages[pageIndex]?.find((item) => item.type !== 'image'); if (!block || !annotation.anchor) return; useMoonReadStore.getState().updateAnnotation(annotation.id, { orphaned:false, anchor:{...annotation.anchor,stableBlockId:block.stableBlockId.split(':')[0],contentHash:hashMoonReadText(block.text),offsets:{start:0,end:Math.min(annotation.anchor.exactText.length,block.text.length)}} }); }}>重新附著到目前頁</button></div>)}</section>}</aside>}
    {showSettings && <div className="moonread-settings-backdrop" onClick={() => setShowSettings(false)}><aside className="moonread-settings-sheet" role="dialog" aria-modal="true" aria-label="閱讀設定" onClick={(event) => event.stopPropagation()}><div className="moonread-settings-head"><strong>閱讀設定</strong><button onClick={() => setShowSettings(false)} aria-label="關閉閱讀設定">×</button></div><div className="moonread-settings-actions"><button aria-label="縮小字體" onClick={() => setFontSize((v) => Math.max(13, v - 1))}>A−</button><button aria-label="放大字體" onClick={() => setFontSize((v) => Math.min(25, v + 1))}>A＋</button><button onClick={() => { setShowSettings(false); setShowNotes(true); }}>批註</button><button onClick={() => addNode('bookmark')}>書籤</button><button disabled={!chapters.length}>目錄</button></div><p>目前第 {pageIndex + 1} / {pages.length} 頁</p></aside></div>}
  </div>;
}

function ReaderPage({ blocks, number, right = false, annotations, onCreateAnnotation }: { blocks: MoonReadBlock[]; number: number; right?: boolean; annotations: ReturnType<typeof useMoonReadStore.getState>['annotations']; onCreateAnnotation: (block: Extract<MoonReadBlock, {type:'paragraph'} | {type:'heading'}>, exactText:string, offsets:{start:number;end:number}, prefix:string, suffix:string)=>void }) {
  const agentName = selectAgentDisplayName(useAppStore((s) => s.partner));
  const handleSelection = () => {
    const selection = getSelection(); if (!selection || selection.isCollapsed) return;
    const element = selection.anchorNode?.parentElement?.closest<HTMLElement>('[data-block-id]'); if (!element) return;
    const block = blocks.find((item) => item.stableBlockId === element.dataset.blockId); if (!block || block.type === 'image') return;
    const exactText = selection.toString().trim(); if (exactText.length < 2) return;
    const start = Math.max(0, block.text.indexOf(exactText)); onCreateAnnotation(block, exactText, {start,end:start+exactText.length}, block.text.slice(Math.max(0,start-16),start), block.text.slice(start+exactText.length,start+exactText.length+16)); selection.removeAllRanges();
  };
  return <article className={`moonread-paper${right ? ' is-right' : ' moonread-reader-scroll'}`} data-reader-text onMouseUp={handleSelection}>{blocks.map((block, i) => block.type === 'image' ? <figure key={i} data-block-id={block.stableBlockId} className="moonread-image-page"><img src={block.src} alt={block.alt}/><figcaption>{block.alt}</figcaption></figure> : block.type === 'heading' ? <h2 key={i} data-block-id={block.stableBlockId}>{block.text}</h2> : <p key={i} data-block-id={block.stableBlockId}>{block.text}{annotations.some((a) => !a.orphaned && a.anchor?.stableBlockId === block.stableBlockId.split(':')[0]) && <button className="moonread-margin-mark" aria-label={`查看 ${agentName} 批註`} title={annotations.find((a) => a.anchor?.stableBlockId === block.stableBlockId.split(':')[0])?.note}>●</button>}</p>)}<span className="moonread-paper-number">{number}</span></article>;
}
