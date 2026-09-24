/* ═══════════════════════════════════════════════
   Custom CSS Storage — multi-zone support
   ═══════════════════════════════════════════════ */

/* ── Zone definitions ── */
export interface CssZone {
  id: string;
  label: string;
  labelEn: string;
  storageKey: string;
  styleId: string;
  /** CSS scope selector prepended to all user rules */
  scope: string;
  /** Default placeholder */
  placeholder: string;
}

export const CSS_ZONES: CssZone[] = [
  {
    id: 'global',
    label: '全域主題',
    labelEn: 'Global Theme',
    storageKey: 'lunartide_css_global_v1',
    styleId: 'lunartide-css-global',
    scope: '.lunartide-app',
    placeholder: '/* 全域樣式 — 作用於 .lunartide-app */\nbody { background: #f8f6f3; }',
  },
  {
    id: 'chat',
    label: '聊天介面',
    labelEn: 'Chat UI',
    storageKey: 'lunartide_css_chat_v1',
    styleId: 'lunartide-css-chat',
    scope: '.lunartide-app #chat-view',
    placeholder: '/* 聊天介面 */\n.chat-view { padding: 16px; }',
  },
  {
    id: 'luna',
    label: 'Luna 氣泡',
    labelEn: 'Luna Bubble',
    storageKey: 'lunartide_css_luna_v1',
    styleId: 'lunartide-css-luna',
    scope: '.lunartide-app .message-row.friend .message-bubble',
    placeholder: '/* Luna AI 氣泡 */\n.message-bubble {\n  background: rgba(255,255,255,0.8);\n  border-radius: 16px;\n}',
  },
  {
    id: 'user',
    label: '我的氣泡',
    labelEn: 'My Bubble',
    storageKey: 'lunartide_css_user_v1',
    styleId: 'lunartide-css-user',
    scope: '.lunartide-app .message-row.me .message-bubble',
    placeholder: '/* 我的氣泡 */\n.message-bubble {\n  background: var(--accent);\n  color: #fff;\n  border-radius: 16px;\n}',
  },
];

/* ── Legacy compat ── */
const LEGACY_KEY = 'lunartide_custom_css_v1';
const LEGACY_STYLE_ID = 'lunartide-custom-css';

let legacyMigrated = false;

function migrateLegacy() {
  if (legacyMigrated) return;
  legacyMigrated = true;
  try {
    const legacyCss = localStorage.getItem(LEGACY_KEY);
    if (legacyCss && legacyCss.trim()) {
      // Migrate legacy CSS to global zone
      localStorage.setItem(CSS_ZONES[0].storageKey, legacyCss);
      localStorage.removeItem(LEGACY_KEY);
    }
    // Clean legacy style element
    const el = document.getElementById(LEGACY_STYLE_ID);
    if (el) el.remove();
  } catch { /* noop */ }
}

/* ── Load / Save / Clear per zone ── */
export function loadZoneCss(zoneId: string): string {
  migrateLegacy();
  const zone = CSS_ZONES.find(z => z.id === zoneId);
  if (!zone) return '';
  try {
    return localStorage.getItem(zone.storageKey) || '';
  } catch {
    return '';
  }
}

export function saveZoneCss(zoneId: string, css: string): void {
  const zone = CSS_ZONES.find(z => z.id === zoneId);
  if (!zone) return;
  try {
    if (css.trim()) {
      localStorage.setItem(zone.storageKey, css);
    } else {
      localStorage.removeItem(zone.storageKey);
    }
  } catch { /* noop */ }
}

export function clearZoneCss(zoneId: string): void {
  const zone = CSS_ZONES.find(z => z.id === zoneId);
  if (!zone) return;
  try {
    localStorage.removeItem(zone.storageKey);
  } catch { /* noop */ }
}

/* ── Safety checks ── */
const BLOCKED_SELECTORS = [
  'body', 'html', ':root', '*',
  '.modal-backdrop', '[class*="modal"]', '.toast', '[class*="toast"]',
  '.sheet-overlay', '.sheet-backdrop', '[class*="overlay-backdrop"]',
  '.bottom-nav', '#bottom-nav',
  '.mini-player-soft', // protect minimised player from accidental hiding
];

const BLOCKED_PROPERTIES: RegExp[] = [
  /@import/i,
  /url\s*\(/i,
  /expression\s*\(/i,
  /javascript:/i,
  /<script[\s>]/i,
];

export interface CssCheckResult {
  valid: boolean;
  error: string;
}

export function checkCssSafety(css: string): CssCheckResult {
  // Block dangerous constructs
  for (const re of BLOCKED_PROPERTIES) {
    if (re.test(css)) {
      return { valid: false, error: '包含不安全的語法（@import / url() / expression / javascript / <script>）' };
    }
  }
  // Block position:fixed with high z-index
  if (/position\s*:\s*fixed/i.test(css) && /z-index\s*:\s*\d{4,}/i.test(css)) {
    return { valid: false, error: '不允許 position: fixed 搭配高 z-index（可能遮擋畫面）' };
  }
  // Block forbidden selectors at root level
  for (const sel of BLOCKED_SELECTORS) {
    const re = new RegExp(`(^|,\\s*|\\{\\s*)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'im');
    if (re.test(css)) {
      return { valid: false, error: `不允許直接修改系統選擇器「${sel}」，請使用提供的作用區 CSS 編輯` };
    }
  }
  return { valid: true, error: '' };
}

/* ── CSS scoping — prefix every selector with zone scope ── */

function scopeCss(css: string, zone: CssZone): string {
  if (!css.trim()) return '';
  const scope = zone.scope;
  // Extract the last simple selector from the scope for bubble-identity replacement
  const scopeParts = scope.split(/\s+/);
  const lastScopePart = scopeParts[scopeParts.length - 1];

  const scoped = css.replace(/([^{}]*)\{/g, (match, rawSelectors) => {
    const trimmed = rawSelectors.trim();
    if (!trimmed) return match;
    // Skip at-rules
    if (trimmed.startsWith('@')) return match;

    const selectors = trimmed.split(',').map((s: string) => {
      s = s.trim();
      if (!s) return s;
      // If selector equals the scope's last segment (e.g. `.message-bubble`),
      // replace it with the full scope to avoid double-nesting
      if (s === lastScopePart) return scope;
      // Otherwise prefix with scope
      return `${scope} ${s}`;
    }).join(',\n');

    return `${selectors} {`;
  });

  return scoped;
}

/* ── Injection ── */
export function injectAllZones(): void {
  const parts: string[] = [];
  for (const zone of CSS_ZONES) {
    const raw = loadZoneCss(zone.id);
    if (!raw.trim()) continue;
    const scoped = scopeCss(raw, zone);
    if (scoped) parts.push(`/* ${zone.label} */\n${scoped}`);
  }
  const combined = parts.join('\n\n');

  // Use the legacy style ID for backwards compat with removeCustomCss
  let style = document.getElementById(LEGACY_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = LEGACY_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = combined;
}

export function removeAllCustomCss(): void {
  const style = document.getElementById(LEGACY_STYLE_ID) as HTMLStyleElement | null;
  if (style) {
    style.textContent = '';
    style.remove();
  }
  // Also clean individual zone style elements
  for (const zone of CSS_ZONES) {
    const el = document.getElementById(zone.styleId);
    if (el) el.remove();
  }
}

/* ── Legacy API (kept for SettingsPage backwards compat) ── */
export function loadCustomCss(): string {
  return loadZoneCss('global');
}

export function saveCustomCss(css: string): void {
  saveZoneCss('global', css);
}

export function clearCustomCss(): void {
  for (const zone of CSS_ZONES) {
    clearZoneCss(zone.id);
  }
  removeAllCustomCss();
}

export function injectCustomCss(_css: string): void {
  injectAllZones();
}

export function removeCustomCss(): void {
  removeAllCustomCss();
}

// Initialise on import
try { migrateLegacy(); } catch { /* noop */ }
