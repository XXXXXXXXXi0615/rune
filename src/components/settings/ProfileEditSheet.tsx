import { useEffect, useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { savePetImage, deletePetImages } from '@/store/petImages';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { t } from '@/i18n';
import type { AvatarImageMeta } from '@/types';
import { compressImageFile, compressedImageName } from '@/utils/imageCompression';

interface ProfileEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** 'profile' edits profile.displayName/status; 'partner' edits partner.displayName/status */
  mode: 'profile' | 'partner';
}

const ALLOWED_AVATAR_TYPES = ['image/png', 'image/webp', 'image/jpeg'];
const MAX_SELECTED_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_BYTES = 1024 * 1024;

export function ProfileEditSheet({ isOpen, onClose, mode }: ProfileEditSheetProps) {
  const profile = useAppStore((s) => s.profile);
  const partner = useAppStore((s) => s.partner);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const updatePartner = useAppStore((s) => s.updatePartner);
  const showToast = useToastStore((s) => s.showToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUser = mode === 'profile';
  const currentName = isUser ? profile.displayName : selectPartnerDisplayName(partner);
  const currentStatus = isUser ? (profile.signature ?? '') : partner.status;
  const currentInitial = isUser
    ? (profile.avatarInitial || profile.displayName || 's').charAt(0).toUpperCase()
    : partner.avatarInitial;
  const currentColor = isUser ? (profile.avatarColor || 'user') : partner.avatarColor;
  const currentImage = isUser ? profile.avatarImage : partner.avatarImage;

  const [name, setName] = useState(currentName);
  const [status, setStatus] = useState(currentStatus);
  const [avatarInitial, setAvatarInitial] = useState(currentInitial);
  const [avatarColor, setAvatarColor] = useState(currentColor);
  const [avatarImage, setAvatarImage] = useState<AvatarImageMeta | undefined>(currentImage);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const draftImageKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(currentName);
     
    setStatus(currentStatus);
     
    setAvatarInitial(currentInitial);
     
    setAvatarColor(currentColor);
    setAvatarImage(currentImage);
    setError('');
    setSaved(false);
    draftImageKeysRef.current.clear();
  }, [currentColor, currentImage, currentInitial, currentName, currentStatus, isOpen]);

  const deleteUnusedDrafts = async (keepKey?: string) => {
    const keys = Array.from(draftImageKeysRef.current).filter((key) => key !== keepKey);
    draftImageKeysRef.current = new Set(keepKey && draftImageKeysRef.current.has(keepKey) ? [keepKey] : []);
    if (keys.length > 0) await deletePetImages(keys).catch(() => {});
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SELECTED_IMAGE_BYTES) {
      showToast(t('pet.imageStillTooBig'));
      e.target.value = '';
      return;
    }
    let compressed: Blob;
    try {
      compressed = await compressImageFile(file, {
        maxWidth: 320,
        maxHeight: 320,
        outputType: 'image/webp',
        quality: 0.82,
      });
    } catch {
      showToast(t('pet.imageStillTooBig'));
      e.target.value = '';
      return;
    }
    if (compressed.size > MAX_COMPRESSED_IMAGE_BYTES) {
      showToast(t('pet.imageStillTooBig'));
      e.target.value = '';
      return;
    }
    const key = `avatar-${mode}-${crypto.randomUUID()}`;
    await savePetImage(key, compressed);
    const compressedType = compressed.type || 'image/png';
    const meta: AvatarImageMeta = {
      storage: 'indexeddb',
      key,
      name: compressedImageName(file.name, compressedType),
      type: compressedType,
      size: compressed.size,
      updatedAt: Date.now(),
    };
    if (avatarImage?.key && draftImageKeysRef.current.has(avatarImage.key)) {
      await deletePetImages([avatarImage.key]).catch(() => {});
      draftImageKeysRef.current.delete(avatarImage.key);
    }
    draftImageKeysRef.current.add(key);
    setAvatarImage(meta);
    e.target.value = '';
  };

  const handleRemoveAvatar = async () => {
    if (avatarImage?.key && draftImageKeysRef.current.has(avatarImage.key)) {
      await deletePetImages([avatarImage.key]).catch(() => {});
      draftImageKeysRef.current.delete(avatarImage.key);
    }
    setAvatarImage(undefined);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(isUser ? '請輸入名稱' : '請輸入對方名稱');
      return;
    }
    const nextInitial = (avatarInitial || (isUser ? trimmed : 'L')).charAt(0).toUpperCase();
    if (isUser) {
      updateProfile({ displayName: trimmed, signature: status.trim(), avatarInitial: nextInitial, avatarColor, avatarImage });
    } else {
      updatePartner({
        displayName: trimmed,
        name: (partner.name || 'LUNARIS'), // systemIdentity stays fixed
        signature: status.trim(),
        avatarInitial: nextInitial || 'L',
        avatarColor,
        avatarImage,
      });
    }
    if (currentImage?.key && currentImage.key !== avatarImage?.key) {
      await deletePetImages([currentImage.key]).catch(() => {});
    }
    await deleteUnusedDrafts(avatarImage?.key);
    draftImageKeysRef.current.clear();
    setError('');
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 600);
  };

  const handleBackdrop = async () => {
    await deleteUnusedDrafts();
    setName(currentName);
    setStatus(currentStatus);
    setAvatarInitial(currentInitial);
    setAvatarColor(currentColor);
    setAvatarImage(currentImage);
    setError('');
    setSaved(false);
    onClose();
  };

  if (!isOpen) return null;

  const title = isUser ? '編輯個人資料' : '編輯 Luna';

  return createPortal(
    <div
      className="profile-edit-overlay"
      onClick={handleBackdrop}
    >
      <form
        className={`profile-edit-sheet ${saved ? 'saved' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="profile-edit-head">
          <div className="profile-edit-handle" />
          <span className="profile-edit-title">{title}</span>
        </div>

        <div className="profile-edit-body">
          {/* Name */}
          <input
            className={`quick-sheet-input ${error ? 'has-error' : ''}`}
            type="text"
            placeholder={isUser ? '你的名稱' : '對方名稱'}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            autoFocus
          />
          {error && <span className="quick-sheet-error">{error}</span>}

          {/* Status */}
          <input
            className="quick-sheet-input"
            type="text"
            placeholder={isUser ? '狀態文字' : '狀態文字'}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />

          {/* Avatar preview + upload (both modes) */}
          <div className="quick-sheet-field">
            <span className="quick-sheet-label">頭像</span>
            <div className="profile-edit-avatar-row">
              <AvatarImage avatarConfig={avatarImage} fallbackInitial={avatarInitial} initial={avatarInitial} color={avatarColor} size={56} label={title} />
              <div className="profile-edit-avatar-actions">
                <button type="button" className="btn-ghost profile-edit-mini-btn"
                  onClick={() => fileInputRef.current?.click()}>上傳</button>
                {avatarImage && (
                  <button type="button" className="btn-ghost profile-edit-mini-btn danger"
                    onClick={handleRemoveAvatar}>移除</button>
                )}
              </div>
            </div>
          </div>

          {/* Hidden file input for avatar */}
          <input ref={fileInputRef} className="settings-file-input" type="file" accept="image/png,image/webp,image/jpeg"
            hidden aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>

        <div className="profile-edit-footer">
          <button type="button" className="btn-ghost" onClick={handleBackdrop}>
            {t('sheet.cancel')}
          </button>
          <button type="submit" className="btn-primary">
            {saved ? t('sheet.saved') : t('sheet.save')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
