import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n';

export function MoonReadCard() {
  const navigate = useNavigate();

  return (
    <button
      className="summary-cell summary-cell-small home-dashboard-moonread"
      onClick={() => navigate('/stash')}
      style={{ cursor: 'pointer' }}
    >
      <div className="desktop-card-title">素材庫</div>
      <div className="summary-cell-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, stroke: 'var(--text-2)', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <rect x="4" y="6" width="14" height="12" rx="2" />
          <path d="M7 3h13v12M8 10h6M8 14h4" />
        </svg>
      </div>
      <div className="summary-cell-label">Rune Stash</div>
      <div className="summary-cell-value" style={{ fontSize: 14, color: 'var(--text-3)' }}>
         保存顏色、顏文字、符號與短文字
      </div>
      <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', marginTop: 6 }}>
        打開素材庫
      </span>
    </button>
  );
}
