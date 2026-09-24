import { useNavigate } from 'react-router-dom';

interface ProviderSetupNoticeProps {
  /** When true, the notice won't render (already configured) */
  ready: boolean;
}

/**
 * Provider setup status row — chat landing.
 * Status (dot + text) and CTA (前往設定) are separate semantic elements;
 * only the CTA is interactive.
 * Styles live in src/styles/chat.css (global, always loaded on landing).
 */
export function ProviderSetupNotice({ ready }: ProviderSetupNoticeProps) {
  const navigate = useNavigate();

  if (ready) return null;

  return (
    <div className="cw-ai-status is-compact" data-testid="ai-status-compact">
      <span className="cw-ai-status-dot" aria-hidden="true" />
      <span className="cw-ai-status-copy">尚未連結 AI 模型</span>
      <button
        type="button"
        className="cw-ai-status-cta"
        onClick={() => navigate('/settings/ai/providers')}
        aria-label="前往設定連接模型"
      >
        前往設定
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}
