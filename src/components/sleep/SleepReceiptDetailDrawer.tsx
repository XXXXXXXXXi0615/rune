import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { sleepScoreLabel } from '@/utils/sleepReceipt';
import type { SleepReceipt } from '@/types';

interface SleepReceiptDetailDrawerProps {
  receipt: SleepReceipt;
  onClose: () => void;
  onExportPNG: (receipt: SleepReceipt) => void;
  onExportPDF: (receipt: SleepReceipt) => void;
  onSaveToSecondBrain: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SleepReceiptDetailDrawer({
  receipt,
  onClose,
  onExportPNG,
  onExportPDF,
  onSaveToSecondBrain,
  onDelete,
}: SleepReceiptDetailDrawerProps) {
  const label = sleepScoreLabel(receipt.sleepScore);
  const scoreColor = receipt.sleepScore >= 80 ? 'var(--success)' : receipt.sleepScore >= 60 ? 'var(--sleep-blue)' : receipt.sleepScore >= 40 ? 'var(--sleep-lilac)' : 'var(--danger)';

  useEffect(() => {
    document.body.classList.add('sheet-open');
    return () => document.body.classList.remove('sheet-open');
  }, []);

  return (
    <div className="sleep-receipt-drawer-backdrop" onClick={onClose}>
      <aside className="sleep-receipt-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="sleep-receipt-drawer-head">
          <div>
            <span className="sleep-receipt-kicker">SLEEP RECEIPT</span>
            <h2>{receipt.date}</h2>
          </div>
          <button type="button" className="sleep-sheet-close" onClick={onClose} aria-label="關閉">&#x2715;</button>
        </header>

        {/* Score ring */}
        <div className="sleep-receipt-detail-score">
          <div className="sleep-receipt-score-ring" style={{ borderColor: scoreColor, color: scoreColor }}>
            <strong>{receipt.sleepScore}</strong>
            <small>{label}</small>
          </div>
          <div className="sleep-receipt-score-meta">
            <span>總睡眠</span>
            <strong>{Math.floor(receipt.totalSleep / 60)}h{receipt.totalSleep % 60 > 0 ? receipt.totalSleep % 60 + 'm' : ''}</strong>
          </div>
        </div>

        {/* Stage breakdown */}
        <section className="sleep-receipt-detail-section">
          <h3>睡眠階段 / Sleep Stages</h3>
          <div className="sleep-receipt-detail-stages">
            <div className="sleep-receipt-stage" data-tone="deep">
              <i style={{ background: '#4a5d9e' }} />
              <span>深睡</span>
              <strong>{receipt.deepMinutes}<small>m</small></strong>
            </div>
            <div className="sleep-receipt-stage" data-tone="rem">
              <i style={{ background: '#7fc1d9' }} />
              <span>REM</span>
              <strong>{receipt.remMinutes}<small>m</small></strong>
            </div>
            <div className="sleep-receipt-stage" data-tone="core">
              <i style={{ background: '#5b8ec9' }} />
              <span>核心</span>
              <strong>{receipt.coreMinutes}<small>m</small></strong>
            </div>
            <div className="sleep-receipt-stage" data-tone="awake">
              <i style={{ background: '#e8b4a0' }} />
              <span>清醒</span>
              <strong>{receipt.awakeMinutes}<small>m</small></strong>
            </div>
          </div>
        </section>

        {/* Agent comment */}
        <section className="sleep-receipt-detail-section">
          <h3>月潮訊息</h3>
          <div className="sleep-receipt-comment">
            {receipt.lunarisComment}
          </div>
        </section>

        {/* Actions */}
        <footer className="sleep-receipt-drawer-actions">
          <button
            type="button"
            className="sleep-receipt-save-btn"
            onClick={() => onSaveToSecondBrain(receipt.id)}
            disabled={!!receipt.savedToSecondBrainAt}
          >
            {receipt.savedToSecondBrainAt ? '已存入第二大腦' : '存入第二大腦'}
          </button>
          <div className="sleep-receipt-export-group">
            <button
              type="button"
              className="sleep-receipt-export-btn"
              onClick={() => onExportPNG(receipt)}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              PNG
            </button>
            <button
              type="button"
              className="sleep-receipt-export-btn"
              onClick={() => onExportPDF(receipt)}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              PDF
            </button>
          </div>
          <button
            type="button"
            className="sleep-receipt-delete-btn"
            onClick={() => onDelete(receipt.id)}
          >
            刪除收據
          </button>
        </footer>
      </aside>
    </div>
  );
}
