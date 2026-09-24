import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusWitnessStore } from '@/store/useFocusWitnessStore';
import { computeMoonDewBalance } from '@/utils/moonDewEngine';
import { PetSprite } from '@/components/pet/PetSprite';
import '@/components/focus/tidebound.css';

interface FocusSettlementProps {
  outcome: 'completed' | 'early_exit' | 'abandoned' | 'interrupted';
  onViewStatistics: () => void;
}

function StatusBadge({ outcome }: { outcome: string }) {
  const config: Record<string, { title: string; sub: string; color: string }> = {
    completed: { title: '守約完成', sub: '這輪算你沒偷懶。', color: '#5DB8A6' },
    early_exit: { title: '提前退潮', sub: '這輪先停在這裡，已完成的部分還在。', color: '#d87c4c' },
    interrupted: { title: '本輪中斷', sub: '節奏斷了一下，記錄仍然留著。', color: '#d87c4c' },
    abandoned: { title: '提前退潮', sub: '這輪沒有走完，下次再把潮線接回來。', color: '#d87c4c' },
  };
  const cfg = config[outcome] || config.interrupted;
  return (
    <div className="tb-settlement-status">
      <h3 className="tb-settlement-status-title" style={{ color: cfg.color }}>{cfg.title}</h3>
      <p className="tb-settlement-status-sub">{cfg.sub}</p>
    </div>
  );
}

const INTERRUPTED_COMMENTS = [
  '這輪先停在這裡，已經做過的部分不會消失。',
  '潮線斷了一次，下次從還記得的位置接回來。',
  '沒有走完整輪，但誠實停下也算留下了座標。',
  '先收好這次中斷，下一輪不用從零開始。',
];

function SelfReportSection({ settlement, onReport }: {
  settlement: ReturnType<typeof useFocusSessionStore.getState>['lastSettlement'];
  onReport: (report: string) => void;
}) {
  const [reported, setReported] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const witnessEnabled = useFocusWitnessStore((s) => s.witnessEnabled);

  if (reported || settlement?.selfReport || settlement?.memorySaved) {
    return (
      <div className="tb-self-report">
        <div className="tb-self-report-done">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>已存入記憶庫</span>
        </div>
      </div>
    );
  }

  if (!witnessEnabled) return null;

  const handleClick = (report: string) => {
    setSelected(report);
    setReported(true);
    onReport(report);
  };

  return (
    <div className="tb-self-report">
      <div className="tb-self-report-title">這輪有完成原本要做的事嗎？</div>
      <div className="tb-self-report-options">
        <button type="button" className={`tb-sr-btn${selected === 'completed' ? ' tb-sr-btn--active' : ''}`} onClick={() => handleClick('completed')}>有完成</button>
        <button type="button" className={`tb-sr-btn${selected === 'partial' ? ' tb-sr-btn--active' : ''}`} onClick={() => handleClick('partial')}>只完成一部分</button>
        <button type="button" className={`tb-sr-btn${selected === 'none' ? ' tb-sr-btn--active' : ''}`} onClick={() => handleClick('none')}>沒有</button>
      </div>
    </div>
  );
}

function getMoonDewEmptyReason(
  outcome: string,
  balance: number,
): string {
  if (outcome === 'completed' && balance <= 0) return '今日獎勵已達上限或當前月印不足';
  if (outcome === 'abandoned' && balance <= 0) return '當前月印不足，受到餘額保護';
  if (outcome === 'early_exit' && balance <= 0) return '當前月印不足，受到餘額保護';
  return '';
}

export function FocusSettlement({ outcome, onViewStatistics }: FocusSettlementProps) {
  const session = useFocusSessionStore((s) => s);
  const settlement = session.lastSettlement;
  const saveSelfReport = useFocusSessionStore((s) => s.saveSelfReport);

  const moonDewLedger = useAppStore((s) => s.moonDewLedger || []);
  const currentBalance = useMemo(() => computeMoonDewBalance(moonDewLedger), [moonDewLedger]);

  const entries = settlement?.entries || [];
  const balanceAfter = settlement?.balanceAfter ?? currentBalance;
  const interruptedComment = INTERRUPTED_COMMENTS[Math.abs(settlement?.timestamp ?? 0) % INTERRUPTED_COMMENTS.length];

  /* ── Planned vs Actual from elapsedFocusSeconds ── */
  const plannedMinutes = session.durationMinutes * Math.max(1, session.rounds);
  const actualMinutes = session.elapsedFocusSeconds > 0
    ? Math.round(session.elapsedFocusSeconds / 60)
    : 0;

  const dateStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  const endReason: Record<string, string> = {
    completed: '守約完成',
    early_exit: '提早離開',
    abandoned: '放棄',
    interrupted: '中斷',
  };

  const emptyReason = useMemo(() => getMoonDewEmptyReason(outcome, currentBalance), [outcome, currentBalance]);

  const totalPlanned = session.durationMinutes * Math.max(1, session.rounds);

  /* ── Settlement view ── */
  return (
    <div className="tb-settlement-scroll-body">
      <div className="tb-settlement-receipt">
        <div className="tb-settlement-pet" aria-hidden="true">
          <PetSprite animationId={outcome === 'completed' ? 'cheer-happy' : outcome === 'abandoned' ? 'idle-sad' : 'idle-tired'} loop={outcome === 'completed' ? false : undefined} />
        </div>
        <StatusBadge outcome={outcome} />
        <div className="tb-settlement-date">{dateStr}</div>
        <div className="tb-settlement-divider" />

          <div className="tb-settlement-summary">
            <div className="tb-summary-row">
              <span className="tb-summary-label">計劃時長</span>
              <span className="tb-summary-value">{plannedMinutes} 分鐘</span>
            </div>
            <div className="tb-summary-row">
              <span className="tb-summary-label">實際專注</span>
              <span className="tb-summary-value tb-summary-value--accent">{actualMinutes} 分鐘</span>
            </div>
            <div className="tb-summary-row">
              <span className="tb-summary-label">完成輪數</span>
              <span className="tb-summary-value">{session.roundsCompleted} / {session.rounds || 1}</span>
            </div>
            {session.pauseCount > 0 && (
              <div className="tb-summary-row">
                <span className="tb-summary-label">暫停次數</span>
                <span className="tb-summary-value">{session.pauseCount}</span>
              </div>
            )}
            <div className="tb-summary-row">
              <span className="tb-summary-label">結束原因</span>
              <span className="tb-summary-value">{endReason[outcome] || outcome}</span>
            </div>
          </div>

          <div className="tb-settlement-divider" />

          <div className="tb-dew-section">
            <div className="tb-dew-title">月印積分明細</div>
            {entries.length === 0 ? (
              <div className="tb-dew-empty">
                <span>本輪未產生月印變動</span>
                {emptyReason && <div className="tb-dew-empty-reason">{emptyReason}</div>}
              </div>
            ) : (
              <div className="tb-dew-list">
                {entries.map((entry) => {
                  const meta = entry.metadata as Record<string, unknown> | undefined;
                  const requestedAmount = typeof meta?.requestedAmount === 'number' ? meta.requestedAmount : null;
                  const appliedAmount = typeof meta?.appliedAmount === 'number' ? meta.appliedAmount : null;
                  const isClamped = requestedAmount !== null && appliedAmount !== null && requestedAmount !== appliedAmount;

                  return (
                    <div key={entry.id} className={`tb-dew-row${entry.amount < 0 ? ' is-negative' : ''}`}>
                      <div className="tb-dew-info">
                        <span className="tb-dew-label">{entry.title}</span>
                        {isClamped && (
                          <span className="tb-dew-clamped">
                            {requestedAmount! > 0
                              ? `規則 +${requestedAmount} · 上限後實得 +${appliedAmount}`
                              : `規則 −${Math.abs(requestedAmount!)} · 餘額保護後實扣 −${Math.abs(appliedAmount!)}`}
                          </span>
                        )}
                      </div>
                      <span className="tb-dew-amount">{entry.amount > 0 ? '+' : ''}{entry.amount}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="tb-dew-total">
            <span className="tb-dew-total-label">本輪合計</span>
            <span className={`tb-dew-total-value${(settlement?.total ?? 0) < 0 ? ' is-negative' : ''}`}>
              {(settlement?.total ?? 0) > 0 ? '+' : ''}{settlement?.total ?? 0}
            </span>
          </div>

          <div className="tb-dew-balance">
            <span className="tb-dew-balance-label">目前月印</span>
            <span className="tb-dew-balance-value">{balanceAfter}</span>
          </div>

          <div className="tb-clawd-comment">
            <span className="tb-clawd-comment-icon">
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
              </svg>
            </span>
            <span className="tb-clawd-comment-text">
              {outcome === 'completed'
                ? session.flags.goodRecovery
                  ? '暫停後仍守住了約定，值得尊敬。'
                  : session.flags.honestCompletion
                    ? '誠實記錄也是一種守約。'
                    : '這輪專注的質量，月潮都記下了。'
                : outcome === 'abandoned'
                  ? interruptedComment
                  : session.flags.earlyEscape
                    ? '提早離開了，但已經完成的部份有價值。'
                    : '記下了這次中斷，下一輪再試試。'}
            </span>
          </div>

          <SelfReportSection settlement={settlement} onReport={saveSelfReport} />
        </div>
      </div>
    );
}
