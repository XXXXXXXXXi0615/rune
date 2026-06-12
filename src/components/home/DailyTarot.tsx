import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { FULL_DECK, drawCards } from '@/data/tarot';
import type { TarotCard } from '@/data/tarot';
import type { TarotSpread, TarotDrawCard } from '@/types';

const SPREAD_OPTIONS: { key: TarotSpread; labelZh: string; count: 1 | 3 }[] = [
  { key: 'single', labelZh: '今日指引', count: 1 },
  { key: 'three', labelZh: '過去·現在·未來', count: 3 },
  { key: 'lunar', labelZh: '記憶·當下·潮汐', count: 3 },
];
const SPREAD_POSITIONS: Record<TarotSpread, string[]> = {
  single: ['今日指引'], three: ['過去', '現在', '未來'], lunar: ['記憶', '當下', '潮汐'],
};
type Stage = 'idle' | 'shuffling' | 'fan' | 'flipped' | 'result';

/* ── SVG Helpers ── */
function CardBack({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 140" width={size} height={size * 1.4} aria-hidden="true">
      <rect x="2" y="2" width="96" height="136" rx="8" fill="#1a1a2e" />
      <rect x="2" y="2" width="96" height="136" rx="8" fill="none" stroke="#a28fb8" strokeWidth="1.5" opacity="0.6" />
      <rect x="10" y="10" width="80" height="120" rx="4" fill="none" stroke="#7b8fc2" strokeWidth="0.8" opacity="0.5" />
      <circle cx="50" cy="55" r="20" fill="none" stroke="#c8d6cf" strokeWidth="1" opacity="0.6" />
      <circle cx="58" cy="50" r="17" fill="#1a1a2e" />
      <path d="M44 55a8 8 0 0 0 0 16 10 10 0 0 1 0-16z" fill="#c8d6cf" opacity="0.6" />
      <circle cx="28" cy="30" r="1.5" fill="#faf9f5" opacity="0.5" />
      <circle cx="70" cy="90" r="1.5" fill="#faf9f5" opacity="0.5" />
      <circle cx="35" cy="105" r="1" fill="#faf9f5" opacity="0.4" />
      <circle cx="68" cy="25" r="1" fill="#a28fb8" opacity="0.4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`t${i}`} x1={20 + i * 14} y1={20} x2={30 + i * 14} y2={20} stroke="#7b8fc2" strokeWidth="1" opacity="0.3" />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`b${i}`} x1={20 + i * 14} y1={120} x2={30 + i * 14} y2={120} stroke="#7b8fc2" strokeWidth="1" opacity="0.3" />
      ))}
    </svg>
  );
}

function CardFace({ card, reversed, size = 64 }: { card: TarotCard; reversed: boolean; size?: number }) {
  const isMajor = card.arcana === 'major';
  return (
    <svg viewBox="0 0 100 140" width={size} height={size * 1.4} aria-hidden="true" style={{ transform: reversed ? 'rotate(180deg)' : undefined }}>
      <rect x="2" y="2" width="96" height="136" rx="8" fill="#faf9f5" />
      <rect x="2" y="2" width="96" height="136" rx="8" fill="none" stroke={isMajor ? '#a28fb8' : '#7b8fc2'} strokeWidth="1.5" />
      <rect x="8" y="8" width="84" height="124" rx="4" fill="none" stroke="#c8d6cf" strokeWidth="0.5" />
      {card.number && (
        <text x="50" y="36" textAnchor="middle" fontSize="16" fontWeight="600" fill="#a28fb8" fontFamily="serif">
          {card.number > 10 ? ['侍', '騎', '后', '王'][card.number - 11] : card.number}
        </text>
      )}
      {card.suit && (
        <text x="50" y="56" textAnchor="middle" fontSize="14" fill="#7b8fc2" fontFamily="serif">
          {{ wands: '', cups: '', swords: '', pentacles: '' }[card.suit]}
        </text>
      )}
      {isMajor && (
        <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="500" fill="#a28fb8" fontFamily="serif">{card.nameZh}</text>
      )}
      <text x="50" y="78" textAnchor="middle" fontSize="7" fill="#7b8fc2" fontFamily="sans-serif">{card.keywords.slice(0, 3).join(' · ')}</text>
      <text x="50" y={reversed ? 128 : 128} textAnchor="middle" fontSize="8" fill={reversed ? '#cc785c' : '#5db8a6'} fontFamily="sans-serif" fontStyle={reversed ? 'italic' : 'normal'}>
        {reversed ? '↑ 逆位' : '↓ 正位'}
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════════ */
export function DailyTarot() {
  const dailyTarot = useAppStore((s) => s.dailyTarot);
  const tarotHistory = useAppStore((s) => s.tarotHistory || []);
  const saveDailyTarot = useAppStore((s) => s.saveDailyTarot);
  const resetDailyTarot = useAppStore((s) => s.resetDailyTarot);

  const today = new Date().toISOString().slice(0, 10);
  const hasToday = dailyTarot?.date === today && dailyTarot.cards.length > 0;

  const [spread, setSpread] = useState<TarotSpread>('single');
  const [stage, setStage] = useState<Stage>('idle');
  const [drawn, setDrawn] = useState<Array<{ card: TarotCard; reversed: boolean }> | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [shufflePhase, setShufflePhase] = useState(0);
  const [showReset, setShowReset] = useState(false);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (animTimer.current) clearTimeout(animTimer.current); }, []);

  const todayCards = hasToday
    ? dailyTarot.cards.map((dc: TarotDrawCard) => ({
      card: FULL_DECK.find((c) => c.id === dc.cardId)!,
      reversed: dc.reversed,
    })).filter(Boolean)
    : null;

  const handleStartShuffle = () => setStage('shuffling');

  // Shuffle animation: phase 0→1→2→3, then fan spread
  useEffect(() => {
    if (stage !== 'shuffling') return;
    setShufflePhase(0);
    const t1 = setTimeout(() => setShufflePhase(1), 300);
    const t2 = setTimeout(() => setShufflePhase(2), 900);
    const t3 = setTimeout(() => setShufflePhase(3), 1600);
    const t4 = setTimeout(() => {
      const count = SPREAD_OPTIONS.find((o) => o.key === spread)!.count;
      setDrawn(drawCards(count));
      setSelectedIdx(null);
      setStage('fan');
    }, 2400);
    animTimer.current = t4;
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [stage, spread]);

  const handleSelectCard = (idx: number) => {
    if (stage !== 'fan' || selectedIdx !== null) return;
    setSelectedIdx(idx);
    // Flip after a tick
    setTimeout(() => setStage('flipped'), 100);
    // Show result after flip animation
    setTimeout(() => {
      setStage('result');
      if (drawn) {
        const drawCards: TarotDrawCard[] = drawn.map((d) => ({ cardId: d.card.id, reversed: d.reversed }));
        saveDailyTarot(spread, drawCards);
      }
    }, 700);
  };

  const handleReset = () => {
    resetDailyTarot();
    setStage('idle');
    setDrawn(null);
    setSelectedIdx(null);
    setShowReset(false);
  };

  /* ── Common wrapper for all stages in the grid ── */
  const wrap = (children: React.ReactNode) => (
    <div className="summary-cell summary-cell-small" style={{ cursor: 'default', gridColumn: '1 / -1', overflow: 'hidden' }}>
      {children}
    </div>
  );

  /* ── Stage: idle (today's result or new draw) ── */
  if (stage === 'idle') {
    // Show today's result if already drawn
    if (hasToday && todayCards) {
      return wrap(
        <>
          <div className="summary-cell-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>每日塔羅 · {todayCards[0].card.nameZh}</span>
            <span style={{ fontSize: 10, color: todayCards[0].reversed ? 'var(--coral)' : 'var(--teal)' }}>
              {todayCards[0].reversed ? '逆位' : '正位'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            {todayCards.map((d, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <CardFace card={d.card} reversed={d.reversed} size={52} />
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{SPREAD_POSITIONS[dailyTarot.spread][i]}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, marginTop: 10, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 10, fontStyle: 'italic' }}>
            {todayCards[0].reversed ? todayCards[0].card.reversedMeaning : todayCards[0].card.uprightMeaning}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {!showReset ? (
              <button type="button" className="liquid-btn liquid-btn--sm" onClick={() => setShowReset(true)} style={{ flex: 1 }}>重新洗牌</button>
            ) : (
              <>
                <button type="button" className="liquid-btn liquid-btn--sm liquid-btn--danger" onClick={handleReset} style={{ flex: 1 }}>確認重置</button>
                <button type="button" className="liquid-btn liquid-btn--sm" onClick={() => setShowReset(false)} style={{ flex: 1 }}>取消</button>
              </>
            )}
          </div>
          {tarotHistory.length > 1 && (
            <details style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
              <summary style={{ cursor: 'pointer' }}>最近記錄</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {tarotHistory.slice(1, 8).map((h) => {
                  const fc = FULL_DECK.find((c) => c.id === h.cards[0]?.cardId);
                  return (
                    <div key={h.createdAt} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span>{h.date}</span>
                      <span>{fc?.nameZh || '?'} · {h.spread === 'single' ? '單張' : '三張'}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </>,
      );
    }
    // New draw: spread selector + start button
    return wrap(
      <>
        <div className="summary-cell-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, stroke: 'var(--text-2)', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div className="summary-cell-label">每日塔羅</div>
        <div className="summary-cell-value" style={{ fontSize: 15, color: 'var(--text-2)', fontWeight: 400 }}>今日尚未抽牌</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {SPREAD_OPTIONS.map((opt) => (
            <button key={opt.key} type="button"
              className={`theme-chip ${spread === opt.key ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setSpread(opt.key); }}
              style={{ fontSize: 11, padding: '4px 10px' }}>{opt.labelZh}</button>
          ))}
        </div>
        <button type="button" className="liquid-btn liquid-btn--sm liquid-btn--accent"
          onClick={(e) => { e.stopPropagation(); handleStartShuffle(); }}
          style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
          {spread === 'single' ? '開始洗牌 · 單張' : '開始洗牌'}
        </button>
      </>,
    );
  }

  /* ── Stage: shuffling ── */
  if (stage === 'shuffling') {
    return wrap(
      <div style={{ textAlign: 'center', padding: '20px 8px' }}>
        <div className="summary-cell-label" style={{ marginBottom: 14 }}>每日塔羅 · 洗牌中</div>
        {shufflePhase === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ transform: `translateY(${i % 2 === 0 ? -3 : 3}px)`, transition: 'transform 0.3s' }}>
                <CardBack size={40} />
              </div>
            ))}
          </div>
        )}
        {shufflePhase === 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{
                transform: `translateX(${(i - 2.5) * 4}px) rotate(${(i - 2.5) * 4}deg)`,
                transition: 'transform 0.4s', flexShrink: 0,
              }}><CardBack size={36} /></div>
            ))}
          </div>
        )}
        {shufflePhase === 2 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                transform: `rotate(${(i - 1) * 3}deg) scale(1.03)`,
                transition: 'transform 0.35s',
              }}><CardBack size={42} /></div>
            ))}
          </div>
        )}
        {shufflePhase === 3 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ transform: `rotate(${(i - 0.5) * 2}deg)`, transition: 'transform 0.3s' }}>
                <CardBack size={44} />
              </div>
            ))}
          </div>
        )}
        <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 12, fontStyle: 'italic' }}>
          {shufflePhase < 3 ? '洗牌中…' : '即將攤牌…'}
        </div>
      </div>,
    );
  }

  /* ── Stage: fan spread (cards face down, user clicks) ── */
  if (stage === 'fan' && drawn) {
    const count = drawn.length;
    const fanAngles = count === 1 ? [0] : count === 3 ? [-12, 0, 12] : [-10, 0, 10];
    return wrap(
      <div style={{ textAlign: 'center', padding: '12px 4px' }}>
        <div className="summary-cell-label" style={{ marginBottom: 14 }}>選擇一張牌</div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: count === 3 ? 8 : 16, minHeight: 120 }}>
          {drawn.map((_d, i) => (
            <div key={i}
              onClick={() => handleSelectCard(i)}
              style={{
                cursor: 'pointer', transition: 'transform 0.2s',
                transform: `rotate(${fanAngles[i]}deg)`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = `rotate(${fanAngles[i]}deg) translateY(-8px) scale(1.05)`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = `rotate(${fanAngles[i]}deg)`; }}
            >
              <CardBack size={count === 1 ? 72 : 56} />
            </div>
          ))}
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 10 }}>點擊牌背選擇</div>
      </div>,
    );
  }

  /* ── Stage: flipped (selected card flips, others remain) ── */
  if ((stage === 'flipped' || stage === 'result') && drawn && selectedIdx !== null) {
    const count = drawn.length;
    const fanAngles = count === 1 ? [0] : count === 3 ? [-12, 0, 12] : [-10, 0, 10];
    const positions = SPREAD_POSITIONS[spread];
    const selected = drawn[selectedIdx];

    return wrap(
      <div style={{ textAlign: 'center', padding: '12px 4px' }}>
        {stage === 'flipped' ? (
          <>
            <div className="summary-cell-label">翻牌中…</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
              {drawn.map((_d, i) => (
                <div key={i} style={{
                  transition: 'transform 0.6s',
                  transform: i === selectedIdx ? 'rotateY(0deg)' : `rotate(${fanAngles[i]}deg)`,
                }}>
                  {i === selectedIdx ? <CardFace card={selected.card} reversed={selected.reversed} size={64} /> : <CardBack size={56} />}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="summary-cell-label" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              <span>每日塔羅 · {selected.card.nameZh}</span>
              <span style={{ fontSize: 11, color: selected.reversed ? 'var(--coral)' : 'var(--teal)' }}>
                {selected.reversed ? '逆位' : '正位'}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <CardFace card={selected.card} reversed={selected.reversed} size={count === 1 ? 72 : 56} />
            </div>
            {/* Interpretation */}
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 10, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 10, fontStyle: 'italic', textAlign: 'left' }}>
              {selected.reversed ? selected.card.reversedMeaning : selected.card.uprightMeaning}
            </div>
            {/* Other cards if 3-card spread */}
            {count === 3 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
                {drawn.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', opacity: i === selectedIdx ? 1 : 0.65 }}>
                    <CardFace card={d.card} reversed={d.reversed} size={40} />
                    <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{positions[i]}</div>
                    <div style={{ fontSize: 8, color: d.reversed ? 'var(--coral)' : 'var(--teal)', fontWeight: 600 }}>
                      {d.reversed ? '逆' : '正'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {!showReset ? (
                <button type="button" className="liquid-btn liquid-btn--sm" onClick={() => setShowReset(true)} style={{ flex: 1 }}>重新洗牌</button>
              ) : (
                <>
                  <button type="button" className="liquid-btn liquid-btn--sm liquid-btn--danger" onClick={handleReset} style={{ flex: 1 }}>確認重置</button>
                  <button type="button" className="liquid-btn liquid-btn--sm" onClick={() => setShowReset(false)} style={{ flex: 1 }}>取消</button>
                </>
              )}
            </div>
            {tarotHistory.length > 1 && (
              <details style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
                <summary style={{ cursor: 'pointer' }}>最近記錄</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                  {tarotHistory.slice(1, 8).map((h) => {
                    const fc = FULL_DECK.find((c) => c.id === h.cards[0]?.cardId);
                    return (
                      <div key={h.createdAt} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>{h.date}</span>
                        <span>{fc?.nameZh || '?'} · {h.spread === 'single' ? '單張' : '三張'} · {h.cards[0]?.reversed ? '逆' : '正'}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </>
        )}
      </div>,
    );
  }

  return null;
}
