import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CSS_ZONES, type CssZone, loadZoneCss, saveZoneCss, clearZoneCss, checkCssSafety } from '@/utils/customCssStorage';
import { PRESETS, getPreset, type ThemePreset } from './presets';
import './ThemeBuilder.css';

/* ── Preview bubble scoping ── */
function buildPreviewCss(zoneId: string, css: string): string {
  if (!css.trim()) return '';
  const zone = CSS_ZONES.find(z => z.id === zoneId)!;
  const scope = zone.scope;
  const scopeParts = scope.split(/\s+/);
  const lastScopePart = scopeParts[scopeParts.length - 1];

  return css.replace(/([^{}]*)\{/g, (match, rawSelectors) => {
    const trimmed = rawSelectors.trim();
    if (!trimmed || trimmed.startsWith('@')) return match;
    const selectors = trimmed.split(',').map((s: string) => {
      s = s.trim();
      if (s === lastScopePart) return `.preview-scope ${scope}`;
      return `.preview-scope ${scope} ${s}`;
    }).join(',\n');
    return `${selectors} {`;
  });
}

/* ── Zone tab button ── */
function ZoneTab({ zone, active, onClick }: { zone: CssZone; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`tb-zone-tab${active ? ' active' : ''}`}
      onClick={onClick}
    >
      {zone.label}
    </button>
  );
}

/* ── Preset card ── */
function PresetCard({ preset, onApply }: { preset: ThemePreset; onApply: (p: ThemePreset) => void }) {
  return (
    <button type="button" className="tb-preset-card" onClick={() => onApply(preset)} title={`套用 ${preset.label}`}>
      <span className="tb-preset-label">{preset.label}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════
   ThemeBuilder
   ═══════════════════════════════════════════ */
export function ThemeBuilder() {
  const [activeZoneId, setActiveZoneId] = useState(CSS_ZONES[0].id);
  // Per-zone CSS buffers
  const [buffers, setBuffers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const zone of CSS_ZONES) {
      initial[zone.id] = loadZoneCss(zone.id);
    }
    return initial;
  });
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeZone = CSS_ZONES.find(z => z.id === activeZoneId)!;
  const activeCss = buffers[activeZoneId] || '';

  const setActiveCss = (css: string) => {
    setBuffers(prev => ({ ...prev, [activeZoneId]: css }));
    setError('');
  };

  /* ── Live preview CSS ── */
  const previewStyleContent = useMemo(() => {
    const parts: string[] = [];
    for (const zone of CSS_ZONES) {
      const raw = buffers[zone.id] || '';
      const scoped = buildPreviewCss(zone.id, raw);
      if (scoped) parts.push(`/* ${zone.label} */\n${scoped}`);
    }
    return parts.join('\n\n');
  }, [buffers]);

  useEffect(() => {
    const styleId = 'tb-live-preview-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = previewStyleContent;
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.textContent = '';
    };
  }, [previewStyleContent]);

  /* ── Apply (save + inject) ── */
  const handleApply = useCallback(() => {
    const trimmed = activeCss.trim();
    if (!trimmed) {
      clearZoneCss(activeZoneId);
      setBuffers(prev => ({ ...prev, [activeZoneId]: '' }));
      setError('');
    } else {
      const result = checkCssSafety(trimmed);
      if (!result.valid) { setError(result.error); return; }
      saveZoneCss(activeZoneId, trimmed);
    }
    window.dispatchEvent(new CustomEvent('lunartide-css-updated'));
    setToastMsg(`已套用 ${activeZone.label}`);
    setTimeout(() => setToastMsg(''), 1800);
  }, [activeCss, activeZoneId, activeZone.label]);

  /* ── Reset zone ── */
  const handleReset = useCallback(() => {
    clearZoneCss(activeZoneId);
    setBuffers(prev => ({ ...prev, [activeZoneId]: '' }));
    setError('');
    window.dispatchEvent(new CustomEvent('lunartide-css-updated'));
    setToastMsg(`已重置 ${activeZone.label}`);
    setTimeout(() => setToastMsg(''), 1800);
  }, [activeZoneId, activeZone.label]);

  /* ── Apply preset ── */
  const handlePreset = useCallback((preset: ThemePreset) => {
    const next = { ...buffers };
    if (preset.global !== undefined) next.global = preset.global;
    if (preset.chat !== undefined) next.chat = preset.chat;
    if (preset.luna !== undefined) next.luna = preset.luna;
    if (preset.user !== undefined) next.user = preset.user;
    setBuffers(next);
    setError('');

    for (const zone of CSS_ZONES) {
      const css = (next as any)[zone.id];
      if (css !== undefined) {
        saveZoneCss(zone.id, css);
      }
    }
    window.dispatchEvent(new CustomEvent('lunartide-css-updated'));
    setToastMsg(`已套用 ${preset.label} 主題`);
    setTimeout(() => setToastMsg(''), 1800);
  }, [buffers]);

  /* ── Export ── */
  const handleExport = useCallback(() => {
    const full: Record<string, string> = {};
    for (const zone of CSS_ZONES) {
      const css = buffers[zone.id] || '';
      if (css.trim()) full[zone.id] = css;
    }
    const json = JSON.stringify(full, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lunartide-theme-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToastMsg('已匯出主題');
    setTimeout(() => setToastMsg(''), 1800);
  }, [buffers]);

  /* ── Import ── */
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (typeof data !== 'object') throw new Error('Invalid');
        const next = { ...buffers };
        let loaded = 0;
        for (const zone of CSS_ZONES) {
          if (typeof data[zone.id] === 'string') {
            next[zone.id] = data[zone.id];
            saveZoneCss(zone.id, data[zone.id]);
            loaded++;
          }
        }
        if (loaded === 0) {
          setToastMsg('無效的主題檔案');
          setTimeout(() => setToastMsg(''), 1800);
          return;
        }
        setBuffers(next);
        window.dispatchEvent(new CustomEvent('lunartide-css-updated'));
        setToastMsg(`已匯入主題（${loaded} 個區域）`);
        setTimeout(() => setToastMsg(''), 1800);
      } catch {
        setToastMsg('無法解析主題檔案');
        setTimeout(() => setToastMsg(''), 1800);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [buffers]);

  return (
    <div className="theme-builder">
      {/* Toast */}
      {toastMsg && <div className="tb-toast">{toastMsg}</div>}

      {/* ════ Presets ════ */}
      <div className="tb-section">
        <div className="tb-section-label">預設主題</div>
        <div className="tb-preset-row">
          {PRESETS.map(p => (
            <PresetCard key={p.id} preset={p} onApply={handlePreset} />
          ))}
        </div>
      </div>

      {/* ════ Zones tabs ════ */}
      <div className="tb-section">
        <div className="tb-section-label">CSS 編輯區域</div>
        <div className="tb-zone-tabs">
          {CSS_ZONES.map(zone => (
            <ZoneTab
              key={zone.id}
              zone={zone}
              active={activeZoneId === zone.id}
              onClick={() => { setActiveZoneId(zone.id); setError(''); }}
            />
          ))}
        </div>

        {/* Zone editor */}
        <textarea
          className="tb-css-input"
          value={activeCss}
          onChange={e => setActiveCss(e.target.value)}
          placeholder={activeZone.placeholder}
          spellCheck={false}
          rows={8}
        />

        {/* Scope hint */}
        <p className="tb-scope-hint">
          作用範圍：<code>{activeZone.scope}</code>
        </p>

        {error && <p className="tb-error">{error}</p>}

        <div className="tb-actions">
          <button type="button" className="liquid-btn" onClick={handleReset}>重置</button>
          <button type="button" className="liquid-btn" onClick={handleImport}>匯入</button>
          <button type="button" className="liquid-btn" onClick={handleExport}>匯出</button>
          <button type="button" className="liquid-btn liquid-btn--accent" onClick={handleApply}>套用</button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} hidden />

      {/* ════ Live Preview ════ */}
      <div className="tb-section">
        <div className="tb-section-label">即時預覽</div>
        <div className="tb-preview-wrap preview-scope">
          {/* Luna bubble */}
          <div className="tb-preview-column">
            <div className="tb-preview-avatar tb-preview-avatar--luna">L</div>
            <div className="lunartide-app">
              <div className="message-row friend">
                <div className="message-bubble">
                  <div className="message-content">
                    你好！這是一個 Luna AI 氣泡的預覽效果。<br />
                    修改 CSS 後這裡會即時更新。
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* User bubble */}
          <div className="tb-preview-column">
            <div className="tb-preview-avatar tb-preview-avatar--user">U</div>
            <div className="lunartide-app">
              <div className="message-row me">
                <div className="message-bubble">
                  <div className="message-content">
                    這是我的氣泡預覽。<br />
                    可以在上方編輯器中調整樣式。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { getPreset };
