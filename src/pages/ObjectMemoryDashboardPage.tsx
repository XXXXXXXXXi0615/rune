/**
 * ObjectMemoryDashboardPage — Layer 1.
 *
 * Shows lifecycle status summaries. Counts represent lifecycle states
 * (active / aging / farewell / retired), NOT stock or quantities.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useObjectMemoryStore, getSummary } from '@/store/objectMemoryStore';
import { ObjectMemoryEditor } from './ObjectMemoryEditor';
import type { ObjectLifecycleState } from '@/types';
import './ObjectMemoryPage.css';

const STATE_LABEL: Record<ObjectLifecycleState, string> = {
  active: '使用中',
  aging: '漸老',
  farewell: '告別期',
  retired: '已退役',
};

function ObjectThumb({ name, image }: { name: string; image?: string }) {
  if (image) return <div className="olm-dash-item-thumb"><img src={image} alt="" /></div>;
  return <div className="olm-dash-item-thumb">{name.charAt(0) || '物'}</div>;
}

export function ObjectMemoryDashboardPage() {
  const navigate = useNavigate();
  const objects = useObjectMemoryStore((s) => s.objects);
  const [editorOpen, setEditorOpen] = useState(false);

  const summary = useMemo(() => getSummary(objects), [objects]);

  // Farewell list (state === 'farewell') — surfaced as the most actionable.
  const farewellObjects = useMemo(
    () => objects.filter((o) => o.lifecycleState === 'farewell').slice(0, 5),
    [objects],
  );
  // Recently active (state === 'active', newest first by createdAt).
  const activeOnes = useMemo(
    () => objects.filter((o) => o.lifecycleState === 'active').sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [objects],
  );

  return (
    <section className="view olm-view">
      <button type="button" className="olm-page-back" onClick={() => navigate('/')}>
        ← More
      </button>

      <div className="settings-page-heading" style={{ marginBottom: 14 }}>
        <Header eyebrow="物品生命檔案" title="生命週期總覽" />
      </div>

      {/* Summary cards */}
      <div className="olm-dash-grid">
        <button type="button" className="olm-dash-card olm-dash-card--farewell" onClick={() => navigate('/objects/archive?state=farewell')}>
          <div className="olm-dash-card-num">{summary.farewell}</div>
          <div className="olm-dash-card-label">告別期</div>
          <div className="olm-dash-card-hint">需要尋找替代品</div>
        </button>
        <button type="button" className="olm-dash-card olm-dash-card--active" onClick={() => navigate('/objects/archive?state=active')}>
          <div className="olm-dash-card-num">{summary.active}</div>
          <div className="olm-dash-card-label">使用中</div>
          <div className="olm-dash-card-hint">每日陪伴中</div>
        </button>
        <button type="button" className="olm-dash-card olm-dash-card--aging" onClick={() => navigate('/objects/archive?state=aging')}>
          <div className="olm-dash-card-num">{summary.aging}</div>
          <div className="olm-dash-card-label">漸老</div>
          <div className="olm-dash-card-hint">使用滿一年</div>
        </button>
      </div>

      {/* Replaced count as quiet footer */}
      <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', margin: '-6px 0 18px' }}>
        已退役 {summary.retired} 件 · 共 {summary.total} 件物品被記住
      </div>

      {/* Farewell — most actionable */}
      {farewellObjects.length > 0 && (
        <div className="olm-dash-section">
          <div className="olm-dash-section-title">
            <span>告別期</span>
            <button type="button" onClick={() => navigate('/objects/archive?state=farewell')}>查看全部</button>
          </div>
          {farewellObjects.map((o) => (
            <button
              key={o.id}
              type="button"
              className="olm-dash-item"
              onClick={() => navigate(`/objects/${o.id}`)}
            >
              <ObjectThumb name={o.name} image={o.image} />
              <div className="olm-dash-item-body">
                <div className="olm-dash-item-name">{o.name}</div>
                <div className="olm-dash-item-meta">{o.usageDays} 天 · {o.category}</div>
              </div>
              <span className={`olm-state-badge olm-state--${o.lifecycleState}`}>{STATE_LABEL[o.lifecycleState]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Active usage */}
      {activeOnes.length > 0 && (
        <div className="olm-dash-section">
          <div className="olm-dash-section-title">
            <span>使用中</span>
            <button type="button" onClick={() => navigate('/objects/archive?state=active')}>查看全部</button>
          </div>
          {activeOnes.map((o) => (
            <button
              key={o.id}
              type="button"
              className="olm-dash-item"
              onClick={() => navigate(`/objects/${o.id}`)}
            >
              <ObjectThumb name={o.name} image={o.image} />
              <div className="olm-dash-item-body">
                <div className="olm-dash-item-name">{o.name}</div>
                <div className="olm-dash-item-meta">{o.usageDays} 天 · {o.category}</div>
              </div>
              <span className={`olm-state-badge olm-state--${o.lifecycleState}`}>{STATE_LABEL[o.lifecycleState]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="olm-detail-actions">
        <button type="button" onClick={() => setEditorOpen(true)}>＋ 加入物品</button>
        <button type="button" onClick={() => navigate('/objects/archive')}>查看全部檔案</button>
      </div>

      {objects.length === 0 && (
        <div className="olm-empty">
          <strong>還沒有收錄任何物品</strong>
          <span>拍下第一件想記住的物品</span>
          <button type="button" className="olm-empty-action" onClick={() => setEditorOpen(true)}>
            ＋ 加入物品
          </button>
        </div>
      )}

      {editorOpen && (
        <ObjectMemoryEditor
          onClose={() => setEditorOpen(false)}
          onSaved={(id) => navigate(`/objects/${id}`)}
        />
      )}
    </section>
  );
}
