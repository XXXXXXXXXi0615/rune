import { useNavigate } from 'react-router-dom';

interface PageBackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export function PageBackButton({ to = '/', label = '返回首頁', className = '' }: PageBackButtonProps) {
  const navigate = useNavigate();
  return (
    <button type="button" className={`page-back-btn ${className}`} onClick={() => navigate(to)} aria-label={label}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
