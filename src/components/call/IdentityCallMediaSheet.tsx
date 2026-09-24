import { useRef } from 'react';
import { useIdentityStore } from '@/store/useIdentityStore';
import { useCallStore } from '@/store/useCallStore';
import { saveAsset } from '@/store/assets';
import type { CallMotionPreset, IdentityCallMedia } from '@/types';

interface IdentityCallMediaSheetProps {
  identityId: string;
  identityName: string;
  onClose: () => void;
}

const BACKGROUND_PRESETS = [
  { id: 'default', label: '月潮' },
  { id: 'dusk', label: '暮色' },
  { id: 'tide', label: '深海' },
  { id: 'forest', label: '林間' },
];

const MOTION_PRESETS: { id: CallMotionPreset; label: string }[] = [
  { id: 'breathe', label: '呼吸' },
  { id: 'scale', label: '縮放' },
  { id: 'glow', label: '光暈' },
  { id: 'tilt', label: '輕擺' },
  { id: 'none', label: '關閉' },
];

/** Per-identity call imagery: portrait / camera-off / background images (IndexedDB), crop, motion preset. */
export function IdentityCallMediaSheet({ identityId, identityName, onClose }: IdentityCallMediaSheetProps) {
  const identity = useIdentityStore((s) => s.identities.find((entry) => entry.id === identityId));
  const updateIdentity = useIdentityStore((s) => s.updateIdentity);
  const backgroundPresetId = useCallStore((s) => s.session?.backgroundPresetId || 'default');
  const setBackground = useCallStore((s) => s.setBackground);
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const cameraOffInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const callMedia = identity?.callMedia || {};

  const patchMedia = (patch: Partial<IdentityCallMedia>) => {
    updateIdentity(identityId, { callMedia: { ...callMedia, ...patch } });
  };

  const handleUpload = async (file: File | undefined, key: 'callPortraitAssetId' | 'cameraOffAssetId' | 'callBackgroundAssetId') => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const assetId = await saveAsset(file, file.type);
      patchMedia({ [key]: assetId });
      if (key === 'callBackgroundAssetId') setBackground('custom');
    } catch { /* silent */ }
  };

  return (
    <div className="call-media-sheet" role="dialog" aria-label={`${identityName} 的通話畫面設定`} data-testid="call-media-sheet">
      <header>
        <h3>{identityName} 的通話畫面</h3>
        <button type="button" onClick={onClose} aria-label="關閉通話畫面設定">
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </header>

      <section>
        <h4>背景</h4>
        <div className="call-media-sheet__presets" role="group" aria-label="通話背景">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset preset--${preset.id}${backgroundPresetId === preset.id ? ' is-active' : ''}`}
              aria-pressed={backgroundPresetId === preset.id}
              onClick={() => setBackground(preset.id)}
              data-testid={`call-bg-${preset.id}`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className={`preset preset--custom${backgroundPresetId === 'custom' ? ' is-active' : ''}`}
            aria-pressed={backgroundPresetId === 'custom'}
            onClick={() => {
              if (callMedia.callBackgroundAssetId) setBackground('custom');
              else backgroundInputRef.current?.click();
            }}
          >
            自訂圖片
          </button>
        </div>
        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          hidden
          aria-label="上傳通話背景圖片"
          onChange={(event) => { void handleUpload(event.target.files?.[0], 'callBackgroundAssetId'); event.target.value = ''; }}
        />
      </section>

      <section>
        <h4>角色圖像</h4>
        <div className="call-media-sheet__uploads">
          <button type="button" onClick={() => portraitInputRef.current?.click()}>
            <span>通話立繪</span>
            <small>{callMedia.callPortraitAssetId ? '已設定' : '未設定'}</small>
          </button>
          <button type="button" onClick={() => cameraOffInputRef.current?.click()}>
            <span>關鏡頭圖片</span>
            <small>{callMedia.cameraOffAssetId ? '已設定' : '未設定'}</small>
          </button>
        </div>
        <input
          ref={portraitInputRef}
          type="file"
          accept="image/*"
          hidden
          aria-label="上傳通話立繪"
          onChange={(event) => { void handleUpload(event.target.files?.[0], 'callPortraitAssetId'); event.target.value = ''; }}
        />
        <input
          ref={cameraOffInputRef}
          type="file"
          accept="image/*"
          hidden
          aria-label="上傳關鏡頭圖片"
          onChange={(event) => { void handleUpload(event.target.files?.[0], 'cameraOffAssetId'); event.target.value = ''; }}
        />
      </section>

      <section>
        <h4>取景縮放</h4>
        <input
          type="range"
          min={1}
          max={2}
          step={0.05}
          value={callMedia.crop?.zoom || 1}
          aria-label="取景縮放"
          onChange={(event) => patchMedia({ crop: { x: callMedia.crop?.x || 0, y: callMedia.crop?.y || 0, zoom: Number(event.target.value) } })}
        />
      </section>

      <section>
        <h4>說話動態</h4>
        <div className="call-media-sheet__presets" role="group" aria-label="說話動態">
          {MOTION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset${(callMedia.motionPreset || 'breathe') === preset.id ? ' is-active' : ''}`}
              aria-pressed={(callMedia.motionPreset || 'breathe') === preset.id}
              onClick={() => patchMedia({ motionPreset: preset.id })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="call-media-sheet__note">動態只使用克制的呼吸、縮放、光暈與輕擺，本版不做假的口型同步。</p>
      </section>
    </div>
  );
}
