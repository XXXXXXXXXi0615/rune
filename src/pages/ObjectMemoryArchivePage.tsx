/**
 * ObjectMemoryArchivePage — Layer 2.
 *
 * Lists all objects with usage duration + lifecycle state. Supports filtering
 * by lifecycle state via URL query (?state=active|aging|farewell|retired).
 * No stock / quantity logic — only lifecycle.
 */
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useObjectMemoryStore } from '@/store/objectMemoryStore';
import type { ObjectLifecycleState } from '@/types';
import './ObjectMemoryPage.css';

const FILTERS: { key: 'all' | ObjectLifecycleState; label: string }[] = [
  { key: 'all',      label: '全部' },
  { key: 'active',   label: '使用中' },
  { key: 'aging',    label: '漸老' },
  { key: 'farewell', label: '告別期' },
  { key: 'retired',  label: '已退役' },
];

const STATE_LABEL: Record<ObjectLifecycleState, string> = {
  active: '使用中',
  aging: '漸老',
  farewell: '告別期',
  retired: '已退役',
};

function ArchiveThumb({ name, image }: { name: string; image?: string }) {
  if (image) return <div className="olm-archive-card-thumb"><img src={image} alt="" /></div>;
  return <div className="olm-archive-card-thumb">{name.charAt(0) || '物'}</div>;
}

function normalizeFilter(value: string | null): 'all' | ObjectLifecycleState {
  if (value === 'ending') return 'farewell';
  if (value === 'replaced') return 'retired';
  if (value === 'active' || value === 'aging' || value === 'farewell' || value === 'retired') return value;
  return 'all';
}

export function ObjectMemoryArchivePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const objects = useObjectMemoryStore((s) => s.objects);

  const activeFilter = normalizeFilter(params.get('state'));

  const filtered = useMemo(() => {
    const list = activeFilter === 'all' ? objects : objects.filter((o) => o.lifecycleState === activeFilter);
    // Sort: farewell > aging > active > retired, then by usageDays desc.
    const order: Record<ObjectLifecycleState, number> = { farewell: 0, aging: 1, active: 2, retired: 3 };
    return [...list].sort((a, b) => {
      const so = order[a.lifecycleState] - order[b.lifecycleState];
      if (so !== 0) return so;
      return b.usageDays - a.usageDays;
    });
  }, [objects, activeFilter]);

  const setFilter = (key: 'all' | ObjectLifecycleState) => {
    if (key === 'all') setParams({});
    else setParams({ state: key });
  };

  return (
    <section className="view olm-view">
      <button type="button" className="olm-page-back" onClick={() => navigate('/objects')}>
        ← Dashboard
      </button>

      <div className="settings-page-heading" style={{ marginBottom: 14 }}>
        <Header eyebrow="物品生命檔案" title="全部檔案" />
      </div>

      <div className="olm-archive-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`olm-archive-filter${activeFilter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="olm-archive-list">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              className="olm-archive-card"
              onClick={() => navigate(`/objects/${o.id}`)}
            >
              <ArchiveThumb name={o.name} image={o.image} />
              <div className="olm-archive-card-body">
                <div className="olm-archive-card-top">
                  <span className="olm-archive-card-name">{o.name}</span>
                  <span className={`olm-state-badge olm-state--${o.lifecycleState}`}>{STATE_LABEL[o.lifecycleState]}</span>
                </div>
                <div className="olm-archive-card-meta">
                  <span className="olm-archive-card-cat">{o.category}</span>
                  <span>{o.usageDays} 天</span>
                  <span>·</span>
                  <span>{o.usageLogs.length} 則記錄</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 && (
        <div className="olm-empty">
          <strong>{objects.length === 0 ? '尚未建立任何物品記憶' : '此分類沒有物品'}</strong>
          <span>{objects.length === 0 ? '回到 Dashboard 收錄第一件物品。' : '切換分類查看其他物品。'}</span>
        </div>
      )}
    </section>
  );
}
