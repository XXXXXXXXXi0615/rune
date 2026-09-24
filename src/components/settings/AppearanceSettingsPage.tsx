import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import { IOSSwitch } from '@/components/ui/IOSSwitch';
import { WallpaperSettingsPanel } from '@/components/settings/WallpaperSettingsPanel';
import { useAppStore } from '@/store/useAppStore';
import { useThemePresetStore, type ThemePresetId } from '@/store/useThemePresetStore';
import { THEME_PRESETS, THEME_PRESET_BY_ID } from '@/themes/themePresets';
import {
  FONT_SCALE_MIN, FONT_SCALE_MAX, FONT_SCALE_DEFAULT, normalizeFontScale,
} from '@/utils/themeConfig';
import './AppearanceSettingsPage.css';
import { useDockPreferenceStore } from '@/store/useDockPreferenceStore';
import { useAgentActivityPreferences } from '@/features/agentActivity/agentActivityState';

type AppearanceTab = 'theme' | 'background' | 'color' | 'motion' | 'type';
const ACCENTS = ['#247c78', '#ad6f31', '#477f72', '#177e94', '#8c718f', '#d06e55'];
const FONT_SCALE_PRESETS = [
  { key: 'small', label: '較小', value: 0.9 },
  { key: 'standard', label: '標準', value: 1 },
  { key: 'large', label: '較大', value: 1.1 },
] as const;

function ThemeMiniature({ colors }: { colors: string[] }) {
  return <div className="appearance-mini" style={{ '--mini-bg': colors[0], '--mini-surface': colors[1], '--mini-accent': colors[2], '--mini-warm': colors[3] } as React.CSSProperties} aria-hidden="true">
    <aside><i /><i className="active" /><i /></aside><main><span /><b /><i className="button" /><label /></main>
  </div>;
}

export function AppearanceSettingsPage() {
  const location = useLocation();
  const mode = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const appliedPreset = useThemePresetStore((state) => state.presetId);
  const appliedAccent = useThemePresetStore((state) => state.accentOverride);
  const draftPreset = useThemePresetStore((state) => state.draftPresetId);
  const draftAccent = useThemePresetStore((state) => state.draftAccentOverride);
  const beginDraft = useThemePresetStore((state) => state.beginDraft);
  const previewPreset = useThemePresetStore((state) => state.previewPreset);
  const previewAccent = useThemePresetStore((state) => state.previewAccent);
  const applyDraft = useThemePresetStore((state) => state.applyDraft);
  const cancelDraft = useThemePresetStore((state) => state.cancelDraft);
  const [tab, setTab] = useState<AppearanceTab>(() => location.hash === '#motion' ? 'motion' : 'theme');
  const [motionPreview, setMotionPreview] = useState(true);
  const activityAnimationEnabled = useAgentActivityPreferences((state) => state.animationEnabled);
  const showActivityLabel = useAgentActivityPreferences((state) => state.showLabel);
  const reducedActivityMotion = useAgentActivityPreferences((state) => state.reducedMotion);
  const updateActivityPreferences = useAgentActivityPreferences((state) => state.update);
  const dockScale = useDockPreferenceStore((state) => state.dockScale);
  const setDockScale = useDockPreferenceStore((state) => state.setDockScale);
  const fontScaleRaw = useAppStore((state) => state.themeConfig.fontScale);
  const setThemeConfig = useAppStore((state) => state.setThemeConfig);
  const persistedScale = normalizeFontScale(fontScaleRaw);
  const [scaleDraft, setScaleDraft] = useState(() => persistedScale);
  const [scaleSaved, setScaleSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  const applyScalePreview = useCallback((value: number) => {
    const v = normalizeFontScale(value);
    const root = document.documentElement;
    if (v === 1) root.style.removeProperty('--font-scale');
    else root.style.setProperty('--font-scale', String(v));
  }, []);

  // Draft drives the live preview only — nothing is persisted yet.
  useEffect(() => { applyScalePreview(scaleDraft); }, [scaleDraft, applyScalePreview]);

  // Keep the draft aligned with the persisted value after external commits.
  useEffect(() => {
    setScaleDraft((prev) => (Math.abs(prev - persistedScale) < 0.001 ? persistedScale : prev));
  }, [persistedScale]);

  // Leaving the page without applying must revert the preview to persisted.
  useEffect(() => {
    return () => {
      const persistedNow = normalizeFontScale(useAppStore.getState().themeConfig.fontScale);
      const root = document.documentElement;
      if (persistedNow === 1) root.style.removeProperty('--font-scale');
      else root.style.setProperty('--font-scale', String(persistedNow));
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  const scaleDirty = Math.abs(scaleDraft - persistedScale) >= 0.001;
  const commitScale = useCallback((value: number) => {
    const normalized = normalizeFontScale(value);
    applyScalePreview(normalized);
    setScaleDraft(normalized);
    setThemeConfig({ fontScale: normalized });
    setScaleSaved(true);
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setScaleSaved(false), 1800);
  }, [applyScalePreview, setThemeConfig]);
  const applyScale = useCallback(() => {
    commitScale(scaleDraft);
  }, [commitScale, scaleDraft]);
  const cancelScale = useCallback(() => setScaleDraft(persistedScale), [persistedScale]);
  const resetScale = useCallback(() => setScaleDraft(FONT_SCALE_DEFAULT), []);

  useEffect(() => { beginDraft(); return cancelDraft; }, [beginDraft, cancelDraft]);
  useEffect(() => {
    if (location.hash === '#motion') setTab('motion');
  }, [location.hash]);
  const activePreset = draftPreset ?? appliedPreset;
  const activeAccent = draftAccent === undefined ? appliedAccent : draftAccent;
  const dirty = activePreset !== appliedPreset || activeAccent !== appliedAccent;
  const activeName = THEME_PRESET_BY_ID[activePreset].name;
  const tabs = useMemo(() => ([['theme', '主題'], ['background', '背景'], ['color', '色彩'], ['motion', '動效'], ['type', '文字']] as const), []);

  const cancel = () => { cancelDraft(); beginDraft(); };
  const apply = () => { applyDraft(); window.requestAnimationFrame(beginDraft); };

  return <div className="appearance-page" data-testid="appearance-settings-page">
    <section className="appearance-live-preview" aria-label="介面預覽" data-testid="appearance-live-preview">
      <h2 className="appearance-live-preview__title">介面預覽</h2>
      <p className="appearance-live-preview__helper">查看目前主題、背景、色彩與互動效果</p>
      <div className="appearance-live-preview__card" aria-hidden="true">
        <div className="appearance-preview-group">
          <span className="appearance-preview-label">排版樣本</span>
          <strong className="appearance-preview-sample-title">標題文字</strong>
          <p className="appearance-preview-sample-body">正文文字</p>
          <small className="appearance-preview-sample-caption">輔助文字</small>
        </div>
        <div className="appearance-preview-group">
          <span className="appearance-preview-label">按鈕樣本</span>
          <div className="appearance-preview-buttons">
            <span className="appearance-preview-btn is-primary" role="presentation">主要按鈕</span>
            <span className="appearance-preview-btn" role="presentation">次要按鈕</span>
          </div>
        </div>
        <div className="appearance-preview-group">
          <span className="appearance-preview-label">輸入樣本</span>
          <span className="appearance-preview-input" role="presentation">輸入文字…</span>
        </div>
        <div className="appearance-preview-group">
          <span className="appearance-preview-label">狀態樣本</span>
          <span className="appearance-preview-state">✓ 已選取</span>
        </div>
      </div>
    </section>
    <div className="appearance-tabs" role="tablist" aria-label="外觀設定分類">{tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'theme' && <section className="appearance-panel" role="tabpanel">
      <div className="appearance-mode"><h2>外觀模式</h2><div role="radiogroup" aria-label="外觀模式">{([['system', '系統'], ['light', '淺色'], ['dark', '深色']] as const).map(([value, label]) => <button key={value} role="radio" aria-checked={mode === value} className={mode === value ? 'selected' : ''} onClick={() => setTheme(value)}>{label}</button>)}</div></div>
      <div className="appearance-mode"><h2>底部導覽列</h2><div role="radiogroup" aria-label="底部導覽列大小">{([['small', '小'], ['medium', '中'], ['large', '大']] as const).map(([value, label]) => <button key={value} role="radio" aria-checked={dockScale === value} className={dockScale === value ? 'selected' : ''} onClick={() => setDockScale(value)}>{label}</button>)}</div></div>
      <div className="appearance-gallery" role="radiogroup" aria-label="主題預設">{THEME_PRESETS.map((preset) => <button key={preset.id} type="button" className={`appearance-theme-card${activePreset === preset.id ? ' selected' : ''}`} role="radio" aria-checked={activePreset === preset.id} onClick={() => previewPreset(preset.id as ThemePresetId)}><ThemeMiniature colors={mode === 'dark' ? preset.dark : preset.light} /><span><strong>{preset.name}</strong><small>{preset.description}</small></span><i aria-hidden="true">✓</i></button>)}</div>
    </section>}
    {tab === 'background' && <section className="appearance-panel" role="tabpanel"><WallpaperSettingsPanel /></section>}
    {tab === 'color' && <section className="appearance-panel appearance-color-panel" role="tabpanel"><h2>強調色</h2><p>只調整 canonical accent；懸停、按下、焦點、選取與月暈色會自動以 OKLCH 推導。</p><div className="appearance-accent-grid">{ACCENTS.map((color) => <button key={color} aria-label={`選擇強調色 ${color}`} aria-pressed={activeAccent === color} style={{ backgroundColor: color }} onClick={() => previewAccent(color)} />)}<label><input type="color" value={activeAccent ?? THEME_PRESET_BY_ID[activePreset].light[2]} onChange={(event) => previewAccent(event.target.value)} /><span>自訂</span></label></div><button className="appearance-clear-accent" onClick={() => previewAccent(null)}>使用主題預設色</button><p className="appearance-contrast-note">按鈕前景色會依實際亮度自動選擇深色或白色，避免自訂色讓文字失去可讀性。</p></section>}
    {tab === 'motion' && <section className="appearance-panel appearance-motion-panel" role="tabpanel">
      <div className="appearance-motion-section">
        <h2>月暈回饋</h2><p>點擊互動控制時，在指標位置顯示短促、克制的局部光暈。</p><IOSSwitch checked={motionPreview} onChange={setMotionPreview} label="預覽互動回饋" /><button className="appearance-ripple-demo" data-moon-ripple={motionPreview ? 'true' : undefined}>試試月暈回饋</button><small>系統開啟「減少動態效果」時，幾何擴張會自動停用，只保留色彩與邊框回饋。</small>
      </div>
      <div className="appearance-motion-section appearance-activity-settings" data-testid="appearance-activity-settings">
        <h2>動畫與動態效果</h2>
        <p>調整 Rune 回覆期間的活動指示。這些選項不會改變 Provider 或 Chat request runtime。</p>
        <div className="appearance-activity-row">
          <span><strong>AI 活動動畫</strong><small>顯示 Rune 回覆時的活動動畫</small></span>
          <IOSSwitch checked={activityAnimationEnabled} onChange={(checked) => updateActivityPreferences({ animationEnabled: checked })} label="AI 活動動畫" />
        </div>
        <div className="appearance-activity-row">
          <span><strong>顯示狀態文字</strong><small>顯示聆聽、搜尋、工具等簡短狀態</small></span>
          <IOSSwitch checked={showActivityLabel} onChange={(checked) => updateActivityPreferences({ showLabel: checked })} label="顯示狀態文字" />
        </div>
        <label className="appearance-activity-row">
          <span><strong>減少動畫</strong><small>降低 AI 活動與回覆動畫</small></span>
          <select value={reducedActivityMotion} aria-label="減少動畫" onChange={(event) => updateActivityPreferences({ reducedMotion: event.target.value as 'system' | 'on' | 'off' })}>
            <option value="system">跟隨系統</option><option value="on">開啟</option><option value="off">關閉</option>
          </select>
        </label>
      </div>
    </section>}
    {tab === 'type' && <section className="appearance-panel appearance-type-panel" role="tabpanel" data-testid="appearance-type-panel">
      <h2>文字與排版</h2>
      <p>只調整介面文字大小；按鈕、圖示、面板與 Dock 的幾何尺寸維持標準。拖曳滑桿或選取快速設定會即時預覽，按「套用」才會永久保存。</p>
      <div className="appearance-type-slider-row">
        <span className="appearance-type-scale-bound">85%</span>
        <input
          type="range"
          className="appearance-type-slider"
          data-testid="font-scale-slider"
          min={FONT_SCALE_MIN}
          max={FONT_SCALE_MAX}
          step={0.05}
          value={scaleDraft}
          aria-label="文字大小"
          aria-valuemin={FONT_SCALE_MIN}
          aria-valuemax={FONT_SCALE_MAX}
          aria-valuenow={scaleDraft}
          aria-valuetext={`${Math.round(scaleDraft * 100)}%`}
          onChange={(event) => setScaleDraft(Number(event.target.value))}
        />
        <span className="appearance-type-scale-bound">125%</span>
      </div>
      <div className="appearance-type-current" data-testid="font-scale-current" role="status">目前 {Math.round(scaleDraft * 100)}%</div>
      <div className="appearance-type-presets" role="group" aria-label="文字大小快速設定">
        {FONT_SCALE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            data-testid={`font-scale-preset-${preset.key}`}
            aria-pressed={Math.abs(scaleDraft - preset.value) < 0.001}
            onClick={() => setScaleDraft(preset.value)}
          >
            {preset.label}<small>{Math.round(preset.value * 100)}%</small>
          </button>
        ))}
      </div>
      <button type="button" className="appearance-type-reset" data-testid="font-scale-reset" onClick={resetScale}>恢復標準</button>
      <div className="appearance-type-actions">
        <button type="button" data-testid="font-scale-cancel" onClick={cancelScale} disabled={!scaleDirty}>取消</button>
        <button type="button" className="appearance-type-apply" data-testid="font-scale-apply" onClick={applyScale} disabled={!scaleDirty}>套用</button>
      </div>
      {scaleSaved && <span className="appearance-type-saved" data-testid="font-scale-saved" role="status">已儲存 ✓</span>}
    </section>}
    {dirty && <div className="appearance-change-bar" role="status"><span>正在預覽「{activeName}」</span><div><button onClick={cancel}>取消變更</button><button className="primary" onClick={apply}>套用主題</button></div></div>}
  </div>;
}
