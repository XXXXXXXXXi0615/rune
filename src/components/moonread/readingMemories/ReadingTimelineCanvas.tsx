import { useNavigate } from 'react-router-dom';
import { useMoonReadStore } from '@/features/moonread/useMoonReadStore';
import type { ReadingBoardDecoration, ReadingBoardMode, ReadingMemoryBoard } from '@/features/moonread/readingMemories/types';
import { ReadingDecorationLayer } from './ReadingDecorationLayer';
import { ReadingTimelineEntryCard } from './ReadingTimelineEntryCard';

export function ReadingTimelineCanvas({ board, scale, mode, selectedId, draftItems, onSelect, onAddEntry, onEditEntry, onDraft, onCommit, guides, onGuides, onLongPress }: { board: ReadingMemoryBoard; scale: number; mode: ReadingBoardMode; selectedId: string | null; draftItems: Record<string, ReadingBoardDecoration>; onSelect(id: string | null): void; onAddEntry(): void; onEditEntry(id: string): void; onDraft(item: ReadingBoardDecoration): void; onCommit(item: ReadingBoardDecoration): void; guides: { x?: number; y?: number }; onGuides(g: { x?: number; y?: number }): void; onLongPress(id: string): void }) {
  const books = useMoonReadStore((state) => state.books);
  const navigate = useNavigate();
  const items = board.imageLayers.map((item) => draftItems[item.id] || item);
  return <div className={`rm-canvas is-${mode}`} data-testid="reading-memory-canvas" style={{ width: board.designWidth, height: board.designHeight }} onPointerDown={(event) => { if (event.target === event.currentTarget) onSelect(null); }}>
    <div className="rm-paper-grid" aria-hidden />
    <div className="rm-safe-area" />
    <header className="rm-canvas-heading"><span>MOONREAD · READING MEMORIES</span><h1>{board.title}</h1><p>{board.subtitle}</p></header>
    <div className="rm-timeline-line" />
    <section className="rm-timeline-entries">{[...board.entries].sort((a, b) => a.order - b.order || a.date - b.date).map((entry) => <ReadingTimelineEntryCard key={entry.id} entry={entry} book={books.find((book) => book.id === entry.bookId)} mode={mode} onEdit={() => onEditEntry(entry.id)} onOpen={() => entry.bookId && navigate(`/moonread/read/${entry.bookId}`)} />)}</section>
    {mode === 'edit' && <button className="rm-add-entry-on-canvas" data-testid="add-reading-entry-canvas" onClick={onAddEntry}>＋ 新增閱讀紀錄</button>}
    <footer className="rm-canvas-footer"><span>Books become tides. Memories become shorelines.</span><i /></footer>
    <ReadingDecorationLayer items={items} scale={scale} mode={mode} selectedId={selectedId} onSelect={onSelect} onDraft={onDraft} onCommit={onCommit} onGuides={onGuides} onLongPress={onLongPress} />
    {guides.x !== undefined && <i className="rm-guide rm-guide-x" style={{ left: guides.x }} />}{guides.y !== undefined && <i className="rm-guide rm-guide-y" style={{ top: guides.y }} />}
  </div>;
}
