import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { sleepScoreLabel } from '@/utils/sleepReceipt';
import type { SleepReceipt } from '@/types';

interface SleepReceiptArchiveProps {
  onOpenReceipt: (id: string) => void;
  onExportPNG: (receipt: SleepReceipt) => void;
  onExportPDF: (receipt: SleepReceipt) => void;
  onSaveToSecondBrain: (id: string) => void;
  onDelete: (id: string) => void;
}

function ArchiveMenu({ onView, onExportPNG, onExportPDF, onDelete }: {
  onView: () => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="sleep-archive-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className="sleep-archive-menu-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="更多"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open && (
        <div className="sleep-archive-menu">
          <button type="button" className="sleep-archive-menu-item" onClick={() => { setOpen(false); onView(); }}>查看</button>
          <button type="button" className="sleep-archive-menu-item" onClick={() => { setOpen(false); onExportPNG(); }}>輸出 PNG</button>
          <button type="button" className="sleep-archive-menu-item" onClick={() => { setOpen(false); onExportPDF(); }}>輸出 PDF</button>
          <hr className="sleep-archive-menu-sep" />
          <button type="button" className="sleep-archive-menu-item sleep-archive-menu-item--danger" onClick={() => { setOpen(false); onDelete(); }}>刪除</button>
        </div>
      )}
    </div>
  );
}

function formatMin(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
}

export function SleepReceiptArchive({
  onOpenReceipt,
  onExportPNG,
  onExportPDF,
  onSaveToSecondBrain,
  onDelete,
}: SleepReceiptArchiveProps) {
  const sleepReceipts = useAppStore((s) => s.sleepReceipts);

  const sortedReceipts = useMemo(
    () => [...sleepReceipts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [sleepReceipts],
  );

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const todayReceipts = useMemo(() => sortedReceipts.filter((r) => r.date === todayStr), [sortedReceipts, todayStr]);
  const historyReceipts = useMemo(() => sortedReceipts.filter((r) => r.date !== todayStr), [sortedReceipts, todayStr]);

  const [subTab, setSubTab] = useState<'today' | 'history'>('today');

  const displayed = subTab === 'today' ? todayReceipts : historyReceipts;

  return (
    <section className="sleep-archive">
      <header className="sleep-archive-head">
        <div>
          <span className="sleep-archive-kicker">Sleep Receipt Archive</span>
          <h2>睡眠收據 / Sleep Receipts</h2>
        </div>
        <span className="sleep-archive-count">{sleepReceipts.length} 張收據</span>
      </header>

      {/* Sub-tabs */}
      <nav className="sleep-archive-tabs">
        <button
          type="button"
          className={subTab === 'today' ? 'active' : ''}
          onClick={() => setSubTab('today')}
        >
          今日
          {todayReceipts.length > 0 && <span>{todayReceipts.length}</span>}
        </button>
        <button
          type="button"
          className={subTab === 'history' ? 'active' : ''}
          onClick={() => setSubTab('history')}
        >
          歷史收據
          {historyReceipts.length > 0 && <span>{historyReceipts.length}</span>}
        </button>
      </nav>

      {displayed.length === 0 ? (
        <div className="sleep-archive-empty">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity={0.35}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="13" y2="17" />
          </svg>
          <p>
            {subTab === 'today' ? '今日尚未生成睡眠收據。' : '尚無歷史收據。'}
          </p>
        </div>
      ) : (
        <div className="sleep-archive-list">
          {displayed.map((receipt) => (
            <article key={receipt.id} className="sleep-archive-item">
              <button
                type="button"
                className="sleep-archive-open"
                onClick={() => onOpenReceipt(receipt.id)}
              >
                <div className="sleep-archive-date">
                  <span>Sleep Receipt</span>
                  <strong>{receipt.date}</strong>
                </div>
                <div className="sleep-archive-stats">
                  <span>Score<strong>{receipt.sleepScore}</strong></span>
                  <span>睡眠<strong>{formatMin(receipt.totalSleep)}</strong></span>
                  <span>深睡<strong>{receipt.deepMinutes}m</strong></span>
                  <span>REM<strong>{receipt.remMinutes}m</strong></span>
                </div>
                <svg className="sleep-archive-chevron" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <ArchiveMenu
                onView={() => onOpenReceipt(receipt.id)}
                onExportPNG={() => onExportPNG(receipt)}
                onExportPDF={() => onExportPDF(receipt)}
                onDelete={() => onDelete(receipt.id)}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
