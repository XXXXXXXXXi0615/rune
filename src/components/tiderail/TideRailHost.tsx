import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { selectActiveMainline, selectOpenDriftCount, useTideRailStore, type TideRailProposal } from '@/store/useTideRailStore';
import './TideRailOrb.css';

const isToday = (timestamp: string) => {
  const date = new Date(timestamp);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};

/** Global TideRail coordinator and quick controller. It never owns navigation. */
export function TideRailHost() {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const dragStartY = useRef<number | null>(null);
  const active = useTideRailStore(selectActiveMainline);
  const driftCount = useTideRailStore(selectOpenDriftCount);
  const driftItems = useTideRailStore((state) => state.driftItems);
  const proposals = useTideRailStore((state) => state.proposals);
  const acceptProposal = useTideRailStore((state) => state.acceptProposal);
  const deferProposal = useTideRailStore((state) => state.deferProposal);
  const skipProposal = useTideRailStore((state) => state.skipProposal);
  const pending = useMemo(
    () => proposals.filter((proposal) => !proposal.decision && !['completed', 'superseded'].includes(proposal.status)),
    [proposals],
  );
  const todayDriftCount = useMemo(
    () => driftItems.filter((item) => item.status !== 'resolved' && isToday(item.createdAt)).length,
    [driftItems],
  );

  const closePalette = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => orbRef.current?.focus());
  };

  useEffect(() => {
    const capture = (state: ReturnType<typeof useFocusSessionStore.getState>) => {
      const settlement = state.lastSettlement;
      if (!settlement?.sessionId) return;
      useTideRailStore.getState().recordSessionClosure({
        sessionId: settlement.sessionId,
        outcome: settlement.outcome,
        sessionTask: state.task,
      });
    };
    capture(useFocusSessionStore.getState());
    return useFocusSessionStore.subscribe((state, previous) => {
      if (state.lastSettlement?.sessionId !== previous.lastSettlement?.sessionId) capture(state);
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        closePalette();
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 'j') return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      if (!hostRef.current?.contains(event.target as Node)) closePalette();
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open]);

  useEffect(() => {
    if (!open || window.innerWidth >= 768) return;
    let removeListener: (() => Promise<void>) | undefined;
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('backButton', () => closePalette());
      removeListener = () => handle.remove();
    });
    return () => { void removeListener?.(); };
  }, [open]);

  const actOnProposal = (proposal: TideRailProposal, action: 'accept' | 'defer' | 'skip') => {
    if (action === 'accept') acceptProposal(proposal.id);
    else if (action === 'defer') deferProposal(proposal.id);
    else skipProposal(proposal.id);
  };

  return (
    <div className="tiderail-quick" ref={hostRef} data-open={open || undefined}>
      <button
        ref={orbRef}
        type="button"
        className="tiderail-orb"
        aria-label={open ? '關閉潮軌快捷面板' : '開啟潮軌快捷面板'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        data-testid="tiderail-orb"
      >
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle className="tiderail-orb__outer" cx="24" cy="24" r="20" />
          {driftCount > 0 && <path className="tiderail-orb__drift" d="M39.8 11.7a20 20 0 0 1 3.8 13.8" />}
          <path className="tiderail-orb__moon" d="M28.5 13.5a12 12 0 1 0 6 21.2 10.5 10.5 0 1 1-6-21.2Z" />
          <path className="tiderail-orb__tide" d="M15 28.5c3-2.2 5.9-2.2 8.8 0s5.8 2.2 9.2 0" />
        </svg>
        {pending.length > 0 && <span className="tiderail-orb__status" aria-hidden="true" />}
      </button>

      {open && (
        <section
          className="tiderail-palette"
          role="dialog"
          aria-label="潮軌快捷面板"
          data-testid="tiderail-palette"
        >
          <div
            className="tiderail-palette__grab"
            aria-hidden="true"
            onPointerDown={(event) => { dragStartY.current = event.pointerType === 'touch' ? event.clientY : null; }}
            onPointerUp={(event) => {
              if (dragStartY.current !== null && event.clientY - dragStartY.current > 72) closePalette();
              dragStartY.current = null;
            }}
          />
          <header className="tiderail-palette__header">
            <div><small>TIDERAIL</small><h2>潮軌</h2></div>
            <button type="button" onClick={() => closePalette()} aria-label="關閉潮軌快捷面板">×</button>
          </header>

          <div className="tiderail-palette__scroll">
            <section className="tiderail-palette__card">
              <span>主線</span>
              <strong>{active?.title || '尚未指定'}</strong>
              {active && <small>{active.acceptanceCriteria.filter((item) => item.completed).length}/{active.acceptanceCriteria.length} 已完成</small>}
              {!active && <button type="button" disabled={!pending.length} onClick={() => document.querySelector('.tiderail-palette__pending')?.scrollIntoView({ block: 'nearest' })}>指定主線</button>}
            </section>

            <div className="tiderail-palette__split">
              <section><span>偏航</span><strong>{todayDriftCount}</strong><small>今日次數</small></section>
              <section><span>今日規矩</span><p>只守一條主線；P2／P3 先收進偏航。</p></section>
            </div>

            {pending.length > 0 && (
              <section className="tiderail-palette__pending">
                <header><span>待決提案</span><small>{pending.length} 項</small></header>
                {pending.slice(0, 3).map((proposal) => (
                  <article key={proposal.id}>
                    <strong>{proposal.title}</strong>
                    <small>{proposal.priority}</small>
                    <div>
                      <button type="button" onClick={() => actOnProposal(proposal, 'accept')}>接受</button>
                      <button type="button" onClick={() => actOnProposal(proposal, 'defer')}>稍後處理</button>
                      <button type="button" onClick={() => actOnProposal(proposal, 'skip')}>略過</button>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
