import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TideRailTabContent } from '@/components/tiderail/TideRailTabContent';
import './TideRailPage.css';

/**
 * TIDEQUEST · 潮軌 — standalone page owning the TideRail UI.
 * Data stays in useTideRailStore; this page only hosts the content.
 */
export function TideRailPage() {
  const navigate = useNavigate();
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    const openComposer = () => setComposerOpen(true);
    window.addEventListener('tiderail:open-drift', openComposer);
    return () => window.removeEventListener('tiderail:open-drift', openComposer);
  }, []);

  return (
    <main className="tiderail-page" data-testid="tiderail-page">
      <header className="tiderail-page__header">
        <button type="button" className="tiderail-page__back" onClick={() => navigate('/quests')} aria-label="回到任務欄">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          任務欄
        </button>
        <div className="tiderail-page__title">
          <span className="tiderail-page__eyebrow">TIDEQUEST</span>
          <h1>潮軌</h1>
          <p>主線 · 偏航</p>
        </div>
        <button type="button" className="tiderail-page__capture" onClick={() => setComposerOpen(true)}>
          <span>＋</span> 收容偏航
        </button>
      </header>
      <div className="tiderail-page__body">
        <TideRailTabContent composerOpen={composerOpen} onComposerClose={() => setComposerOpen(false)} />
      </div>
    </main>
  );
}
