import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { t, type Language } from '@/i18n';
import type { ActivityLogEntry } from '@/types';

const RAW_STATUS_MAP: Record<string, string> = {
  local: '本地模式',
  online: '在線',
  offline: '離線',
  syncing: '同步中',
  busy: '忙碌',
  invisible: '隱身',
  quiet: '安靜陪伴中',
};

/** Replace raw status enum values in log text with Chinese labels */
function sanitizeLogText(text: string): string {
  let result = text;
  for (const [raw, label] of Object.entries(RAW_STATUS_MAP)) {
    result = result.replace(new RegExp(`「${raw}」`, 'g'), `「${label}」`);
  }
  return result;
}

function formatLogTime(ts: number, language: Language): string {
  const d = new Date(ts);
  const locale = language === 'en' ? 'en-US' : 'zh-TW';
  const date = d.toLocaleDateString(locale, { month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}

function levelToClass(level: ActivityLogEntry['level']): string {
  return `activity-log-level--${level}`;
}

function typeLabel(type: ActivityLogEntry['type']): string {
  return t(`system.type.${type}`);
}

function ClearIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 15, height: 15 }}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16 }}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function SystemActivityPage() {
  const navigate = useNavigate();
  const language = useAppStore((s) => s.language);
  const activityLogs = useAppStore((s) => s.activityLogs || []);
  const clearActivityLogs = useAppStore((s) => s.clearActivityLogs);
  const [clearConfirm, setClearConfirm] = useState(false);

  const handleClear = () => {
    clearActivityLogs();
    setClearConfirm(false);
  };

  return (
    <section className="system-activity-view">
      {/* Header */}
      <header className="system-activity-header">
        <button
          type="button"
          className="round-back-btn"
          onClick={() => navigate('/chat')}
          aria-label={t('system.backToInbox')}
          style={{ position: 'static' }}
        >
          <BackIcon />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="system-activity-eyebrow">{t('system.subtitle')}</span>
          <h1>{t('system.title')}</h1>
        </div>
        {activityLogs.length > 0 && (
          !clearConfirm ? (
            <button
              type="button"
              className="btn-icon"
              onClick={() => setClearConfirm(true)}
              aria-label={t('system.clearAll')}
              title={t('system.clearAll')}
              style={{ color: 'var(--danger)' }}
            >
              <ClearIcon />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" className="btn-ghost" onClick={() => setClearConfirm(false)} style={{ fontSize: 12, height: 32, padding: '0 10px' }}>
                {t('sheet.cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={handleClear} style={{ fontSize: 12, height: 32, padding: '0 10px', background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {t('system.clearAll')}
              </button>
            </div>
          )
        )}
      </header>

      {/* Log list */}
      {activityLogs.length === 0 ? (
        <div className="empty-state" style={{ flex: 1, minHeight: 0 }}>
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">{t('system.empty')}</div>
          <div className="empty-state-desc">{t('system.subtitle')}</div>
          <Link to="/chat" className="btn-secondary" style={{ marginTop: 16, textDecoration: 'none' }}>
            <BackIcon />
            <span>{t('system.backToInbox')}</span>
          </Link>
        </div>
      ) : (
        <div className="activity-log-list" role="log" aria-label={t('system.title')}>
          {activityLogs.map((log) => (
            <article
              key={log.id}
              className={`activity-log-entry ${log.read ? '' : 'activity-log-entry--unread'}`}
            >
              <div className="activity-log-meta">
                <span className={`activity-log-level ${levelToClass(log.level)}`} aria-hidden="true" />
                <span className="activity-log-type">{typeLabel(log.type)}</span>
                <time className="activity-log-time">{formatLogTime(log.createdAt, language)}</time>
              </div>
              <div className="activity-log-body">
                <span className="activity-log-title">{sanitizeLogText(log.title)}</span>
                {log.detail && <span className="activity-log-detail">{sanitizeLogText(log.detail)}</span>}
              </div>
              {log.route && (
                <Link to={log.route} className="activity-log-route">
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 12, height: 12 }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
