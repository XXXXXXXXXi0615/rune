import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GAME_REGISTRY, getPublicGames, getExperimentalGames } from '@/features/playroom/gameRegistry';
import type { GameDefinition, GameSession } from '@/features/playroom/types';
import { useGameSessionStore } from '@/store/useGameSessionStore';
import '@/styles/playroom.css';

const MODE_TAG_LABEL: Record<string, string> = {
  '1-6-model-invite': '1–6 人 · 支持 AI · 可邀请角色',
  '2-offline-ai': '2 人 · 可离线玩 · AI 对战',
};

function modeTag(g: GameDefinition): string {
  if (g.id === 'free-roleplay') return '1–6 人 · 支持 AI · 可邀请角色';
  if (g.id === 'gomoku') return '2 人 · 离线可玩 · AI 对战';
  const parts: string[] = [`${g.playerRange.min}–${g.playerRange.max} 人`];
  if (g.supportsOfflineBot) parts.push('离线可玩');
  if (g.supportsModelAgent) parts.push('支持 AI');
  if (g.supportsChatInvite) parts.push('可邀请角色');
  return parts.join(' · ');
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  return d.toLocaleDateString();
}

function GameCover({ game, lastSession }: { game: GameDefinition; lastSession?: GameSession }) {
  if (game.id === 'gomoku') {
    return (
      <div className="pr-cover pr-cover-gomoku" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="pr-cover-svg">
          <rect width="120" height="120" rx="16" fill="#deb887" />
          <line x1="20" y1="20" x2="20" y2="100" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="40" y1="20" x2="40" y2="100" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="60" y1="20" x2="60" y2="100" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="80" y1="20" x2="80" y2="100" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="100" y1="20" x2="100" y2="100" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="20" y1="20" x2="100" y2="20" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="20" y1="40" x2="100" y2="40" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="20" y1="60" x2="100" y2="60" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="20" y1="80" x2="100" y2="80" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <line x1="20" y1="100" x2="100" y2="100" stroke="rgba(0,0,0,.15)" strokeWidth=".5" />
          <circle cx="60" cy="60" r="7" fill="#1a1a1a" />
          <circle cx="40" cy="40" r="7" fill="#1a1a1a" />
          <circle cx="80" cy="80" r="7" fill="#f5f5f0" stroke="#1a1a1a" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }
  if (game.id === 'free-roleplay') {
    return (
      <div className="pr-cover pr-cover-roleplay" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="pr-cover-svg">
          <rect width="120" height="120" rx="16" fill="#1e1b2e" />
          <circle cx="48" cy="44" r="14" fill="none" stroke="rgba(204,184,140,.5)" strokeWidth="1" />
          <circle cx="48" cy="44" r="6" fill="rgba(204,184,140,.35)" />
          <path d="M48 58v12M38 52l-6 8M58 52l6 8" stroke="rgba(204,184,140,.5)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="84" cy="36" r="3" fill="rgba(204,184,140,.2)" />
          <circle cx="90" cy="50" r="1.5" fill="rgba(204,184,140,.15)" />
          <line x1="20" y1="72" x2="100" y2="72" stroke="rgba(204,184,140,.15)" strokeWidth=".5" strokeDasharray="2 3" />
          <line x1="30" y1="84" x2="90" y2="84" stroke="rgba(204,184,140,.1)" strokeWidth=".5" />
        </svg>
      </div>
    );
  }
  if (game.id === 'scenario-simulator') {
    return (
      <div className="pr-cover pr-cover-scenario" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="pr-cover-svg">
          <rect width="120" height="120" rx="16" fill="#2a1e1e" />
          <rect x="18" y="18" width="84" height="30" rx="6" fill="rgba(232,165,90,.15)" stroke="rgba(232,165,90,.3)" strokeWidth=".8" />
          <rect x="18" y="56" width="84" height="14" rx="4" fill="rgba(255,255,255,.06)" />
          <rect x="18" y="76" width="84" height="14" rx="4" fill="rgba(255,255,255,.04)" />
          <rect x="44" y="60" width="24" height="6" rx="3" fill="rgba(232,165,90,.2)" />
          <text x="24" y="38" fill="rgba(255,255,255,.3)" fontSize="11" fontFamily="serif">场景卡</text>
        </svg>
      </div>
    );
  }
  return (
    <div className="pr-cover pr-cover-generic" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="pr-cover-svg">
        <rect width="120" height="120" rx="16" fill="#2a2a28" />
        <text x="60" y="68" textAnchor="middle" fill="rgba(255,255,255,.25)" fontSize="28" fontFamily="Georgia,serif">{game.title.slice(0, 1)}</text>
      </svg>
    </div>
  );
}

function GameCard({ game, lastSession }: { game: GameDefinition; lastSession?: GameSession }) {
  const route = lastSession ? `/playroom/session/${lastSession.id}` : game.route;
  const label = lastSession ? '继续游戏' : '开始游戏';
  return (
    <article className="pr-game-card">
      <Link to={route} className="pr-game-card-link" aria-label={`${game.title} — ${label}`}>
        <GameCover game={game} lastSession={lastSession} />
        <div className="pr-game-card-body">
          <h2>{game.title}</h2>
          <p>{game.description}</p>
          <span className="pr-game-mode-tag">{modeTag(game)}</span>
          {lastSession && (
            <small className="pr-game-save">最近存档 · {formatTime(lastSession.updatedAt)}</small>
          )}
        </div>
      </Link>
      <div className="pr-game-card-cta">
        <Link to={route} className="pr-btn pr-btn-primary">{label}</Link>
      </div>
    </article>
  );
}

export function PlayroomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewGames = searchParams.get('previewGames') === '1';

  const sessionsById = useGameSessionStore(s => s.sessions);
  const sessions = useMemo(
    () => Object.values(sessionsById).sort((a, b) => b.updatedAt - a.updatedAt),
    [sessionsById],
  );

  const [query, setQuery] = useState('');

  const publicGames = useMemo(() => getPublicGames(), []);
  const experimentalGames = useMemo(() => getExperimentalGames(), []);
  const allVisibleGames = useMemo(() => {
    if (previewGames) return [...GAME_REGISTRY];
    return [...publicGames, ...experimentalGames];
  }, [previewGames, publicGames, experimentalGames]);

  const filteredGames = useMemo(() => {
    if (!query.trim()) return allVisibleGames;
    const q = query.trim().toLowerCase();
    return allVisibleGames.filter(g =>
      g.title.includes(q) || g.description.includes(q),
    );
  }, [allVisibleGames, query]);

  const recentSession = sessions.find(s => s.status === 'active' || s.status === 'paused');
  const recentPlayedGames = useMemo(
    () => sessions.slice(0, 3),
    [sessions],
  );

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <main className="playroom-page">
      <header className="pr-header">
        <div className="pr-header-main">
          <h1>月潮遊藝廳</h1>
          <p>和角色一起进入故事与游戏</p>
        </div>
        <div className="pr-header-actions">
          <label className="pr-search">
            <span className="sr-only">搜索游戏</span>
            <svg viewBox="0 0 24 24" width="16" height="16" className="pr-search-icon" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="15" y1="15" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索游戏"
            />
          </label>
          <button
            className="pr-btn pr-btn-primary"
            onClick={() => navigate('/playroom/new/free-roleplay')}
          >
            新建游戏
          </button>
        </div>
      </header>

      {/* Continue Game */}
      <section className="pr-section pr-continue-section">
        {recentSession ? (
          <div className="pr-continue-card">
            <div className="pr-continue-info">
              <span className="pr-eyebrow">继续游戏</span>
              <h2>{recentSession.title}</h2>
              <p>
                {recentSession.gameDefinitionId === 'gomoku'
                  ? `已进行 ${recentSession.currentTurn} 回合`
                  : '故事正在等待你的下一次选择'}
              </p>
              <div className="pr-continue-meta">
                <span>{recentSession.participants.map(p => p.displayName).join(' · ')}</span>
                <span>第 {recentSession.currentTurn} 回合</span>
                <span>{formatTime(recentSession.updatedAt)}</span>
              </div>
            </div>
            <div className="pr-continue-actions">
              <Link to={`/playroom/session/${recentSession.id}`} className="pr-btn pr-btn-primary">
                继续游戏
              </Link>
              <button
                className="pr-btn pr-btn-ghost"
                onClick={() => {
                  useGameSessionStore.getState().pauseSession(recentSession.id);
                }}
              >
                暂停
              </button>
            </div>
          </div>
        ) : (
          <div className="pr-continue-empty">
            <h2>从今晚的第一局开始</h2>
            <p>选择下面的玩法创建游戏。</p>
          </div>
        )}
      </section>

      {/* Playable Games */}
      {query.trim() ? (
        <section className="pr-section">
          <div className="pr-section-head">
            <h2>搜索结果</h2>
          </div>
          <div className="pr-game-grid">
            {filteredGames.length === 0 ? (
              <p className="pr-empty-msg">没有找到匹配的游戏。</p>
            ) : (
              filteredGames.map(g => (
                <GameCard
                  key={g.id}
                  game={g}
                  lastSession={sessions.find(s => s.gameDefinitionId === g.id)}
                />
              ))
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="pr-section">
            <div className="pr-section-head">
              <h2>现在可玩</h2>
            </div>
            {publicGames.length === 0 ? (
              <p className="pr-empty-msg">目前没有可玩的游戏。</p>
            ) : (
              <div className="pr-game-grid">
                {publicGames.map(g => (
                  <GameCard
                    key={g.id}
                    game={g}
                    lastSession={sessions.find(s => s.gameDefinitionId === g.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Experimental */}
          {experimentalGames.length > 0 && (
            <section className="pr-section pr-experimental-section">
              <div className="pr-section-head">
                <h2>实验玩法</h2>
                <span className="pr-badge pr-badge-amber">实验</span>
              </div>
              <p className="pr-experimental-note">
                这些玩法仍在调整，存档格式和规则可能更新。
              </p>
              <div className="pr-game-grid">
                {experimentalGames.map(g => (
                  <GameCard
                    key={g.id}
                    game={g}
                    lastSession={sessions.find(s => s.gameDefinitionId === g.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Development Preview */}
          {previewGames && (
            <section className="pr-section pr-dev-section">
              <div className="pr-section-head">
                <h2>开发预览</h2>
                <span className="pr-badge pr-badge-dev">dev</span>
              </div>
              <div className="pr-game-grid">
                {GAME_REGISTRY.filter(g => g.releaseChannel === 'development').map(g => (
                  <GameCard
                    key={g.id}
                    game={g}
                    lastSession={sessions.find(s => s.gameDefinitionId === g.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Recent Plays */}
      {recentPlayedGames.filter(s => s.status === 'completed' || s.status === 'abandoned').length > 0 && (
        <section className="pr-section pr-recent-section">
          <h2>最近游玩</h2>
          <div className="pr-recent-list">
            {recentPlayedGames
              .filter(s => s.status === 'completed' || s.status === 'abandoned')
              .slice(0, 3)
              .map(s => (
                <Link key={s.id} to={`/playroom/session/${s.id}`} className="pr-recent-item">
                  <span>{s.title}</span>
                  <span className="pr-recent-meta">{s.currentTurn} 回合 · {formatTime(s.updatedAt)}</span>
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* Chat Invites */}
      <section className="pr-section pr-invites-section">
        <div className="pr-invites-card">
          <div>
            <span className="pr-eyebrow">来自聊天的游戏邀请</span>
            <h2>邀请角色一起玩</h2>
            <p>在聊天中选择角色，以固定 Persona Snapshot 加入游戏。</p>
          </div>
          <Link to="/chat" className="pr-btn pr-btn-secondary">前往聊天</Link>
        </div>
      </section>
    </main>
  );
}
