/**
 * SettingsAppearanceFontsPage.tsx — 字體與配色
 *
 * Standalone page under /settings/appearance/fonts.
 * Three liquid-card sections: Preview / Custom Fonts / Font Colors.
 * No accordion toggles — all sections visible.
 */

import { useState, useRef, useCallback, useEffect, type ChangeEvent } from 'react';
import { Header } from '@/components/layout/Header';
import { BackButton } from '@/components/layout/BackButton';
import { useAppStore } from '@/store/useAppStore';
import {
  uploadCustomFont,
  deleteCustomFont,
  FONT_PREVIEW_TEXT,
  FONT_PREVIEW_CJK,
  FONT_PREVIEW_DIGITS,
  FONT_PREVIEW_PUNCT,
  type CustomFont,
} from '@/utils/fontLibrary';

/* ── Color storage keys (localStorage) ── */
const COLOR_KEY_TEXT = 'lunartide_custom_text';
const COLOR_KEY_TEXT2 = 'lunartide_custom_text2';
const COLOR_KEY_ACCENT = 'lunartide_custom_accent';

const DEFAULT_COLORS = {
  text: '#2a1f14',
  text2: '#6b5a48',
  accent: '#e8735a',
} as const;

function loadColor(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function saveColor(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}
function applyColorVar(name: string, value: string | null) {
  const root = document.documentElement;
  if (value) root.style.setProperty(name, value);
  else root.style.removeProperty(name);
}

/* ── Section title (standalone, not a toggle) ── */
function SectionTitle({ label }: { label: string }) {
  return <div className="font-page-section-title">{label}</div>;
}

/* ═══════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════ */
export function SettingsAppearanceFontsPage() {
  const displayFont = useAppStore((s) => s.displayFont);
  const bodyFont = useAppStore((s) => s.bodyFont);
  const fontSize = useAppStore((s) => s.fontSize);
  const customFonts = useAppStore((s) => s.customFonts || []);
  const addCustomFont = useAppStore((s) => s.addCustomFont);
  const removeCustomFont = useAppStore((s) => s.removeCustomFont);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [previewFont, setPreviewFont] = useState<string>('var(--font-display)');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Color state ── */
  const [colorText, setColorText] = useState(() => loadColor(COLOR_KEY_TEXT) || '');
  const [colorText2, setColorText2] = useState(() => loadColor(COLOR_KEY_TEXT2) || '');
  const [colorAccent, setColorAccent] = useState(() => loadColor(COLOR_KEY_ACCENT) || '');

  // Apply colors live as user picks them
  useEffect(() => {
    applyColorVar('--text', colorText || null);
  }, [colorText]);
  useEffect(() => {
    applyColorVar('--text-2', colorText2 || null);
  }, [colorText2]);
  useEffect(() => {
    applyColorVar('--accent', colorAccent || null);
  }, [colorAccent]);

  // Re-apply on mount (piggyback on AppShell restore)
  useEffect(() => {
    applyColorVar('--text', loadColor(COLOR_KEY_TEXT));
    applyColorVar('--text-2', loadColor(COLOR_KEY_TEXT2));
    applyColorVar('--accent', loadColor(COLOR_KEY_ACCENT));
  }, []);

  /* ── Font role selection ── */
  const [fontRoleMenuId, setFontRoleMenuId] = useState<string | null>(null);

  const handleApplyCustomFont = useCallback((fontFamily: string, role: 'display' | 'body' | 'all') => {
    if (role === 'display' || role === 'all') {
      updateSettings({ displayFont: fontFamily });
    }
    if (role === 'body' || role === 'all') {
      updateSettings({ bodyFont: fontFamily });
    }
    setFontRoleMenuId(null);
  }, [updateSettings]);

  /* ── Upload ── */
  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const font = await uploadCustomFont(file);
      addCustomFont(font);
      setPreviewFont(font.fontFamily);
    } catch (err) {
      console.warn('[FontLibrary] Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveCustom = async (font: CustomFont) => {
    if (displayFont === font.fontFamily) updateSettings({ displayFont: '' });
    if (bodyFont === font.fontFamily) updateSettings({ bodyFont: '' });
    await deleteCustomFont(font);
    removeCustomFont(font.id);
  };

  /* ── Colors ── */
  const handleColorChange = (key: string, setter: (v: string) => void, value: string) => {
    setter(value);
    saveColor(key, value);
  };

  const handleResetColors = () => {
    setColorText('');
    setColorText2('');
    setColorAccent('');
    try {
      localStorage.removeItem(COLOR_KEY_TEXT);
      localStorage.removeItem(COLOR_KEY_TEXT2);
      localStorage.removeItem(COLOR_KEY_ACCENT);
    } catch { /* noop */ }
    applyColorVar('--text', null);
    applyColorVar('--text-2', null);
    applyColorVar('--accent', null);
  };

  const installedCustomFonts = customFonts.filter((f) => f.category === 'custom');

  return (
    <section id="settings-fonts-view" className="view">
      <BackButton to="/settings" />
      <Header eyebrow="" title="字體與配色" />

      {/* ═══ 1. Preview ═══ */}
      <div className="liquid-card fonts-page-card">
        <div className="liquid-section">
          <SectionTitle label="預覽" />
          <div className="font-preview-card">
            <div className="font-preview-label">{FONT_PREVIEW_TEXT}</div>
            <div className="font-preview-cjk" style={{ fontFamily: previewFont, fontSize: `${Math.min(fontSize + 4, 20)}px` }}>
              {FONT_PREVIEW_CJK}
            </div>
            <div className="font-preview-aux" style={{ fontFamily: previewFont }}>
              <span>{FONT_PREVIEW_DIGITS}</span>
              <span>{FONT_PREVIEW_PUNCT}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 2. Custom Fonts ═══ */}
      <div className="liquid-card fonts-page-card">
        <div className="liquid-section">
          <SectionTitle label="自定義字體" />

          {/* Usage guide */}
          <div className="font-usage-guide">
            <p className="font-usage-title">使用方式</p>
            <ul className="font-usage-list">
              <li>支援格式：<code>.ttf</code> <code>.otf</code> <code>.woff</code> <code>.woff2</code></li>
              <li>點擊下方按鈕上傳字體檔案</li>
              <li>上傳後可選擇套用到標題、內文或全站</li>
              <li>字體資料保存在本機，不會自動上傳雲端</li>
              <li>若字體沒有生效，請刷新頁面或重新套用</li>
            </ul>
          </div>

          {/* Upload */}
          <input ref={fileInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }} onChange={handleUpload} />
          <button type="button" className="font-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? '上傳中…' : '+ 上傳字體 (.ttf .otf .woff .woff2)'}
          </button>

          {/* Installed fonts */}
          {installedCustomFonts.length === 0 && (
            <div className="font-library-empty">尚未上傳自定義字體</div>
          )}
          {installedCustomFonts.map((font) => (
            <div key={font.id} className="font-library-row installed">
              <div className="font-library-row-info">
                <span className="font-library-row-name">{font.name}</span>
                <span className="font-library-row-meta">{font.format}</span>
              </div>
              <div className="font-library-row-actions" style={{ position: 'relative' }}>
                <button
                  className="font-library-btn"
                  onClick={() => setFontRoleMenuId(fontRoleMenuId === font.id ? null : font.id)}
                >
                  套用
                </button>
                {fontRoleMenuId === font.id && (
                  <div className="font-role-menu">
                    <button type="button" className="font-role-opt" onClick={() => handleApplyCustomFont(font.fontFamily, 'display')}>
                      套用到標題
                    </button>
                    <button type="button" className="font-role-opt" onClick={() => handleApplyCustomFont(font.fontFamily, 'body')}>
                      套用到內文
                    </button>
                    <button type="button" className="font-role-opt" onClick={() => handleApplyCustomFont(font.fontFamily, 'all')}>
                      套用到全站
                    </button>
                  </div>
                )}
                <button className="font-library-btn font-library-btn-danger" onClick={() => handleRemoveCustom(font)}>移除</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 3. Font Colors ═══ */}
      <div className="liquid-card fonts-page-card">
        <div className="liquid-section">
          <SectionTitle label="字體顏色" />

          <div className="font-color-list">
            {/* Primary text */}
            <div className="font-color-row">
              <div className="font-color-info">
                <span className="font-color-label">主文字色</span>
                <span className="font-color-token">--text</span>
                <span className="font-color-preview" style={{
                  background: colorText || DEFAULT_COLORS.text,
                  width: 24, height: 24, borderRadius: 6,
                  border: '1px solid var(--border)',
                  flexShrink: 0,
                }} />
              </div>
              <input
                type="color"
                value={colorText || DEFAULT_COLORS.text}
                onChange={e => handleColorChange(COLOR_KEY_TEXT, setColorText, e.target.value)}
                className="font-color-input"
                aria-label="主文字色"
              />
            </div>

            {/* Secondary text */}
            <div className="font-color-row">
              <div className="font-color-info">
                <span className="font-color-label">次文字色</span>
                <span className="font-color-token">--text-2</span>
                <span className="font-color-preview" style={{
                  background: colorText2 || DEFAULT_COLORS.text2,
                  width: 24, height: 24, borderRadius: 6,
                  border: '1px solid var(--border)',
                  flexShrink: 0,
                }} />
              </div>
              <input
                type="color"
                value={colorText2 || DEFAULT_COLORS.text2}
                onChange={e => handleColorChange(COLOR_KEY_TEXT2, setColorText2, e.target.value)}
                className="font-color-input"
                aria-label="次文字色"
              />
            </div>

            {/* Accent */}
            <div className="font-color-row">
              <div className="font-color-info">
                <span className="font-color-label">強調色</span>
                <span className="font-color-token">--accent</span>
                <span className="font-color-preview" style={{
                  background: colorAccent || DEFAULT_COLORS.accent,
                  width: 24, height: 24, borderRadius: 6,
                  border: '1px solid var(--border)',
                  flexShrink: 0,
                }} />
              </div>
              <input
                type="color"
                value={colorAccent || DEFAULT_COLORS.accent}
                onChange={e => handleColorChange(COLOR_KEY_ACCENT, setColorAccent, e.target.value)}
                className="font-color-input"
                aria-label="強調色"
              />
            </div>
          </div>

          <button type="button" className="font-reset-colors-btn" onClick={handleResetColors}>
            恢復預設顏色
          </button>
        </div>
      </div>
    </section>
  );
}
