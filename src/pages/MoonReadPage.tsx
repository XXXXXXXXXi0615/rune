import { useRef, useState, useEffect, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Header } from '@/components/layout/Header';
import { PageBackButton } from '@/components/ui/PageBackButton';
import { Card } from '@/components/ui/Card';
import {
  addPreview,
  deletePreview,
  loadPreviews,
  updatePreview,
  type HtmlPreview,
} from '@/config/htmlPreviews';

const SCROLL_POS_PREFIX = 'lunartide_moonread_scroll_';
const PIN_STORAGE_KEY = 'lunartide_moonread_pinned';

type SortMode = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

const SORT_CYCLE: SortMode[] = ['newest', 'oldest', 'title-asc', 'title-desc'];

const SORT_LABELS: Record<SortMode, string> = {
  newest: '最新',
  oldest: '最舊',
  'title-asc': 'A-Z',
  'title-desc': 'Z-A',
};

function formatWorkDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function titleFromFile(fileName: string) {
  return fileName.replace(/\.html?$/i, '').trim() || '未命名作品';
}

function countLabel(html: string): string {
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const chars = text.length;
  if (chars >= 10000) return `${(chars / 1000).toFixed(0)}k 字`;
  if (chars >= 1000) return `${(chars / 1000).toFixed(1)}k 字`;
  return `${chars} 字`;
}

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch { return new Set<string>(); }
}

function savePinned(ids: Set<string>) {
  localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...ids]));
}

function parseTags(input: string): string[] {
  return input.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
}

function tagsToInput(tags: string[]): string {
  return (tags || []).join(', ');
}

export function LibraryPage() {
  const [works, setWorks] = useState<HtmlPreview[]>(() => loadPreviews());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(loadPinned);
  const [readingMode, setReadingMode] = useState<'none' | 'dark' | 'sepia'>('none');

  const preview = previewId ? works.find((work) => work.id === previewId) ?? null : null;

  const togglePin = (id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      savePinned(next);
      return next;
    });
  };

  const cycleReadingMode = () => {
    setReadingMode(prev => prev === 'none' ? 'dark' : prev === 'dark' ? 'sepia' : 'none');
  };

  useEffect(() => {
    if (!preview) return;
    const frame = previewFrameRef.current;
    if (!frame) return;

    let cancelled = false;

    const saveScroll = () => {
      if (cancelled) return;
      try {
        const y = frame.contentWindow?.scrollY;
        if (y !== undefined && y !== null) {
          localStorage.setItem(`${SCROLL_POS_PREFIX}${preview.id}`, String(Math.round(y)));
        }
      } catch {}
    };

    const onLoad = () => {
      try {
        const saved = localStorage.getItem(`${SCROLL_POS_PREFIX}${preview.id}`);
        if (saved) {
          frame.contentWindow?.scrollTo(0, Number(saved));
        }
      } catch {}
    };

    frame.addEventListener('load', onLoad);
    const interval = setInterval(saveScroll, 2000);

    return () => {
      cancelled = true;
      saveScroll();
      clearInterval(interval);
      frame.removeEventListener('load', onLoad);
    };
  }, [preview]);

  const resetEditor = () => {
    setEditingId(null);
    setEditorOpen(false);
    setTitle('');
    setHtml('');
    setTagsInput('');
    setError('');
  };

  const startNewWork = () => {
    setPreviewId(null);
    setEditingId(null);
    setTitle('');
    setHtml('');
    setTagsInput('');
    setError('');
    setEditorOpen(true);
  };

  const startEditing = (work: HtmlPreview) => {
    setPreviewId(null);
    setEditingId(work.id);
    setTitle(work.title);
    setHtml(work.html);
    setTagsInput(tagsToInput(work.tags));
    setError('');
    setEditorOpen(true);
  };

  const saveWork = () => {
    const nextTitle = title.trim();
    const nextHtml = html.trim();
    if (!nextTitle || !nextHtml) {
      setError('請填寫作品名稱與 HTML 內容。');
      return;
    }
    const nextTags = parseTags(tagsInput);

    if (editingId) {
      setWorks(updatePreview(editingId, { title: nextTitle, html: nextHtml, tags: nextTags }));
    } else {
      const now = Date.now();
      setWorks(addPreview({
        id: crypto.randomUUID(),
        title: nextTitle,
        html: nextHtml,
        tags: nextTags,
        createdAt: now,
        updatedAt: now,
      }));
    }
    resetEditor();
  };

  const importHtml = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const now = Date.now();
      const work: HtmlPreview = {
        id: crypto.randomUUID(),
        title: titleFromFile(file.name),
        html: reader.result,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      setWorks(addPreview(work));
      setPreviewId(work.id);
      resetEditor();
    };
    reader.readAsText(file, 'UTF-8');
  };

  const confirmDelete = () => {
    if (!deleteConfirmId) return;
    setWorks(deletePreview(deleteConfirmId));
    if (previewId === deleteConfirmId) setPreviewId(null);
    if (editingId === deleteConfirmId) resetEditor();
    setDeleteConfirmId(null);
  };

  const copyHtml = (work: HtmlPreview) => {
    navigator.clipboard.writeText(work.html).then(() => {
      setCopiedId(work.id);
      setTimeout(() => setCopiedId(null), 1800);
    }).catch(() => {});
  };

  const exportHtml = (work: HtmlPreview) => {
    const blob = new Blob([work.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${work.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allTags = [...new Set(works.flatMap(w => w.tags || []))].sort();

  let filtered = works;
  if (search.trim()) {
    const kw = search.trim().toLowerCase();
    filtered = filtered.filter(w =>
      w.title.toLowerCase().includes(kw) ||
      (w.tags || []).some(t => t.toLowerCase().includes(kw))
    );
  }
  if (activeTag) {
    filtered = filtered.filter(w => (w.tags || []).includes(activeTag));
  }

  switch (sort) {
    case 'newest':
      filtered = [...filtered].sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? -1 : 1;
        const bp = pinnedIds.has(b.id) ? -1 : 1;
        return ap !== bp ? ap - bp : b.updatedAt - a.updatedAt;
      });
      break;
    case 'oldest':
      filtered = [...filtered].sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? -1 : 1;
        const bp = pinnedIds.has(b.id) ? -1 : 1;
        return ap !== bp ? ap - bp : a.updatedAt - b.updatedAt;
      });
      break;
    case 'title-asc':
      filtered = [...filtered].sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? -1 : 1;
        const bp = pinnedIds.has(b.id) ? -1 : 1;
        return ap !== bp ? ap - bp : a.title.localeCompare(b.title, 'zh-TW');
      });
      break;
    case 'title-desc':
      filtered = [...filtered].sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? -1 : 1;
        const bp = pinnedIds.has(b.id) ? -1 : 1;
        return ap !== bp ? ap - bp : b.title.localeCompare(a.title, 'zh-TW');
      });
      break;
  }

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const idx = filtered.findIndex(w => w.id === preview.id);
        if (idx > 0) setPreviewId(filtered[idx - 1].id);
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const idx = filtered.findIndex(w => w.id === preview.id);
        if (idx < filtered.length - 1) setPreviewId(filtered[idx + 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, filtered]);

  const cycleSort = () => {
    const idx = SORT_CYCLE.indexOf(sort);
    setSort(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
  };

  if (preview) {
    const currentIdx = filtered.findIndex(w => w.id === preview.id);
    const prevWork = currentIdx > 0 ? filtered[currentIdx - 1] : null;
    const nextWork = currentIdx < filtered.length - 1 ? filtered[currentIdx + 1] : null;
    const isPinned = pinnedIds.has(preview.id);

    const readingIcon = readingMode === 'none'
      ? '☀️' : readingMode === 'dark'
        ? '🌙' : '🟫';

    return (
      <section className="view moonread-preview-view">
        <header className="moonread-preview-header">
          <button type="button" className="moonread-back-button" onClick={() => setPreviewId(null)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            工坊
          </button>
          <div className="moonread-preview-heading">
            <strong>{preview.title}</strong>
            <span>
              {countLabel(preview.html)}
              {(preview.tags || []).length > 0 && ` · ${preview.tags!.join(', ')}`}
              {currentIdx >= 0 && ` · ${currentIdx + 1}/${filtered.length}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="moonread-edit-button"
              onClick={() => copyHtml(preview)}
            >
              {copiedId === preview.id ? '已複製' : '複製 HTML'}
            </button>
            <button
              type="button"
              className={`moonread-edit-button${isPinned ? ' is-pinned' : ''}`}
              onClick={() => togglePin(preview.id)}
            >
              {isPinned ? '★ 已置頂' : '☆ 置頂'}
            </button>
            <button type="button" className="moonread-edit-button" onClick={() => startEditing(preview)}>
              編輯
            </button>
          </div>
        </header>
        <div style={{ display: 'flex', gap: 8, padding: '4px 16px', alignItems: 'center' }}>
          <button
            type="button"
            className="moonread-nav-button"
            disabled={!prevWork}
            onClick={() => prevWork && setPreviewId(prevWork.id)}
          >
            ← 上一篇
          </button>
          <button
            type="button"
            className={`moonread-mode-button${readingMode !== 'none' ? ' is-active' : ''}`}
            onClick={cycleReadingMode}
          >
            {readingIcon}
          </button>
          <button
            type="button"
            className="moonread-nav-button"
            disabled={!nextWork}
            onClick={() => nextWork && setPreviewId(nextWork.id)}
          >
            下一篇 →
          </button>
        </div>
        <div className={`moonread-browser-shell${readingMode !== 'none' ? ` is-${readingMode}` : ''}`}>
          <div className="moonread-browser-bar" aria-hidden="true">
            <span />
            <span />
            <span />
            <div>{preview.title}</div>
          </div>
          <iframe
            ref={previewFrameRef}
            className="moonread-preview-frame"
            srcDoc={preview.html}
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-same-origin"
            title={`${preview.title} HTML 預覽`}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="view moonread-library">
      <div className="page-header-row">
        <PageBackButton to="/" label="返回首頁" />
        <Header eyebrow="保存 AI 對話生成的網頁作品" title="工坊" />
      </div>

      <div className="moonread-library-toolbar">
        <button type="button" className="liquid-btn liquid-btn--accent" onClick={startNewWork}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新增作品
        </button>
        <button type="button" className="liquid-btn" onClick={() => fileInputRef.current?.click()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          導入 HTML
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,text/html"
          hidden
          onChange={importHtml}
        />
      </div>

      <div className="moonread-search-bar">
        <input
          type="search"
          className="moonread-search-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋作品名稱…"
        />
        <button type="button" className="moonread-sort-btn" onClick={cycleSort}>
          {SORT_LABELS[sort]}
        </button>
        <span className="moonread-work-count">{filtered.length} 件作品</span>
      </div>

      {activeTag && (
        <div className="moonread-active-tag">
          <span>標籤：{activeTag}</span>
          <button type="button" onClick={() => setActiveTag(null)}>×</button>
        </div>
      )}

      {allTags.length > 0 && !search.trim() && !activeTag && (
        <div className="moonread-tag-cloud">
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              className="moonread-tag-chip"
              onClick={() => setActiveTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {editorOpen && (
        <Card className="moonread-editor-card">
          <div className="moonread-editor-heading">
            <div>
              <strong>{editingId ? '編輯作品' : '新增 HTML 作品'}</strong>
              <span>內容只會保存在這台裝置的 localStorage。</span>
            </div>
            <button type="button" onClick={resetEditor} aria-label="關閉編輯器">×</button>
          </div>
          <label className="moonread-field">
            <span>作品名稱</span>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError('');
              }}
              placeholder="例如：月光登入頁"
            />
          </label>
          <label className="moonread-field">
            <span>標籤（用逗號分隔）</span>
            <input
              value={tagsInput}
              onChange={(event) => {
                setTagsInput(event.target.value);
                setError('');
              }}
              placeholder="例如：landing, dashboard, blog"
            />
          </label>
          <label className="moonread-field">
            <span>HTML</span>
            <textarea
              value={html}
              onChange={(event) => {
                setHtml(event.target.value);
                setError('');
              }}
              placeholder="貼上完整 HTML 程式碼"
              spellCheck={false}
            />
          </label>
          {error && <p className="moonread-editor-error">{error}</p>}
          <div className="moonread-editor-actions">
            <button type="button" className="liquid-btn" onClick={resetEditor}>取消</button>
            <button type="button" className="liquid-btn liquid-btn--accent" onClick={saveWork}>
              {editingId ? '儲存修改' : '保存作品'}
            </button>
          </div>
        </Card>
      )}

      {filtered.length === 0 && !editorOpen && (
        <Card className="moonread-empty-card">
          <div className="moonread-empty-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M3 9h18" />
              <circle cx="7" cy="6.5" r=".7" />
              <circle cx="10" cy="6.5" r=".7" />
            </svg>
          </div>
          <strong>
            {search.trim() || activeTag ? '沒有符合的結果' : '工坊還是空的'}
          </strong>
          <p>
            {search.trim() || activeTag
              ? '試試其他關鍵字或清除篩選條件。'
              : '導入 `.html` 檔案，或貼上 AI 為你生成的完整網頁程式碼。'}
          </p>
          {(search.trim() || activeTag) && (
            <button type="button" className="liquid-btn" onClick={() => { setSearch(''); setActiveTag(null); }}>
              清除篩選
            </button>
          )}
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="moonread-work-grid">
          {filtered.map((work) => (
            <article className="moonread-work-card" key={work.id}>
              <button type="button" className="moonread-work-preview" onClick={() => setPreviewId(work.id)}>
                <iframe
                  srcDoc={work.html}
                  sandbox=""
                  tabIndex={-1}
                  aria-hidden="true"
                  title=""
                />
                <span>開啟預覽</span>
              </button>
              <div className="moonread-work-meta">
                <div>
                  <strong>{work.title}</strong>
                  <span>{formatWorkDate(work.updatedAt)} · {countLabel(work.html)}</span>
                </div>
              </div>
              {(work.tags || []).length > 0 && (
                <div className="moonread-card-tags">
                  {work.tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className="moonread-card-tag"
                      onClick={(e) => { e.stopPropagation(); setActiveTag(tag); }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              <div className="moonread-work-actions">
                <button type="button" onClick={() => startEditing(work)}>編輯</button>
                <button type="button" onClick={() => copyHtml(work)}>
                  {copiedId === work.id ? '已複製' : '複製'}
                </button>
                <button type="button" onClick={() => exportHtml(work)}>匯出</button>
                <button
                  type="button"
                  className={`${pinnedIds.has(work.id) ? 'is-pinned' : ''}`}
                  onClick={() => togglePin(work.id)}
                >
                  {pinnedIds.has(work.id) ? '★' : '☆'}
                </button>
                <button type="button" className="danger" onClick={() => setDeleteConfirmId(work.id)}>刪除</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleteConfirmId && createPortal(
        <div className="confirm-sheet-overlay active" onClick={() => setDeleteConfirmId(null)}>
          <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
            <div className="quick-sheet-handle" />
            <div className="confirm-sheet-body">
              <p className="confirm-sheet-text">確定要刪除這個作品嗎？刪除後無法復原。</p>
            </div>
            <div className="confirm-sheet-actions">
              <button type="button" className="btn-ghost" onClick={() => setDeleteConfirmId(null)}>取消</button>
              <button type="button" className="btn-primary" onClick={confirmDelete} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>確認刪除</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
