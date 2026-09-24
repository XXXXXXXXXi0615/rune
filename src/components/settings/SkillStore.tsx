import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ── SVG icons ──

const svgA = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function SkillSvg({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} {...svgA}>
      {name === 'web_search' && (
        <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>
      )}
      {name === 'file_reader' && (
        <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>
      )}
      {name === 'calendar' && (
        <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
      )}
      {name === 'music_control' && (
        <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>
      )}
      {name === 'moonread' && (
        <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>
      )}
      {name === 'tide_analysis' && (
        <><circle cx="12" cy="12" r="10" /><path d="M12 6v12M6 12h12" /></>
      )}
    </svg>
  );
}

interface SkillItem {
  id: string;
  icon: string;           /* SVG name */
  color: string;          /* accent colour for icon bg */
  nameKey: string;        /* i18n key for name */
  descKey: string;        /* i18n key for short description */
  builtIn: boolean;       /* always installed if true */
  sourceKey: string;      /* i18n key for source label */
  permissions: string[];  /* i18n keys for permission labels */
  featureKey: string;     /* i18n key for feature description */
}

/* ── Skill catalogue ── */
const SKILL_CATALOG: SkillItem[] = [
  {
    id: 'web_search',
    icon: 'web_search',
    color: '#4A9EFF',
    nameKey: 'skillStore.webSearch',
    descKey: 'skillStore.webSearchDesc',
    builtIn: true,
    sourceKey: 'skillDetail.sourceBuiltIn',
    permissions: ['skillDetail.permInternet', 'skillDetail.permRead'],
    featureKey: 'skillDetail.featureWebSearch',
  },
  {
    id: 'file_reader',
    icon: 'file_reader',
    color: '#FF9F43',
    nameKey: 'skillStore.fileReader',
    descKey: 'skillStore.fileReaderDesc',
    builtIn: true,
    sourceKey: 'skillDetail.sourceBuiltIn',
    permissions: ['skillDetail.permFileRead', 'skillDetail.permLocal'],
    featureKey: 'skillDetail.featureFileReader',
  },
  {
    id: 'calendar',
    icon: 'calendar',
    color: '#2ED573',
    nameKey: 'skillStore.calendar',
    descKey: 'skillStore.calendarDesc',
    builtIn: true,
    sourceKey: 'skillDetail.sourceBuiltIn',
    permissions: ['skillDetail.permCalendar', 'skillDetail.permRead'],
    featureKey: 'skillDetail.featureCalendar',
  },
  {
    id: 'music_control',
    icon: 'music_control',
    color: '#FF6B9D',
    nameKey: 'skillStore.musicControl',
    descKey: 'skillStore.musicControlDesc',
    builtIn: true,
    sourceKey: 'skillDetail.sourceBuiltIn',
    permissions: ['skillDetail.permMedia', 'skillDetail.permPlayback'],
    featureKey: 'skillDetail.featureMusicControl',
  },
  {
    id: 'moonread',
    icon: 'moonread',
    color: '#1ABC9C',
    nameKey: 'skillStore.moonread',
    descKey: 'skillStore.moonreadDesc',
    builtIn: true,
    sourceKey: 'skillDetail.sourceMoonRead',
    permissions: ['skillDetail.permFileRead', 'skillDetail.permAI'],
    featureKey: 'skillDetail.featureMoonread',
  },
  {
    id: 'tide_analysis',
    icon: 'tide_analysis',
    color: '#B18DFF',
    nameKey: 'skillStore.tideAnalysis',
    descKey: 'skillStore.tideAnalysisDesc',
    builtIn: true,
    sourceKey: 'skillDetail.sourceTide',
    permissions: ['skillDetail.permMemory', 'skillDetail.permEmotion'],
    featureKey: 'skillDetail.featureTideAnalysis',
  },
];

export function SkillStore({ isOpen, onClose }: Props) {
  const agentTools = useAppStore((s) => s.agentTools);
  const toggleTool = useAppStore((s) => s.toggleTool);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const skills = useMemo(() => {
    return SKILL_CATALOG.map((skill) => {
      const tool = agentTools.find(
        (t) => t.type === skill.id || t.id === skill.id,
      );
      return {
        ...skill,
        tool,
        enabled: skill.builtIn ? true : !!tool?.enabled,
        installed: skill.builtIn || !!tool,
      };
    });
  }, [agentTools]);

  const selectedSkill = useMemo(
    () => skills.find((s) => s.id === selectedId) ?? null,
    [skills, selectedId],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleInstall = useCallback(() => {
    /* Built-in skills are pre-installed; this is a placeholder for future marketplace skills */
    if (selectedSkill && !selectedSkill.installed && selectedSkill.tool) {
      toggleTool(selectedSkill.tool.id);
    }
  }, [selectedSkill, toggleTool]);

  const handleToggle = useCallback(() => {
    if (selectedSkill?.tool) {
      toggleTool(selectedSkill.tool.id);
    }
  }, [selectedSkill, toggleTool]);

  const handleReconnect = useCallback(() => {
    /* Simulate reconnect animation — in production this would re-initialise MCP/tool connection */
    if (selectedSkill?.tool) {
      toggleTool(selectedSkill.tool.id); /* quick toggle to refresh state */
    }
  }, [selectedSkill, toggleTool]);

  if (!isOpen) return null;

  return createPortal(
    <div className="skill-store-overlay" onClick={onClose}>
      <div
        className={`skill-store${selectedId ? ' skill-store--detail' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ DETAIL VIEW ═══ */}
        {selectedSkill && selectedId ? (
          <>
            {/* ── Detail Header ── */}
            <div className="skill-detail-header">
              <button
                type="button"
                className="skill-detail-back"
                onClick={handleBack}
                aria-label={t('skillDetail.back')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              <div className="skill-detail-icon-row">
                <div
                  className="skill-detail-icon"
                  style={{
                    background: `linear-gradient(135deg, ${selectedSkill.color}22, ${selectedSkill.color}10)`,
                    color: selectedSkill.color,
                    boxShadow: `0 4px 20px ${selectedSkill.color}25`,
                  }}
                >
                  <SkillSvg name={selectedSkill.icon} size={28} />
                </div>
              </div>

              <h2 className="skill-detail-name">{t(selectedSkill.nameKey)}</h2>

              <div className={`skill-detail-status-dot${selectedSkill.enabled ? ' skill-detail-status-dot--on' : ''}`}>
                <span className="skill-detail-dot" />
                {t(selectedSkill.enabled ? 'skillDetail.statusConnected' : 'skillDetail.statusOffline')}
              </div>
            </div>

            {/* ── Info Rows ── */}
            <div className="detail-info-rows">
              {/* 技能來源 */}
              <div className="detail-info-row">
                <div className="detail-info-label">{t('skillDetail.source')}</div>
                <div className="detail-info-value">{t(selectedSkill.sourceKey)}</div>
              </div>

              {/* 連線狀態 */}
              <div className="detail-info-row">
                <div className="detail-info-label">{t('skillDetail.connection')}</div>
                <div className={`detail-info-value detail-info-value--status${selectedSkill.enabled ? '' : ' detail-info-value--off'}`}>
                  {t(selectedSkill.enabled ? 'skillDetail.statusConnected' : 'skillDetail.statusOffline')}
                </div>
              </div>

              {/* 權限 */}
              <div className="detail-info-row detail-info-row--perm">
                <div className="detail-info-label">{t('skillDetail.permissions')}</div>
                <div className="detail-perm-list">
                  {selectedSkill.permissions.map((permKey, i) => (
                    <span key={i} className="detail-perm-tag">
                      {t(permKey)}
                    </span>
                  ))}
                </div>
              </div>

              {/* 功能說明 */}
              <div className="detail-info-row detail-info-row--desc">
                <div className="detail-info-label">{t('skillDetail.features')}</div>
                <p className="detail-feature-text">{t(selectedSkill.featureKey)}</p>
              </div>
            </div>

            {/* ── Action Buttons ── */}
            <div className="detail-actions">
              {!selectedSkill.installed ? (
                <button
                  type="button"
                  className="liquid-btn detail-btn detail-btn--primary"
                  onClick={handleInstall}
                >
                  {t('skillDetail.install')}
                </button>
              ) : null}

              {selectedSkill.installed ? (
                <button
                  type="button"
                  className={`liquid-btn detail-btn detail-btn--secondary${!selectedSkill.enabled ? ' detail-btn--disabled' : ''}`}
                  onClick={handleToggle}
                >
                  {selectedSkill.enabled ? t('skillDetail.disable') : t('skillDetail.enable')}
                </button>
              ) : null}

              <button
                type="button"
                className="liquid-btn detail-btn detail-btn--ghost"
                onClick={handleReconnect}
              >
                {t('skillDetail.reconnect')}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ═══ GRID VIEW ═══ */}
            {/* ── Header ── */}
            <div className="skill-store-head">
              <h2 className="skill-store-title">{t('lunaris.skills')}</h2>
              <p className="skill-store-subtitle">{t('skillStore.subtitle')}</p>
            </div>

            {/* ── Card Grid ── */}
            <div className="skill-grid">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`skill-card${skill.enabled ? ' skill-card--enabled' : ''}`}
                  onClick={() => handleSelect(skill.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(skill.id)}
                >
                  {/* Icon */}
                  <div
                    className="skill-icon"
                    style={{ background: `${skill.color}18`, color: skill.color }}
                  >
                    <SkillSvg name={skill.icon} />
                  </div>

                  {/* Text */}
                  <div className="skill-info">
                    <div className="skill-name">{t(skill.nameKey)}</div>
                    <div className="skill-desc">{t(skill.descKey)}</div>
                  </div>

                  {/* Status */}
                  <div
                    className={`skill-status${
                      skill.installed ? ' skill-status--installed' : ''
                    }`}
                  >
                    {skill.installed
                      ? t('skillStore.statusInstalled')
                      : t('skillStore.statusAvailable')}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Footer ── */}
            <button
              type="button"
              className="liquid-btn skill-store-close"
              onClick={onClose}
            >
              {t('sheet.cancel')}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
