import { Component, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ITERATIONS, RELEASE_NOTICES } from '@/config/releaseNotices';
import { buildTideRailProposals } from '@/features/tiderail/tideRailSources';
import { useQuestStore } from '@/store/useQuestStore';
import { selectActiveMainline, useTideRailStore, type TideRailPriority, type TideRailProposal } from '@/store/useTideRailStore';
import './TideRail.css';
import './TideRailProviderRuntime.css';

/** Human-readable category labels — internal enum values stay in details. */
const categoryLabel: Record<string, string> = {
  feature: '功能提案',
  bugfix: '缺陷修正',
  improvement: '改善項目',
  technical_debt: '技術債務',
};

const statusLabel: Record<string, string> = {
  open: '待審議',
  advisory_open: '待徵詢',
  adjudicating: '裁決中',
  decided: '已裁決',
  adopted: '已採納',
  completed: '已結案',
  superseded: '已取代',
};

function iterationLabel(refId: string): string {
  const m = refId.match(/iter-(\d+)/);
  return m ? `Sprint ${m[1]}` : refId;
}

function sourceSummary(proposal: TideRailProposal): string {
  return proposal.sourceRefs.map((ref) => {
    if (ref.type === 'iteration') return `來源：${iterationLabel(ref.id)}`;
    if (ref.type === 'quest') return `任務：${ref.id}`;
    return `${ref.type}:${ref.id}`;
  }).join(' · ');
}

class ProposalBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <article className="tr-proposal-card" role="alert">這張提案無法解析；其他裁決仍可繼續。</article>
      : this.props.children;
  }
}

export function TideRailTabContent({ composerOpen = false, onComposerClose = () => {} }: { composerOpen?: boolean; onComposerClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const store = useTideRailStore();
  const quests = useQuestStore((state) => state.quests);
  const active = selectActiveMainline(store);
  const activeProposal = store.proposals.find((item) => item.id === store.activeMainlineProposalId) || null;
  const [driftTitle, setDriftTitle] = useState('');
  const [driftNote, setDriftNote] = useState('');
  const [driftPriority, setDriftPriority] = useState<TideRailPriority>('P2');
  const [feedback, setFeedback] = useState('');
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [detailsOpen, setDetailsOpen] = useState<Set<string>>(new Set());

  const toggleDetails = (id: string) => setDetailsOpen((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const refreshSources = () => {
    setRefreshState('loading');
    try {
      store.syncProposals(buildTideRailProposals(quests, ITERATIONS, RELEASE_NOTICES));
      setRefreshState('success');
      setFeedback('');
      setTimeout(() => setRefreshState((s) => s === 'success' ? 'idle' : s), 1800);
    } catch {
      setRefreshState('error');
      setFeedback('無法更新來源，請檢查網路後再試。');
    }
  };

  useEffect(() => { store.syncProposals(buildTideRailProposals(quests, ITERATIONS, RELEASE_NOTICES)); }, [quests]);
  const handleProposal = (proposal: TideRailProposal, action: 'accept' | 'defer' | 'skip') => {
    const succeeded = action === 'accept'
      ? store.acceptProposal(proposal.id)
      : action === 'defer'
        ? store.deferProposal(proposal.id)
        : store.skipProposal(proposal.id);
    setFeedback(succeeded
      ? action === 'accept' ? '已接受提案。' : action === 'defer' ? '已保留，稍後再處理。' : '已略過提案。'
      : '目前主線仍在進行；這項提案已依既有規矩保留。');
  };

  const captureDrift = () => {
    if (!driftTitle.trim()) return setFeedback('偏航至少需要標題。');
    store.captureDrift({ title: driftTitle, note: driftNote, priority: driftPriority, relationToMainline: '非目前正式主線', sourceRoute: location.pathname });
    setDriftTitle(''); setDriftNote(''); setFeedback('已收進偏航箱；正式主線沒有改變。'); onComposerClose();
  };

  const queue = store.proposals.filter((proposal) => !['completed', 'superseded'].includes(proposal.status));
  const openDrift = store.driftItems.filter((item) => item.status !== 'resolved');

  const refreshBtnLabel = refreshState === 'loading' ? '整理中…' : refreshState === 'success' ? '已更新' : refreshState === 'error' ? '重試' : '重新整理';

  return <div className="tr-tab" data-testid="tiderail-tab">
    {/* ── Today's Rule ── */}
    <section className="tr-rule">
      <div className="tr-rule-head">
        <strong>今日規矩</strong>
        <button type="button" className="tr-refresh-btn" onClick={refreshSources} disabled={refreshState === 'loading'} aria-label={refreshBtnLabel}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={refreshState === 'loading' ? 'tr-spin' : ''}>
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          {refreshBtnLabel}
        </button>
      </div>
      <span>只守一條主線。P2／P3 收進偏航箱；P0／P1 必須先簽中斷契約。</span>
    </section>

    {/* ── Mainline Summary ── */}
    <article className="tr-mainline-card" data-testid="tiderail-mainline-card">
      <header>
        <div>
          <small>正式主線</small>
          <h2>{active?.title || '正在整理目前的阻塞與下一步。'}</h2>
        </div>
        {active && <span className={`tr-priority is-${active.priority.toLowerCase()}`}>{active.priority}</span>}
      </header>
      {active ? <>
        <div className="tr-mainline-meta">
          <span>{activeProposal ? sourceSummary(activeProposal) : active.sourceType}</span>
          <span>{active.acceptanceCriteria.filter((item) => item.completed).length}/{active.acceptanceCriteria.length}</span>
        </div>
        <p><b>第一個可執行動作</b>{active.nextAction}</p>
        <p><b>為何現在最重要</b>{activeProposal?.decision?.rationale || '延續既有已開始主線，避免靜默擴張範圍。'}</p>
        <div className="tr-mainline-actions">
          <button onClick={() => navigate('/quests')}>前往 TIDEQUEST</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('tidebound:open-quick', { detail: { task: active.title } }))}>開始專注</button>
        </div>
      </> : <p className="tr-provider-state">尚未指定主線。可從下方待決提案選擇，或回到任務欄建立工作。</p>}
    </article>

    <div className="tr-section-heading"><h3>待決提案</h3><small>接受、稍後處理或略過，不需要公開投票。</small></div>

    {/* ── Proposal Queue ── */}
      <div className="tr-stack">
        {queue.length === 0 && <p className="tr-empty-state">目前沒有待決提案。</p>}
        {queue.map((proposal) => (
          <ProposalBoundary key={proposal.id}>
            <article className="tr-proposal-card" data-proposal-id={proposal.id}>
              <header>
                <span className={`tr-priority is-${proposal.priority.toLowerCase()}`}>{proposal.priority}</span>
                <span className="tr-chip">{categoryLabel[proposal.category] || proposal.category}</span>
                <span className="tr-chip">{statusLabel[proposal.status] || proposal.status}</span>
              </header>
              <h4>{proposal.title}</h4>
              <p className="tr-clamp-two">{sourceSummary(proposal)}</p>

              {/* Direct proposal actions; legacy votes and decisions remain persisted but are no longer primary UI. */}
              {!proposal.decision && (
                <div className="tr-advisory">
                  <div className="tr-vote-row">
                    <button type="button" className="tr-vote-btn" onClick={() => handleProposal(proposal, 'accept')}>接受</button>
                    <button type="button" className="tr-vote-btn" onClick={() => handleProposal(proposal, 'defer')}>稍後處理</button>
                    <button type="button" className="tr-vote-btn" onClick={() => handleProposal(proposal, 'skip')}>略過</button>
                  </div>
                </div>
              )}

              {/* Interruption contract — P0/P1 adoption over an active mainline */}
              {proposal.decision?.verdict === 'require_interruption_contract' && store.activeMainlineProposalId && store.activeMainlineProposalId !== proposal.id && (
                <div className="tr-contract" data-testid="interruption-contract">
                  <h5>中斷契約</h5>
                  <p><b>何時返回</b>：中斷提案完成全部驗收後立即返回</p>
                  <p>{proposal.decision.rationale}</p>
                  <button type="button" onClick={() => {
                    if (store.confirmProposalInterruption(proposal.id)) setFeedback('已切換主線並簽訂中斷契約。');
                  }}>確認契約並切換主線</button>
                </div>
              )}

              {/* Expand details */}
              <button type="button" className="tr-expand-btn" onClick={() => toggleDetails(proposal.id)} aria-expanded={detailsOpen.has(proposal.id)}>
                {detailsOpen.has(proposal.id) ? '收起詳情' : '展開詳情'}
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className={detailsOpen.has(proposal.id) ? 'tr-rotated' : ''}><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {detailsOpen.has(proposal.id) && (
                <dl className="tr-details">
                  <dt>來源</dt><dd>{proposal.sourceRefs.map((ref) => `${ref.type}:${ref.id}`).join(' · ')}</dd>
                  <dt>依賴</dt><dd>{proposal.dependencies.join('、') || '無'}</dd>
                  <dt>範圍</dt><dd>{proposal.estimatedScope || '待裁決'}</dd>
                  <dt>影響</dt><dd>{proposal.impact}</dd>
                  <dt>驗收</dt><dd>{proposal.acceptanceCriteria.join('；')}</dd>
                  {proposal.decision?.appliedRules && proposal.decision.appliedRules.length > 0 && (
                    <><dt>應用規則</dt><dd><ul>{proposal.decision.appliedRules.map((rule) => <li key={rule}>{rule}</li>)}</ul></dd></>
                  )}
                </dl>
              )}
            </article>
          </ProposalBoundary>
        ))}
      </div>

    {composerOpen && <section className="tr-section tr-capture"><header><div><h3>收進偏航箱</h3><small>只收 P2／P3，不會取代正式主線。</small></div><button onClick={onComposerClose}>關閉</button></header><input autoFocus aria-label="偏航標題" value={driftTitle} onChange={(event) => setDriftTitle(event.target.value)} /><textarea aria-label="偏航備註（選填）" value={driftNote} onChange={(event) => setDriftNote(event.target.value)} /><select aria-label="偏航 priority" value={driftPriority} onChange={(event) => setDriftPriority(event.target.value as TideRailPriority)}><option>P2</option><option>P3</option></select><button className="tr-primary" onClick={captureDrift}>收進 Drift Inbox</button></section>}
    <section className="tr-section" id="tiderail-drift-inbox"><header><div><h3>偏航箱</h3><small>{openDrift.length} 項</small></div></header>{openDrift.map((item) => <article className="tr-drift-row" key={item.id}><b>{item.priority}</b><span>{item.title}<small>{item.sourceRoute} · {item.status}</small></span><button onClick={() => store.resolveDrift(item.id)}>完成</button></article>)}{!openDrift.length && <p className="tr-empty-state">偏航箱目前是空的。</p>}</section>
    <p className="tr-feedback" aria-live="polite">{feedback}</p>
  </div>;
}
