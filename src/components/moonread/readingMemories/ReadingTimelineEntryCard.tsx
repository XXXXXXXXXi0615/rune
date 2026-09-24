import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';
import type { MoonReadBook } from '@/features/moonread/types';
import type { ReadingBoardMode, ReadingTimelineEntry } from '@/features/moonread/readingMemories/types';

export function ReadingTimelineEntryCard({ entry, book, mode, onEdit, onOpen }: { entry: ReadingTimelineEntry; book?: MoonReadBook; mode: ReadingBoardMode; onEdit(): void; onOpen(): void }) {
  const coverUrl = useAssetBlobUrl(entry.coverAssetId || book?.coverAssetId);
  const date = new Date(entry.date);
  const content = <><div className="rm-entry-date"><b>{String(date.getDate()).padStart(2, '0')}</b><span>{date.toLocaleDateString('zh-TW', { month: 'short', year: 'numeric' })}</span></div><div className="rm-entry-cover">{coverUrl ? <img src={coverUrl} alt="" /> : <span>{entry.title.slice(0, 1)}</span>}</div><div className="rm-entry-copy"><span className="rm-entry-kicker">{entry.moodTag || '靜靜讀過'}</span><h3>{entry.title}</h3><p className="rm-entry-author">{entry.author || '未知作者'}{entry.chapterTitle ? ` · ${entry.chapterTitle}` : ''}</p>{entry.excerpt && <p className="rm-entry-note">{entry.excerpt}</p>}</div><span className="rm-entry-chevron" aria-hidden>›</span></>;
  if (mode === 'reading' && entry.bookId) return <button className="rm-entry-card" onClick={onOpen}>{content}</button>;
  return <article className="rm-entry-card" onDoubleClick={mode === 'edit' ? onEdit : undefined}>{content}</article>;
}
