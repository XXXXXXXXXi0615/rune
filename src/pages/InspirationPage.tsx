import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageBackButton } from '@/components/ui/PageBackButton';
import { useToastStore } from '@/store/useToastStore';
import {
  createInspirationDraft,
  loadInspirationItems,
  saveInspirationItems,
  createInspirationItem,
  updateInspirationItem,
  deleteInspirationItem,
  togglePinInspirationItem,
  markInspirationCopied,
  getRelativeTime,
  detectKaomojiCategory,
  KAOMOJI_CATEGORIES,
  TYPE_LABELS,
  TYPE_COLORS,
  TYPE_OPTIONS,
  TEMPLATES,
  type InspirationItem,
  type InspirationTemplate,
  type InspirationType,
  type KaomojiCategory,
  type VaultCredential,
} from '@/utils/inspirationStorage';
import { TEMPLATE_SCHEMAS } from '@/utils/templateSchemas';
import type { TemplateSchema } from '@/utils/templateSchemas';
import { TemplateForm } from '@/components/inspiration/TemplateForm';
import '@/styles/inspiration.css';

async function copyInspirationContent(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
      if (document.execCommand('copy')) return true;
    } finally {
      textarea.remove();
    }

    const copyNode = document.createElement('span');
    copyNode.textContent = content;
    copyNode.style.position = 'fixed';
    copyNode.style.left = '-9999px';
    copyNode.style.whiteSpace = 'pre-wrap';
    document.body.appendChild(copyNode);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(copyNode);
    selection?.removeAllRanges();
    selection?.addRange(range);
    try {
      return document.execCommand('copy');
    } finally {
      selection?.removeAllRanges();
      copyNode.remove();
    }
  }
}

/* Primary categories featured in the stats header */
const HEADER_STATS: InspirationType[] = ['json', 'markdown', 'vault'];
const KNOWLEDGE_TYPES: InspirationType[] = ['prompt', 'worldbook', 'character', 'kaomoji'];
const DATA_TYPES: InspirationType[] = ['json', 'csv', 'markdown'];
const VAULT_TYPES: InspirationType[] = ['vault'];
const STORAGE_LAYERS = [
  {
    id: 'knowledge',
    eyebrow: 'Layer 01',
    title: 'Knowledge',
    description: 'Prompt、世界書、角色卡與可重複使用的表達收藏。',
    types: KNOWLEDGE_TYPES,
  },
  {
    id: 'data',
    eyebrow: 'Layer 02',
    title: 'Data',
    description: 'JSON、CSV、Markdown 等結構化資料片段。',
    types: DATA_TYPES,
  },
  {
    id: 'vault',
    eyebrow: 'Layer 03',
    title: 'Vault',
    description: '憑證與敏感入口，只在 Vault 層顯示。',
    types: VAULT_TYPES,
  },
] as const;
const KAOMOJI_SEARCH_ALIASES: Record<KaomojiCategory, string> = {
  開心: '開心 笑 快樂 happy',
  傷心: '傷心 哭 難過 低落 sad',
  撒嬌: '撒嬌 可愛 抱抱 cute',
  生氣: '生氣 憤怒 不爽 angry',
  驚訝: '驚訝 震驚 嚇到 surprise',
  貓貓: '貓 貓貓 猫 cat',
  摸魚: '摸魚 偷懶 躺平 放空 lazy',
  常用: '常用 favorite',
};

function getKaomojiCategory(item: Pick<InspirationItem, 'content' | 'tags'>): KaomojiCategory {
  return KAOMOJI_CATEGORIES.find(category => item.tags.includes(category))
    ?? detectKaomojiCategory(item.content);
}

function replaceKaomojiCategory(tags: string, category: KaomojiCategory): string {
  const next = tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .filter(tag => !KAOMOJI_CATEGORIES.includes(tag as KaomojiCategory));
  return [category, ...next].slice(0, 5).join(', ');
}

function encodeVaultPassword(value: string): string {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return btoa(value);
  }
}

function decodeVaultPassword(value = ''): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    try { return atob(value); } catch { return ''; }
  }
}

function normalizeVaultUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function validateJsonContent(value: string): string {
  try {
    JSON.parse(value);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid JSON';
  }
}

function parseCsvRows(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(',').map(cell => cell.trim()));
}

function renderMarkdownPreview(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function renderStructuredPreview(item: InspirationItem) {
  if (item.type === 'vault') {
    const credential = item.vault;
    return (
      <div className="insp-vault-panel">
        <div className="insp-vault-row">
          <span>Service</span>
          <strong>{credential?.serviceName || item.title}</strong>
        </div>
        <div className="insp-vault-row">
          <span>URL</span>
          <strong>{credential?.url || '未填寫'}</strong>
        </div>
        <div className="insp-vault-row">
          <span>ID</span>
          <strong>{credential?.loginId || '未填寫'}</strong>
        </div>
      </div>
    );
  }

  if (item.type === 'json') {
    let preview = item.content;
    try {
      preview = JSON.stringify(JSON.parse(item.content), null, 2);
    } catch { /* keep original content if legacy item is not valid JSON */ }
    return <pre className="insp-structured-preview insp-json-preview">{preview.slice(0, 900)}</pre>;
  }

  if (item.type === 'csv') {
    const rows = parseCsvRows(item.content).slice(0, 4);
    return (
      <div className="insp-structured-preview insp-csv-preview">
        {rows.length > 0 ? (
          <table className="insp-csv-table">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${item.id}-row-${rowIndex}`}>
                  {row.slice(0, 4).map((cell, cellIndex) => (
                    <td key={`${item.id}-cell-${rowIndex}-${cellIndex}`}>{cell || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span className="insp-structured-empty">CSV 內容為空</span>
        )}
      </div>
    );
  }

  if (item.type === 'markdown') {
    const preview = renderMarkdownPreview(item.content);
    return (
      <div className="insp-structured-preview insp-markdown-preview">
        {preview.length > 220 ? `${preview.slice(0, 220)}…` : preview || 'Markdown 內容為空'}
      </div>
    );
  }

  return (
    <p className="insp-glass-card-body">
      {item.content.length > 150 ? `${item.content.slice(0, 150)}…` : item.content}
    </p>
  );
}

/* ══════════════════════════════════════
   QUICK CAPTURE SHEET — large capture box
   ══════════════════════════════════════ */

function QuickCaptureSheet({ onSave, onClose }: {
  onSave: (data: { type: InspirationType; title: string; content: string; tags: string[] }) => void;
  onClose: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState('');
  const [type, setType] = useState<InspirationType>('prompt');
  const [title, setTitle] = useState('');
  const [tagsStr, setTagsStr] = useState('');

  useEffect(() => {
    document.body.classList.add('sheet-open');
    const t = setTimeout(() => textareaRef.current?.focus(), 60);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('sheet-open');
      clearTimeout(t);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleContentChange = (value: string) => {
    setContent(value);
    if (!value.trim()) {
      setType('prompt');
      setTitle('');
      setTagsStr('');
      return;
    }
    const draft = createInspirationDraft(value);
    setType(draft.type);
    setTitle(draft.title);
    setTagsStr(draft.tags.join(', '));
  };

  const handleSave = () => {
    if (!content.trim() || !title.trim()) return;
    onSave({
      type,
      title: title.trim(),
      content: content.trim(),
      tags: Array.from(new Set(tagsStr.split(',').map(tag => tag.trim()).filter(Boolean))).slice(0, 5),
    });
  };

  return createPortal(
    <div className="insp-sheet-backdrop" onClick={onClose}>
      <section
        className="insp-sheet insp-sheet--capture"
        role="dialog"
        aria-modal="true"
        aria-labelledby="insp-quick-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="insp-sheet-handle" />
        <header className="insp-sheet-header">
          <div className="insp-sheet-heading">
            <span className="insp-sheet-eyebrow">Capture</span>
            <h2 id="insp-quick-title">快速收納</h2>
            <p>貼上內容，月潮即時整理成資料格式與標籤。</p>
          </div>
          <button type="button" className="insp-sheet-close" onClick={onClose} aria-label="關閉快速收納">&#x2715;</button>
        </header>

        <div className="insp-sheet-body">
          <div className="insp-capture-box">
            <textarea
              ref={textareaRef}
              className="insp-capture-textarea"
              value={content}
              onChange={event => handleContentChange(event.target.value)}
              placeholder="貼上灵感、JSON、CSV、Markdown、Prompt、世界書、角色卡或顏文字…"
              aria-label="快速收納內容"
            />
            {!content.trim() && (
              <div className="insp-capture-hint">
                <span className="insp-capture-hint-dot" />
                輸入內容後將即時產生分類預覽
              </div>
            )}
          </div>

          {content.trim() && (
            <div className="insp-capture-preview" aria-live="polite">
              <div className="insp-capture-preview-banner" style={{
                '--preview-color': TYPE_COLORS[type],
              } as React.CSSProperties}>
                <div className="insp-capture-preview-left">
                <span className="insp-capture-preview-eyebrow">格式預覽</span>
                  <strong className="insp-capture-preview-type">{TYPE_LABELS[type]}</strong>
                </div>
                <span className="insp-capture-preview-count">{content.length} 字</span>
              </div>

              <div className="insp-sheet-field">
                <label className="insp-sheet-field-label">調整格式</label>
                <div className="insp-capsule-row">
                  {TYPE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`insp-capsule${type === option.value ? ' insp-capsule--active' : ''}`}
                      data-tone={option.value}
                      onClick={() => setType(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="insp-sheet-field">
                <label className="insp-sheet-field-label" htmlFor="insp-quick-item-title">自動標題</label>
                <input
                  id="insp-quick-item-title"
                  className="insp-sheet-input"
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="輸入標題"
                />
              </div>

              <div className="insp-sheet-field">
                <label className="insp-sheet-field-label" htmlFor="insp-quick-item-tags">Tags · 逗號分隔，最多 5 個</label>
                <input
                  id="insp-quick-item-tags"
                  className="insp-sheet-input"
                  value={tagsStr}
                  onChange={event => setTagsStr(event.target.value)}
                  placeholder="如：Prompt, UI, React"
                />
              </div>
            </div>
          )}
        </div>

        <footer className="insp-sheet-footer">
          <button type="button" className="insp-sheet-btn insp-sheet-btn--ghost" onClick={onClose}>取消</button>
          <button type="button" className="insp-sheet-btn insp-sheet-btn--primary" onClick={handleSave} disabled={!content.trim() || !title.trim()}>
            收納
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════
   INSPIRATION FORM SHEET — iOS bottom sheet
   ══════════════════════════════════════ */

function InspirationForm({ editing, initialType = 'prompt', onSave, onClose }: {
  editing: InspirationItem | null;
  initialType?: InspirationType;
  onSave: (data: { type: InspirationType; title: string; content: string; tags: string[]; pinned: boolean; vault?: VaultCredential }) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<InspirationType>(editing?.type || initialType);
  const [title, setTitle] = useState(editing?.title || (initialType === 'kaomoji' ? '顏文字收藏' : ''));
  const [content, setContent] = useState(editing?.content || '');
  const [tagsStr, setTagsStr] = useState(
    (editing?.tags || (initialType === 'kaomoji' ? ['常用'] : [])).join(', '),
  );
  const [pinned, setPinned] = useState(editing?.pinned || false);
  const [submitted, setSubmitted] = useState(false);
  const [vaultServiceName, setVaultServiceName] = useState(editing?.vault?.serviceName || '');
  const [vaultUrl, setVaultUrl] = useState(editing?.vault?.url || '');
  const [vaultLoginId, setVaultLoginId] = useState(editing?.vault?.loginId || '');
  const [vaultPassword, setVaultPassword] = useState(
    editing?.vault?.passwordEncoded ? decodeVaultPassword(editing.vault.passwordEncoded) : '',
  );
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    document.body.classList.add('sheet-open');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('sheet-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSave = () => {
    setSubmitted(true);
    const isVault = type === 'vault';
    const isJson = type === 'json';
    const resolvedTitle = title.trim()
      || (type === 'kaomoji' ? '顏文字收藏' : '')
      || (isVault ? vaultServiceName.trim() || vaultLoginId.trim() || 'Vault Credential' : '');
    const resolvedContent = isVault
      ? [
          vaultServiceName.trim() && `Service: ${vaultServiceName.trim()}`,
          vaultUrl.trim() && `URL: ${normalizeVaultUrl(vaultUrl)}`,
          vaultLoginId.trim() && `ID: ${vaultLoginId.trim()}`,
        ].filter(Boolean).join('\n')
      : content.trim();
    const nextJsonError = isJson ? validateJsonContent(resolvedContent) : '';
    setJsonError(nextJsonError);
    if (!resolvedTitle || (!isVault && !resolvedContent) || (isVault && !vaultServiceName.trim() && !vaultUrl.trim() && !vaultLoginId.trim()) || nextJsonError) return;
    onSave({
      type,
      title: resolvedTitle,
      content: resolvedContent,
      tags: Array.from(new Set(tagsStr.split(',').map(s => s.trim()).filter(Boolean))).slice(0, 5),
      pinned,
      vault: isVault ? {
        serviceName: vaultServiceName.trim() || resolvedTitle,
        url: normalizeVaultUrl(vaultUrl),
        loginId: vaultLoginId.trim(),
        passwordEncoded: encodeVaultPassword(vaultPassword),
      } : undefined,
    });
  };

  const titleError = submitted && type !== 'kaomoji' && type !== 'vault' && !title.trim();
  const contentError = submitted && type !== 'vault' && !content.trim();
  const vaultError = submitted && type === 'vault' && !vaultServiceName.trim() && !vaultUrl.trim() && !vaultLoginId.trim();
  const selectedKaomojiCategory = KAOMOJI_CATEGORIES.find(category =>
    tagsStr.split(',').map(tag => tag.trim()).includes(category),
  ) ?? detectKaomojiCategory(content);

  const handleTypeChange = (nextType: InspirationType) => {
    setType(nextType);
    setJsonError('');
    if (nextType === 'kaomoji') {
      if (!title.trim()) setTitle('顏文字收藏');
      if (!KAOMOJI_CATEGORIES.some(category => tagsStr.includes(category))) {
        setTagsStr(replaceKaomojiCategory(tagsStr, detectKaomojiCategory(content)));
      }
    } else if (nextType === 'vault') {
      if (!title.trim()) setTitle(vaultServiceName || 'Vault Credential');
    }
  };

  return createPortal(
    <div className="insp-sheet-backdrop" onClick={onClose}>
      <section
        className="insp-sheet insp-sheet--form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="insp-form-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="insp-sheet-handle" />
        <header className="insp-sheet-header">
          <div className="insp-sheet-heading">
            <span className="insp-sheet-eyebrow">{editing ? 'Edit' : 'New'}</span>
            <h2 id="insp-form-title">
              {editing ? (editing.type === 'kaomoji' ? '編輯顏文字' : '編輯收納') : (initialType === 'kaomoji' ? '新增顏文字' : '新增收納')}
            </h2>
            <p>{editing ? '調整這筆資料的格式與內容' : '新增靈感、知識片段、結構化資料或 Vault 憑證'}</p>
          </div>
          <button type="button" className="insp-sheet-close" onClick={onClose} aria-label="關閉">&#x2715;</button>
        </header>

        <div className="insp-sheet-body">
          <div className="insp-sheet-field">
            <label className="insp-sheet-field-label">格式</label>
            <div className="insp-capsule-row">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`insp-capsule${type === opt.value ? ' insp-capsule--active' : ''}`}
                  data-tone={opt.value}
                  onClick={() => handleTypeChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="insp-sheet-field">
            <label className="insp-sheet-field-label" htmlFor="insp-form-title-input">
              {type === 'kaomoji' ? '收藏名稱 · 可選' : type === 'vault' ? '標題 · 可選' : '標題'}
            </label>
            <input
              id="insp-form-title-input"
              className={`insp-sheet-input${titleError ? ' insp-sheet-input--error' : ''}`}
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); if (submitted) setSubmitted(false); }}
              placeholder={type === 'kaomoji' ? '顏文字收藏' : type === 'vault' ? '例如：Notion 主帳號' : '輸入標題'}
              autoFocus
            />
            {titleError && <span className="insp-sheet-field-error">請輸入標題</span>}
          </div>

          {type === 'vault' ? (
            <div className="insp-vault-fields">
              <div className="insp-sheet-field">
                <label className="insp-sheet-field-label" htmlFor="insp-vault-service">服務名稱</label>
                <input
                  id="insp-vault-service"
                  className={`insp-sheet-input${vaultError ? ' insp-sheet-input--error' : ''}`}
                  value={vaultServiceName}
                  onChange={e => { setVaultServiceName(e.target.value); if (submitted) setSubmitted(false); }}
                  placeholder="例如：Notion / Gmail / OpenAI"
                />
              </div>
              <div className="insp-sheet-field">
                <label className="insp-sheet-field-label" htmlFor="insp-vault-url">網站 URL</label>
                <input
                  id="insp-vault-url"
                  className="insp-sheet-input"
                  value={vaultUrl}
                  onChange={e => setVaultUrl(e.target.value)}
                  placeholder="example.com 或 https://example.com"
                />
              </div>
              <div className="insp-vault-grid">
                <div className="insp-sheet-field">
                  <label className="insp-sheet-field-label" htmlFor="insp-vault-id">ID / Email</label>
                  <input
                    id="insp-vault-id"
                    className="insp-sheet-input"
                    value={vaultLoginId}
                    onChange={e => setVaultLoginId(e.target.value)}
                    placeholder="登入帳號"
                    autoComplete="username"
                  />
                </div>
                <div className="insp-sheet-field">
                  <label className="insp-sheet-field-label" htmlFor="insp-vault-password">Password</label>
                  <input
                    id="insp-vault-password"
                    className="insp-sheet-input"
                    type="password"
                    value={vaultPassword}
                    onChange={e => setVaultPassword(e.target.value)}
                    placeholder="預設遮蔽保存"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {vaultError && <span className="insp-sheet-field-error">請至少填寫服務名稱、URL 或 ID</span>}
            </div>
          ) : (
            <div className="insp-sheet-field">
              <label className="insp-sheet-field-label" htmlFor="insp-form-content-input">
                {type === 'kaomoji' ? '顏文字' : type === 'json' ? 'JSON 內容' : type === 'csv' ? 'CSV 內容' : type === 'markdown' ? 'Markdown 內容' : '內容'}
              </label>
              <textarea
                id="insp-form-content-input"
                className={`insp-sheet-input insp-sheet-textarea${type === 'kaomoji' ? ' insp-sheet-textarea--kaomoji' : ''}${contentError || jsonError ? ' insp-sheet-input--error' : ''}`}
                value={content}
                onChange={e => { setContent(e.target.value); if (submitted) setSubmitted(false); if (jsonError) setJsonError(''); }}
                placeholder={type === 'kaomoji' ? '例如：૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა' : type === 'json' ? '{\n  "name": "Lunartide"\n}' : type === 'csv' ? 'name,type\nLuna,companion' : type === 'markdown' ? '# 標題\n- 要點' : '貼上或輸入收納內容'}
                rows={6}
              />
              {contentError && <span className="insp-sheet-field-error">請輸入內容</span>}
              {jsonError && <span className="insp-sheet-field-error">JSON 格式錯誤：{jsonError}</span>}
            </div>
          )}

          {type === 'kaomoji' && (
            <div className="insp-sheet-field">
              <label className="insp-sheet-field-label">顏文字分類</label>
              <div className="insp-kaomoji-category-picker">
                {KAOMOJI_CATEGORIES.map(category => (
                  <button
                    key={category}
                    type="button"
                    className={`insp-kaomoji-category-chip${selectedKaomojiCategory === category ? ' active' : ''}`}
                    onClick={() => setTagsStr(replaceKaomojiCategory(tagsStr, category))}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="insp-sheet-field">
            <label className="insp-sheet-field-label" htmlFor="insp-form-tags-input">標籤 · 逗號分隔</label>
            <input
              id="insp-form-tags-input"
              className="insp-sheet-input"
              type="text"
              value={tagsStr}
              onChange={e => setTagsStr(e.target.value)}
              placeholder="如: AI, 設計, 寫作"
            />
          </div>

          <button
            type="button"
            className={`insp-pin-toggle${pinned ? ' active' : ''}`}
            onClick={() => setPinned(p => !p)}
            aria-pressed={pinned}
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v5l3 3v2h-5v7l-2 2-2-2v-7H5v-2l3-3V2h8Z" />
            </svg>
            <span>{type === 'kaomoji' ? (pinned ? '已收藏' : '加入常用收藏') : (pinned ? '已置頂' : '置頂於收納箱')}</span>
          </button>
        </div>

        <footer className="insp-sheet-footer">
          <button type="button" className="insp-sheet-btn insp-sheet-btn--ghost" onClick={onClose}>取消</button>
          <button type="button" className="insp-sheet-btn insp-sheet-btn--primary" onClick={handleSave}>
            {editing ? '儲存' : '新增'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function KaomojiStickerCard({
  item,
  copied,
  menuOpen,
  onCopy,
  onToggleMenu,
  onEdit,
  onToggleFavorite,
  onDelete,
}: {
  item: InspirationItem;
  copied: boolean;
  menuOpen: boolean;
  onCopy: () => void;
  onToggleMenu: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const category = getKaomojiCategory(item);

  return (
    <article className={`insp-kaomoji-card${item.pinned ? ' favorite' : ''}${copied ? ' copied' : ''}`}>
      <span className="insp-kaomoji-tape" aria-hidden="true" />
      <button
        type="button"
        className="insp-kaomoji-copy-zone"
        onClick={onCopy}
        aria-label={`複製顏文字 ${item.content}`}
      >
        <span className="insp-kaomoji-glyph">{item.content}</span>
        <span className="insp-kaomoji-card-foot">
          <span className="insp-kaomoji-category">{category}</span>
          <span className="insp-kaomoji-copy-hint">{copied ? '已複製' : '點一下複製'}</span>
        </span>
      </button>

      {item.pinned && (
        <span className="insp-kaomoji-favorite-mark" aria-label="已收藏">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 2.8 2.74 5.55 6.13.89-4.44 4.33 1.05 6.1L12 16.8l-5.48 2.87 1.05-6.1-4.44-4.33 6.13-.89L12 2.8Z" />
          </svg>
        </span>
      )}

      <button
        type="button"
        className="insp-kaomoji-more"
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu();
        }}
        aria-label="顏文字更多操作"
        aria-expanded={menuOpen}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>

      {menuOpen && (
        <div className="insp-kaomoji-menu" role="menu" onClick={event => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={onEdit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>
            編輯
          </button>
          <button type="button" role="menuitem" onClick={onToggleFavorite}>
            <svg viewBox="0 0 24 24" fill={item.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 2.8 2.74 5.55 6.13.89-4.44 4.33 1.05 6.1L12 16.8l-5.48 2.87 1.05-6.1-4.44-4.33 6.13-.89L12 2.8Z" />
            </svg>
            {item.pinned ? '取消收藏' : '收藏'}
          </button>
          <button type="button" role="menuitem" className="danger" onClick={onDelete}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="m19 6-1 15H6L5 6" />
            </svg>
            刪除
          </button>
        </div>
      )}
    </article>
  );
}

function InspirationStorageCard({
  item,
  copied,
  onCopy,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  item: InspirationItem;
  copied: boolean;
  onCopy: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`insp-glass-card${item.pinned ? ' pinned' : ''}`} data-tone={item.type}>
      <div className="insp-glass-card-glow" aria-hidden="true" />
      <div className="insp-glass-card-head">
        <span className="insp-glass-card-type">
          <i className="insp-glass-card-type-dot" />
          {TYPE_LABELS[item.type]}
        </span>
        {item.pinned && (
          <span className="insp-glass-card-pin" aria-label="置頂">
            <svg viewBox="0 0 24 24" width={11} height={11} fill="currentColor" stroke="none">
              <path d="M12 2v5l3 3v2h-5v7l-2 2-2-2v-7H5v-2l3-3V2h8Z" />
            </svg>
          </span>
        )}
      </div>
      <h3 className="insp-glass-card-title">{item.title}</h3>
      {renderStructuredPreview(item)}
      {item.tags.length > 0 && (
        <div className="insp-glass-card-tags">
          {item.tags.map(t => <span key={t} className="insp-tag">{t}</span>)}
        </div>
      )}
      <div className="insp-glass-card-meta">
        {item.lastUsedAt
          ? <span className="insp-card-time">已複製 {getRelativeTime(item.lastUsedAt)}</span>
          : <span className="insp-card-time">{getRelativeTime(item.updatedAt)}</span>}
      </div>
      <div className="insp-glass-card-actions">
        <button type="button" className="insp-act" onClick={onCopy} aria-label="複製內容">
          {copied ? (
            <span className="insp-act-copied">已複製</span>
          ) : (
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
        <button type="button" className={`insp-act${item.pinned ? ' on' : ''}`} onClick={onTogglePin} aria-label={item.pinned ? '取消置頂' : '置頂'}>
          <svg viewBox="0 0 24 24" width={15} height={15} fill={item.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v5l3 3v2h-5v7l-2 2-2-2v-7H5v-2l3-3V2h8Z" />
          </svg>
        </button>
        <button type="button" className="insp-act" onClick={onEdit} aria-label="編輯">
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button type="button" className="insp-act insp-act--del" onClick={onDelete} aria-label="刪除">
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </article>
  );
}

function VaultCredentialCard({
  item,
  copied,
  expanded,
  revealed,
  onToggleExpanded,
  onToggleReveal,
  onOpenUrl,
  onCopyId,
  onCopyPassword,
  onCopy,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  item: InspirationItem;
  copied: boolean;
  expanded: boolean;
  revealed: boolean;
  onToggleExpanded: () => void;
  onToggleReveal: () => void;
  onOpenUrl: () => void;
  onCopyId: () => void;
  onCopyPassword: () => void;
  onCopy: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const credential = item.vault;
  const password = decodeVaultPassword(credential?.passwordEncoded || '');

  return (
    <article className={`insp-vault-card${item.pinned ? ' pinned' : ''}${expanded ? ' expanded' : ''}`} data-tone="vault">
      <div className="insp-vault-card-glow" aria-hidden="true" />
      <header className="insp-vault-card-head">
        <span className="insp-vault-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4.5" y="10" width="15" height="10" rx="3" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
          </svg>
        </span>
        <div className="insp-vault-title-block">
          <span>Credential Vault</span>
          <h3>{credential?.serviceName || item.title}</h3>
        </div>
        <button type="button" className="insp-vault-expand" onClick={onToggleExpanded} aria-expanded={expanded} aria-label="展開 Vault 詳情">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d={expanded ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
          </svg>
        </button>
      </header>

      <div className="insp-vault-summary">
        <div>
          <span>URL</span>
          <strong>{credential?.url || '未填寫'}</strong>
        </div>
        <div>
          <span>ID</span>
          <strong>{credential?.loginId || '未填寫'}</strong>
        </div>
      </div>

      <div className="insp-vault-quick-actions" aria-label="Vault 快速操作">
        <button type="button" onClick={onOpenUrl}>Open URL</button>
        <button type="button" onClick={onCopyId}>Copy ID</button>
        <button type="button" onClick={onCopyPassword}>Copy PW</button>
      </div>

      {expanded && (
        <div className="insp-vault-detail" aria-label="Vault 詳情">
          <div className="insp-vault-detail-row">
            <span>Service</span>
            <strong>{credential?.serviceName || item.title}</strong>
          </div>
          <div className="insp-vault-detail-row">
            <span>URL</span>
            <strong>{credential?.url || '未填寫'}</strong>
          </div>
          <div className="insp-vault-detail-row">
            <span>ID</span>
            <strong>{credential?.loginId || '未填寫'}</strong>
          </div>
          <div className="insp-vault-detail-row">
            <span>Password</span>
            <strong>{revealed ? password || '未填寫' : '••••••••'}</strong>
            <button type="button" onClick={onToggleReveal}>{revealed ? '隱藏' : '顯示'}</button>
          </div>
          {item.tags.length > 0 && (
            <div className="insp-glass-card-tags insp-vault-tags">
              {item.tags.map(t => <span key={t} className="insp-tag">{t}</span>)}
            </div>
          )}
        </div>
      )}

      <footer className="insp-vault-card-actions">
        <span>{item.lastUsedAt ? `已複製 ${getRelativeTime(item.lastUsedAt)}` : getRelativeTime(item.updatedAt)}</span>
        <div>
          <button type="button" className="insp-act" onClick={onCopy} aria-label="複製 Vault 內容">
            {copied ? (
              <span className="insp-act-copied">已複製</span>
            ) : (
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button type="button" className={`insp-act${item.pinned ? ' on' : ''}`} onClick={onTogglePin} aria-label={item.pinned ? '取消置頂' : '置頂'}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill={item.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v5l3 3v2h-5v7l-2 2-2-2v-7H5v-2l3-3V2h8Z" />
            </svg>
          </button>
          <button type="button" className="insp-act" onClick={onEdit} aria-label="編輯 Vault">
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button type="button" className="insp-act insp-act--del" onClick={onDelete} aria-label="刪除 Vault">
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </footer>
    </article>
  );
}

/* ══════════════════════════════════════
   STORAGE BOX PAGE — 收纳箱
   ══════════════════════════════════════ */

export function InspirationPage() {
  const [items, setItems] = useState<InspirationItem[]>(loadInspirationItems);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<InspirationType | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [editing, setEditing] = useState<InspirationItem | null>(null);
  const [newItemType, setNewItemType] = useState<InspirationType>('prompt');
  const [kaomojiCategory, setKaomojiCategory] = useState<KaomojiCategory | 'all'>('all');
  const [kaomojiMenuId, setKaomojiMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedVaultIds, setRevealedVaultIds] = useState<Set<string>>(() => new Set());
  const [templateSchema, setTemplateSchema] = useState<TemplateSchema | null>(null);
  const [expandedVaultIds, setExpandedVaultIds] = useState<Set<string>>(() => new Set());
  const showToast = useToastStore((state) => state.showToast);

  const persist = (next: InspirationItem[]) => {
    setItems(next);
    saveInspirationItems(next);
  };

  /* Stats */
  const stats = useMemo(() => {
    const counts: Record<InspirationType, number> = {
      prompt: 0,
      worldbook: 0,
      character: 0,
      kaomoji: 0,
      json: 0,
      csv: 0,
      markdown: 0,
      vault: 0,
    };
    items.forEach(i => {
      if (i.type in counts) counts[i.type] += 1;
    });
    const latest = items.reduce<string | null>((acc, i) => {
      if (!acc || new Date(i.updatedAt) > new Date(acc)) return i.updatedAt;
      return acc;
    }, null);
    return { counts, total: items.length, latest };
  }, [items]);

  /* Filter + search + sort */
  const filtered = useMemo(() => {
    let result = items;
    if (filterType !== 'all') result = result.filter(i => i.type === filterType);
    if (filterType === 'kaomoji' && kaomojiCategory !== 'all') {
      result = result.filter(item => getKaomojiCategory(item) === kaomojiCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q)) ||
        (i.vault?.serviceName || '').toLowerCase().includes(q) ||
        (i.vault?.url || '').toLowerCase().includes(q) ||
        (i.vault?.loginId || '').toLowerCase().includes(q) ||
        (i.type === 'kaomoji' && KAOMOJI_SEARCH_ALIASES[getKaomojiCategory(i)].toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [items, filterType, kaomojiCategory, search]);

  const isEmpty = items.length === 0;
  const noResults = !isEmpty && filtered.length === 0;
  const knowledgeItems = filtered.filter(item => KNOWLEDGE_TYPES.includes(item.type));
  const dataItems = filtered.filter(item => DATA_TYPES.includes(item.type));
  const vaultItems = filtered.filter(item => item.type === 'vault');
  const kaomojiItems = knowledgeItems.filter(item => item.type === 'kaomoji');
  const standardKnowledgeItems = knowledgeItems.filter(item => item.type !== 'kaomoji');
  const kaomojiLibraryEmpty = filterType === 'kaomoji' && stats.counts.kaomoji === 0;

  useEffect(() => {
    if (!kaomojiMenuId) return;
    const closeMenu = () => setKaomojiMenuId(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [kaomojiMenuId]);

  const openNewForm = (type: InspirationType = 'prompt') => {
    setEditing(null);
    setNewItemType(type);
    setModalOpen(true);
  };

  /* Actions */
  const handleAdd = (data: { type: InspirationType; title: string; content: string; tags: string[]; pinned: boolean; vault?: VaultCredential }) => {
    persist([createInspirationItem(data), ...items]);
    setModalOpen(false);
    showToast(data.type === 'kaomoji' ? '已新增顏文字' : data.type === 'vault' ? '已加入 Vault' : '已新增');
  };

  const handleQuickCapture = (data: { type: InspirationType; title: string; content: string; tags: string[] }) => {
    persist([createInspirationItem(data), ...items]);
    setQuickCaptureOpen(false);
    showToast(data.type === 'kaomoji' ? '已收錄顏文字' : '已收納至月潮庫藏');
  };

  const handleEdit = (id: string, data: { type: InspirationType; title: string; content: string; tags: string[]; pinned: boolean; vault?: VaultCredential }) => {
    persist(updateInspirationItem(items, id, data));
    setEditing(null);
    setModalOpen(false);
    showToast('已更新');
  };

  const handleDelete = (id: string) => {
    persist(deleteInspirationItem(items, id));
    showToast('已刪除');
  };

  const handleTogglePin = (id: string) => {
    persist(togglePinInspirationItem(items, id));
    setKaomojiMenuId(null);
  };

  const handleCopy = async (item: InspirationItem) => {
    const copied = await copyInspirationContent(item.content);
    if (!copied) return;
    persist(markInspirationCopied(items, item.id));
    setCopiedId(item.id);
    showToast(item.type === 'kaomoji' ? '已複製顏文字' : '已複製');
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyText = async (content: string, itemId: string, message: string) => {
    const copied = await copyInspirationContent(content);
    if (!copied) return;
    setCopiedId(itemId);
    showToast(message);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleOpenVaultUrl = (item: InspirationItem) => {
    const url = normalizeVaultUrl(item.vault?.url || '');
    if (!url) {
      showToast('這筆 Vault 還沒有 URL');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const toggleVaultReveal = (id: string) => {
    setRevealedVaultIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVaultExpanded = (id: string) => {
    setExpandedVaultIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Render ── */

  if (isEmpty) {
    return (
      <section className="view insp-view" id="inspiration-view">
        <div className="page-header-row">
          <PageBackButton to="/" label="返回首頁" />
          <h1 className="page-title">收纳箱</h1>
          <span className="insp-header-spacer" />
        </div>

        <div className="insp-empty-hero">
          <div className="insp-empty-orb" aria-hidden="true">
            <div className="insp-empty-orb-core" />
            <div className="insp-empty-orb-ring" />
            <div className="insp-empty-orb-ring insp-empty-orb-ring--2" />
          </div>
          <span className="insp-empty-eyebrow">Structured Storage</span>
          <h2 className="insp-empty-title">建立你的第一個收纳</h2>
          <p className="insp-empty-sub">
            靈感、知識片段、JSON、CSV、Markdown 與 Vault 憑證，都能安靜放進同一個收纳箱。
          </p>

          <div className="insp-empty-cta-row">
            <button type="button" className="insp-empty-cta insp-empty-cta--primary" onClick={() => setQuickCaptureOpen(true)}>
              <span className="insp-empty-cta-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 5 13h6l-1 9 8-12h-6l1-8Z" />
                </svg>
              </span>
              <span className="insp-empty-cta-copy">
                <strong>快速收納</strong>
                <span>貼上內容 · 自動整理</span>
              </span>
            </button>
            <button type="button" className="insp-empty-cta insp-empty-cta--glass" onClick={() => openNewForm()}>
              <span className="insp-empty-cta-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
              <span className="insp-empty-cta-copy">
                <strong>新增資料</strong>
                <span>格式欄位 · Vault 可用</span>
              </span>
            </button>
          </div>

          {/* Template Buttons */}
          <div className="insp-template-row">
            <span className="insp-template-label">使用模板快速開始</span>
            {TEMPLATES.map(tpl => {
              const schema = TEMPLATE_SCHEMAS.find(s => s.id === tpl.id);
              return (
              <button
                key={tpl.id}
                type="button"
                className="insp-template-btn"
                onClick={() => {
                  if (schema) {
                    setTemplateSchema(schema);
                  } else {
                    // Fallback: open generic form with content pre-filled
                    setEditing({
                      id: '',
                      title: '',
                      type: tpl.type,
                      content: tpl.content,
                      tags: tpl.tags,
                      pinned: false,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    } as InspirationItem & { id: '' });
                    setModalOpen(true);
                  }
                }}
              >
                <span className="insp-template-btn-icon">
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    {tpl.type === 'worldbook'
                      ? <><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>
                      : tpl.type === 'character'
                      ? <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>
                      : <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /></>
                    }
                  </svg>
                </span>
                <span className="insp-template-btn-title">{tpl.title}</span>
                <span className="insp-template-btn-desc">{tpl.description}</span>
              </button>
              );
            })}
          </div>
        </div>

        {quickCaptureOpen && (
          <QuickCaptureSheet onSave={handleQuickCapture} onClose={() => setQuickCaptureOpen(false)} />
        )}
        {modalOpen && (
          <InspirationForm
            editing={editing}
            initialType={newItemType}
            onSave={editing ? (data) => handleEdit(editing.id, data) : handleAdd}
            onClose={() => { setEditing(null); setModalOpen(false); }}
          />
        )}
        {templateSchema && (
          <TemplateForm
            schema={templateSchema}
            onSave={(data) => {
              handleAdd({ ...data, pinned: false });
              setTemplateSchema(null);
            }}
            onClose={() => setTemplateSchema(null)}
          />
        )}
      </section>
    );
  }

  return (
    <section className="view insp-view" id="inspiration-view">
      {/* Header */}
      <div className="page-header-row">
        <PageBackButton to="/" label="返回首頁" />
        <h1 className="page-title">收纳箱</h1>
        <button type="button" className="insp-header-add" onClick={() => openNewForm()} aria-label="新增資料">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="insp-scroll">
        {/* Stats Header Card */}
        <div className="insp-stats-card">
          <div className="insp-stats-card-glow" aria-hidden="true" />
          <div className="insp-stats-card-head">
            <div className="insp-stats-card-eyebrow">
              <span className="insp-stats-card-dot" />
              結構收納
            </div>
            <div className="insp-stats-card-total">
              <strong>{stats.total}</strong>
              <span>總收納</span>
            </div>
          </div>
          <div className="insp-stats-card-grid">
            {HEADER_STATS.map(t => (
              <div key={t} className="insp-stat-tile" style={{ '--stat-color': TYPE_COLORS[t] } as React.CSSProperties}>
                <span className="insp-stat-tile-count">{stats.counts[t]}</span>
                <span className="insp-stat-tile-label">{TYPE_LABELS[t]}</span>
              </div>
            ))}
          </div>
          <div className="insp-stats-card-foot">
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            <span>最後收納 · {stats.latest ? getRelativeTime(stats.latest) : '—'}</span>
          </div>
        </div>

        {/* Large Quick Capture Box */}
        <button type="button" className="insp-capture-card" onClick={() => setQuickCaptureOpen(true)}>
          <span className="insp-capture-card-glow" aria-hidden="true" />
          <span className="insp-capture-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 5 13h6l-1 9 8-12h-6l1-8Z" />
            </svg>
          </span>
          <span className="insp-capture-card-copy">
            <strong>快速收納</strong>
            <span>貼上內容，自動整理格式</span>
          </span>
          <svg className="insp-capture-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {/* Search */}
        <div className="insp-search-wrap">
          <svg className="insp-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="insp-search-input" type="text" value={search}
            onChange={e => setSearch(e.target.value)} placeholder="搜尋收纳箱…" />
        </div>

        {/* Filter chips */}
        <div className="insp-filter-row">
          <button
            type="button"
            className={`insp-capsule insp-capsule--filter${filterType === 'all' ? ' insp-capsule--active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            <span>全部</span>
            <em>{stats.total}</em>
          </button>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`insp-capsule insp-capsule--filter${filterType === opt.value ? ' insp-capsule--active' : ''}`}
              data-tone={opt.value}
              onClick={() => setFilterType(opt.value)}
            >
              <span>{opt.label}</span>
              <em>{stats.counts[opt.value]}</em>
            </button>
          ))}
        </div>

        {filterType === 'kaomoji' && (
          <div className="insp-kaomoji-category-row" aria-label="顏文字分類">
            <button
              type="button"
              className={`insp-kaomoji-category-chip${kaomojiCategory === 'all' ? ' active' : ''}`}
              onClick={() => setKaomojiCategory('all')}
            >
              全部
            </button>
            {KAOMOJI_CATEGORIES.map(category => (
              <button
                key={category}
                type="button"
                className={`insp-kaomoji-category-chip${kaomojiCategory === category ? ' active' : ''}`}
                onClick={() => setKaomojiCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {/* Layered storage */}
        {kaomojiLibraryEmpty ? (
          <div className="insp-kaomoji-empty">
            <div className="insp-kaomoji-empty-sample" aria-hidden="true">(｡•́︿•̀｡)</div>
            <h2>建立你的第一個顏文字收藏</h2>
            <p>把常用的心情留在這座貼紙簿，點一下就能帶走。</p>
            <button type="button" onClick={() => openNewForm('kaomoji')}>新增顏文字</button>
          </div>
        ) : noResults ? (
          <div className="insp-no-results">
            <div className="insp-no-results-text">找不到符合條件的資料</div>
            <div className="insp-no-results-sub">試試不同的關鍵字或分類</div>
          </div>
        ) : (
          <div className="insp-layer-stack">
            {STORAGE_LAYERS.map((layer) => {
              const layerItems = layer.id === 'knowledge'
                ? knowledgeItems
                : layer.id === 'data'
                  ? dataItems
                  : vaultItems;
              if (layerItems.length === 0) return null;

              return (
                <section key={layer.id} className={`insp-layer-section insp-layer-section--${layer.id}`} aria-labelledby={`insp-layer-${layer.id}`}>
                  <div className="insp-layer-header">
                    <div>
                      <span>{layer.eyebrow}</span>
                      <h2 id={`insp-layer-${layer.id}`}>{layer.title}</h2>
                      <p>{layer.description}</p>
                    </div>
                    <strong>{layerItems.length}</strong>
                  </div>

                  <div className="insp-layer-types" aria-label={`${layer.title} types`}>
                    {layer.types.map(type => (
                      <span key={type} data-tone={type}>{TYPE_LABELS[type]}</span>
                    ))}
                  </div>

                  {layer.id === 'knowledge' && standardKnowledgeItems.length > 0 && (
                    <div className="insp-list">
                      {standardKnowledgeItems.map(item => (
                        <InspirationStorageCard
                          key={item.id}
                          item={item}
                          copied={copiedId === item.id}
                          onCopy={() => handleCopy(item)}
                          onTogglePin={() => handleTogglePin(item.id)}
                          onEdit={() => { setEditing(item); setNewItemType(item.type); setModalOpen(true); }}
                          onDelete={() => handleDelete(item.id)}
                        />
                      ))}
                    </div>
                  )}

                  {layer.id === 'knowledge' && kaomojiItems.length > 0 && (
                    <div className="insp-kaomoji-section" aria-labelledby="insp-kaomoji-title">
                      <div className="insp-section-heading">
                        <div>
                          <span>Sticker Collection</span>
                          <h3 id="insp-kaomoji-title">顏文字收藏館</h3>
                        </div>
                        <strong>{kaomojiItems.length}</strong>
                      </div>
                      <div className="insp-kaomoji-wall">
                        {kaomojiItems.map(item => (
                          <KaomojiStickerCard
                            key={item.id}
                            item={item}
                            copied={copiedId === item.id}
                            menuOpen={kaomojiMenuId === item.id}
                            onCopy={() => handleCopy(item)}
                            onToggleMenu={() => setKaomojiMenuId(current => current === item.id ? null : item.id)}
                            onEdit={() => {
                              setKaomojiMenuId(null);
                              setEditing(item);
                              setNewItemType('kaomoji');
                              setModalOpen(true);
                            }}
                            onToggleFavorite={() => handleTogglePin(item.id)}
                            onDelete={() => {
                              setKaomojiMenuId(null);
                              handleDelete(item.id);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {layer.id === 'data' && (
                    <div className="insp-list">
                      {dataItems.map(item => (
                        <InspirationStorageCard
                          key={item.id}
                          item={item}
                          copied={copiedId === item.id}
                          onCopy={() => handleCopy(item)}
                          onTogglePin={() => handleTogglePin(item.id)}
                          onEdit={() => { setEditing(item); setNewItemType(item.type); setModalOpen(true); }}
                          onDelete={() => handleDelete(item.id)}
                        />
                      ))}
                    </div>
                  )}

                  {layer.id === 'vault' && (
                    <div className="insp-vault-list">
                      {vaultItems.map(item => (
                        <VaultCredentialCard
                          key={item.id}
                          item={item}
                          copied={copiedId === item.id}
                          expanded={expandedVaultIds.has(item.id)}
                          revealed={revealedVaultIds.has(item.id)}
                          onToggleExpanded={() => toggleVaultExpanded(item.id)}
                          onToggleReveal={() => toggleVaultReveal(item.id)}
                          onOpenUrl={() => handleOpenVaultUrl(item)}
                          onCopyId={() => handleCopyText(item.vault?.loginId || '', item.id, '已複製 ID')}
                          onCopyPassword={() => handleCopyText(decodeVaultPassword(item.vault?.passwordEncoded || ''), item.id, '已複製密碼')}
                          onCopy={() => handleCopy(item)}
                          onTogglePin={() => handleTogglePin(item.id)}
                          onEdit={() => { setEditing(item); setNewItemType(item.type); setModalOpen(true); }}
                          onDelete={() => handleDelete(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button type="button" className="insp-fab" onClick={() => openNewForm(filterType === 'kaomoji' ? 'kaomoji' : filterType === 'vault' ? 'vault' : 'prompt')} aria-label={filterType === 'kaomoji' ? '新增顏文字' : '新增資料'}>
        <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Sheets */}
      {modalOpen && (
        <InspirationForm
          editing={editing}
          initialType={newItemType}
          onSave={editing ? (data) => handleEdit(editing.id, data) : handleAdd}
          onClose={() => { setEditing(null); setModalOpen(false); }}
        />
      )}
      {quickCaptureOpen && (
        <QuickCaptureSheet onSave={handleQuickCapture} onClose={() => setQuickCaptureOpen(false)} />
      )}
    </section>
  );
}
