import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCycleSnapshot, type CycleSnapshot } from '@/features/period/getCycleSnapshot';
import { getCyclePhaseLabel, getPeriodMoodLabel, getTideLevelLabel } from '@/features/period/periodLabels';
import { CYCLE_PHASE_COLOR } from '@/components/period/CycleTrendStrip';
import { CycleTrendStrip } from '@/components/period/CycleTrendStrip';
import { loadPeriodRecords, deletePeriodRecord } from '@/utils/periodStorage';
import { deleteTicketsForRecord } from '@/features/period/ticketStorage';
import type { PeriodUndoEntry } from '@/utils/periodStorage';
import { simpleHash } from '@/utils/hash';
import { toLocalDateString } from '@/utils/date';
import './CycleTrendCard.css';

function TideIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M4 16c4-6 8-6 12 0" opacity={0.3} />
      <path d="M6 20c4-6 8-6 12 0" opacity={0.6} />
      <path d="M4 24c4-6 8-6 12 0" opacity={1} />
    </svg>
  );
}

function ThreeDotIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export function CycleTrendCard() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const snapshot: CycleSnapshot = useMemo(() => getCycleSnapshot(), [tick]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [undoData, setUndoData] = useState<PeriodUndoEntry | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<{ recordId: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<ReturnType<typeof setTimeout>>(null);
  const undoErrorRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const onUpdated = () => setTick(t => t + 1);
    window.addEventListener('period-records-updated', onUpdated);
    return () => window.removeEventListener('period-records-updated', onUpdated);
  }, []);

  // Check for undo data on mount + listen for fresh undo
  useEffect(() => {
    const checkUndo = () => {
      try {
        const stored = localStorage.getItem('period_undo');
        if (stored) {
          const parsed: PeriodUndoEntry = JSON.parse(stored);
          const now = Date.now();
          if (now < parsed.expiresAt) {
            setUndoData(parsed);
            const remaining = parsed.expiresAt - now;
            if (undoRef.current) clearTimeout(undoRef.current);
            undoRef.current = setTimeout(() => {
              localStorage.removeItem('period_undo');
              setUndoData(null);
            }, remaining);
          } else {
            // Expired — clear stale entry
            localStorage.removeItem('period_undo');
          }
        }
      } catch {}
    };
    checkUndo();
    window.addEventListener('period-undo-ready', checkUndo);
    return () => {
      window.removeEventListener('period-undo-ready', checkUndo);
      if (undoRef.current) clearTimeout(undoRef.current);
      if (undoErrorRef.current) clearTimeout(undoErrorRef.current);
    };
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleClick = () => navigate('/period');

  const phaseLabel = getCyclePhaseLabel(snapshot.status);
  const phaseColor = CYCLE_PHASE_COLOR[snapshot.status] || '#888';

  const todayStr = toLocalDateString(new Date());
  const todayRecord = useMemo(() => {
    const records = loadPeriodRecords();
    return records.find(r => r.startDate === todayStr || (r.startDate <= todayStr && r.endDate >= todayStr)) || null;
  }, [tick, todayStr]);

  const latestRecord = useMemo(() => {
    const records = loadPeriodRecords();
    return records.sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  }, [tick]);

  const handleUndo = () => {
    if (!undoData) return;

    // Check expiration
    if (Date.now() > undoData.expiresAt) {
      localStorage.removeItem('period_undo');
      if (undoRef.current) clearTimeout(undoRef.current);
      setUndoData(null);
      return;
    }

    // Verify current state matches post-save state (concurrency guard)
    const currentSnapshot = JSON.stringify(loadPeriodRecords());
    const currentHash = simpleHash(currentSnapshot);

    if (currentHash !== undoData.afterSnapshotHash) {
      // Records changed since save — cannot safely undo
      setUndoError('記錄已經發生變化，無法安全撤銷');
      localStorage.removeItem('period_undo');
      if (undoRef.current) clearTimeout(undoRef.current);
      setUndoData(null);
      if (undoErrorRef.current) clearTimeout(undoErrorRef.current);
      undoErrorRef.current = setTimeout(() => setUndoError(null), 3000);
      return;
    }

    // Hash matches — safe to restore beforeSnapshot
    try {
      const prev = JSON.parse(undoData.beforeSnapshot);
      localStorage.setItem('lunartide_period_records_v1', JSON.stringify(prev));
    } catch {}
    localStorage.removeItem('period_undo');
    if (undoRef.current) clearTimeout(undoRef.current);
    setUndoData(null);
    setTick(t => t + 1);
    window.dispatchEvent(new CustomEvent('period-records-updated'));
  };

  const handleDeleteLatest = () => {
    if (!latestRecord) return;
    deleteTicketsForRecord(latestRecord.id);
    deletePeriodRecord(latestRecord.id);
    localStorage.removeItem('period_undo');
    if (undoRef.current) clearTimeout(undoRef.current);
    setUndoData(null);
    setConfirmClear(null);
    setMenuOpen(false);
    setTick(t => t + 1);
    window.dispatchEvent(new CustomEvent('period-records-updated'));
  };

  const dayText = snapshot.periodDay && snapshot.periodDay > 0
    ? `第 ${snapshot.periodDay} 天`
    : `第 ${snapshot.cycleDay} 天`;

  if (snapshot.status === 'no-data') {
    return (
      <div className="ctc-card ctc-empty" onClick={handleClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') handleClick(); }}>
        <div className="ctc-header">
          <span className="ctc-kicker">今日潮汐</span>
          <span className="ctc-chevron">&rsaquo;</span>
        </div>
        <div className="ctc-empty-body">
          <TideIcon />
          <p className="ctc-empty-title">尚未建立週期紀錄</p>
          <p className="ctc-empty-sub">開始記錄後 LUNARIS 會幫你追蹤週期趨勢</p>
          <span className="ctc-start-btn">開始記錄</span>
        </div>
      </div>
    );
  }

  if (snapshot.confidence === 'low' && snapshot.cycleDay && snapshot.cycleDay > 30) {
    return (
      <div className="ctc-card ctc-empty" onClick={handleClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') handleClick(); }}>
        <div className="ctc-header">
          <span className="ctc-kicker">今日潮汐</span>
          <span className="ctc-chevron">&rsaquo;</span>
        </div>
        <div className="ctc-empty-body">
          <TideIcon />
          <p className="ctc-empty-title">再記錄幾次</p>
          <p className="ctc-empty-sub">LUNARIS 才能看見你的週期趨勢</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ctc-card" onClick={handleClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') handleClick(); }}>
      <div className="ctc-header">
        <span className="ctc-kicker">今日潮汐</span>
        <div className="ctc-header-right">
          {menuOpen && (
            <div className="ctc-menu-overlay" onClick={() => setMenuOpen(false)} />
          )}
          <div className="ctc-menu-wrap" ref={menuRef}>
            <button type="button" className="ctc-menu-btn" onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }} aria-label="更多選項">
              <ThreeDotIcon />
            </button>
            {menuOpen && (
              <div className="ctc-menu-dropdown" onClick={e => e.stopPropagation()}>
                {todayRecord ? (
                  <>
                    <button type="button" className="ctc-menu-item" onClick={() => { setMenuOpen(false); navigate('/period'); }}>編輯今日記錄</button>
                    {latestRecord && (
                      <button type="button" className="ctc-menu-item ctc-menu-item--danger" onClick={() => { setMenuOpen(false); setConfirmClear({ recordId: latestRecord.id }); }}>撤銷最近一次記錄</button>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" className="ctc-menu-item" onClick={() => { setMenuOpen(false); navigate('/period'); }}>查看週期記錄</button>
                    {latestRecord && (
                      <>
                        <button type="button" className="ctc-menu-item" onClick={() => { setMenuOpen(false); navigate('/period'); }}>編輯最近記錄</button>
                        <button type="button" className="ctc-menu-item ctc-menu-item--danger" onClick={() => { setMenuOpen(false); setConfirmClear({ recordId: latestRecord.id }); }}>刪除最近記錄</button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ctc-detail">
        <div className="ctc-main">
          <span className="ctc-phase" style={{ color: phaseColor }}>{phaseLabel} · {dayText}</span>
        </div>

        {snapshot.predictedNextStart && snapshot.predictedDaysRemaining != null && (
          <div className="ctc-next">
            <span className="ctc-next-label">
              預估 {snapshot.predictedDaysRemaining} 天後進入下一週期
            </span>
            {snapshot.confidence === 'low' && (
              <span className="ctc-confidence">依目前紀錄推估</span>
            )}
          </div>
        )}
      </div>

      {(snapshot.currentMood || snapshot.currentTide) && (
        <div className="ctc-footer">
          {snapshot.currentMood && (
            <span className="ctc-mood">今日心情：{getPeriodMoodLabel(snapshot.currentMood)}</span>
          )}
          {snapshot.currentTide && (
            <span className="ctc-tide">今日潮位：{getTideLevelLabel(snapshot.currentTide)}</span>
          )}
        </div>
      )}

      {snapshot.trend.length > 0 && (
        <div className="ctc-trend">
          <CycleTrendStrip snapshot={snapshot} variant="compact" />
        </div>
      )}

      {/* Undo Toast */}
      {undoData && (
        <div className="ctc-undo-toast" onClick={e => e.stopPropagation()}>
          <span className="ctc-undo-toast-msg">已記錄今日潮位</span>
          <button type="button" className="ctc-undo-toast-btn" onClick={(e) => { e.stopPropagation(); handleUndo(); }}>撤銷</button>
        </div>
      )}

      {/* Undo Error (concurrent modification) */}
      {undoError && (
        <div className="ctc-undo-toast ctc-undo-toast--error" onClick={e => e.stopPropagation()}>
          <span className="ctc-undo-toast-msg">{undoError}</span>
        </div>
      )}

      {/* Confirmation Sheet */}
      {confirmClear && (
        <div className="ctc-confirm-overlay" onClick={() => setConfirmClear(null)}>
          <div className="ctc-confirm-sheet" onClick={e => e.stopPropagation()}>
            <h3 className="ctc-confirm-title">撤銷這次潮汐記錄？</h3>
            <p className="ctc-confirm-desc">這會移除該日期範圍內的心情、潮位與症狀記錄。</p>
            <div className="ctc-confirm-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmClear(null)}>保留記錄</button>
              <button type="button" className="btn-primary" style={{ background: 'var(--danger)' }} onClick={handleDeleteLatest}>確認撤銷</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
