import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';

/* ═══════════════════════════════════════
   Skill Library — 技能樹頁 (RPG style)
   Unlocked skills · Locked skills · Status display
   ═══════════════════════════════════════ */

interface Props { isOpen: boolean; onClose: () => void; }

// ── SVG icons ──

const svgA = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function SlpSvg({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} {...svgA}>
      {name === 'moonread' && (
        <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>
      )}
      {name === 'tide' && (
        <><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 15c-2 3-10 3-14 0" /><path d="M5 19c2 2 8 2 14 0" /></>
      )}
      {name === 'music_analysis' && (
        <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>
      )}
      {name === 'emotion_sort' && (
        <><circle cx="12" cy="12" r="10" /><path d="M12 6v12M6 12h12" /></>
      )}
      {name === 'image_analysis' && (
        <><rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></>
      )}
      {name === 'web_reader' && (
        <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>
      )}
      {name === 'agent_mode' && (
        <><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="16" r="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>
      )}
      {name === 'analysis' && (
        <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
      )}
      {name === 'creative' && (
        <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></>
      )}
      {name === 'utility' && (
        <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>
      )}
      {name === 'ai' && (
        <><circle cx="12" cy="12" r="10" /><path d="M12 6v12M6 12h12" /></>
      )}
      {name === 'check' && (
        <polyline points="4,12 10,18 20,6" />
      )}
      {name === 'lock' && (
        <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>
      )}
      {name === 'rocket' && (
        <><path d="M12 15s8-4 8-10c-6 0-10 4-10 8" /><path d="M8 21c2-1 4-3 4-6" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="1" /></>
      )}
    </svg>
  );
}

// ── Skill definition ──

interface SkillDef {
  id: string;
  icon: string;
  labelKey: string;
  descKey: string;
  color: string;
  bg: string;
  category: 'analysis' | 'creative' | 'utility' | 'ai';
  unlocked: boolean; /* computed from agentTools */
}

// All possible skills in the system
const ALL_SKILLS: SkillDef[] = [
  // Unlocked by default
  { id: 'moonread',      icon: 'moonread',        labelKey: 'sl.skillMoonread',         descKey: 'sl.skillMoonreadDesc',      color: '#B18DFF', bg: 'rgba(177,141,255,0.12)', category: 'analysis',  unlocked: true },
  { id: 'tide',          icon: 'tide',             labelKey: 'sl.skillTide',             descKey: 'sl.skillTideDesc',          color: '#7AB8FF', bg: 'rgba(122,184,255,0.12)', category: 'analysis',  unlocked: true },
  { id: 'music_analysis',icon: 'music_analysis',   labelKey: 'sl.skillMusicAnalysis',    descKey: 'sl.skillMusicAnalysisDesc',  color: '#E870A0', bg: 'rgba(232,112,160,0.12)', category: 'creative',  unlocked: true },
  { id: 'emotion_sort',  icon: 'emotion_sort',     labelKey: 'sl.skillEmotionSort',      descKey: 'sl.skillEmotionSortDesc',   color: '#5DB872', bg: 'rgba(93,184,114,0.12)',   category: 'ai',       unlocked: true },

  // Locked / future
  { id: 'image_analysis',icon: 'image_analysis',   labelKey: 'sl.skillImageAnalysis',    descKey: 'sl.skillImageAnalysisDesc',  color: '#FF8A3D', bg: 'rgba(255,138,61,0.12)',   category: 'creative', unlocked: false },
  { id: 'web_reader',    icon: 'web_reader',       labelKey: 'sl.skillWebReader',        descKey: 'sl.skillWebReaderDesc',     color: '#F5C96A', bg: 'rgba(245,201,106,0.12)', category: 'utility',  unlocked: false },
  { id: 'agent_mode',    icon: 'agent_mode',       labelKey: 'sl.skillAgentMode',        descKey: 'sl.skillAgentModeDesc',     color: '#8EA0B8', bg: 'rgba(142,160,184,0.12)', category: 'ai',       unlocked: false },
];

const CATEGORY_LABELS: Record<string, { icon: string; labelKey: string }> = {
  analysis:  { icon: 'analysis',  labelKey: 'sl.catAnalysis'  },
  creative:  { icon: 'creative',  labelKey: 'sl.catCreative'  },
  utility:   { icon: 'utility',   labelKey: 'sl.catUtility'   },
  ai:        { icon: 'ai',        labelKey: 'sl.catAI'        },
};

/* ═══ Component ═══ */

export function SkillLibraryPage({ isOpen, onClose }: Props) {
  const agentTools = useAppStore((s) => s.agentTools);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Compute which skills are actually enabled
  const skills = useMemo(() => {
    const enabledIds = new Set(agentTools.filter((t) => t.enabled).map((t) => t.type));
    return ALL_SKILLS.map((s) => ({
      ...s,
      unlocked: s.unlocked || enabledIds.has(s.id as never),
    }));
  }, [agentTools]);

  const unlockedSkills = skills.filter((s) => s.unlocked);
  const lockedSkills = skills.filter((s) => !s.unlocked);

  const selectedSkill = skills.find((s) => s.id === selectedId);

  if (!isOpen) return null;

  return createPortal(
    <div className="slp-overlay" onClick={onClose}>
      <div className="slp" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('sl.title')}>
        {/* ── Header ── */}
        <div className="slp-head">
          <button className="slp-back" onClick={onClose} aria-label={t('skillDetail.back')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h2 className="slp-title">{t('sl.title')}</h2>
            <p className="slp-subtitle">
              {unlockedSkills.length} {t('sl.unlocked')} · {lockedSkills.length} {t('sl.locked')}
            </p>
          </div>
        </div>

        <div className="slp-body">
          {/* ═══ UNLOCKED SKILLS ═══ */}
          <div className="slp-section">
            <div className="slp-section-head">
              <span className="slp-section-icon"><SlpSvg name="rocket" size={18} /></span>
              <span>{t('sl.sectionUnlocked')}</span>
            </div>

            {/* Skill tree nodes */}
            <div className="slp-tree">
              {unlockedSkills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className={`slp-node ${selectedId === skill.id ? 'slp-node--selected' : ''}`}
                  style={{
                    '--slp-accent': skill.color,
                    '--slp-bg': skill.bg,
                  } as React.CSSProperties}
                  onClick={() => setSelectedId(selectedId === skill.id ? null : skill.id)}
                >
                  <div className="slp-node-icon-wrap">
                    <span className="slp-node-emoji"><SlpSvg name={skill.icon} /></span>
                    <SlpSvg name="check" size={14} />
                  </div>
                  <div className="slp-node-info">
                    <span className="slp-node-name">{t(skill.labelKey)}</span>
                    <span className="slp-node-cat"><SlpSvg name={CATEGORY_LABELS[skill.category].icon} size={12} /> {t(CATEGORY_LABELS[skill.category].labelKey)}</span>
                  </div>
                  <svg className="slp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
          </div>

          {/* ═══ LOCKED SKILLS ═══ */}
          {lockedSkills.length > 0 && (
            <div className="slp-section slp-section--locked">
              <div className="slp-section-head">
                <span className="slp-section-icon"><SlpSvg name="lock" size={18} /></span>
                <span>{t('sl.sectionLocked')}</span>
              </div>

              <div className="slp-tree slp-tree--locked">
                {lockedSkills.map((skill) => (
                  <div key={skill.id} className="slp-node slp-node--locked" style={{ '--slp-accent': skill.color, '--slp-bg': skill.bg } as React.CSSProperties}>
                    <div className="slp-node-icon-wrap slp-node-icon-wrap--dim">
                      <span className="slp-node-emoji"><SlpSvg name={skill.icon} /></span>
                      <span className="slp-node-lock"><SlpSvg name="lock" size={12} /></span>
                    </div>
                    <div className="slp-node-info">
                      <span className="slp-node-name">{t(skill.labelKey)}</span>
                    <span className="slp-node-cat"><SlpSvg name={CATEGORY_LABELS[skill.category].icon} size={12} /> {t(CATEGORY_LABELS[skill.category].labelKey)}</span>
                    </div>
                    <span className="slp-soon-badge">{t('sl.comingSoon')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Detail Panel (slide-in when selected) ═══ */}
        {selectedSkill && (
          <div className="slp-detail-panel">
            <div className="slp-detail-head">
              <div className="slp-detail-big-icon" style={{ background: `linear-gradient(135deg, ${selectedSkill.bg}, ${selectedSkill.color}22)` }}>
                <SlpSvg name={selectedSkill.icon} size={28} />
              </div>
              <h3 className="slp-detail-name">{t(selectedSkill.labelKey)}</h3>
              <span className={`slp-detail-status ${selectedSkill.unlocked ? 'slp-detail-status--on' : ''}`}>
                {selectedSkill.unlocked ? t('sl.statusActive') : t('sl.statusLocked')}
              </span>
            </div>
            <p className="slp-detail-desc">{t(selectedSkill.descKey)}</p>
            <div className="slp-detail-meta">
              <div className="slp-meta-row">
                <span className="slp-meta-label">{t('sl.metaCategory')}</span>
                <span className="slp-meta-value"><SlpSvg name={CATEGORY_LABELS[selectedSkill.category].icon} size={14} /> {t(CATEGORY_LABELS[selectedSkill.category].labelKey)}</span>
              </div>
              <div className="slp-meta-row">
                <span className="slp-meta-label">{t('sl.metaStatus')}</span>
                <span className="slp-meta-value">{selectedSkill.unlocked ? <><SlpSvg name="check" size={14} /> {t('sl.statusActive')}</> : <><SlpSvg name="lock" size={14} /> {t('sl.statusLocked')}</>}</span>
              </div>
            </div>
            {!selectedSkill.unlocked && (
              <button type="button" className="slp-unlock-btn" disabled>
                {t('sl.unlockSoon')}
              </button>
            )}
            <button type="button" className="slp-close-detail" onClick={() => setSelectedId(null)}>
              {t('skillDetail.back')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
