import type { ReadingBoardDecoration, ReadingBoardMode } from '@/features/moonread/readingMemories/types';
import { TransformableReadingImage } from './TransformableReadingImage';

export function ReadingDecorationLayer({ items, scale, mode, selectedId, onSelect, onDraft, onCommit, onGuides, onLongPress }: {
  items: ReadingBoardDecoration[];
  scale: number;
  mode: ReadingBoardMode;
  selectedId: string | null;
  onSelect(id: string): void;
  onDraft(item: ReadingBoardDecoration): void;
  onCommit(item: ReadingBoardDecoration): void;
  onGuides(guides: { x?: number; y?: number }): void;
  onLongPress(id: string): void;
}) {
  return <div className={`rm-decoration-layer is-${mode}`}>{[...items].sort((a, b) => a.zIndex - b.zIndex).map((item) => (
    <TransformableReadingImage key={item.id} item={item} scale={scale} selected={selectedId === item.id} editable={mode === 'edit'} onSelect={() => onSelect(item.id)} onDraft={onDraft} onCommit={onCommit} onGuides={onGuides} onLongPress={() => onLongPress(item.id)} />
  ))}</div>;
}
