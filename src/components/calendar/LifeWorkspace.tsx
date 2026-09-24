import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LIFE_LEDGER_CHANGED_EVENT } from '@/features/integration/appEntityReference';
import { loadLifeLedgerReadModel, type LifeLedgerReadModel } from '@/features/lifeLedger/readModel';
import type { LifeLedgerEntry } from '@/features/lifeLedger/domain';
import { ObjectMemoryEditor } from '@/pages/ObjectMemoryEditor';
import { deriveItemLifecycleCounts, visibleItemEntries } from './lifeUtilityContent';

const ITEM_STATE_LABEL: Record<string, string> = {
  active: '使用中',
  idle: '閒置',
  aging: '漸老',
  farewell: '告別期',
  retired: '已退役',
};

function recentItems(entries: LifeLedgerEntry[]): LifeLedgerEntry[] {
  return visibleItemEntries(entries)
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 3);
}

function LifeSummary({ model }: { model: LifeLedgerReadModel }) {
  const counts = useMemo(() => deriveItemLifecycleCounts(model.itemEntries), [model.itemEntries]);
  return <dl className="compact-life-summary" aria-label="物品生命週期摘要">
    <div><dt>使用中</dt><dd>{counts.active}</dd></div>
    <div><dt>漸老</dt><dd>{counts.aging}</dd></div>
    <div><dt>告別期</dt><dd>{counts.farewell}</dd></div>
  </dl>;
}

function ItemList({ entries }: { entries: LifeLedgerEntry[] }) {
  const items = useMemo(() => recentItems(entries), [entries]);
  return <ol className="compact-life-list" aria-label="最近物品">
    {items.map((entry) => <li key={entry.id}>
      <Link to={`/objects/${entry.source.legacyId.replace(/^object-memory:/, '') || entry.id}`}>
        <strong>{entry.title}</strong>
        <span>{ITEM_STATE_LABEL[entry.item!.lifecycleState] ?? entry.item!.lifecycleState} · {entry.item!.usageDays ?? 0} 天</span>
      </Link>
    </li>)}
  </ol>;
}

/** Calendar > 生活 is a compact read projection. Item writes remain owned by
 * canonicalItemStore/Life Ledger; receipts and finance are not re-owned here. */
export function LifeWorkspace() {
  const [model, setModel] = useState<LifeLedgerReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    void loadLifeLedgerReadModel()
      .then(setModel)
      .catch(() => setModel(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(LIFE_LEDGER_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(LIFE_LEDGER_CHANGED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const items = model ? visibleItemEntries(model.itemEntries) : [];

  return <div className="compact-life-window" data-testid="life-workspace">
    <section className="compact-life-content" aria-labelledby="compact-life-title">
      <header className="compact-life-heading">
        <span>LIFE CYCLE</span>
        <h3 id="compact-life-title">生命週期</h3>
      </header>

      {loading ? <p className="compact-life-status">正在讀取物品記錄…</p> : !model ? (
        <p className="compact-life-status">暫時無法讀取物品記錄。</p>
      ) : (
        <>
          <LifeSummary model={model} />
          {items.length ? <ItemList entries={model.itemEntries} /> : (
            <div className="compact-life-empty">
              <strong>尚未收錄任何物品。</strong>
              <p>拍下第一件想記住的物品。</p>
            </div>
          )}
        </>
      )}

      <footer className="compact-life-actions">
        <button type="button" className="is-primary" onClick={() => setEditorOpen(true)}>＋ 加入物品</button>
        {items.length > 0 && <Link to="/objects/archive">查看全部檔案</Link>}
      </footer>
    </section>

    {editorOpen && <ObjectMemoryEditor
      onClose={() => setEditorOpen(false)}
      onSaved={() => {
        setEditorOpen(false);
        refresh();
      }}
    />}
  </div>;
}
