import { useEffect, useState, useRef, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { savePetImage, deletePetImages } from '@/store/petImages';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { t } from '@/i18n';
import type { AvatarImageMeta } from '@/types';
import { compressImageFile, compressedImageName } from '@/utils/imageCompression';
import { selectAgentDisplayName } from '@/store/useAppStore';

export type IdentityEditorMode = 'user' | 'rune';

interface SharedIdentityEditorProps {
  mode: IdentityEditorMode;
  isOpen: boolean;
  onClose: () => void;
}

const ALLOWED_AVATAR_TYPES = ['image/png', 'image/webp', 'image/jpeg'];
const MAX_SELECTED_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_BYTES = 1024 * 1024;
const SIGNATURE_MAX_LENGTH = 48;
const SIGNATURE_COUNTER_THRESHOLD = 36;

type FocusableElement = HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement | HTMLAnchorElement;

const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]), button:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]';

function getFocusable(el: HTMLElement): FocusableElement[] {
  return Array.from(el.querySelectorAll<FocusableElement>(FOCUSABLE));
}

const TARGET_TEXT: Record<IdentityEditorMode, { title: string; namePlaceholder: string; nameError: string; avatarKeyPrefix: string }> = {
  user: { title: '編輯個人資料', namePlaceholder: '你的名稱', nameError: '請輸入你的名稱', avatarKeyPrefix: 'avatar-user-' },
  rune: { title: '編輯角色資料', namePlaceholder: 'Rune 的名稱', nameError: '請輸入 Rune 名稱', avatarKeyPrefix: 'avatar-agent-' },
};

/**
 * Shared compact floating identity editor — user ↔ partner symmetric.
 * Only presentation + draft/commit: the canonical owners (useAppStore.profile /
 * useAppStore.partner) stay separate; no shared mutable identity object.
 */
export function SharedIdentityEditor({ mode, isOpen, onClose }: SharedIdentityEditorProps) {
  const profile = useAppStore((s) => s.profile);
  const partner = useAppStore((s) => s.partner);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const updateAgentProfile = useAppStore((s) => s.updateAgentProfile);
  const showToast = useToastStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const draftKeysRef = useRef<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const isUser = mode === 'user';
  const canonicalName = isUser ? profile.displayName : selectAgentDisplayName(partner);
  const canonicalSignature = isUser ? (profile.signature ?? '') : (partner.signature ?? '');
  const canonicalAvatar = isUser ? profile.avatarImage : partner.avatarImage;
  const canonicalInitial = isUser ? (profile.avatarInitial || profile.displayName || 's') : (partner.avatarInitial || selectAgentDisplayName(partner) || '智');
  const canonicalColor = isUser ? (profile.avatarColor || 'user') : (partner.avatarColor || 'char');
  const text = TARGET_TEXT[mode];

  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [draftSignature, setDraftSignature] = useState('');
  const [initial, setInitial] = useState('');
  const [color, setColor] = useState('');
  const [draftAvatar, setDraftAvatar] = useState<AvatarImageMeta | undefined>();
  const [error, setError] = useState('');

  const dirty =
    draftDisplayName.trim() !== canonicalName ||
    draftSignature !== canonicalSignature ||
    draftAvatar?.key !== canonicalAvatar?.key;

  // Latest-attemptClose ref: the Escape handler must never act on a stale
  // first-render closure (which saw empty drafts and misread dirty=true).
  const attemptCloseRef = useRef<() => void>(() => {});

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      attemptCloseRef.current();
      return;
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current = document.activeElement;
    setDraftDisplayName(canonicalName);
    setDraftSignature(canonicalSignature);
    setInitial(canonicalInitial.charAt(0).toUpperCase());
    setColor(canonicalColor);
    setDraftAvatar(canonicalAvatar);
    setError('');
    setSaved(false);
    setRemoveConfirm(false);
    setCloseConfirm(false);
    draftKeysRef.current.clear();
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      setTimeout(() => { (triggerRef.current as HTMLElement)?.focus(); }, 0);
    };
  }, [isOpen, canonicalName, canonicalSignature, canonicalInitial, canonicalColor, canonicalAvatar, handleKeyDown]);

  const attemptClose = async () => {
    if (saved) { onClose(); return; }
    if (dirty) {
      setCloseConfirm(true);
      return;
    }
    await deleteUnusedDrafts();
    setError('');
    onClose();
  };
  attemptCloseRef.current = () => { void attemptClose(); };

  const confirmClose = async () => {
    await deleteUnusedDrafts();
    setError('');
    setCloseConfirm(false);
    onClose();
  };

  const dismissCloseConfirm = () => {
    setCloseConfirm(false);
  };

  const deleteUnusedDrafts = async (keepKey?: string) => {
    const keys = Array.from(draftKeysRef.current).filter((k) => k !== keepKey);
    draftKeysRef.current = new Set(keepKey && draftKeysRef.current.has(keepKey) ? [keepKey] : []);
    if (keys.length > 0) await deletePetImages(keys).catch(() => {});
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) { e.target.value = ''; return; }
    if (file.size > MAX_SELECTED_IMAGE_BYTES) { showToast(t('pet.imageStillTooBig')); e.target.value = ''; return; }
    let compressed: Blob;
    try {
      compressed = await compressImageFile(file, { maxWidth: 320, maxHeight: 320, outputType: 'image/webp', quality: 0.82 });
    } catch { showToast(t('pet.imageStillTooBig')); e.target.value = ''; return; }
    if (compressed.size > MAX_COMPRESSED_IMAGE_BYTES) { showToast(t('pet.imageStillTooBig')); e.target.value = ''; return; }
    const key = `${text.avatarKeyPrefix}${crypto.randomUUID()}`;
    await savePetImage(key, compressed);
    const meta: AvatarImageMeta = {
      storage: 'indexeddb', key, name: compressedImageName(file.name, compressed.type || 'image/png'),
      type: compressed.type || 'image/png', size: compressed.size, updatedAt: Date.now(),
    };
    if (draftAvatar?.key && draftKeysRef.current.has(draftAvatar.key)) {
      await deletePetImages([draftAvatar.key]).catch(() => {});
      draftKeysRef.current.delete(draftAvatar.key);
    }
    draftKeysRef.current.add(key);
    setDraftAvatar(meta);
    e.target.value = '';
  };

  const handleRemoveAvatar = async () => {
    if (draftAvatar?.key && draftKeysRef.current.has(draftAvatar.key)) {
      await deletePetImages([draftAvatar.key]).catch(() => {});
      draftKeysRef.current.delete(draftAvatar.key);
    }
    setDraftAvatar(undefined);
    setRemoveConfirm(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    const trimmed = draftDisplayName.trim();
    if (!trimmed) { setError(text.nameError); return; }
    setError('');

    const prevKey = canonicalAvatar?.key;
    const commit = {
      displayName: trimmed,
      signature: draftSignature.trim(),
      avatarInitial: (initial || trimmed).charAt(0).toUpperCase(),
      avatarColor: color,
      avatarImage: draftAvatar,
    };
    if (isUser) updateProfile(commit);
    else updateAgentProfile(commit);

    if (prevKey && prevKey !== draftAvatar?.key) await deletePetImages([prevKey]).catch(() => {});
    await deleteUnusedDrafts(draftAvatar?.key);
    draftKeysRef.current.clear();
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 600);
  };

  if (!isOpen) return null;

  const signatureCounterVisible = draftSignature.trim().length >= SIGNATURE_COUNTER_THRESHOLD;

  return createPortal(
    <div className="profile-edit-overlay" onClick={attemptClose}>
      <form
        className={`profile-edit-sheet profile-edit-sheet--compact${saved ? ' saved' : ''}`}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={text.title}
        data-testid="profile-editor"
        data-identity-target={mode}
      >
        <div className="profile-edit-head">
          <div className="profile-edit-head-row">
            <span className="profile-edit-title">{text.title}</span>
            <button type="button" className="profile-edit-close" onClick={attemptClose} aria-label="關閉">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="profile-edit-body">
          <label className="profile-edit-field-label">
            顯示名稱
            <input
              className={`quick-sheet-input${error ? ' has-error' : ''}`}
              type="text"
              placeholder={text.namePlaceholder}
              value={draftDisplayName}
              onChange={(e) => { setDraftDisplayName(e.target.value); setError(''); }}
              autoFocus
            />
          </label>
          {error && <span className="quick-sheet-error">{error}</span>}

          <label className="profile-edit-field-label">
            簽名
            <textarea
              className="quick-sheet-input profile-edit-textarea"
              placeholder={isUser ? '寫一句想在 Presence 下方顯示的話' : '寫一句角色的簽名'}
              value={draftSignature}
              onChange={(e) => setDraftSignature(e.target.value.slice(0, SIGNATURE_MAX_LENGTH))}
              rows={2}
              maxLength={SIGNATURE_MAX_LENGTH}
            />
          </label>
          {signatureCounterVisible && (
            <span className="profile-edit-counter" data-testid="signature-counter">{draftSignature.trim().length} / {SIGNATURE_MAX_LENGTH}</span>
          )}

          <div className="quick-sheet-field">
            <span className="quick-sheet-label">頭像</span>
            <div className="profile-edit-avatar-row">
              <AvatarImage avatarConfig={draftAvatar} fallbackInitial={initial} initial={initial} color={color} size={52} label={isUser ? '使用者' : '角色'} />
              <div className="profile-edit-avatar-actions">
                <button type="button" className="btn-ghost profile-edit-mini-btn"
                  onClick={() => fileRef.current?.click()}>{draftAvatar ? '更換照片' : '上傳照片'}</button>
                {draftAvatar && (
                  <button type="button" className="btn-ghost profile-edit-mini-btn profile-edit-mini-btn--danger"
                    onClick={() => setRemoveConfirm(true)}>移除</button>
                )}
              </div>
            </div>
          </div>
          <input ref={fileRef} className="settings-file-input" type="file" accept="image/png,image/webp,image/jpeg"
            hidden style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>

        <div className="profile-edit-footer">
          <button type="button" className="btn-ghost" onClick={attemptClose}>{t('sheet.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={!dirty}>{saved ? t('sheet.saved') : t('sheet.save')}</button>
        </div>
      </form>

      {removeConfirm && (
        <div className="profile-edit-overlay profile-edit-overlay--nested" onClick={() => setRemoveConfirm(false)}>
          <div className="profile-edit-confirm-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label="確認移除頭像">
            <p className="profile-edit-confirm-text">確定要移除目前頭像嗎？移除後將使用預設圖示。</p>
            <div className="profile-edit-confirm-actions">
              <button type="button" className="btn-ghost" onClick={() => setRemoveConfirm(false)}>取消</button>
              <button type="button" className="btn-primary profile-edit-confirm-danger" onClick={handleRemoveAvatar}>移除</button>
            </div>
          </div>
        </div>
      )}

      {closeConfirm && (
        <div className="profile-edit-overlay profile-edit-overlay--nested" onClick={dismissCloseConfirm}>
          <div className="profile-edit-confirm-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label="未儲存修改">
            <p className="profile-edit-confirm-text">你有未儲存的修改，確定要關閉嗎？</p>
            <div className="profile-edit-confirm-actions">
              <button type="button" className="btn-ghost" onClick={dismissCloseConfirm}>繼續編輯</button>
              <button type="button" className="btn-primary profile-edit-confirm-danger" onClick={confirmClose}>捨棄修改</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
