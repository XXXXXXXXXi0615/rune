import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n';

export function MoonReadCard() {
  const navigate = useNavigate();

  return (
    <button
      className="summary-cell summary-cell-small home-dashboard-moonread"
      onClick={() => navigate('/moon-reading')}
      style={{ cursor: 'pointer' }}
    >
      <div className="desktop-card-title">月讀室</div>
      <div className="summary-cell-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, stroke: 'var(--text-2)', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
      <div className="summary-cell-label">{t('home.moonRead')}</div>
      <div className="summary-cell-value" style={{ fontSize: 14, color: 'var(--text-3)' }}>
        {t('home.moonReadHint')}
      </div>
      <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', marginTop: 6 }}>
        {t('home.enterMoonRead')}
      </span>
    </button>
  );
}
