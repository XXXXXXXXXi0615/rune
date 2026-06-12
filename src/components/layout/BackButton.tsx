import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n';

interface BackButtonProps {
  to?: string;
  fallback?: string;
}

export function BackButton({ to, fallback = '/' }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      className="view-back"
      onClick={handleClick}
      aria-label={t('shared.back')}
      type="button"
    >
      <svg
        className="icon"
        viewBox="0 0 24 24"
        style={{ width: 16, height: 16 }}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
