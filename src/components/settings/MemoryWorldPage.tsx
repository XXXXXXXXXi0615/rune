import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { t } from '@/i18n';

/* ═══════════════════════════════════════
   Memory & World — 記憶與世界觀頁
   Long-term memory management · World book CRUD
   ═══════════════════════════════════════ */

interface Props { isOpen: boolean; onClose: () => void; }

// ── SVG icons ──

const svgA = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function MwpSvg({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} {...svgA}>
      {name === 'character' && (
        <><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></>
      )}
      {name === 'location' && (
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      )}
      {name === 'event' && (
        <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
      )}
      {name === 'rule' && (
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      )}
      {name === 'memory-tab' && (
        <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></>
      )}
      {name === 'world-tab' && (
        <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>
      )}
      {name === 'empty' && (
        <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>
      )}
    </svg>
  );
}

// ── World Book Category Types ──

type WB_Category = 'character' | 'location' | 'event' | 'rule';

interface WorldBookDraft {
  title: string;
  keywords: string;
  content: string;
  category: WB_Category;
}

const EMPTY_DRAFT: WorldBookDraft = {
  title: '',
  keywords: '',
  content: '',
  category: 'character',
};

const WB_CATEGORIES: { id: WB_Category; icon: string; labelKey: string; color: string }[] = [
  { id: 'character', icon: 'character', labelKey: 'mw.wbCatCharacter', color: '#B18DFF' },
  { id: 'location', icon: 'location',   labelKey: 'mw.wbCatLocation',  color: '#7AB8FF' },
  { id: 'event',    icon: 'event',      labelKey: 'mw.wbCatEvent',     color: '#FF8A3D' },
  { id: 'rule',     icon: 'rule',       labelKey: 'mw.wbCatRule',      color: '#5DB872' },
];

// ═══ Component ═══

export function MemoryWorldPage({ isOpen, onClose }: Props) {
  // ── Store data ──
  const memoryEntries = useAppStore((s) => s.memoryEntries);
  const aiPrompting = useAppStore((s) => s.aiPrompting);
  const addWorldBookEntry = useAppStore((s) => s.addWorldBookEntry);
  const deleteWorldBookEntry = useAppStore((s) => s.deleteWorldBookEntry);
  const deleteMemoryEntry = useAppStore((s) => s.deleteMemoryEntry);
  const showToast = useToastStore((s) => s.showToast);
  const isZh = useAppStore((s) => s.language).startsWith('zh');

  // ── Local state ──
  const [activeTab, setActiveTab] = useState<'memory' | 'world'>('memory');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [wbDeleteId, setWbDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorldBookDraft>(EMPTY_DRAFT);
  const [showAddForm, setShowAddForm] = useState(false);

  // ── Derived: memories ──
  const sortedMemories = useMemo(
    () => [...memoryEntries].sort((a, b) => b.createdAt - a.createdAt),
    [memoryEntries]
  );

  const recentMemories = useMemo(() => sortedMemories.slice(0, 5), [sortedMemories]);
  const favoriteMemories = useMemo(() =>
    sortedMemories.filter((m) => m.summary && m.summary.includes('\u2605')).slice(0, 5),
    [sortedMemories]
  );

  // ── Derived: world book ──
  const worldBookEntries = useMemo(
    () => (aiPrompting?.worldBookEntries || []),
    [aiPrompting]
  );

  const wbByCategory = useMemo(() => {
    const map: Record<WB_Category, typeof worldBookEntries> = {
      character: [], location: [], event: [], rule: [],
    };
    for (const entry of worldBookEntries) {
      if (entry.metadata?.category) {
        map[entry.metadata.category].push(entry);
        continue;
      }
      /* Compatibility classification for entries created before category metadata. */
      const kw = entry.keywords.join(' ').toLowerCase();
      let cat: WB_Category = 'rule'; // default
      if (/角色|character|人物|luna/i.test(kw)) cat = 'character';
      else if (/地點|location|場所|房間|世界/i.test(kw)) cat = 'location';
      else if (/事件|event|約定|紀念|歷史/i.test(kw)) cat = 'event';
      map[cat].push(entry);
    }
    return map;
  }, [worldBookEntries]);

  // ── Handlers: memory delete ──
  const handleDeleteMemory = useCallback(() => {
    if (!deleteTargetId) return;
    deleteMemoryEntry(deleteTargetId);
    setDeleteTargetId(null);
    showToast(isZh ? '記憶已刪除' : 'Memory deleted');
  }, [deleteTargetId, deleteMemoryEntry, showToast, isZh]);

  // ── Handlers: world book ──
  const handleAddWB = useCallback(() => {
    if (!draft.title.trim() || !draft.content.trim()) {
      showToast(isZh ? '請填寫標題和內容' : 'Title and content are required');
      return;
    }
    addWorldBookEntry({
      title: draft.title.trim(),
      keywords: draft.keywords.split(/[,，]/).map((k) => k.trim()).filter(Boolean),
      content: draft.content.trim(),
      enabled: true,
      priority: wbByCategory[draft.category].length + 1,
      metadata: { category: draft.category },
    });
    setDraft(EMPTY_DRAFT);
    setShowAddForm(false);
    showToast(isZh ? '世界書條目已新增' : 'World book entry added');
  }, [draft, addWorldBookEntry, showToast, isZh, wbByCategory]);

  const handleDeleteWB = useCallback(() => {
    if (!wbDeleteId) return;
    deleteWorldBookEntry(wbDeleteId);
    setWbDeleteId(null);
    showToast(isZh ? '世界書條目已刪除' : 'World book entry deleted');
  }, [wbDeleteId, deleteWorldBookEntry, showToast, isZh]);

  if (!isOpen) return null;

  return createPortal(
    <div className="mwp-overlay" onClick={onClose}>
      <div className="mwp" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('mw.title')}>
        {/* ── Header ── */}
        <div className="mwp-head">
          <button className="mwp-back" onClick={onClose} aria-label={t('skillDetail.back')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 className="mwp-title">{t('mw.title')}</h2>
        </div>

        {/* ── Tab Bar ── */}
        <div className="mwp-tabs">
          <button
            type="button"
            className={`mwp-tab ${activeTab === 'memory' ? 'mwp-tab--active' : ''}`}
            onClick={() => setActiveTab('memory')}
          >
            <MwpSvg name="memory-tab" size={16} /> {t('mw.tabMemory')}
            <span className="mwp-tab-count">{memoryEntries.length}</span>
          </button>
          <button
            type="button"
            className={`mwp-tab ${activeTab === 'world' ? 'mwp-tab--active' : ''}`}
            onClick={() => setActiveTab('world')}
          >
            <MwpSvg name="world-tab" size={16} /> {t('mw.tabWorld')}
            <span className="mwp-tab-count">{worldBookEntries.length}</span>
          </button>
        </div>

        <div className="mwp-body">
          {/* ═══ TAB: MEMORY ═══ */}
          {activeTab === 'memory' && (
            <>
              {/* Stats row */}
              <div className="mwp-stats-row">
                <div className="mwp-stat">
                  <span className="mwp-stat-num">{memoryEntries.length}</span>
                  <span className="mwp-stat-label">{t('mw.totalSaved')}</span>
                </div>
                <div className="mwp-stat">
                  <span className="mwp-stat-num">{favoriteMemories.length}</span>
                  <span className="mwp-stat-label">{t('mw.favorites')}</span>
                </div>
              </div>

              {/* Recent memories list */}
              <div className="mwp-list-header">{t('mw.recentMemories')}</div>
              {recentMemories.length > 0 ? (
                <div className="mwp-memory-list">
                  {recentMemories.map((mem) => (
                    <div key={mem.id} className="mwp-mem-card">
                      <div className="mwp-mem-body">
                        <p className="mwp-mem-summary">{mem.summary || mem.triggerText || mem.bodyThoughts.slice(0, 80)}</p>
                        <span className="mwp-mem-date">{new Date(mem.createdAt).toLocaleDateString(isZh ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <button
                        type="button"
                        className="mwp-delete-btn"
                        onClick={() => setDeleteTargetId(mem.id)}
                        aria-label={t('mw.deleteMemory')}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                          <polyline points="3 6 5 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mwp-empty"><MwpSvg name="empty" size={18} /> {t('mw.noMemories')}</div>
              )}

              {/* Favorites section */}
              {favoriteMemories.length > 0 && (
                <>
                  <div className="mwp-list-header">{t('mw.favoriteMemories')}</div>
                  <div className="mwp-memory-list">
                    {favoriteMemories.map((mem) => (
                      <div key={mem.id} className="mwp-mem-card mwp-mem-card--fav">
                        <div className="mwp-mem-body">
                          <p className="mwp-mem-summary">\u2605 {mem.summary}</p>
                          <span className="mwp-mem-date">{new Date(mem.createdAt).toLocaleDateString(isZh ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <button type="button" className="mwp-delete-btn" onClick={() => setDeleteTargetId(mem.id)} aria-label={t('mw.deleteMemory')}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                            <polyline points="3 6 5 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══ TAB: WORLD BOOK ═══ */}
          {activeTab === 'world' && (
            <>
              {/* Category sections */}
              {WB_CATEGORIES.map((cat) => (
                <div key={cat.id} className="mwp-wb-section">
                  <div className="mwp-wb-cat-head">
                    <span className="mwp-wb-cat-icon" style={{ background: `${cat.color}18`, color: cat.color }}><MwpSvg name={cat.icon} /></span>
                    <span className="mwp-wb-cat-name">{t(cat.labelKey)}</span>
                    <span className="mwp-wb-cat-count">{wbByCategory[cat.id].length}</span>
                  </div>

                  {wbByCategory[cat.id].length > 0 ? (
                    <div className="mwp-wb-list">
                      {wbByCategory[cat.id].map((entry) => (
                        <div key={entry.id} className="mwp-wb-card">
                          <div className="mwp-wb-info">
                            <strong className="mwp-wb-title">{entry.title}</strong>
                            {entry.keywords.length > 0 && (
                              <span className="mwp-wb-keywords">{entry.keywords.join(', ')}</span>
                            )}
                            <p className="mwp-wb-content">{entry.content.slice(0, 120)}{entry.content.length > 120 ? '\u2026' : ''}</p>
                          </div>
                          <button
                            type="button"
                            className="mwp-delete-btn mwp-delete-btn--small"
                            onClick={() => setWbDeleteId(entry.id)}
                            aria-label={t('mw.deleteWb')}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
                              <polyline points="3 6 5 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mwp-empty-sm">{t('mw.emptyCategory')}</div>
                  )}
                </div>
              ))}

              {/* Add new entry form */}
              <button
                type="button"
                className="mwp-add-btn"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                + {t('mw.addEntry')}
              </button>

              {showAddForm && (
                <div className="mwp-form">
                  <div className="mwp-form-field">
                    <label className="mwp-form-label">{t('mw.formTitle')}</label>
                    <input
                      type="text"
                      className="mwp-form-input"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      placeholder={t('mw.formTitlePh')}
                    />
                  </div>
                  <div className="mwp-form-field">
                    <label className="mwp-form-label">{t('mw.formKeywords')}</label>
                    <input
                      type="text"
                      className="mwp-form-input"
                      value={draft.keywords}
                      onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                      placeholder={t('mw.formKeywordsPh')}
                    />
                  </div>
                  <div className="mwp-form-field">
                    <label className="mwp-form-label">{t('mw.formContent')}</label>
                    <textarea
                      className="mwp-form-textarea"
                      rows={3}
                      value={draft.content}
                      onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                      placeholder={t('mw.formContentPh')}
                    />
                  </div>
                  <div className="mwp-form-field">
                    <label className="mwp-form-label">{t('mw.formCategory')}</label>
                    <div className="mwp-form-cats">
                      {WB_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`mwp-cat-chip ${draft.category === cat.id ? 'mwp-cat-chip--active' : ''}`}
                          style={{ '--mwp-accent': cat.color } as React.CSSProperties}
                          onClick={() => setDraft({ ...draft, category: cat.id })}
                        >
                          {cat.icon} {t(cat.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mwp-form-actions">
                    <button type="button" className="mwp-form-cancel" onClick={() => { setShowAddForm(false); setDraft(EMPTY_DRAFT); }}>
                      {t('sheet.cancel')}
                    </button>
                    <button type="button" className="mwp-form-submit" onClick={handleAddWB}>
                      {t('mw.addConfirm')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ Delete Confirm: Memory ═══ */}
        {deleteTargetId && (
          <div className="mwp-confirm-overlay" onClick={() => setDeleteTargetId(null)}>
            <div className="mwp-confirm" onClick={(e) => e.stopPropagation()}>
              <p className="mwp-confirm-text">{t('mw.confirmDeleteMem')}</p>
              <div className="mwp-confirm-actions">
                <button type="button" className="mwp-confirm-no" onClick={() => setDeleteTargetId(null)}>{t('sheet.cancel')}</button>
                <button type="button" className="mwp-confirm-yes" onClick={handleDeleteMemory}>{t('mw.confirmYes')}</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Delete Confirm: World Book ═══ */}
        {wbDeleteId && (
          <div className="mwp-confirm-overlay" onClick={() => setWbDeleteId(null)}>
            <div className="mwp-confirm" onClick={(e) => e.stopPropagation()}>
              <p className="mwp-confirm-text">{t('mw.confirmDeleteWb')}</p>
              <div className="mwp-confirm-actions">
                <button type="button" className="mwp-confirm-no" onClick={() => setWbDeleteId(null)}>{t('sheet.cancel')}</button>
                <button type="button" className="mwp-confirm-yes" onClick={handleDeleteWB}>{t('mw.confirmYes')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
