import { Header } from '@/components/layout/Header';
import { PageBackButton } from '@/components/ui/PageBackButton';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

export function ReadingPage() {
  const navigate = useNavigate();
  const agentRuntimeLogs = useAppStore((s) => s.agentRuntimeLogs || []);
  const isZh = useAppStore((s) => s.language) === 'zh-TW';

  const recentReads = agentRuntimeLogs
    .filter((l) => l.source === 'moonread' && l.status === 'completed')
    .slice(-5)
    .reverse();

  return (
    <section className="view reading-page">
      <div className="page-header-row">
        <PageBackButton to="/" label={isZh ? '返回首頁' : 'Back'} />
        <Header
          eyebrow={isZh ? '上傳小說，Luna 深度理解角色、劇情與主題' : 'Upload a novel — Luna deeply understands characters, plots, and themes'}
          title={isZh ? '月讀室' : 'MoonRead'}
        />
      </div>

      <div className="reading-hero">
        <div className="reading-hero-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            <line x1="8" y1="7" x2="16" y2="7" />
            <line x1="8" y1="11" x2="14" y2="11" />
            <circle cx="17" cy="14" r="3" fill="currentColor" opacity="0.3" />
          </svg>
        </div>
        <p className="reading-hero-text">
          {isZh
            ? '月讀室是 Luna 的深度閱讀分析引擎。上傳小說或長文後，Luna 會理解角色關係、劇情脈絡與主題思想，讓你能在對話中深入討論作品細節。'
            : "MoonRead is Luna's deep reading analysis engine. Upload a novel or long text, and Luna understands character relationships, plot threads, and themes for in-depth discussion."}
        </p>
        <button
          type="button"
          className="liquid-btn liquid-btn--accent"
          onClick={() => navigate('/chat')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {isZh ? '開始對話' : 'Start a Conversation'}
        </button>
      </div>

      {recentReads.length > 0 && (
        <div className="reading-recent">
          <h3 className="reading-section-title">
            {isZh ? '最近分析' : 'Recent Analysis'}
          </h3>
          <div className="reading-recent-list">
            {recentReads.map((log, i) => (
              <div key={log.id || i} className="reading-recent-item">
                <span className="reading-recent-dot" />
                <span className="reading-recent-label">
                  {isZh ? '月讀室分析' : 'MoonRead Analysis'}
                </span>
                <span className="reading-recent-time">
                  {new Date(log.finishedAt ?? log.startedAt).toLocaleDateString(
                    isZh ? 'zh-TW' : 'en-US',
                    { month: 'short', day: 'numeric' }
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="reading-features">
        <div className="reading-feature-card">
          <strong>{isZh ? '角色關係圖' : 'Character Maps'}</strong>
          <span>{isZh ? 'Luna 會自動提取小說中的角色，並分析他們之間的關係脈絡。' : 'Luna automatically extracts characters and maps their relationships.'}</span>
        </div>
        <div className="reading-feature-card">
          <strong>{isZh ? '劇情分析' : 'Plot Analysis'}</strong>
          <span>{isZh ? '理解故事結構、轉折點與主題發展，與 Luna 深度討論。' : 'Understand story structure, turning points, and thematic development.'}</span>
        </div>
        <div className="reading-feature-card">
          <strong>{isZh ? '段落摘錄' : 'Passage Excerpts'}</strong>
          <span>{isZh ? '從月讀室選擇段落帶入對話，Luna 會基於前後文回應。' : 'Select passages to bring into chat — Luna responds with full context.'}</span>
        </div>
      </div>

      <style>{`
        .reading-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 0 16px 40px;
        }
        .reading-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 32px 16px;
          text-align: center;
        }
        .reading-hero-icon {
          color: var(--accent);
          opacity: 0.7;
        }
        .reading-hero-text {
          color: var(--text-2);
          font-size: 14px;
          line-height: 1.7;
          max-width: 520px;
          margin: 0;
        }
        .reading-recent {
          margin-top: 12px;
        }
        .reading-section-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-3);
          margin: 0 0 10px;
          padding: 0 4px;
        }
        .reading-recent-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .reading-recent-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--surface-2);
          font-size: 13px;
        }
        .reading-recent-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }
        .reading-recent-label {
          flex: 1;
          color: var(--text);
        }
        .reading-recent-time {
          color: var(--text-3);
          font-size: 11px;
          flex-shrink: 0;
        }
        .reading-features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-top: 24px;
        }
        .reading-feature-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid var(--border-hi);
          background: var(--surface);
        }
        .reading-feature-card strong {
          font-size: 13px;
          color: var(--text);
        }
        .reading-feature-card span {
          font-size: 12px;
          color: var(--text-3);
          line-height: 1.6;
        }
      `}</style>
    </section>
  );
}
