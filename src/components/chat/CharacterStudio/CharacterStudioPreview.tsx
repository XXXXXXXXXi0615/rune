import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { CharacterProfile, ProviderConfig } from '@/types';
import { AvatarAssetImage } from '../ConversationAvatars';
import { PREVIEW_MODES, type PreviewMode } from './types';
import './CharacterStudio.css';

interface CharacterStudioPreviewProps {
  draft: CharacterProfile;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  resolvedProvider?: ProviderConfig;
  pendingUrl: string | null;
  onAvatarFile: (file: File) => void;
  onAvatarRemove: () => void;
  onAvatarCrop: (crop: { x: number; y: number; zoom: number }) => void;
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/avif';

export function CharacterStudioPreview({
  draft,
  previewMode,
  onPreviewModeChange,
  resolvedProvider,
  pendingUrl,
  onAvatarFile,
  onAvatarRemove,
  onAvatarCrop,
}: CharacterStudioPreviewProps) {
  const displayName = draft.name || '未命名角色';
  const identity = draft.shortIdentity || draft.subtitle || '尚未設定一句身份';
  const relationshipLabel = draft.relationshipToUser || draft.relationship || '未設定';
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.split(',').includes(file.type) && file.type !== 'image/avif') {
        // Accept avif even if browser reports different MIME
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext || '')) return;
      }
      onAvatarFile(file);
    },
    [onAvatarFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  const crop = draft.avatarCrop || { x: 50, y: 50, zoom: 1.0 };

  return (
    <div className="cs-preview">
      {/* Mode switcher */}
      <div className="cs-preview-modes" role="radiogroup" aria-label="預覽模式">
        {PREVIEW_MODES.map((mode) => (
          <button
            key={mode.id}
            role="radio"
            aria-checked={previewMode === mode.id}
            className={`cs-preview-mode-btn ${previewMode === mode.id ? 'is-active' : ''}`}
            onClick={() => onPreviewModeChange(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Preview content */}
      <div className="cs-preview-content">
        {previewMode === 'card' && (
          <div>
            <CharacterCard
              draft={draft}
              displayName={displayName}
              identity={identity}
              relationshipLabel={relationshipLabel}
              resolvedProvider={resolvedProvider}
              pendingUrl={pendingUrl}
            />
            {/* Avatar controls */}
            <div className="cs-avatar-editor">
              <div
                className={`cs-avatar-dropzone ${dragOver ? 'is-dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileInput}
                  hidden
                />
                {draft.avatarAssetId || pendingUrl ? (
                  <span className="cs-avatar-dropzone__hint">拖放或點擊更換頭像</span>
                ) : (
                  <span className="cs-avatar-dropzone__hint">
                    拖放或點擊上傳頭像
                    <br />
                    <small>JPEG、PNG、WebP、AVIF</small>
                  </span>
                )}
              </div>

              {(draft.avatarAssetId || pendingUrl) && (
                <>
                  <div className="cs-avatar-crop-controls">
                    <label className="cs-field">
                      <span className="cs-field__label">縮放</span>
                      <div className="cs-field__range">
                        <input
                          type="range"
                          min={0.5}
                          max={3}
                          step={0.05}
                          value={crop.zoom}
                          onChange={(e) => onAvatarCrop({ ...crop, zoom: Number(e.target.value) })}
                          aria-label="頭像縮放"
                        />
                        <span className="cs-field__range-value">{crop.zoom.toFixed(1)}x</span>
                      </div>
                    </label>
                    <label className="cs-field">
                      <span className="cs-field__label">水平位移</span>
                      <div className="cs-field__range">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={crop.x}
                          onChange={(e) => onAvatarCrop({ ...crop, x: Number(e.target.value) })}
                          aria-label="頭像水平位移"
                        />
                        <span className="cs-field__range-value">{crop.x}%</span>
                      </div>
                    </label>
                    <label className="cs-field">
                      <span className="cs-field__label">垂直位移</span>
                      <div className="cs-field__range">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={crop.y}
                          onChange={(e) => onAvatarCrop({ ...crop, y: Number(e.target.value) })}
                          aria-label="頭像垂直位移"
                        />
                        <span className="cs-field__range-value">{crop.y}%</span>
                      </div>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="cs-footer__btn"
                    onClick={onAvatarRemove}
                    style={{ width: '100%', marginTop: '8px' }}
                  >
                    移除頭像
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {previewMode === 'dm' && (
          <DmPreview
            draft={draft}
            displayName={displayName}
            pendingUrl={pendingUrl}
          />
        )}
        {previewMode === 'group' && (
          <GroupPreview
            draft={draft}
            displayName={displayName}
            pendingUrl={pendingUrl}
          />
        )}
      </div>
    </div>
  );
}

function CharacterCard({
  draft,
  displayName,
  identity,
  relationshipLabel,
  resolvedProvider,
  pendingUrl,
}: {
  draft: CharacterProfile;
  displayName: string;
  identity: string;
  relationshipLabel: string;
  resolvedProvider?: ProviderConfig;
  pendingUrl: string | null;
}) {
  const crop = draft.avatarCrop;
  return (
    <div className="cs-card-preview">
      {/* Avatar */}
      <div className="cs-card-avatar">
        {pendingUrl ? (
          <img
            src={pendingUrl}
            alt={displayName}
            draggable={false}
            style={{
              objectPosition: `${crop?.x ?? 50}% ${crop?.y ?? 50}%`,
              transform: `scale(${crop?.zoom ?? 1})`,
              objectFit: 'cover',
            }}
          />
        ) : draft.avatarAssetId ? (
          <AvatarAssetImage assetId={draft.avatarAssetId} alt={displayName} crop={draft.avatarCrop} />
        ) : (
          <span className="cs-card-avatar__fallback">{displayName.charAt(0) || '?'}</span>
        )}
      </div>

      {/* Name */}
      <h3 className="cs-card-name">{displayName || '未命名角色'}</h3>

      {/* Identity */}
      <p className="cs-card-identity">{identity}</p>

      {/* Relationship badge */}
      <span className="cs-card-badge">{relationshipLabel}</span>

      {/* Status row */}
      <div className="cs-card-status">
        <span className={`cs-card-status__item ${resolvedProvider ? 'is-ok' : 'is-warn'}`}>
          {resolvedProvider ? `模型：${resolvedProvider.name}` : '模型：沿用聊天設定'}
        </span>
        <span className={`cs-card-status__item ${draft.voiceProfileId ? 'is-ok' : 'is-muted'}`}>
          語音：{draft.voiceProfileId ? '已配置' : '未配置'}
        </span>
      </div>

      {/* Description */}
      {draft.description && (
        <p className="cs-card-desc">{draft.description}</p>
      )}
    </div>
  );
}

function DmPreview({
  draft,
  displayName,
  pendingUrl,
}: {
  draft: CharacterProfile;
  displayName: string;
  pendingUrl: string | null;
}) {
  const greeting = draft.greeting || '（尚未設定問候語）';

  return (
    <div className="cs-dm-preview">
      <div className="cs-dm-header">
        <div className="cs-dm-avatar">
          {pendingUrl ? (
            <img src={pendingUrl} alt={displayName} draggable={false} />
          ) : draft.avatarAssetId ? (
            <AvatarAssetImage assetId={draft.avatarAssetId} alt={displayName} crop={draft.avatarCrop} />
          ) : (
            <span className="cs-card-avatar__fallback">{displayName.charAt(0) || '?'}</span>
          )}
        </div>
        <span className="cs-dm-name">{displayName || '未命名角色'}</span>
      </div>
      <div className="cs-dm-bubble">
        <p>{greeting}</p>
      </div>
      <p className="cs-dm-hint">預覽僅顯示角色第一句問候，不會寫入真實對話。</p>
    </div>
  );
}

function GroupPreview({
  draft,
  displayName,
  pendingUrl,
}: {
  draft: CharacterProfile;
  displayName: string;
  pendingUrl: string | null;
}) {
  return (
    <div className="cs-group-preview">
      <div className="cs-group-header">
        <div className="cs-group-avatars">
          <div className="cs-group-avatar is-self">我</div>
          <div className="cs-group-avatar is-character">
            {pendingUrl ? (
              <img src={pendingUrl} alt={displayName} draggable={false} />
            ) : draft.avatarAssetId ? (
              <AvatarAssetImage assetId={draft.avatarAssetId} alt={displayName} crop={draft.avatarCrop} />
            ) : (
              displayName.charAt(0) || '?'
            )}
          </div>
          <div className="cs-group-avatar is-other">?</div>
        </div>
        <span className="cs-group-title">群聊預覽 — {displayName || '未命名角色'}</span>
      </div>
      <div className="cs-group-messages">
        <div className="cs-group-msg is-other">大家早安</div>
        <div className="cs-group-msg is-character">
          <span className="cs-group-msg__sender">{displayName || '未命名角色'}</span>
          <span className="cs-group-msg__body">
            {draft.greeting ? draft.greeting.slice(0, 80) + (draft.greeting.length > 80 ? '…' : '') : '（模擬訊息，角色問候語將在此顯示）'}
          </span>
        </div>
        <div className="cs-group-msg is-other">今天有什麼計畫嗎</div>
      </div>
      <p className="cs-dm-hint">預覽僅模擬群聊外觀，不會寫入真實對話。</p>
    </div>
  );
}
