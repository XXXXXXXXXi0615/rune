import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useTypographyStore } from '@/store/useTypographyStore';
import { useToastStore } from '@/store/useToastStore';
import { AppDialog } from '@/components/ui/AppPrimitives';
import { FONT_MANIFEST, getFontById, getDefaultFontIdForRole, BUNDLED_FONTS } from '@/features/typography/fontManifest';
import { TYPOGRAPHY_PRESETS, getDefaultPreset } from '@/features/typography/typographyPresets';
import { saveFontBlob, deleteFontBlob } from '@/features/typography/fontStorage';
import { installCustomFont, downloadAndRegisterFont } from '@/features/typography/fontLoader';
import { isFontAvailable } from '@/features/typography/fontAvailability';
import {
  buildFontStack,
  applyTypographyToDocument,
  applyTypography,
  getStoreDraft,
  clampWeight,
  type TypographyDraft,
} from '@/features/typography/applyTypography';
import type { FontFamilyDefinition, FontRole, FontSource, TypographyProfile, CustomFontRecord } from '@/features/typography/types';
import { applyAppearanceColors, DEFAULT_APPEARANCE_COLORS, loadAppearanceColors, type AppearanceColors } from '@/features/typography/appearanceColors';
import './TypographySettingsPage.css';

type TabId = 'combos' | 'display' | 'body' | 'mono' | 'custom';
type SourceFilter = 'all' | 'bundled' | 'system' | 'downloadable' | 'custom';

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: '全部',
  bundled: 'Rune內置',
  system: '本機可用',
  downloadable: '可下載',
  custom: '自定義',
};

const SOURCE_FILTERS: SourceFilter[] = ['all', 'bundled', 'system', 'downloadable', 'custom'];
const TABS: { id: TabId; label: string }[] = [
  { id: 'combos', label: '字體組合' },
  { id: 'display', label: '標題字體' },
  { id: 'body', label: '正文字體' },
  { id: 'mono', label: '等寬字體' },
  { id: 'custom', label: '自定義字體' },
];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'];
const ALLOWED_MIMES = ['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/octet-stream', 'application/x-font-ttf', 'application/x-font-opentype', 'application/x-font-woff'];

type ApplyPhase = 'idle' | 'loading' | 'success' | 'error';

const CJK_PREVIEW = 'Rune如詩，溫柔地記錄每一個當下';
const LATIN_PREVIEW = 'Lunartide remembers every quiet moment.';
const DIGITS_PREVIEW = '0123456789 ½ ¼ — 「」！？；：';
const BODY_PREVIEW = '在每個潮起潮落之間，Rune為你記住所有細碎的日常、天氣、心情與遇見。這裡沒有複雜的介面，只留下你與自己的對話空間。';
const CODE_PREVIEW = 'const tide = "moon";\nconst depth = 384_400;\nfunction orbit(phase: Phase) {\n  return { phase, gravity: 1.62 };\n}';

function getCoverageLabel(cov: FontFamilyDefinition['languageCoverage']): string {
  const parts: string[] = [];
  if (cov.latin) parts.push('Latin');
  if (cov.traditionalChinese) parts.push('繁體');
  if (cov.simplifiedChinese) parts.push('簡體');
  if (cov.japanese) parts.push('日文');
  if (cov.korean) parts.push('韓文');
  return parts.join(' · ');
}

function getRoleLabel(roles: FontRole[]): string {
  const map: Record<FontRole, string> = { display: '標題', body: '正文', mono: '等寬' };
  return roles.map((r) => map[r]).join(' · ');
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TypographySettingsPage() {
  const store = useTypographyStore();
  const showToast = useToastStore((s) => s.showToast);

  const [tab, setTab] = useState<TabId>('combos');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const [draft, setDraft] = useState<TypographyDraft>(() => ({
    displayFontId: store.displayFontId,
    bodyFontId: store.bodyFontId,
    monoFontId: store.monoFontId,
    displayWeight: store.displayWeight,
    bodyWeight: store.bodyWeight,
    monoWeight: store.monoWeight,
    baseSize: store.baseSize,
    lineHeight: store.lineHeight,
    letterSpacing: store.letterSpacing,
  }));

  const [applyPhase, setApplyPhase] = useState<ApplyPhase>('idle');
  const [systemAvail, setSystemAvail] = useState<Map<string, boolean>>(new Map());
  const [bundledAvail, setBundledAvail] = useState<Map<string, boolean>>(new Map());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [colorDraft, setColorDraft] = useState<AppearanceColors>(() => loadAppearanceColors());

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sys = new Map<string, boolean>();
    for (const f of FONT_MANIFEST) {
      if (f.source === 'system') {
        sys.set(f.id, isFontAvailable(f.family));
      }
    }
    setSystemAvail(sys);
    const bun = new Map<string, boolean>();
    for (const f of BUNDLED_FONTS) {
      bun.set(f.id, isFontAvailable(f.family));
    }
    setBundledAvail(bun);
  }, []);

  // Live-preview: sync draft to CSS when anything changes
  useEffect(() => {
    applyTypographyToDocument(draft);
  }, [draft]);

  // Revert global typography to the *applied* (persisted) values when leaving
  // without applying, so an unapplied draft never leaks into the rest of the app.
  useEffect(() => () => {
    applyTypographyToDocument(getStoreDraft());
  }, []);

  const effectiveStatus = useCallback((font: FontFamilyDefinition): FontFamilyDefinition['status'] => {
    if (font.source === 'bundled') {
      const avail = bundledAvail.get(font.id);
      if (avail === false) return 'failed';
      return 'available';
    }
    if (font.source === 'system') {
      const avail = systemAvail.get(font.id);
      if (avail === true) return 'available';
      if (avail === false) return 'not-installed';
      return 'not-installed';
    }
    if (font.source === 'downloadable') {
      if (store.downloadedFontIds.includes(font.id)) return 'available';
      return 'not-downloaded';
    }
    if (font.source === 'custom') return 'available';
    return 'not-downloaded';
  }, [bundledAvail, systemAvail, store.downloadedFontIds]);

  const visibleFonts = useMemo(() => {
    let fonts: (FontFamilyDefinition | CustomFontRecord)[] = [];

    if (tab === 'custom') {
      fonts = store.customFonts;
    } else {
      const role: FontRole = tab === 'combos' ? 'display' : tab;
      const byRole = FONT_MANIFEST.filter((f) => f.roles.includes(role));

      if (sourceFilter === 'all') {
        fonts = byRole;
      } else if (sourceFilter === 'custom') {
        fonts = store.customFonts;
      } else {
        fonts = byRole.filter((f) => f.source === sourceFilter);
      }
    }

    if (sourceFilter === 'all' && tab !== 'custom') {
      fonts.push(...store.customFonts);
    }

    const seen = new Set<string>();
    return fonts.filter((f) => {
      const key = 'family' in f ? (f as FontFamilyDefinition).id : (f as CustomFontRecord).id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tab, sourceFilter, store.customFonts]);

  const isFontUsed = useCallback((fontId: string, role?: FontRole): boolean => {
    if (role === 'display') return draft.displayFontId === fontId;
    if (role === 'body') return draft.bodyFontId === fontId;
    if (role === 'mono') return draft.monoFontId === fontId;
    return draft.displayFontId === fontId || draft.bodyFontId === fontId || draft.monoFontId === fontId;
  }, [draft.displayFontId, draft.bodyFontId, draft.monoFontId]);

  const selectFont = useCallback((fontId: string) => {
    if (tab === 'display') setDraft((d) => ({ ...d, displayFontId: fontId }));
    else if (tab === 'body') setDraft((d) => ({ ...d, bodyFontId: fontId }));
    else if (tab === 'mono') setDraft((d) => ({ ...d, monoFontId: fontId }));
  }, [tab]);

  const handleDownload = useCallback(async (font: FontFamilyDefinition) => {
    const asset = font.assets?.[0];
    if (!asset?.url) {
      showToast('此字體暫無下載連結');
      return;
    }
    setDownloadingIds((s) => new Set(s).add(font.id));
    try {
      const status = await downloadAndRegisterFont(font, asset.url, asset.format, font.id, asset.weight || 400);
      if (status === 'available') {
        store.markFontDownloaded(font.id);
        showToast(`${font.displayName} 已下載`);
      } else {
        showToast('下載失敗');
      }
    } catch {
      showToast('下載失敗，請檢查網路');
    } finally {
      setDownloadingIds((s) => {
        const next = new Set(s);
        next.delete(font.id);
        return next;
      });
    }
  }, [showToast, store]);

  const handleDeleteDownloaded = useCallback(async (font: FontFamilyDefinition) => {
    const using =
      draft.displayFontId === font.id ||
      draft.bodyFontId === font.id ||
      draft.monoFontId === font.id;
    if (using) {
      showToast('請先切換至其他字體再刪除');
      return;
    }
    try {
      await deleteFontBlob(font.id);
      store.markFontRemoved(font.id);
      showToast(`${font.displayName} 已移除`);
    } catch {
      showToast('刪除失敗');
    }
  }, [draft, showToast, store]);

  const handleUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showToast('不支援的字體格式');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(`檔案過大（上限 ${MAX_UPLOAD_BYTES / 1024 / 1024} MB）`);
      e.target.value = '';
      return;
    }
    setLoadingIds((s) => new Set(s).add('__upload__'));
    try {
      const format = ext.replace('.', '') as CustomFontRecord['format'];
      const name = file.name.replace(/\.[^.]+$/, '');
      const fontFamily = `"${name}-custom"`;
      await installCustomFont(fontFamily, file, format);

      const id = crypto.randomUUID();
      const blobForStorage = new Blob([file], { type: file.type });
      await saveFontBlob(id, blobForStorage, format);

      const record: CustomFontRecord = {
        id,
        displayName: name,
        assetId: id,
        format,
        sizeBytes: file.size,
        originalFilename: file.name,
        family: fontFamily,
        weights: [400],
        createdAt: Date.now(),
      };
      store.addCustomFont(record);
      showToast(`${name} 已安裝`);
    } catch {
      showToast('字體安裝失敗');
    } finally {
      setLoadingIds((s) => {
        const next = new Set(s);
        next.delete('__upload__');
        return next;
      });
      e.target.value = '';
    }
  }, [showToast, store]);

  const handleDeleteCustom = useCallback(async (font: CustomFontRecord) => {
    const using =
      draft.displayFontId === font.id ||
      draft.bodyFontId === font.id ||
      draft.monoFontId === font.id;
    if (using) {
      setDraft((d) => {
        const next = { ...d };
        if (d.displayFontId === font.id) next.displayFontId = 'lora';
        if (d.bodyFontId === font.id) next.bodyFontId = 'inter';
        if (d.monoFontId === font.id) next.monoFontId = 'jetbrains-mono';
        return next;
      });
    }
    try {
      await deleteFontBlob(font.assetId);
      store.removeCustomFont(font.id);
      showToast('字體已刪除');
    } catch {
      showToast('刪除失敗');
    }
  }, [draft, showToast, store]);

  const handleApply = useCallback(async () => {
    setApplyPhase('loading');
    try {
      // Write draft to store
      store.setDisplayFont(draft.displayFontId);
      store.setBodyFont(draft.bodyFontId);
      store.setMonoFont(draft.monoFontId);
      store.setDisplayWeight(draft.displayWeight);
      store.setBodyWeight(draft.bodyWeight);
      store.setMonoWeight(draft.monoWeight);
      store.setBaseSize(draft.baseSize);
      store.setLineHeight(draft.lineHeight);
      store.setLetterSpacing(draft.letterSpacing);

      // Apply globally: sync CSS vars + load fonts
      await applyTypography(draft);
      applyAppearanceColors(colorDraft, true);
      setApplyPhase('success');
      showToast('字體已套用至整個Rune');
    } catch {
      setApplyPhase('error');
      showToast('套用字體失敗');
    }
  }, [colorDraft, draft, showToast, store]);

  const handleCancel = useCallback(() => {
    // Reset draft to store (applied) values
    const restored: TypographyDraft = {
      displayFontId: store.displayFontId,
      bodyFontId: store.bodyFontId,
      monoFontId: store.monoFontId,
      displayWeight: store.displayWeight,
      bodyWeight: store.bodyWeight,
      monoWeight: store.monoWeight,
      baseSize: store.baseSize,
      lineHeight: store.lineHeight,
      letterSpacing: store.letterSpacing,
    };
    setDraft(restored);
    setColorDraft(loadAppearanceColors());
    applyTypographyToDocument(restored);
    setApplyPhase('idle');
  }, [store]);

  const handleResetConfirm = useCallback(() => {
    setShowResetConfirm(false);
    store.resetToDefaults();
    const defaultProfile = getDefaultPreset();
    const d: TypographyDraft = {
      displayFontId: defaultProfile.displayFontId,
      bodyFontId: defaultProfile.bodyFontId,
      monoFontId: defaultProfile.monoFontId,
      displayWeight: defaultProfile.displayWeight,
      bodyWeight: defaultProfile.bodyWeight,
      monoWeight: defaultProfile.monoWeight,
      baseSize: defaultProfile.baseSize,
      lineHeight: defaultProfile.lineHeight,
      letterSpacing: defaultProfile.letterSpacing,
    };
    setDraft(d);
    applyTypographyToDocument(d);
    applyTypography(d).catch(() => {});
    setColorDraft({ ...DEFAULT_APPEARANCE_COLORS });
    applyAppearanceColors(DEFAULT_APPEARANCE_COLORS, true);
    setApplyPhase('success');
    showToast('已恢復Rune默認字體');
  }, [showToast, store]);

  const handleProfileSelect = useCallback((profile: TypographyProfile) => {
    setDraft({
      displayFontId: profile.displayFontId,
      bodyFontId: profile.bodyFontId,
      monoFontId: profile.monoFontId,
      displayWeight: profile.displayWeight,
      bodyWeight: profile.bodyWeight,
      monoWeight: profile.monoWeight,
      baseSize: profile.baseSize,
      lineHeight: profile.lineHeight,
      letterSpacing: profile.letterSpacing,
    });
  }, []);

  const displayDef = getFontById(draft.displayFontId);
  const bodyDef = getFontById(draft.bodyFontId);
  const monoDef = getFontById(draft.monoFontId);

  const hasChanges = useMemo(() => {
    return (
      draft.displayFontId !== store.displayFontId ||
      draft.bodyFontId !== store.bodyFontId ||
      draft.monoFontId !== store.monoFontId ||
      draft.displayWeight !== store.displayWeight ||
      draft.bodyWeight !== store.bodyWeight ||
      draft.monoWeight !== store.monoWeight ||
      draft.baseSize !== store.baseSize ||
      draft.lineHeight !== store.lineHeight ||
      draft.letterSpacing !== store.letterSpacing
      || colorDraft.text !== loadAppearanceColors().text
      || colorDraft.text2 !== loadAppearanceColors().text2
      || colorDraft.accent !== loadAppearanceColors().accent
      || colorDraft.readable !== loadAppearanceColors().readable
    );
  }, [colorDraft, draft, store]);

  // Button state machine: idle → dirty → loading → success / error
  const btnState: 'idle' | 'dirty' | 'loading' | 'success' | 'error' =
    applyPhase === 'loading' ? 'loading'
      : applyPhase === 'error' ? 'error'
        : hasChanges ? 'dirty'
          : applyPhase === 'success' ? 'success'
            : 'idle';

  const applyLabel =
    btnState === 'loading' ? '套用中…'
      : btnState === 'dirty' || btnState === 'error' ? '重新套用'
        : btnState === 'success' ? '已套用'
          : '套用字體';
  const applyDisabled = btnState === 'idle' || btnState === 'success' || btnState === 'loading';
  // Only highlight as primary when there is an action to take (avoid a meaningless pale-green button when nothing changed)
  const applyPrimary = btnState === 'dirty' || btnState === 'error' || btnState === 'loading';

  return (
    <div className="typography-settings">
      <div className="typo-scroll-area">
      {/* Preview */}
      <div className="typo-preview typo-preview--interface" style={{ '--preview-text': colorDraft.text, '--preview-text-2': colorDraft.text2, '--preview-accent': colorDraft.accent } as CSSProperties}>
        <div className="typo-preview-block typo-preview-cjk" style={{ fontFamily: buildFontStack(draft.displayFontId), fontWeight: draft.displayWeight }}>
          <h3 className="typo-preview-label">中文標題</h3>
          {CJK_PREVIEW}
        </div>
        <div className="typo-preview-block typo-preview-latin" style={{ fontFamily: buildFontStack(draft.displayFontId), fontWeight: draft.displayWeight }}>
          <h3 className="typo-preview-label">Latin</h3>
          {LATIN_PREVIEW}
        </div>
        <div className="typo-preview-block typo-preview-digits" style={{ fontFamily: buildFontStack(draft.bodyFontId), fontWeight: draft.bodyWeight }}>
          <h3 className="typo-preview-label">數字與標點</h3>
          {DIGITS_PREVIEW}
        </div>
        <div className="typo-preview-block typo-preview-body" style={{ fontFamily: buildFontStack(draft.bodyFontId), fontWeight: draft.bodyWeight, fontSize: `${draft.baseSize}px`, lineHeight: draft.lineHeight, letterSpacing: `${draft.letterSpacing}em` }}>
          <h3 className="typo-preview-label">正文段落</h3>
          {BODY_PREVIEW}
        </div>
        <div className="typo-preview-block typo-preview-code" style={{ fontFamily: buildFontStack(draft.monoFontId), fontWeight: draft.monoWeight }}>
          <h3 className="typo-preview-label">代碼</h3>
          <pre>{CODE_PREVIEW}</pre>
        </div>

        <div className="typo-preview-ui" data-readable={colorDraft.readable || undefined}>
          <button type="button">儲存片段</button><a href="#typography-preview">查看閱讀設定</a><input value="正在輸入的文字" readOnly aria-label="輸入框預覽" />
          <span className="typo-preview-focus">焦點狀態</span>
        </div>

        <div className="typo-active-stack">
          <div className="typo-active-stack-row">
            <span className="typo-active-stack-role">標題</span>
            <span className="typo-active-stack-chain">
              {displayDef?.family || draft.displayFontId} → {displayDef?.fallbackStack.slice(0, 2).join(' → ') || 'fallback'}
            </span>
          </div>
          <div className="typo-active-stack-row">
            <span className="typo-active-stack-role">正文</span>
            <span className="typo-active-stack-chain">
              {bodyDef?.family || draft.bodyFontId} → {bodyDef?.fallbackStack.slice(0, 2).join(' → ') || 'fallback'}
            </span>
          </div>
          <div className="typo-active-stack-row">
            <span className="typo-active-stack-role">等寬</span>
            <span className="typo-active-stack-chain">
              {monoDef?.family || draft.monoFontId} → {monoDef?.fallbackStack.slice(0, 2).join(' → ') || 'fallback'}
            </span>
          </div>
        </div>
      </div>

      <section className="typo-colors" aria-label="文字色彩與可讀性">
        <div className="typo-params-title">文字色彩</div>
        <div className="typo-color-grid">
          {([['text', '主文字色'], ['text2', '次文字色'], ['accent', '強調色']] as const).map(([key, label]) => (
            <label key={key} className="typo-color-control"><span>{label}</span><input type="color" value={colorDraft[key]} onChange={(event) => setColorDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>
          ))}
        </div>
        <div className="typo-readable-row"><div><strong>可讀性模式</strong><small>{colorDraft.readable ? '高可讀模式會提高前景對比，並降低背景圖的干擾。' : '柔和模式保留背景皮膚的氛圍與層次。'}</small></div><button type="button" className={`typo-readable-switch${colorDraft.readable ? ' is-active' : ''}`} onClick={() => setColorDraft((current) => ({ ...current, readable: !current.readable }))} aria-pressed={colorDraft.readable}>{colorDraft.readable ? '高可讀模式' : '柔和模式'}</button></div>
      </section>

      {/* Tabs */}
      <div className="typo-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`typo-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Source filter */}
      {tab !== 'combos' && (
        <div className="typo-source-filters">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`typo-source-chip${sourceFilter === f ? ' is-active' : ''}`}
              onClick={() => setSourceFilter(f)}
            >
              {SOURCE_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {/* Combos tab */}
      {tab === 'combos' && (
        <div className="typo-combos">
          {TYPOGRAPHY_PRESETS.map((profile) => {
            const pDisplay = getFontById(profile.displayFontId);
            const pBody = getFontById(profile.bodyFontId);
            const pMono = getFontById(profile.monoFontId);
            const isActive =
              draft.displayFontId === profile.displayFontId &&
              draft.bodyFontId === profile.bodyFontId &&
              draft.monoFontId === profile.monoFontId;
            const isApplied =
              store.displayFontId === profile.displayFontId &&
              store.bodyFontId === profile.bodyFontId &&
              store.monoFontId === profile.monoFontId;
            const isIansui = profile.displayFontId === 'iansui' || profile.bodyFontId === 'iansui';
            return (
              <button
                key={profile.id}
                type="button"
                className={`typo-combo-card${isActive ? ' is-selected' : ''}`}
                onClick={() => handleProfileSelect(profile)}
              >
                <div className="typo-combo-head">
                  <div className="typo-combo-name">{profile.name}</div>
                  <div className="typo-combo-badges">
                    {isApplied && <span className="typo-chip typo-chip--applied">使用中</span>}
                    {!isApplied && isActive && <span className="typo-chip typo-chip--dirty">尚未套用</span>}
                    {isIansui && <span className="typo-chip typo-chip--partial">部分支援</span>}
                  </div>
                </div>
                <div
                  className="typo-combo-preview"
                  style={{ fontFamily: buildFontStack(profile.displayFontId), fontWeight: draft.displayWeight }}
                >
                  <div className="typo-combo-preview-cjk">Rune會記得每一次靠近。</div>
                  <div className="typo-combo-preview-latin" style={{ fontFamily: buildFontStack(profile.bodyFontId) }}>
                    Rune 0123456789
                  </div>
                  <div className="typo-combo-preview-punct" style={{ fontFamily: buildFontStack(profile.bodyFontId) }}>
                    ，。！？「」——
                  </div>
                </div>
                <div className="typo-combo-stack">
                  <span>標題: {pDisplay?.displayName || profile.displayFontId}</span>
                  <span>正文: {pBody?.displayName || profile.bodyFontId}</span>
                  <span>等寬: {pMono?.displayName || profile.monoFontId}</span>
                </div>
                {isIansui && (
                  <div className="typo-combo-warning">實驗性字體 · 可能存在缺字</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Font cards */}
      {tab !== 'combos' && (
        <div className="typo-font-grid">
          {visibleFonts.length === 0 && (
            <div className="typo-empty">沒有符合條件的字體</div>
          )}

          {visibleFonts.map((font) => {
            if ('displayName' in font && 'assetId' in font) {
              const cf = font as CustomFontRecord;
              const isUsed = isFontUsed(cf.id);
              const isAppliedCustom = store.displayFontId === cf.id || store.bodyFontId === cf.id || store.monoFontId === cf.id;
              return (
                <div
                  key={cf.id}
                  className={`typo-font-card${isUsed ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isUsed}
                  onClick={() => !isUsed && selectFont(cf.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isUsed) selectFont(cf.id); } }}
                >
                  <div className="typo-font-card-preview" style={{ fontFamily: cf.family }}>
                    <div className="typo-font-card-preview-cjk">Rune會記得每一次靠近。</div>
                    <div className="typo-font-card-preview-latin">Rune 0123456789</div>
                    <div className="typo-font-card-preview-punct">，。！？「」——</div>
                  </div>
                  <div className="typo-font-card-meta">
                    <span className="typo-font-card-name" style={{ fontFamily: cf.family }}>{cf.displayName}</span>
                    <span className="typo-font-card-source">自定義</span>
                  </div>
                  <div className="typo-font-card-info">
                    <span>{formatBytes(cf.sizeBytes)}</span>
                    <span>{cf.format.toUpperCase()}</span>
                  </div>
                  <div className="typo-no-cjk-note">中文字形覆蓋範圍未知</div>
                  <div className="typo-font-card-actions">
                    {isAppliedCustom ? (
                      <span className="typo-chip typo-chip--applied">使用中</span>
                    ) : isUsed ? (
                      <span className="typo-chip typo-chip--dirty">尚未套用</span>
                    ) : (
                      <button type="button" className="typo-btn typo-btn-sm" onClick={(e) => { e.stopPropagation(); selectFont(cf.id); }}>
                        選用
                      </button>
                    )}
                    <button type="button" className="typo-btn typo-btn-sm typo-btn-danger" onClick={(e) => { e.stopPropagation(); handleDeleteCustom(cf); }}>
                      刪除
                    </button>
                  </div>
                </div>
              );
            }

            const f = font as FontFamilyDefinition;
            const status = effectiveStatus(f);
            const isUsed = isFontUsed(f.id);
            const isApplied = store.displayFontId === f.id || store.bodyFontId === f.id || store.monoFontId === f.id;
            const isDownloading = downloadingIds.has(f.id);
            const fontFamily = f.family;
            const canSelect = status === 'available' && !isUsed;
            const partialSupport = (f.roles.includes('display') || f.roles.includes('body')) && !f.languageCoverage.traditionalChinese && !f.languageCoverage.simplifiedChinese;

            return (
              <div
                key={f.id}
                className={`typo-font-card${isUsed ? ' is-selected' : ''}${status === 'failed' || status === 'not-installed' ? ' is-unavailable' : ''}`}
                role="button"
                tabIndex={canSelect ? 0 : -1}
                aria-pressed={isUsed}
                aria-disabled={!canSelect}
                onClick={() => canSelect && selectFont(f.id)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canSelect) { e.preventDefault(); selectFont(f.id); } }}
              >
                <div className="typo-font-card-preview" style={{ fontFamily: `"${fontFamily}"` }}>
                  <div className="typo-font-card-preview-cjk">Rune會記得每一次靠近。</div>
                  <div className="typo-font-card-preview-latin">Rune 0123456789</div>
                  <div className="typo-font-card-preview-punct">，。！？「」——</div>
                </div>
                <div className="typo-font-card-meta">
                  <span className="typo-font-card-name" style={{ fontFamily: `"${fontFamily}"` }}>
                    {f.displayName}
                  </span>
                  <span className="typo-font-card-source">
                    {f.source === 'bundled' ? 'Rune內置' : f.source === 'system' ? '本機' : '可下載'}
                  </span>
                </div>
                <div className="typo-font-card-info">
                  <span>{getRoleLabel(f.roles)}</span>
                  <span>{getCoverageLabel(f.languageCoverage)}</span>
                </div>
                {f.assets?.[0]?.sizeBytes ? (
                  <div className="typo-font-card-info">
                    <span>{formatBytes(f.assets[0].sizeBytes)}</span>
                    <span>{f.assets[0].format.toUpperCase()}</span>
                  </div>
                ) : null}
                <div className="typo-font-card-license">
                  授權: {f.license.name}
                </div>

                {!f.languageCoverage.traditionalChinese && !f.languageCoverage.simplifiedChinese && (
                  <div className="typo-no-cjk-note">不含中文字形</div>
                )}

                <div className="typo-font-card-actions">
                  {status === 'available' && (
                    <>
                      {isApplied ? (
                        <span className="typo-chip typo-chip--applied">使用中</span>
                      ) : isUsed ? (
                        <span className="typo-chip typo-chip--dirty">尚未套用</span>
                      ) : (
                        <button type="button" className="typo-btn typo-btn-sm" onClick={(e) => { e.stopPropagation(); selectFont(f.id); }}>
                          選用
                        </button>
                      )}
                      {partialSupport && <span className="typo-chip typo-chip--partial">部分支援</span>}
                      {f.source === 'downloadable' && (
                        <button
                          type="button"
                          className="typo-btn typo-btn-sm typo-btn-danger"
                          onClick={(e) => { e.stopPropagation(); handleDeleteDownloaded(f); }}
                        >
                          移除
                        </button>
                      )}
                    </>
                  )}

                  {status === 'not-downloaded' && (
                    <button
                      type="button"
                      className="typo-btn typo-btn-sm typo-btn-primary"
                      onClick={(e) => { e.stopPropagation(); handleDownload(f); }}
                      disabled={isDownloading}
                    >
                      {isDownloading ? '下載中...' : '下載'}
                    </button>
                  )}

                  {status === 'not-installed' && (
                    <span className="typo-status-badge typo-status-unavailable">未安裝</span>
                  )}

                  {status === 'failed' && (
                    <span className="typo-chip typo-chip--error">載入失敗</span>
                  )}

                  {status === 'loading' && (
                    <span className="typo-status-badge typo-status-loading">載入中...</span>
                  )}
                </div>

                {f.id === 'iansui' && (
                  <div className="typo-combo-warning" style={{ marginTop: 4 }}>
                    實驗性字體 · 可能存在缺字 · 不得作為唯一全局 fallback
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom upload section */}
      {tab === 'custom' && (
        <div className="typo-upload-section">
          <label className="typo-upload-label">
            <span>上傳自訂字體</span>
            <small>支援 .ttf、.otf、.woff、.woff2（上限 20 MB），檔案只保存在本機 IndexedDB。</small>
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleUpload}
            />
          </label>
        </div>
      )}

      {/* Typography parameters */}
      <div className="typo-params">
        <div className="typo-params-title">字體參數</div>

        <div className="typo-param-row">
          <label className="typo-param-label">
            <span>標題字重</span>
            <span className="typo-param-value">{draft.displayWeight}</span>
          </label>
          <input
            type="range"
            min={100}
            max={900}
            step={100}
            value={draft.displayWeight}
            onChange={(e) => setDraft((d) => ({ ...d, displayWeight: Number(e.target.value) }))}
          />
          {displayDef && clampWeight(draft.displayFontId, draft.displayWeight).clamped && (
            <span className="typo-param-hint">最近可用: {clampWeight(draft.displayFontId, draft.displayWeight).effective}</span>
          )}
        </div>

        <div className="typo-param-row">
          <label className="typo-param-label">
            <span>正文字重</span>
            <span className="typo-param-value">{draft.bodyWeight}</span>
          </label>
          <input
            type="range"
            min={100}
            max={900}
            step={100}
            value={draft.bodyWeight}
            onChange={(e) => setDraft((d) => ({ ...d, bodyWeight: Number(e.target.value) }))}
          />
          {bodyDef && clampWeight(draft.bodyFontId, draft.bodyWeight).clamped && (
            <span className="typo-param-hint">最近可用: {clampWeight(draft.bodyFontId, draft.bodyWeight).effective}</span>
          )}
        </div>

        <div className="typo-param-row">
          <label className="typo-param-label">
            <span>基礎字號</span>
            <span className="typo-param-value">{draft.baseSize}px</span>
          </label>
          <input
            type="range"
            min={12}
            max={22}
            step={1}
            value={draft.baseSize}
            onChange={(e) => setDraft((d) => ({ ...d, baseSize: Number(e.target.value) }))}
          />
        </div>

        <div className="typo-param-row">
          <label className="typo-param-label">
            <span>行高</span>
            <span className="typo-param-value">{draft.lineHeight.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={1.0}
            max={2.2}
            step={0.05}
            value={draft.lineHeight}
            onChange={(e) => setDraft((d) => ({ ...d, lineHeight: Number(e.target.value) }))}
          />
        </div>

        <div className="typo-param-row">
          <label className="typo-param-label">
            <span>字距</span>
            <span className="typo-param-value">{draft.letterSpacing.toFixed(2)}em</span>
          </label>
          <input
            type="range"
            min={-0.05}
            max={0.15}
            step={0.005}
            value={draft.letterSpacing}
            onChange={(e) => setDraft((d) => ({ ...d, letterSpacing: Number(e.target.value) }))}
          />
        </div>
      </div>

      </div>

      {/* Bottom actions */}
      <div className="typo-actions">
        <button type="button" className="typo-btn" onClick={() => setShowResetConfirm(true)}>
          恢復Rune默認
        </button>
        <button
          type="button"
          className="typo-btn"
          onClick={handleCancel}
          disabled={!hasChanges}
        >
          取消
        </button>
        <button
          type="button"
          className={`typo-btn${applyPrimary ? ' typo-btn-primary' : ''}`}
          onClick={handleApply}
          disabled={applyDisabled}
          data-testid="typo-apply"
          aria-label="套用字體"
        >
          {applyLabel}
        </button>
      </div>

      <AppDialog
        open={showResetConfirm}
        title="恢復預設"
        onClose={() => setShowResetConfirm(false)}
        footer={
          <>
            <button type="button" className="typo-btn" onClick={() => setShowResetConfirm(false)}>取消</button>
            <button type="button" className="typo-btn typo-btn-primary" onClick={handleResetConfirm}>確認恢復</button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
          確認恢復Rune預設字體設定？目前所有變更將會遺失。
        </p>
      </AppDialog>
    </div>
  );
}
