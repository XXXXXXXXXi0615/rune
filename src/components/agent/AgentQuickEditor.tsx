import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore, selectAgentAvatar, selectAgentDisplayName } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { deletePetImages } from '@/store/petImages';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { AGENT_AVATAR_ACCEPT, AgentAvatarError, storeAgentAvatar } from '@/features/agentIdentity/agentAvatar';
import { AGENT_DEFAULT_DISPLAY_NAME, SYSTEM_AGENT_NAME } from '@/store/agentIdentity';
import type { AvatarImageMeta } from '@/types';
import './AgentQuickEditor.css';

const MAX_DISPLAY_NAME_LENGTH = 24;

export type AgentQuickEditorVariant = 'popover' | 'sheet';

interface AgentQuickEditorProps {
  open: boolean;
  variant: AgentQuickEditorVariant;
  /** Anchor rect for the desktop popover (presence pill). */
  anchor?: DOMRect | null;
  onClose: () => void;
}

export function AgentQuickEditor({ open, variant, anchor, onClose }: AgentQuickEditorProps) {
  const partner = useAppStore((s) => s.partner);
  const updateAgentProfile = useAppStore((s) => s.updateAgentProfile);
  const showToast = useToastStore((s) => s.showToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLFormElement>(null);
  const draftKeysRef = useRef<Set<string>>(new Set());

  const [displayName, setDisplayName] = useState(selectAgentDisplayName(partner));
  const [personalityNote, setPersonalityNote] = useState(partner.personalityNote ?? '');
  const [avatarImage, setAvatarImage] = useState<AvatarImageMeta | undefined>(selectAgentAvatar(partner));
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // ── Reset draft whenever the editor opens ──
  useEffect(() => {
    if (!open) return;
    setDisplayName(selectAgentDisplayName(partner));
    setPersonalityNote(partner.personalityNote ?? '');
    setAvatarImage(selectAgentAvatar(partner));
    setAdvanced(false);
    setError('');
    setSaved(false);
    draftKeysRef.current.clear();
  }, [open, partner]);

  // ── Desktop popover anchoring ──
  useEffect(() => {
    if (!open || variant !== 'popover') { setPosition(null); return; }
    const compute = () => {
      if (!anchor) return;
      const width = 320;
      const margin = 12;
      const top = anchor.bottom + 10;
      const left = Math.min(
        Math.max(margin, anchor.left + anchor.width / 2 - width / 2),
        window.innerWidth - width - margin,
      );
      setPosition({ top, left });
    };
    compute();
    window.addEventListener('resize', compute, { passive: true });
    window.addEventListener('scroll', compute, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, { capture: true } as EventListenerOptions);
    };
  }, [open, variant, anchor]);

  // ── Dialog keyboard contract: Escape, initial focus and focus trap ──
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key !== 'Tab' || !editorRef.current) return;
      const focusable = Array.from(editorRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.requestAnimationFrame(() => editorRef.current?.querySelector<HTMLElement>('.aqe-name-input')?.focus());
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const deleteUnusedDrafts = useCallback(async (keepKey?: string) => {
    const keys = Array.from(draftKeysRef.current).filter((key) => key !== keepKey);
    draftKeysRef.current = new Set(keepKey && draftKeysRef.current.has(keepKey) ? [keepKey] : []);
    if (keys.length > 0) await deletePetImages(keys).catch(() => {});
  }, []);

  const handleClose = useCallback(async () => {
    await deleteUnusedDrafts();
    setError('');
    setSaved(false);
    onClose();
  }, [deleteUnusedDrafts, onClose]);

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    let meta: AvatarImageMeta;
    try {
      meta = await storeAgentAvatar(file);
    } catch (cause) {
      showToast(cause instanceof AgentAvatarError ? cause.message : '圖片處理失敗');
      event.target.value = '';
      return;
    }

    if (avatarImage?.key && draftKeysRef.current.has(avatarImage.key)) {
      await deletePetImages([avatarImage.key]).catch(() => {});
      draftKeysRef.current.delete(avatarImage.key);
    }
    draftKeysRef.current.add(meta.key);
    setAvatarImage(meta);
    event.target.value = '';
  };

  const handleRemoveAvatar = async () => {
    if (avatarImage?.key && draftKeysRef.current.has(avatarImage.key)) {
      await deletePetImages([avatarImage.key]).catch(() => {});
      draftKeysRef.current.delete(avatarImage.key);
    }
    setAvatarImage(undefined);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('顯示名稱不能為空');
      return;
    }
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      setError(`名稱最多 ${MAX_DISPLAY_NAME_LENGTH} 字`);
      return;
    }

    const previousKey = partner.avatarImage?.key;
    updateAgentProfile({
      displayName: trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH),
      name: partner.name?.trim() || SYSTEM_AGENT_NAME,
      avatarInitial: (partner.avatarInitial || trimmed || '智').charAt(0).toUpperCase(),
      avatarColor: partner.avatarColor || 'char',
      avatarImage,
      personalityNote: personalityNote.trim(),
    });

    if (previousKey && previousKey !== avatarImage?.key) {
      await deletePetImages([previousKey]).catch(() => {});
    }
    await deleteUnusedDrafts(avatarImage?.key);
    draftKeysRef.current.clear();

    setError('');
    setSaved(true);
    showToast('智能體設定已保存');
    window.setTimeout(() => {
      setSaved(false);
      onClose();
    }, 500);
  };

  if (!open) return null;

  const fallbackInitial = (partner.avatarInitial || displayName || '智').charAt(0).toUpperCase();

  const editor = (
    <form
      ref={editorRef}
      className={`agent-quick-editor agent-quick-editor--${variant}${advanced ? ' agent-quick-editor--advanced' : ''}${saved ? ' is-saved' : ''}`}
      onSubmit={handleSubmit}
      role="dialog"
      aria-modal="true"
      aria-label="智能體快速編輯"
      data-testid="agent-quick-editor"
      style={variant === 'popover' && position ? { top: position.top, left: position.left } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="aqe-handle" aria-hidden="true" />
      <header className="aqe-head">
        <div>
          <p className="aqe-eyebrow">目前智能體</p>
          <h2 className="aqe-title">{advanced ? '完整智能體設定' : '編輯智能體'}</h2>
        </div>
        <button type="button" className="aqe-close" onClick={handleClose} aria-label="關閉">×</button>
      </header>

      <div className="aqe-identity-row">
        <AvatarImage
          avatarConfig={avatarImage}
          fallbackInitial={fallbackInitial}
          initial={fallbackInitial}
          color={partner.avatarColor || 'char'}
          size={56}
          label={displayName || AGENT_DEFAULT_DISPLAY_NAME}
        />
        <div className="aqe-identity-copy">
          <input
            className={`aqe-name-input${error ? ' aqe-name-input--error' : ''}`}
            value={displayName}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            placeholder={AGENT_DEFAULT_DISPLAY_NAME}
            aria-label="智能體顯示名稱"
            onChange={(e) => { setDisplayName(e.target.value); setError(''); }}
          />
          {error ? (
            <span className="aqe-error">{error}</span>
          ) : (
            <span className="aqe-hint">{displayName.trim().length}/{MAX_DISPLAY_NAME_LENGTH} 字</span>
          )}
          <div className="aqe-avatar-actions">
            <button type="button" className="aqe-mini-btn" onClick={() => fileInputRef.current?.click()}>
              更換頭像
            </button>
            {avatarImage && (
              <button type="button" className="aqe-mini-btn aqe-mini-btn--danger" onClick={handleRemoveAvatar}>
                移除
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={AGENT_AVATAR_ACCEPT}
        aria-label="上傳智能體頭像"
        hidden
        onChange={handleAvatarUpload}
      />

      <label className="aqe-field">
        <span className="aqe-field-label">人格與語氣</span>
        <textarea
          className="aqe-textarea"
          rows={2}
          value={personalityNote}
          placeholder="例如：克制、溫柔、偶爾毒舌。"
          onChange={(e) => setPersonalityNote(e.target.value)}
        />
      </label>

      {!advanced && <nav className="aqe-links" aria-label="智能體設定入口">
        <button type="button" className="aqe-link-row" onClick={() => setAdvanced(true)}>
          <span>完整智能體設定</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </nav>}

      {advanced && (
        <section className="aqe-advanced-summary" aria-label="智能體身份資料">
          <p>名稱、頭像與人格摘要共用同一份本機身份資料；儲存後會立即套用到首頁與聊天。</p>
          <button type="button" className="aqe-link-row" onClick={() => setAdvanced(false)}>返回快速編輯</button>
        </section>
      )}

      <footer className="aqe-actions">
        <button type="button" className="aqe-btn aqe-btn--ghost" onClick={handleClose}>取消</button>
        <button type="submit" className="aqe-btn aqe-btn--primary">{saved ? '已保存' : '保存'}</button>
      </footer>
    </form>
  );

  if (variant === 'sheet') {
    return createPortal(
      <div className="aqe-backdrop aqe-backdrop--sheet" onClick={handleClose} data-testid="agent-quick-editor-backdrop">
        {editor}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="aqe-backdrop aqe-backdrop--popover" onClick={handleClose} data-testid="agent-quick-editor-backdrop">
      {editor}
    </div>,
    document.body,
  );
}
