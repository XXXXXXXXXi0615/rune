import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SleepReceipt } from '@/types';
import { sleepScoreLabel } from '@/utils/sleepReceipt';

interface SleepReceiptPrinterProps {
  receipt: SleepReceipt;
  onSave: (id: string) => void;
  onShare: (receipt: SleepReceipt) => void;
  onClose: () => void;
}

export function SleepReceiptPrinter({
  receipt,
  onSave,
  onShare,
  onClose,
}: SleepReceiptPrinterProps) {
  const [phase, setPhase] = useState<'feed' | 'show'>('feed');

  useEffect(() => {
    document.body.classList.add('sheet-open');
    const timer = setTimeout(() => setPhase('show'), 1200);
    return () => {
      document.body.classList.remove('sheet-open');
      clearTimeout(timer);
    };
  }, []);

  const label = sleepScoreLabel(receipt.sleepScore);

  return createPortal(
    <div className="sleep-printer-overlay">
      <div className="sleep-printer-machine" onClick={(e) => e.stopPropagation()}>
        {/* Machine body */}
        <div className="sleep-printer-top">
          <span className="sleep-printer-light" />
          <span className="sleep-printer-slot-label">LUNARIS SLEEP PRINTER</span>
        </div>
        <div className="sleep-printer-slot">
          {/* Paper feeds out */}
          <div className={`sleep-printer-paper ${phase === 'show' ? 'fed' : ''}`}>
            <div className="sleep-printer-paper-inner">
              <div className="sleep-receipt-kicker">SLEEP RECEIPT</div>
              <h1>{receipt.date}</h1>
              <hr />

              {/* Score */}
              <div className="sleep-printer-score">
                <strong>{receipt.sleepScore}</strong>
                <span>sleep score · {label}</span>
              </div>

              {/* Stats */}
              <div className="sleep-printer-stats">
                <span>總睡眠 <b>{Math.floor(receipt.totalSleep / 60)}h{receipt.totalSleep % 60}m</b></span>
                <span>深睡 <b>{receipt.deepMinutes}m</b></span>
                <span>REM <b>{receipt.remMinutes}m</b></span>
                <span>核心 <b>{receipt.coreMinutes}m</b></span>
                <span>清醒 <b>{receipt.awakeMinutes}m</b></span>
              </div>

              {/* Comment */}
              <blockquote>{receipt.lunarisComment}</blockquote>

              {/* Barcode */}
              <div className="sleep-printer-barcode">
                {Array.from({ length: 22 }, (_, i) => <span key={i} />)}
              </div>
              <div className="sleep-printer-footer">謝謝你記錄今晚的自己</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {phase === 'show' && (
          <div className="sleep-printer-actions">
            <button
              type="button"
              className="sleep-printer-action"
              onClick={() => onSave(receipt.id)}
              disabled={!!receipt.savedToSecondBrainAt}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {receipt.savedToSecondBrainAt ? '已儲存' : '存入第二大腦'}
            </button>
            <button type="button" className="sleep-printer-action" onClick={() => onShare(receipt)}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
            <button type="button" className="sleep-printer-action sleep-printer-action--close" onClick={onClose}>
              關閉
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
