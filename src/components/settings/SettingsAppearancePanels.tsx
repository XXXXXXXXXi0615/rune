import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import {
  uploadCustomFont,
  deleteCustomFont,
  FONT_PREVIEW_TEXT,
  FONT_PREVIEW_CJK,
  FONT_PREVIEW_DIGITS,
  FONT_PREVIEW_PUNCT,
  SYSTEM_DISPLAY_FONTS,
  SYSTEM_BODY_FONTS,
  SYSTEM_MONO_FONTS,
  registerGoogleFont,
} from '@/utils/fontLibrary';
import type { CustomFont } from '@/utils/fontLibrary';

/* ── Font Manager ── */

const RECENT_FONTS_KEY = 'lunartide_recent_fonts';
const RECENT_FONTS_MAX = 10;

function loadRecentFonts(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_FONTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentFonts(fonts: string[]) {
  try {
    localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(fonts.slice(0, RECENT_FONTS_MAX)));
  } catch { /* quota exceeded — silently ignore */ }
}

function addRecentFont(fontFamily: string) {
  const recent = loadRecentFonts().filter((f) => f !== fontFamily);
  recent.unshift(fontFamily);
  saveRecentFonts(recent);
}

const GOOGLE_FONTS_PRESETS: { name: string; family: string }[] = [
  { name: 'Inter', family: "'Inter', sans-serif" },
  { name: 'Noto Sans SC', family: "'Noto Sans SC', sans-serif" },
  { name: 'Source Han Serif SC', family: "'Source Han Serif SC', serif" },
  { name: 'Noto Serif SC', family: "'Noto Serif SC', serif" },
  { name: 'Playfair Display', family: "'Playfair Display', serif" },
  { name: 'Lora', family: "'Lora', serif" },
  { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
];

export function SettingsFontsPanel() {
  const displayFont = useAppStore((state) => state.displayFont);
  const bodyFont = useAppStore((state) => state.bodyFont);
  const fontSize = useAppStore((state) => state.fontSize);
  const customFonts = useAppStore((state) => state.customFonts || []);
  const addCustomFont = useAppStore((state) => state.addCustomFont);
  const removeCustomFont = useAppStore((state) => state.removeCustomFont);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const showToast = useToastStore((state) => state.showToast);
  const [previewFont, setPreviewFont] = useState(displayFont || bodyFont || 'var(--font-display)');
  const [uploading, setUploading] = useState(false);
  const [fontRoleMenuId, setFontRoleMenuId] = useState<string | null>(null);

  const installedFonts = customFonts.filter((font) => font.category === 'custom');
  const recentFonts = useMemo(() => loadRecentFonts(), [previewFont]);

  const applyFont = useCallback((fontFamily: string, role: 'display' | 'body' | 'all') => {
    if (role === 'display' || role === 'all') updateSettings({ displayFont: fontFamily });
    if (role === 'body' || role === 'all') updateSettings({ bodyFont: fontFamily });
    setPreviewFont(fontFamily);
    addRecentFont(fontFamily);
    setFontRoleMenuId(null);
    showToast('字體已套用');
  }, [showToast, updateSettings]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const font = await uploadCustomFont(file);
      addCustomFont(font);
      setPreviewFont(font.fontFamily);
      addRecentFont(font.fontFamily);
      showToast('字體已加入');
    } catch {
      showToast('字體上傳失敗');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemove = async (font: CustomFont) => {
    if (displayFont === font.fontFamily) updateSettings({ displayFont: '' });
    if (bodyFont === font.fontFamily) updateSettings({ bodyFont: '' });
    await deleteCustomFont(font);
    removeCustomFont(font.id);
    setPreviewFont('var(--font-display)');
    showToast('字體已移除');
  };

  const handleGoogleFont = async (name: string, family: string) => {
    try {
      await registerGoogleFont(name, family);
      setPreviewFont(family);
      addRecentFont(family);
      showToast(`已載入 ${name}`);
    } catch {
      showToast('Google Font 載入失敗');
    }
  };

  const resetFonts = () => {
    updateSettings({ displayFont: '', bodyFont: '' });
    setPreviewFont('var(--font-display)');
    showToast('已恢復預設字體');
  };

  return (
    <div className="settings-module-stack">
      {/* ── Current Font Info ── */}
      <div className="settings-font-current">
        <div className="settings-font-current-item">
          <span className="settings-font-current-label">Display</span>
          <span className="settings-font-current-value" style={{ fontFamily: displayFont || 'var(--f-d)' }}>
            {displayFont || 'System Default'}
          </span>
        </div>
        <div className="settings-font-current-item">
          <span className="settings-font-current-label">Body</span>
          <span className="settings-font-current-value" style={{ fontFamily: bodyFont || 'var(--f-ui)' }}>
            {bodyFont || 'System Default'}
          </span>
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="settings-preview-surface" style={{ fontFamily: previewFont }}>
        <span>LUNARTIDE TYPOGRAPHY</span>
        <strong style={{ fontSize: `${Math.min(fontSize + 6, 22)}px` }}>{FONT_PREVIEW_CJK}</strong>
        <small>{FONT_PREVIEW_DIGITS} · {FONT_PREVIEW_PUNCT}</small>
      </div>

      {/* ── Recent Fonts ── */}
      {recentFonts.length > 0 && (
        <div className="settings-font-section">
          <span className="settings-font-section-label">Recent</span>
          <div className="settings-font-pill-row">
            {recentFonts.map((family) => (
              <button
                key={family}
                type="button"
                className={`appearance-chip${previewFont === family ? ' is-active' : ''}`}
                style={{ fontFamily: family }}
                onClick={() => setPreviewFont(family)}
              >
                {family.replace(/['"]/g, '').split(',')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── System Fonts ── */}
      <div className="settings-font-section">
        <span className="settings-font-section-label">System Display Fonts</span>
        <div className="settings-font-pill-row">
          {SYSTEM_DISPLAY_FONTS.map((f) => (
            <button
              key={f.fontFamily}
              type="button"
              className={`appearance-chip${previewFont === f.fontFamily ? ' is-active' : ''}`}
              onClick={() => setPreviewFont(f.fontFamily)}
              onDoubleClick={() => applyFont(f.fontFamily, 'display')}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-font-section">
        <span className="settings-font-section-label">System Body Fonts</span>
        <div className="settings-font-pill-row">
          {SYSTEM_BODY_FONTS.map((f) => (
            <button
              key={f.fontFamily}
              type="button"
              className={`appearance-chip${previewFont === f.fontFamily ? ' is-active' : ''}`}
              onClick={() => setPreviewFont(f.fontFamily)}
              onDoubleClick={() => applyFont(f.fontFamily, 'body')}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-font-section">
        <span className="settings-font-section-label">System Monospace Fonts</span>
        <div className="settings-font-pill-row">
          {SYSTEM_MONO_FONTS.map((f) => (
            <button
              key={f.fontFamily}
              type="button"
              className={`appearance-chip${previewFont === f.fontFamily ? ' is-active' : ''}`}
              onClick={() => setPreviewFont(f.fontFamily)}
              onDoubleClick={() => applyFont(f.fontFamily, 'body')}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Google Fonts ── */}
      <div className="settings-font-section">
        <span className="settings-font-section-label">Google Fonts</span>
        <div className="settings-font-pill-row">
          {GOOGLE_FONTS_PRESETS.map((gf) => (
            <button
              key={gf.family}
              type="button"
              className={`appearance-chip${previewFont === gf.family ? ' is-active' : ''}`}
              onClick={() => handleGoogleFont(gf.name, gf.family)}
            >
              {gf.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Custom Fonts ── */}
      {installedFonts.length > 0 && (
        <div className="settings-font-section">
          <span className="settings-font-section-label">Custom Fonts</span>
          <div className="settings-module-list">
            {installedFonts.map((font) => (
              <div key={font.id} className="settings-module-row">
                <button type="button" className="settings-font-preview-button" onClick={() => setPreviewFont(font.fontFamily)}>
                  <span style={{ fontFamily: font.fontFamily }}>{font.name}</span>
                  <small>{font.format}</small>
                </button>
                <div className="settings-module-actions">
                  <button type="button" className="liquid-btn" onClick={() => setFontRoleMenuId(current => current === font.id ? null : font.id)}>
                    套用
                  </button>
                  <button type="button" className="liquid-btn liquid-btn--danger" onClick={() => handleRemove(font)}>移除</button>
                </div>
                {fontRoleMenuId === font.id && (
                  <div className="settings-inline-choice">
                    <button type="button" onClick={() => applyFont(font.fontFamily, 'display')}>標題</button>
                    <button type="button" onClick={() => applyFont(font.fontFamily, 'body')}>內文</button>
                    <button type="button" onClick={() => applyFont(font.fontFamily, 'all')}>全站</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upload ── */}
      <label className="settings-file-field">
        <span>上傳自訂字體</span>
        <small>支援 .ttf、.otf、.woff、.woff2，檔案只保存在本機。</small>
        <input
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>

      {installedFonts.length === 0 && (
        <div className="settings-panel-empty">尚未加入自訂字體</div>
      )}

      <div className="settings-panel-actions">
        <button type="button" className="liquid-btn" onClick={resetFonts}>重置字體</button>
      </div>
    </div>
  );
}

/* ── Colors Panel ── */

const CUSTOM_COLOR_PREFIX = 'lunartide_custom_';

const COLOR_STORAGE_KEYS = {
  text: `${CUSTOM_COLOR_PREFIX}--text`,
  text2: `${CUSTOM_COLOR_PREFIX}--text-2`,
  accent: `${CUSTOM_COLOR_PREFIX}--accent`,
} as const;

const DEFAULT_COLORS = {
  text: '#2c2825',
  text2: '#6b6560',
  accent: '#5db8a6',
};

function readColor(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function applyCssVar(name: string, value: string) {
  if (!value) {
    document.documentElement.style.removeProperty(name);
  } else {
    document.documentElement.style.setProperty(name, value);
  }
}

export function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const a = luminance(foreground); const b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

export function SettingsColorsPanel() {
  const showToast = useToastStore((state) => state.showToast);
  const [text, setText] = useState(() => readColor(COLOR_STORAGE_KEYS.text));
  const [text2, setText2] = useState(() => readColor(COLOR_STORAGE_KEYS.text2));
  const [accent, setAccent] = useState(() => readColor(COLOR_STORAGE_KEYS.accent));
  const [advanced, setAdvanced] = useState(false);
  const dark = document.documentElement.dataset.theme === 'dark';
  const background = dark ? '#181715' : '#faf9f5';
  const textSafe = contrastRatio(text || DEFAULT_COLORS.text, background) >= 4.5;
  const text2Safe = contrastRatio(text2 || DEFAULT_COLORS.text2, background) >= 3;
  const safe = !advanced || (textSafe && text2Safe);

  const save = () => {
    if (!safe) { showToast('文字對比不足，請調整後再儲存'); return; }
    try {
      [[COLOR_STORAGE_KEYS.accent, accent], [COLOR_STORAGE_KEYS.text, advanced ? text : ''], [COLOR_STORAGE_KEYS.text2, advanced ? text2 : '']].forEach(([key, value]) => value ? localStorage.setItem(key, value) : localStorage.removeItem(key));
    } catch { /* local-only preference */ }
    applyCssVar('--accent', accent); applyCssVar('--text', advanced ? text : ''); applyCssVar('--text-2', advanced ? text2 : '');
    showToast('配色已儲存');
  };

  const reset = () => {
    setText('');
    setText2('');
    setAccent('');
    try {
      Object.values(COLOR_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    } catch { /* local-only preference */ }
    applyCssVar('--text', ''); applyCssVar('--text-2', ''); applyCssVar('--accent', '');
    setAdvanced(false);
    showToast('已恢復預設配色');
  };

  return (
    <div className="settings-module-stack">
      <div className="settings-color-preview">
        <div style={{ color: advanced ? text || DEFAULT_COLORS.text : 'var(--text)' }}>Rune替你保留柔和的文字層級。</div>
        <span style={{ color: advanced ? text2 || DEFAULT_COLORS.text2 : 'var(--text-2)' }}>次文字預覽與可讀性檢查。</span>
        <button type="button" style={{ background: accent || DEFAULT_COLORS.accent }}>Rune按鈕</button>
        <a href="#settings-color-preview" style={{ color: accent || DEFAULT_COLORS.accent }}>連結預覽</a>
        <span className="settings-color-focus-preview" tabIndex={0}>選中項目與 Focus ring</span>
      </div>

      <div className="settings-module-list">
        <label className="settings-color-control"><span>全局強調色<small>--accent</small></span><input type="color" value={accent || DEFAULT_COLORS.accent} onChange={(event) => setAccent(event.target.value)} /></label>
        <label className="settings-advanced-toggle"><input type="checkbox" checked={advanced} onChange={(event) => setAdvanced(event.target.checked)} />進階文字色</label>
        {advanced && <>
          <label className="settings-color-control"><span>主文字色<small>對比 {contrastRatio(text || DEFAULT_COLORS.text, background).toFixed(1)}:1</small></span><input type="color" value={text || DEFAULT_COLORS.text} onChange={(event) => setText(event.target.value)} /></label>
          <label className="settings-color-control"><span>次文字色<small>對比 {contrastRatio(text2 || DEFAULT_COLORS.text2, background).toFixed(1)}:1</small></span><input type="color" value={text2 || DEFAULT_COLORS.text2} onChange={(event) => setText2(event.target.value)} /></label>
          {!safe && <p className="settings-color-warning" role="alert">文字與背景對比不足，無法儲存。</p>}
        </>}
      </div>

      <div className="settings-panel-actions">
        <button type="button" className="liquid-btn" onClick={reset}>恢復預設</button>
        <button type="button" className="liquid-btn liquid-btn--accent" onClick={save} disabled={!safe}>儲存</button>
      </div>
    </div>
  );
}
