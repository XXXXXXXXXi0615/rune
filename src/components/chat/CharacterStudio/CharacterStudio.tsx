import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CharacterProfile, ProviderConfig } from '@/types';
import { BUILTIN_LUNARIS_ID, useCharacterStore } from '@/store/useCharacterStore';
import { useAppStore } from '@/store/useAppStore';
import { putBlob, getBlob, deleteBlob } from '@/store/avatarBlobStorage';
import { CharacterStudioPreview } from './CharacterStudioPreview';
import { CharacterStudioForm } from './CharacterStudioForm';
import { CharacterStudioFooter } from './CharacterStudioFooter';
import { blankDraft, type DraftStatus, type PreviewMode, type StudioTabId } from './types';
import './CharacterStudio.css';

interface CharacterStudioProps {
  character?: CharacterProfile;
  onClose: () => void;
  /** Called when character is deleted from danger zone */
  onDeleted?: () => void;
}

/**
 * CharacterStudio — Phase 2
 *
 * Replaces the old inline CharacterEditor.
 * Tab-based IA, live preview, draft safety, avatar asset management,
 * model/voice selectors, sensitive data permissions, and templates.
 *
 * Share create + edit behind a single editor surface.
 * Draft ISOLATED from store until explicit save.
 */
export function CharacterStudio({ character, onClose, onDeleted }: CharacterStudioProps) {
  const isEdit = Boolean(character?.id);
  const createCharacter = useCharacterStore((s) => s.createCharacter);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const folders = useCharacterStore((s) => s.folders);
  const characters = useCharacterStore((s) => s.characters);
  const providers = useAppStore((s) => s.providers);

  // ── Draft ──
  const [draft, setDraft] = useState<CharacterProfile>(() =>
    character ? structuredClone(character) : blankDraft(),
  );
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('clean');
  const savingRef = useRef(false);

  // ── Avatar ──
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const avatarReqId = useRef(0);

  // Cleanup preview URL on unmount or new file
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  // ── Tabs & Preview ──
  const [activeTab, setActiveTab] = useState<StudioTabId>('basic');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('card');

  // ── Dirty detection ──
  const sourceJson = useMemo(
    () => JSON.stringify(character ?? blankDraft()),
    [character],
  );
  const draftWithoutPending = useMemo(() => {
    const { id: _id, createdAt: _c, updatedAt: _u, isBuiltIn: _b, ...rest } = draft;
    return JSON.stringify(rest);
  }, [draft]);

  const srcWithoutMeta = useMemo(() => {
    if (!character) return JSON.stringify(blankDraft());
    const { id: _id, createdAt: _c, updatedAt: _u, isBuiltIn: _b, ...rest } = character;
    return JSON.stringify(rest);
  }, [character]);

  const dirty = pendingFile !== null || draftWithoutPending !== srcWithoutMeta;

  // ── beforeunload ──
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ── Update draft field ──
  const updateField = useCallback(
    <K extends keyof CharacterProfile>(key: K, value: CharacterProfile[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ── Avatar handlers ──
  const handleAvatarFile = useCallback((file: File) => {
    const id = ++avatarReqId.current;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // Reset crop on new image
    setDraft((prev) => ({
      ...prev,
      avatarCrop: { x: 50, y: 50, zoom: 1 },
    }));
  }, [previewUrl]);

  const handleAvatarRemove = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setDraft((prev) => ({ ...prev, avatarAssetId: undefined, avatarCrop: undefined }));
  }, [previewUrl]);

  const handleAvatarCrop = useCallback(
    (crop: { x: number; y: number; zoom: number }) => {
      setDraft((prev) => ({ ...prev, avatarCrop: crop }));
    },
    [],
  );

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setDraftStatus('saving');

    try {
      let avatarAssetId = draft.avatarAssetId;
      // Upload new avatar
      if (pendingFile) {
        avatarAssetId = `character-avatar-${crypto.randomUUID()}`;
        await putBlob(avatarAssetId, pendingFile);
      }
      // Remove avatar
      if (!pendingFile && draft.avatarAssetId === undefined && character?.avatarAssetId) {
        // Avatar was explicitly removed — don't delete blob yet (may be referenced by old messages)
        avatarAssetId = undefined;
      }

      const payload = { ...draft, avatarAssetId, name: draft.name.trim() || '未命名角色', updatedAt: Date.now() };

      if (isEdit && character) {
        updateCharacter(character.id, payload);
      } else {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, isBuiltIn: _isBuiltIn, ...createPayload } = payload;
        createCharacter(createPayload);
      }

      setDraftStatus('saved');
      // Brief delay to show "saved" state before closing
      setTimeout(() => onClose(), 300);
    } catch {
      setDraftStatus('error');
      savingRef.current = false;
    }
  }, [draft, pendingFile, isEdit, character, createCharacter, updateCharacter, onClose]);

  // ── Cancel ──
  const handleCancel = useCallback(() => {
    if (!dirty || window.confirm('放棄尚未保存的角色修改？')) {
      onClose();
    }
  }, [dirty, onClose]);

  // ── Dynamic dirty status ──
  useEffect(() => {
    if (draftStatus === 'saving' || draftStatus === 'saved' || draftStatus === 'error') return;
    setDraftStatus(dirty ? 'dirty' : 'clean');
  }, [dirty, draftStatus]);

  // ── Resolve provider for preview ──
  const resolvedProvider = useMemo((): ProviderConfig | undefined => {
    if (draft.modelMode === 'custom' && draft.providerId) {
      return providers?.find((p) => p.id === draft.providerId);
    }
    return providers?.find((p) => p.isDefault);
  }, [draft.modelMode, draft.providerId, providers]);

  // ── Render ──
  return createPortal(
    <div className="cs-backdrop">
      <section
        className="cs-shell"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `編輯角色：${draft.name || '未命名'}` : '新增角色'}
      >
        {/* Header */}
        <header className="cs-header">
          <div>
            <p className="cs-header__overline">CHARACTER STUDIO</p>
            <h2 className="cs-header__title">
              {isEdit ? `編輯 ${draft.name || '未命名角色'}` : '新增角色'}
            </h2>
          </div>
          <button
            type="button"
            className="cs-header__close"
            onClick={handleCancel}
            aria-label="關閉編輯器"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="cs-body">
          {/* Left: Preview */}
          <aside className="cs-preview-panel">
            <CharacterStudioPreview
              draft={draft}
              previewMode={previewMode}
              onPreviewModeChange={setPreviewMode}
              resolvedProvider={resolvedProvider}
              pendingUrl={previewUrl}
              onAvatarFile={handleAvatarFile}
              onAvatarRemove={handleAvatarRemove}
              onAvatarCrop={handleAvatarCrop}
            />
          </aside>

          {/* Right: Tabs + Form */}
          <div className="cs-content-panel">
            <nav className="cs-tabs" role="tablist" aria-label="角色編輯分頁">
              {(['basic', 'personality', 'relationships', 'model-memory', 'voice', 'advanced'] as StudioTabId[]).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  className={`cs-tab ${activeTab === tab ? 'is-active' : ''}`}
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'basic' ? '基本資料' : tab === 'personality' ? '人格與語氣' : tab === 'relationships' ? '關係與背景' : tab === 'model-memory' ? '模型與記憶' : tab === 'voice' ? '語音' : '進階'}
                </button>
              ))}
            </nav>

            <div className="cs-form-scroll" role="tabpanel" aria-label="當前分頁內容">
              <CharacterStudioForm
                draft={draft}
                activeTab={activeTab}
                updateField={updateField}
                folders={folders}
                characters={characters}
                providers={providers}
                isEdit={isEdit}
                onDeleted={onDeleted}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <CharacterStudioFooter
          draft={draft}
          draftStatus={draftStatus}
          isEdit={isEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          onApplyTemplate={(template) => setDraft(template)}
          providers={providers}
        />
      </section>
    </div>,
    document.body,
  );
}
