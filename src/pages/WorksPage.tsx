import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageBackButton } from '@/components/ui/PageBackButton';
import { useToastStore } from '@/store/useToastStore';
import '@/styles/works.css';

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

interface Work {
  id: string;
  title: string;
  html: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'lunartide_works_v2';

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function loadWorks(): Work[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return raw.map((w: any) => ({
      id: w.id || uid(),
      title: w.title || '',
      html: w.html || '',
      createdAt: w.createdAt || Date.now(),
      updatedAt: w.updatedAt || w.createdAt || Date.now(),
    }));
  } catch {
    return [];
  }
}

function saveWorks(works: Work[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(works));
  } catch { /* unavailable */ }
}

function parseHtmlMeta(html: string): { title: string } {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = doc.querySelector('title')?.textContent?.trim() || '';
    return { title };
  } catch {
    return { title: '' };
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return '今天';
  if (diff < 172800000 && d.getDate() === now.getDate() - 1) return '昨天';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/* ══════════════════════════════════════════════
   Drag & Drop Overlay
   ══════════════════════════════════════════════ */

function DragDropOverlay({ onDrop, onLeave }: { onDrop: (files: FileList) => void; onLeave: () => void }) {
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) onDrop(e.dataTransfer.files); };

  return createPortal(
    <div className="works-drop-overlay" onDragOver={handleDragOver} onDrop={handleDrop} onDragLeave={onLeave}>
      <div className="works-drop-zone">
        <svg viewBox="0 0 48 48" width={48} height={48} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M24 32V16M16 24l8-8 8 8" />
          <rect x="8" y="6" width="32" height="36" rx="4" opacity={0.3} />
        </svg>
        <p className="works-drop-zone-title">放開以上傳 HTML</p>
        <p className="works-drop-zone-hint">支援 .html .htm 檔案 — 自動解析標題與描述</p>
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════════════
   WorkCard
   ══════════════════════════════════════════════ */

function WorkCard({ work, selected, onSelect, onEdit, onDelete }: {
  work: Work;
  selected: boolean;
  onSelect: (w: Work) => void;
  onEdit: (w: Work) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <article className={`works-card${selected ? ' selected' : ''}`} onClick={() => onSelect(work)}>
      <div className="works-card-thumb">
        {work.html ? (
          <iframe className="works-card-frame" srcDoc={work.html} sandbox="" title={work.title} scrolling="no" loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BFB4A7' }}>
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.2}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <polyline points="12 8 12 12 15 14" />
              <line x1="9" y1="16" x2="15" y2="16" />
            </svg>
          </div>
        )}
      </div>
      <div className="works-card-body">
        <h3 className="works-card-title">{work.title || '未命名'}</h3>
        <span>{formatDate(work.createdAt)}</span>
      </div>
      <div className="works-card-actions">
        <button type="button" className="works-card-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(work); }} title="編輯">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button type="button" className="works-card-action-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(work.id); }} title="刪除">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </article>
  );
}

/* ══════════════════════════════════════════════
   Form Modal (Add / Edit)
   ══════════════════════════════════════════════ */

function WorkFormModal({ editing, onSave, onClose }: {
  editing: Work | null;
  onSave: (data: Partial<Work> & { html: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(editing?.title || '');
  const [html, setHtml] = useState(editing?.html || '');
  const [htmlFileName, setHtmlFileName] = useState('');
  const [htmlSize, setHtmlSize] = useState(0);

  useEffect(() => {
    document.body.classList.add('sheet-open');
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('sheet-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleHtmlUpload = (content: string, name: string) => {
    setHtml(content);
    setHtmlFileName(name);
    setHtmlSize(content.length);
    const meta = parseHtmlMeta(content);
    if (!title.trim() && meta.title) setTitle(meta.title);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleHtmlUpload(reader.result as string, file.name);
    reader.readAsText(file);
  };

  const handleSave = () => {
    if (!html) return;
    const meta = parseHtmlMeta(html);
    onSave({
      title: title.trim() || meta.title || htmlFileName.replace(/\.(html?|htm)$/i, '') || '未命名',
      html,
    });
  };

  const canSave = !!html;

  return createPortal(
    <div className="works-form-backdrop" onClick={onClose}>
      <section className="works-form" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="works-form-header">
          <h2 className="works-form-title">{editing ? '編輯 HTML 作品' : '新增 HTML 作品'}</h2>
          <button type="button" className="works-form-close" onClick={onClose} aria-label="關閉">✕</button>
        </div>

        <div className="works-form-body">
          {/* HTML upload */}
          <div className="works-form-field">
            <label className="works-form-label">HTML 檔案</label>
            <div className={`works-form-upload${html ? ' has-file' : ''}`}>
              {html ? (
                <>
                  <div className="works-form-upload-icon">
                    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                    </svg>
                  </div>
                  <div className="works-form-upload-info">
                    <div className="works-form-upload-name">{htmlFileName}</div>
                    <div className="works-form-upload-size">{htmlSize.toLocaleString()} 字元</div>
                  </div>
                  <button type="button" className="works-form-upload-remove" onClick={() => { setHtml(''); setHtmlFileName(''); }}>✕</button>
                </>
              ) : (
                <label style={{ display: 'contents', cursor: 'pointer' }}>
                  <div className="works-form-upload-placeholder">
                    <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    <span>點擊上傳 HTML 檔案，或拖放到此區</span>
                  </div>
                  <input type="file" accept=".html,.htm" onChange={handleFileChange} hidden />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="works-form-field">
            <label className="works-form-label">標題</label>
            <input className="works-form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="自動解析或自行輸入" />
          </div>
        </div>

        <div className="works-form-footer">
          <button type="button" className="works-form-btn works-form-btn--cancel" onClick={onClose}>取消</button>
          <button type="button" className="works-form-btn works-form-btn--save" onClick={handleSave} disabled={!canSave}>
            {editing ? '儲存' : '新增'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════════════
   Preview Modal
   ══════════════════════════════════════════════ */

function PreviewModal({ work, onClose, onEdit, onDelete }: {
  work: Work;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return createPortal(
    <div className="works-preview-overlay" onClick={onClose}>
      <div className="works-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="works-preview-modal-bar">
          <span className="works-preview-modal-title">{work.title || '未命名'}</span>
          <div className="works-preview-modal-actions">
            <button type="button" className="works-preview-btn works-preview-btn--edit" onClick={onEdit}>編輯</button>
            <button type="button" className="works-preview-btn works-preview-btn--delete" onClick={onDelete}>刪除</button>
          </div>
          <button type="button" className="works-preview-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="works-preview-modal-body">
          <iframe className="works-preview-iframe" srcDoc={work.html} sandbox="allow-scripts" title={work.title} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════════════
   Main Page — HTML Sandbox
   ══════════════════════════════════════════════ */

export function WorksPage() {
  const [works, setWorks] = useState<Work[]>(loadWorks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Work | null>(null);
  const [previewWork, setPreviewWork] = useState<Work | null>(null);
  const [dropping, setDropping] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const dragCounterRef = useRef(0);

  const persist = (next: Work[]) => {
    setWorks(next);
    saveWorks(next);
  };

  /* ── Handlers ── */

  const handleAdd = (data: Partial<Work> & { html: string }) => {
    const now = Date.now();
    const work: Work = {
      id: uid(),
      title: data.title || '未命名',
      html: data.html,
      createdAt: now,
      updatedAt: now,
    };
    persist([work, ...works]);
    setModalOpen(false);
    setPreviewWork(work);
    showToast('已新增 HTML 作品');
  };

  const handleEdit = (id: string, data: Partial<Work> & { html: string }) => {
    if (!data.html) return;
    persist(works.map(w => w.id === id ? { ...w, ...data, updatedAt: Date.now() } : w));
    setEditing(null);
    setModalOpen(false);
    showToast('已更新作品');
  };

  const handleDelete = (id: string) => {
    persist(works.filter(w => w.id !== id));
    if (previewWork?.id === id) setPreviewWork(null);
    showToast('已刪除作品');
  };

  const handleSelect = (work: Work) => {
    setPreviewWork(work);
  };

  const handleDropFiles = useCallback((files: FileList) => {
    setDropping(false);
    const htmlFiles = Array.from(files).filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    if (htmlFiles.length === 0) {
      showToast('請上傳 HTML 檔案');
      return;
    }
    const now = Date.now();
    const file = htmlFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const meta = parseHtmlMeta(content);
      const work: Work = {
        id: uid(),
        title: meta.title || file.name.replace(/\.(html?|htm)$/i, '') || '未命名',
        html: content,
        createdAt: now,
        updatedAt: now,
      };
      persist([work, ...works]);
      setPreviewWork(work);
      showToast(`已上傳 ${file.name}`);
    };
    reader.readAsText(file);
  }, [works, showToast, persist]);

  /* ── Global drag & drop ── */

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setDropping(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) setDropping(false);
    };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setDropping(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleDropFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDropFiles]);

  /* ── Render ── */

  return (
    <section className="view works-view works-view--sandbox">
      {/* Header */}
      <div className="works-header">
        <div className="works-header-left">
          <PageBackButton to="/" label="返回首頁" />
          <div>
            <h1 className="works-header-title">作品庫</h1>
            <p className="works-header-subtitle">HTML Sandbox · 本地創作環境</p>
          </div>
        </div>
        <button type="button" className="works-header-add" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新增 HTML 作品
        </button>
      </div>

      {/* Works grid */}
      <div className="works-body works-body--sandbox">
        {works.length === 0 ? (
          <div className="works-empty-state">
            <div className="works-empty-logo">
              <svg viewBox="0 0 48 48" width={44} height={44} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="36" height="40" rx="4" />
                <line x1="6" y1="12" x2="42" y2="12" />
                <circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="18" cy="20" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="24" cy="20" r="1.5" fill="currentColor" stroke="none" />
                <rect x="10" y="24" width="28" height="16" rx="2" />
                <line x1="10" y1="30" x2="38" y2="30" />
                <line x1="10" y1="34" x2="30" y2="34" />
              </svg>
            </div>
            <h2 className="works-empty-title">建立你的第一個 HTML 作品</h2>
            <p className="works-empty-sub">點擊上方「新增 HTML 作品」開始建立第一個作品。</p>
          </div>
        ) : (
          <div className="works-grid">
            {works.map(work => (
              <WorkCard
                key={work.id}
                work={work}
                selected={previewWork?.id === work.id}
                onSelect={handleSelect}
                onEdit={w => { setEditing(w); setModalOpen(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drag & drop overlay */}
      {dropping && <DragDropOverlay onDrop={handleDropFiles} onLeave={() => { dragCounterRef.current = 0; setDropping(false); }} />}

      {/* Form modal */}
      {modalOpen && (
        <WorkFormModal
          editing={editing}
          onSave={editing ? (data) => handleEdit(editing.id, data) : handleAdd}
          onClose={() => { setEditing(null); setModalOpen(false); }}
        />
      )}

      {/* Preview modal */}
      {previewWork && (
        <PreviewModal
          work={previewWork}
          onClose={() => setPreviewWork(null)}
          onEdit={() => { setEditing(previewWork); setModalOpen(true); }}
          onDelete={() => { handleDelete(previewWork.id); }}
        />
      )}
    </section>
  );
}
