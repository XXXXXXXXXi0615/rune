import { useMemo, useState } from 'react';
import { BoardEditor } from '@/components/home/HomeCompanionBoard';
import { useCompanionBoardStore, type BoardItem, type BoardItemType } from '@/store/useCompanionBoardStore';
import { MoonBroadcastTicker } from './MoonBroadcastTicker';
import './MomentsBoardProjections.css';

function stamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Message Board projection inside 朋友圈 — presentation only.
 *  Data keeps living in the canonical companion board store; nothing is
 *  copied, no new schema, no new store. */
export function MomentsBoardProjections() {
  const boardItems = useCompanionBoardStore((state) => state.boardItems);
  const [editor, setEditor] = useState<{ type: BoardItemType; item?: BoardItem } | null>(null);

  const recent = useMemo(() => [...boardItems]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6), [boardItems]);

  const openItem = (item: BoardItem) => setEditor({ type: item.type, item });

  return <section className="moments-board" data-testid="moments-board" aria-label="留言板">
    <MoonBroadcastTicker onOpenItem={openItem} />

    <div className="moments-board__actions">
      <button
        type="button"
        className="moments-board__add"
        data-testid="moments-board-add"
        onClick={() => setEditor({ type: 'mixed' })}
        data-pet-safe-region="interactive"
      >
        ＋ 留言
      </button>
    </div>

    {recent.length > 0 && <div className="moments-board__recent" data-testid="moments-board-recent">
      {recent.map((item) => <article
        key={item.id}
        className={`moments-board-card is-${item.type}`}
        data-board-item-id={item.id}
        data-board-item-type={item.type}
      >
        {item.imageUrl && <div className="moments-board-card__image" data-has-alpha={item.hasAlpha === true ? 'true' : 'false'} data-mime-type={item.mimeType}>
          <img src={item.imageUrl} alt={item.title || '留言圖片'} />
        </div>}
        <div className="moments-board-card__body">
          <h3>{item.title || '未命名留言'}</h3>
          {item.note && <p>{item.note}</p>}
          <small>{stamp(item.createdAt)}</small>
          <button type="button" className="moments-board-card__open" onClick={() => openItem(item)}>查看</button>
        </div>
      </article>)}
    </div>}

    {editor && <BoardEditor type={editor.type} item={editor.item} onClose={() => setEditor(null)} />}
  </section>;
}
