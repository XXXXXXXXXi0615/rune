import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n';

/* ═══════════════════════════════════════
   Character Settings — 角色設定頁
   Personality mode · Reply length · Thinking depth · Live preview
   ═══════════════════════════════════════ */

interface Props { isOpen: boolean; onClose: () => void; }

// ── Types ──

type PersonalityMode = 'cold' | 'tsundere' | 'rational' | 'sarcastic' | 'gentle';
type ReplyLength = 'short' | 'medium' | 'long';
type ThinkingDepth = 'quick' | 'balanced' | 'deep';

interface CharacterSettings {
  personality: PersonalityMode;
  replyLength: ReplyLength;
  thinkingDepth: ThinkingDepth;
}

const LS_KEY = 'lunartide_character_settings_v1';

// ── Defaults ──

const DEFAULTS: CharacterSettings = {
  personality: 'tsundere',
  replyLength: 'medium',
  thinkingDepth: 'balanced',
};

function loadSettings(): CharacterSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        personality: ['cold', 'tsundere', 'rational', 'sarcastic', 'gentle'].includes(parsed.personality)
          ? parsed.personality : DEFAULTS.personality,
        replyLength: ['short', 'medium', 'long'].includes(parsed.replyLength)
          ? parsed.replyLength : DEFAULTS.replyLength,
        thinkingDepth: ['quick', 'balanced', 'deep'].includes(parsed.thinkingDepth)
          ? parsed.thinkingDepth : DEFAULTS.thinkingDepth,
      };
    }
  } catch { /* corrupt */ }
  return { ...DEFAULTS };
}

function saveSettings(s: CharacterSettings): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

// ── Preview text map ──

const PREVIEW_TEXTS: Record<PersonalityMode, Record<ReplyLength, string>> = {
  cold: {
    short: '嗯。',
    medium: '知道了。沒別的事的話我先忙了。',
    long: '……你說的事我已經記下來了。雖然我覺得這種事情不需要特地跟我報告，不過既然你都開口了，我就聽一下。還有其他事嗎？',
  },
  tsundere: {
    short: '才、才不是為了你呢！',
    medium: '哼，又不是我想幫你的！只是剛好順手而已啦！',
    long: '喂、喂！別誤會了啊！我才不是因為擔心你才說這些話的！只是……好吧，如果你真的那麼需要我的意見的話，聽著——我覺得你應該先冷靜下來想想。不是關心你喔！絕對不是！',
  },
  rational: {
    short: '根據分析，建議如下。',
    medium: '從目前的信息來看，有三個可能的解決方向。第一……',
    long: '讓我系統性地分析一下這個情況。首先，我們需要釐清問題的本質——這涉及到時間成本與收益之間的權衡。根據過往數據，採取方案 A 的成功率約為 67%，但代價是……綜合以上因素，我的建議是：分階段執行，每個階段設置明確的檢查點。這樣可以最大化效率並降低風險。',
  },
  sarcastic: {
    short: '哦？真是有創意的想法呢～',
    medium: '哇，你這個想法太「獨特」了，我差點不知道該怎麼吐槽。要不我們換個正常的思路？',
    long: '哦～讓我猜猜，你花了很多時間想出這個點子對吧？真是令人感動的努力啊（感動到想哭的那種）。說真的，如果「把事情搞複雜」是一項奧運項目的話，你大概已經能拿金牌了。不過嘛……既然你都問我了，我就勉強給你一個「稍微靠譜一點點」的建議好了。',
  },
  gentle: {
    short: '沒關係的，我在這裡。',
    medium: '我明白你的感受了。慢慢來，不用急，我陪著你。',
    long: '嘿，聽我說——你現在的感受是完全正常的。每個人都會有這樣的時候，不需要勉強自己裝作沒事。如果覺得累了就休息一下，如果想聊聊隨時都可以找我。我會在這裡等你的。你不是一個人面對這些事。記住了嗎？',
  },
};

// ── SVG Icon ──

const svgAttrs = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function CharSvg({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} {...svgAttrs}>
      {name === 'cold' && (
        <><path d="M12 2v4m0 12v4M4 12H2m6.34-4.34l-2.83-2.83m11.32 0l-2.83 2.83M4 12h-2m16.34-1.34l2.83-2.83M6 12h12" /><circle cx="12" cy="12" r="3" /></>
      )}
      {name === 'tsundere' && (
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      )}
      {name === 'rational' && (
        <polygon points="12,2 22,12 12,22 2,12" />
      )}
      {name === 'sarcastic' && (
        <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" /></>
      )}
      {name === 'gentle' && (
        <path d="M12 22c-2 0-8-4-8-10C4 6.5 7 4 12 4s8 2.5 8 8c0 6-6 10-8 10z" />
      )}
      {name === 'short' && (
        <line x1="6" y1="12" x2="18" y2="12" />
      )}
      {name === 'medium' && (
        <><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /></>
      )}
      {name === 'long' && (
        <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>
      )}
      {name === 'quick' && (
        <polygon points="6,3 20,12 6,21" />
      )}
      {name === 'balanced' && (
        <><line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" /></>
      )}
      {name === 'deep' && (
        <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="20" y2="14" /><line x1="4" y1="18" x2="20" y2="18" /></>
      )}
      {name === 'preview' && (
        <><circle cx="12" cy="9" r="3" /><path d="M12 21v-4m0 0c-3 0-6-1.5-6-5s3-5 6-5 6 1.5 6 5-3 5-6 5z" /></>
      )}
      {name === 'check' && (
        <polyline points="4,12 10,18 20,6" />
      )}
    </svg>
  );
}

// ── Mode config ──

interface ModeConfig {
  id: PersonalityMode;
  icon: string;
  labelKey: string;
  descKey: string;
  color: string;
  bg: string;
}

const PERSONALITY_MODES: ModeConfig[] = [
  { id: 'cold',       icon: 'cold',       labelKey: 'char.modeCold',       descKey: 'char.modeColdDesc',       color: '#7AB8FF', bg: 'rgba(122,184,255,0.12)' },
  { id: 'tsundere',   icon: 'tsundere',   labelKey: 'char.modeTsundere',   descKey: 'char.modeTsundereDesc',   color: '#F5C96A', bg: 'rgba(245,201,106,0.12)' },
  { id: 'rational',   icon: 'rational',   labelKey: 'char.modeRational',   descKey: 'char.modeRationalDesc',   color: '#8EA0B8', bg: 'rgba(142,160,184,0.12)' },
  { id: 'sarcastic',  icon: 'sarcastic',  labelKey: 'char.modeSarcastic',  descKey: 'char.modeSarcasticDesc',  color: '#FF8A3D', bg: 'rgba(255,138,61,0.12)' },
  { id: 'gentle',     icon: 'gentle',     labelKey: 'char.modeGentle',     descKey: 'char.modeGentleDesc',     color: '#B18DFF', bg: 'rgba(177,141,255,0.12)' },
];

const REPLY_LENGTHS: { id: ReplyLength; icon: string; labelKey: string; descKey: string }[] = [
  { id: 'short',  icon: 'short',  labelKey: 'char.lenShort',  descKey: 'char.lenShortDesc'  },
  { id: 'medium', icon: 'medium', labelKey: 'char.lenMedium', descKey: 'char.lenMediumDesc' },
  { id: 'long',   icon: 'long',   labelKey: 'char.lenLong',   descKey: 'char.lenLongDesc'   },
];

const THINKING_DEPTHS: { id: ThinkingDepth; icon: string; labelKey: string; descKey: string }[] = [
  { id: 'quick',   icon: 'quick',    labelKey: 'char.depthQuick',    descKey: 'char.depthQuickDesc'    },
  { id: 'balanced',icon: 'balanced', labelKey: 'char.depthBalanced', descKey: 'char.depthBalancedDesc' },
  { id: 'deep',    icon: 'deep',     labelKey: 'char.depthDeep',     descKey: 'char.depthDeepDesc'     },
];

/* ═══ Component ═══ */

export function CharacterSettingsPage({ isOpen, onClose }: Props) {
  const [settings, setSettings] = useState<CharacterSettings>(loadSettings);
  const [saved, setSaved] = useState(false);

  // Reload when opened
  useEffect(() => {
    if (isOpen) { setSettings(loadSettings()); setSaved(false); }
  }, [isOpen]);

  const update = useCallback(<K extends keyof CharacterSettings>(key: K, value: CharacterSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
      return next;
    });
  }, []);

  const previewText = useMemo(
    () => PREVIEW_TEXTS[settings.personality][settings.replyLength],
    [settings.personality, settings.replyLength]
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="csp-overlay" onClick={onClose}>
      <div className="csp" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('char.title')}>
        {/* ── Header ── */}
        <div className="csp-head">
          <button className="csp-back" onClick={onClose} aria-label={t('skillDetail.back')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h2 className="csp-title">{t('char.title')}</h2>
            <p className="csp-subtitle">{t('char.subtitle')}</p>
          </div>
          {saved && <span className="csp-saved"><CharSvg name="check" size={14} /> {t('char.saved')}</span>}
        </div>

        <div className="csp-body">
          {/* ── Section: Personality Mode ── */}
          <div className="csp-section">
            <div className="csp-section-label">{t('char.personality')}</div>
            <div className="csp-mode-grid">
              {PERSONALITY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`csp-mode-card ${settings.personality === mode.id ? 'csp-mode-card--active' : ''}`}
                  style={{
                    '--csp-accent': mode.color,
                    '--csp-bg': mode.bg,
                  } as React.CSSProperties}
                  onClick={() => update('personality', mode.id)}
                >
                  <span className="csp-mode-emoji"><CharSvg name={mode.icon} /></span>
                  <span className="csp-mode-label">{t(mode.labelKey)}</span>
                  <span className="csp-mode-desc">{t(mode.descKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Section: Reply Length ── */}
          <div className="csp-section">
            <div className="csp-section-label">{t('char.replyLength')}</div>
            <div className="csp-option-row">
              {REPLY_LENGTHS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`csp-chip ${settings.replyLength === opt.id ? 'csp-chip--active' : ''}`}
                  onClick={() => update('replyLength', opt.id)}
                >
                  <span className="csp-chip-icon"><CharSvg name={opt.icon} size={15} /></span>
                  <span>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
            <p className="csp-hint">{t(REPLY_LENGTHS.find((o) => o.id === settings.replyLength)!.descKey)}</p>
          </div>

          {/* ── Section: Thinking Depth ── */}
          <div className="csp-section">
            <div className="csp-section-label">{t('char.thinkingDepth')}</div>
            <div className="csp-option-row">
              {THINKING_DEPTHS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`csp-chip ${settings.thinkingDepth === opt.id ? 'csp-chip--active' : ''}`}
                  onClick={() => update('thinkingDepth', opt.id)}
                >
                  <span className="csp-chip-icon"><CharSvg name={opt.icon} size={15} /></span>
                  <span>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
            <p className="csp-hint">{t(THINKING_DEPTHS.find((o) => o.id === settings.thinkingDepth)!.descKey)}</p>
          </div>

          {/* ── Live Preview ── */}
          <div className="csp-preview">
            <div className="csp-preview-header">
              <span className="csp-preview-badge">{t('char.preview')}</span>
              <span className="csp-preview-modes">
                <CharSvg name={PERSONALITY_MODES.find((m) => m.id === settings.personality)!.icon} size={16} />
                {' '}
                {t(REPLY_LENGTHS.find((r) => r.id === settings.replyLength)!.labelKey)}
                {' · '}
                {t(THINKING_DEPTHS.find((d) => d.id === settings.thinkingDepth)!.labelKey)}
              </span>
            </div>
            <div className="csp-preview-bubble">
              <div className="csp-preview-avatar"><CharSvg name="preview" size={20} /></div>
              <p className="csp-preview-text">{previewText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
