import { useState, useEffect } from 'react';
import { AppButton, AppCard, AppSheet } from '@/components/ui/AppPrimitives';
import { useThemePresetStore, type ThemePresetId } from '@/store/useThemePresetStore';
import { THEME_PRESETS } from '@/themes/themePresets';

const PRESETS = THEME_PRESETS;

export function ThemePresetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const presetId = useThemePresetStore((state) => state.presetId);
  const beginDraft = useThemePresetStore((state) => state.beginDraft);
  const previewPreset = useThemePresetStore((state) => state.previewPreset);
  const applyDraft = useThemePresetStore((state) => state.applyDraft);
  const cancelDraft = useThemePresetStore((state) => state.cancelDraft);
  const [draftId, setDraftId] = useState<ThemePresetId>(presetId);

  // Sync draft to persisted preset when dialog opens
  useEffect(() => {
    if (open) { setDraftId(presetId); beginDraft(); }
  }, [beginDraft, open, presetId]);

  const cancel = () => {
    setDraftId(presetId);
    cancelDraft();
    onClose();
  };

  const apply = () => {
    previewPreset(draftId);
    applyDraft();
    onClose();
  };

  const footer = (
    <div className="theme-preset-footer">
      <AppButton variant="ghost" onClick={cancel}>取消</AppButton>
      <AppButton variant="primary" onClick={apply}>套用</AppButton>
    </div>
  );

  return (
    <AppSheet open={open} title="外觀預設" onClose={cancel} footer={footer} className="theme-preset-sheet">
      <p className="theme-preset-lead">預覽Rune整體視覺。主題模式、字體與強調色會繼續沿用現有設定。</p>
      <div className="theme-preset-options" role="radiogroup" aria-label="外觀預設">
        {PRESETS.map((preset) => (
          <AppCard
            key={preset.id}
            interactive
            className={`theme-preset-option${draftId === preset.id ? ' is-selected' : ''}`}
            role="radio"
            aria-checked={draftId === preset.id}
            onClick={() => { setDraftId(preset.id); previewPreset(preset.id); }}
          >
            <div className={`theme-preset-swatch theme-preset-swatch--${preset.id}`} aria-hidden="true">
              <span /><span /><span />
            </div>
            <div>
              <strong>{preset.name}</strong>
              <small>{preset.description}</small>
            </div>
            <span className="theme-preset-check" aria-hidden="true">✓</span>
          </AppCard>
        ))}
      </div>
      <AppButton className="theme-preset-reset" variant="ghost" onClick={() => { setDraftId('lunar-tide'); previewPreset('lunar-tide'); }}>
        恢復Rune原生
      </AppButton>
    </AppSheet>
  );
}
