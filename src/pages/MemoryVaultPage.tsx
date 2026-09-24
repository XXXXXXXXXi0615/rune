import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMemoryVault, type MemoryOwner } from '@/store/useMemoryVault';
import { BackButton } from '@/components/layout/BackButton';
import { IOSSwitch } from '@/components/ui/IOSSwitch';

type Tab = 'user' | 'ai' | 'shared';

const TAB_LABELS: Record<Tab, string> = { user: '我的', ai: 'AI', shared: '共同' };

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'chat', label: '聊天' },
  { value: 'focus', label: 'CLAWD' },
  { value: 'manual', label: '手動' },
  { value: 'forum', label: '論壇' },
  { value: 'diet', label: '飲食' },
];

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

/* ── Add Memory Sheet ── */
function AddMemorySheet({ onClose }: { onClose: () => void }) {
  const vault = useMemoryVault();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [owner, setOwner] = useState<MemoryOwner>('user');
  const [source, setSource] = useState<string>('manual');
  const [allowAi, setAllowAi] = useState(true);
  const [localOnly, setLocalOnly] = useState(true);
  const [pinned, setPinned] = useState(false);

  const handleSave = () => {
    if (!title.trim()) return;
    vault.addMemory({ title: title.trim(), content: content.trim(), owner, createdBy: owner === 'ai' ? 'ai' : 'user', source: source as any, type: 'note', allowAiRecall: allowAi, localOnly, sensitive: false, tags: pinned ? ['pinned'] : [] });
    onClose();
  };

  return createPortal(
    <div className="mv-sheet-backdrop" onClick={onClose}>
      <div className="mv-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mv-sheet-head">
          <h3>新增記憶</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mv-sheet-body">
          <input className="mv-glass-input" placeholder="標題" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea className="mv-glass-input" placeholder="記錄內容..." rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="mv-sheet-row">
            <span>Owner</span>
            <div className="mv-segmented">
              {(['user', 'ai', 'shared'] as MemoryOwner[]).map((o) => (
                <button key={o} className={owner === o ? 'active' : ''} onClick={() => setOwner(o)}>{o === 'user' ? '我' : o === 'ai' ? 'AI' : '共'}</button>
              ))}
            </div>
          </div>
          <div className="mv-sheet-row">
            <span>AI 可參考</span><IOSSwitch checked={allowAi} onChange={setAllowAi} />
          </div>
          <div className="mv-sheet-row">
            <span>本機</span><IOSSwitch checked={localOnly} onChange={setLocalOnly} />
          </div>
          <div className="mv-sheet-row">
            <span>釘選</span><IOSSwitch checked={pinned} onChange={setPinned} />
          </div>
        </div>
        <div className="mv-sheet-footer">
          <button className="mv-btn-ghost" onClick={onClose}>取消</button>
          <button className="mv-btn-primary" onClick={handleSave}>儲存</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Filter Popover ── */
function FilterPopover({ current, onChange, onClose }: { current: string; onChange: (v: string) => void; onClose: () => void }) {
  const vault = useMemoryVault();
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mem of vault.memories) m[mem.source || 'manual'] = (m[mem.source || 'manual'] || 0) + 1;
    return m;
  }, [vault.memories]);

  return createPortal(
    <div className="mv-sheet-backdrop" onClick={onClose}>
      <div className="mv-sheet mv-filter" onClick={(e) => e.stopPropagation()}>
        <div className="mv-sheet-head">
          <h3>來源篩選</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="mv-filter-list">
          {SOURCE_OPTIONS.map((opt) => (
            <button key={opt.value} className={`mv-filter-item ${current === opt.value ? 'active' : ''}`}
              onClick={() => { onChange(opt.value); onClose(); }}>
              <span>{opt.label}</span>
              <span className="mv-filter-count">{opt.value === 'all' ? vault.memories.length : counts[opt.value] || 0}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MemoryVaultPage() {
  const vault = useMemoryVault();
  const [tab, setTab] = useState<Tab>('user');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const filtered = useMemo(() => {
    let list = tab === 'user' ? vault.getByOwner('user') : tab === 'ai' ? vault.getByOwner('ai') : vault.getByOwner('shared');
    if (sourceFilter !== 'all') list = list.filter((m) => (m.source || 'manual') === sourceFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((m) => (m.title || '').toLowerCase().includes(q) || (m.content || '').toLowerCase().includes(q));
    }
    return list;
  }, [tab, query, sourceFilter, vault]);

  const currentSourceLabel = sourceFilter === 'all' ? '全部' : SOURCE_OPTIONS.find((o) => o.value === sourceFilter)?.label || '全部';

  return (
    <div className="memory-vault-page">
      <header className="mv-header">
        {/* Section 1: Title + summary */}
        <section className="mv-title-section">
          <div className="mv-title-copy">
            <BackButton to="/" />
            <div>
              <h1 className="mv-title">記憶庫</h1>
              <p className="mv-subtitle">你與 LUNARIS 共同整理的記憶空間</p>
            </div>
          </div>
          <div className="mv-summary-row">
            <div className="mv-tide-chip active">正在發光 {vault.activeCount}</div>
            <div className="mv-tide-chip pinned">釘選 {vault.pinnedCount}</div>
            <div className="mv-tide-chip fading">即將退潮 {vault.fadingCount}</div>
            <div className="mv-tide-chip recall">AI 可參考 {vault.aiRecallableCount}</div>
          </div>
        </section>

        {/* Section 2: Owner tabs */}
        <section className="mv-owner-tabs-row">
          {(['user', 'ai', 'shared'] as Tab[]).map((t) => (
            <button key={t} className={`mv-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>
          ))}
        </section>

        {/* Section 3: Toolbar */}
        <section className="mv-toolbar-row">
          {showSearch ? (
            <input className="mv-glass-input mv-search-input" placeholder="搜尋..." value={query}
              onChange={(e) => setQuery(e.target.value)} onBlur={() => { if (!query) setShowSearch(false); }} autoFocus />
          ) : (
            <button className="mv-icon-btn" onClick={() => setShowSearch(true)} title="搜尋">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            </button>
          )}
          <button className="mv-chip-btn" onClick={() => setShowFilter(true)}>
            篩選：{currentSourceLabel}
          </button>
          <span className="mv-toolbar-spacer" />
          <button className="mv-add-btn-pill" onClick={() => setShowAdd(true)}>+ 新增</button>
        </section>
      </header>

      {/* Memory list */}
      <div className="mv-list">
        {filtered.length === 0 ? (
          <div className="mv-empty">
            <p className="mv-empty-title">
              {tab === 'user' ? '尚無我的記憶' : tab === 'ai' ? 'AI 還沒有留下觀察' : '尚無共同記憶'}
            </p>
            <span>
              {tab === 'user' ? '你手動保存的想法、音訊轉錄與專注記錄會出現在這裡。'
                : tab === 'ai' ? '智能體的觀察與整理會在你允許後出現在這裡。'
                : '你與智能體共同確認的重要內容會放在這裡。'}
            </span>
          </div>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className={`mv-card ${entry.status === 'pinned' ? 'pinned' : ''} ${entry.status === 'fading' ? 'fading' : ''}`}>
              {/* Top: badges + AI toggle inline */}
              <div className="mv-card-top">
                <span className="mv-card-source-badge">{entry.source || 'manual'}</span>
                <span className="mv-card-owner-badge">{entry.owner === 'ai' ? 'AI' : entry.owner === 'shared' ? '共同' : '我'}</span>
                {entry.allowAiRecall && <span className="mv-card-ai-badge">AI</span>}
                <span className="mv-card-top-spacer" />
                <IOSSwitch checked={!!entry.allowAiRecall} onChange={() => vault.toggleAiRecall(entry.id, !entry.allowAiRecall)} />
              </div>
              {/* Body */}
              <div className="mv-card-body">
                <strong>{entry.title || '空白記憶'}</strong>
                {entry.content && <p>{entry.content.slice(0, 80)}{entry.content.length > 80 ? '…' : ''}</p>}
              </div>
              {/* Footer: time + actions */}
              <div className="mv-card-footer">
                <span className="mv-card-time">{formatTime(entry.updatedAt)}</span>
                <div className="mv-card-footer-actions">
                  <button className="mv-icon-btn mv-fade-btn" onClick={() => vault.fadeMemory(entry.id)} title="標記退潮">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a9 9 0 109 9c-4.5-1.5-7-4-7-9z"/></svg>
                    <span>退潮</span>
                  </button>
                  <button className="mv-icon-btn mv-delete-btn" onClick={() => vault.deleteMemory(entry.id)} title="刪除">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && <AddMemorySheet onClose={() => setShowAdd(false)} />}
      {showFilter && <FilterPopover current={sourceFilter} onChange={setSourceFilter} onClose={() => setShowFilter(false)} />}
    </div>
  );
}
