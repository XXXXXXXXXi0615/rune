import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useAppStore } from '@/store/useAppStore';
import { putBlob } from '@/store/avatarBlobStorage';
import type { ProviderConfig } from '@/types';
import './PartnerOnboarding.css';

export interface PartnerCreatorSheetProps {
  open: boolean;
  roleSource: 'local' | 'ai' | null;
  onClose: () => void;
  onCreate: (characterId: string) => void;
}

type RoleSource = 'local' | 'ai';

interface Draft {
  name: string;
  signature: string;
  personality: string;
  roleSource: RoleSource;
  providerId: string;
  modelId: string;
  avatarFile: File | null;
  avatarAssetId: string | null;
}

export function PartnerCreatorSheet({ open, roleSource, onClose, onCreate }: PartnerCreatorSheetProps) {
  const createCharacter = useCharacterStore((s) => s.createCharacter);
  const providers = useAppStore((s) => s.providers || []);
  const [draft, setDraft] = useState<Draft>({
    name: '',
    signature: '',
    personality: '',
    roleSource: roleSource === 'ai' ? 'ai' : 'local',
    providerId: '',
    modelId: '',
    avatarFile: null,
    avatarAssetId: null,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<Element | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const onCreateRef = useRef(onCreate);
  onCloseRef.current = onClose;
  onCreateRef.current = onCreate;

  const isAi = draft.roleSource === 'ai';
  const selectedProvider = useMemo(() => providers.find((p) => p.id === draft.providerId), [providers, draft.providerId]);

  useEffect(() => {
    if (open && roleSource) {
      setDraft((prev) => ({ ...prev, roleSource }));
    }
  }, [open, roleSource]);

  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = document.activeElement;
    setError(null);
    setSaving(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const el = lastActiveRef.current instanceof HTMLElement ? lastActiveRef.current : null;
      if (el && el !== document.body && el.isConnected) { el.focus?.(); return; }
      const cta = document.querySelector<HTMLElement>('.cw-empty-secondary-btn');
      cta?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.hasAttribute('disabled') && !(el instanceof HTMLInputElement && el.type === 'file'));
    const first = focusables()[0];
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) { event.preventDefault(); lastEl.focus(); }
      else if (!event.shiftKey && document.activeElement === lastEl) { event.preventDefault(); firstEl.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isAi]);

  const handleAvatar = useCallback((file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setDraft((prev) => ({ ...prev, avatarFile: file }));
  }, [previewUrl]);

  const pickAvatar = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleAvatar(file);
    };
    input.click();
  }, [handleAvatar]);

  const validate = useCallback((): string | null => {
    if (!draft.name.trim()) return '請輸入顯示名稱。';
    return null;
  }, [draft.name]);

  const handleCreate = useCallback(async () => {
    if (saving) return;
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      let avatarAssetId = draft.avatarAssetId || undefined;
      if (draft.avatarFile) {
        avatarAssetId = `partner-avatar-${crypto.randomUUID()}`;
        await putBlob(avatarAssetId, draft.avatarFile);
      }
      const id = createCharacter({
        name: draft.name.trim(),
        subtitle: draft.signature.trim(),
        shortIdentity: draft.signature.trim(),
        description: '',
        greeting: '',
        personality: draft.personality.trim(),
        speakingStyle: '',
        relationship: '',
        scenario: '',
        folderId: 'temporary',
        tags: [],
        capabilities: ['chat'],
        systemPrompt: '',
        isFavorite: false,
        isArchived: false,
        avatarAssetId,
        modelMode: isAi && draft.providerId ? 'custom' : 'global',
        providerId: isAi && draft.providerId ? draft.providerId : undefined,
        modelId: isAi && draft.modelId ? draft.modelId : undefined,
        lastUsedAt: Date.now(),
      });
      onCreateRef.current(id);
      onCloseRef.current();
    } catch {
      setError('建立失敗，請重試。');
      setSaving(false);
    }
  }, [saving, validate, draft, isAi, createCharacter]);

  if (!open) return null;

  return createPortal(
    <div className="po-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="po-dialog po-creator"
        role="dialog"
        aria-modal="true"
        aria-labelledby="po-creator-title"
        ref={panelRef}
      >
        <header className="po-header">
          <div>
            <p className="po-eyebrow">NEW PARTNER</p>
            <h2 id="po-creator-title">建立新夥伴</h2>
          </div>
          <button type="button" className="po-close" onClick={onClose} aria-label="關閉">×</button>
        </header>

        <form
          className="po-creator-form"
          onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}
        >
          <div className="po-creator-avatar-row">
            <button
              type="button"
              className="po-avatar-picker"
              onClick={pickAvatar}
              aria-label="選擇頭像"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="頭像預覽" className="po-avatar-preview" />
              ) : (
                <span className="po-avatar-empty" aria-hidden="true">+</span>
              )}
            </button>
            <div className="po-creator-avatar-hint">
              <strong>頭像</strong>
              <small>{previewUrl ? '點擊更換' : '點擊上傳（可稍後設定）'}</small>
            </div>
          </div>

          <label className="po-field">
            <span className="po-field-label">顯示名稱 <em>*</em></span>
            <input
              ref={inputRef}
              className="po-input"
              value={draft.name}
              maxLength={24}
              placeholder="例如：月讀"
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className="po-field">
            <span className="po-field-label">簽名</span>
            <input
              className="po-input"
              value={draft.signature}
              maxLength={60}
              placeholder="一句話介紹（可稍後設定）"
              onChange={(e) => setDraft((prev) => ({ ...prev, signature: e.target.value }))}
            />
          </label>

          <fieldset className="po-source">
            <legend className="po-field-label">角色來源</legend>
            <div className="po-source-options">
              <button
                type="button"
                className={`po-source-option${!isAi ? ' is-active' : ''}`}
                aria-pressed={!isAi}
                onClick={() => setDraft((prev) => ({ ...prev, roleSource: 'local' }))}
              >
                <strong>本地角色</strong>
                <small>離線可用、不呼叫模型</small>
              </button>
              <button
                type="button"
                className={`po-source-option${isAi ? ' is-active' : ''}`}
                aria-pressed={isAi}
                onClick={() => setDraft((prev) => ({ ...prev, roleSource: 'ai' }))}
              >
                <strong>AI 角色</strong>
                <small>連接到模型提供者</small>
              </button>
            </div>
          </fieldset>

          {isAi && (
            <div className="po-ai-reveal">
              <label className="po-field">
                <span className="po-field-label">Provider</span>
                <select
                  className="po-input"
                  value={draft.providerId}
                  onChange={(e) => setDraft((prev) => ({ ...prev, providerId: e.target.value, modelId: '' }))}
                >
                  <option value="">尚未配置（先建立身份）</option>
                  {providers.map((p: ProviderConfig) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}{p.isDefault ? '（預設）' : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedProvider && (
                <label className="po-field">
                  <span className="po-field-label">Model</span>
                  <input
                    className="po-input"
                    value={draft.modelId}
                    placeholder="例如：gpt-4o"
                    onChange={(e) => setDraft((prev) => ({ ...prev, modelId: e.target.value }))}
                  />
                </label>
              )}

              <label className="po-field">
                <span className="po-field-label">人格設定</span>
                <textarea
                  className="po-input po-textarea"
                  value={draft.personality}
                  rows={3}
                  placeholder="一句話描述這個角色的性格與語氣（可稍後設定）"
                  onChange={(e) => setDraft((prev) => ({ ...prev, personality: e.target.value }))}
                />
              </label>

              <p className="po-ai-note">
                {draft.providerId
                  ? `此角色身份與「${selectedProvider?.name || draft.providerId}」連接。`
                  : '尚未連接模型。你可以先建立身份，稍後再到角色庫連結 Provider。'}
              </p>
            </div>
          )}

          {error && <p className="po-error" role="alert">{error}</p>}

          <footer className="po-footer">
            <button type="button" className="po-btn po-btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="po-btn po-btn-primary" disabled={saving}>
              {saving ? '建立中…' : '建立並開始聊天'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
