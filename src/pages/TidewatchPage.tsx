import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BackButton } from '@/components/layout/BackButton';
import { useActivityLedgerStore } from '@/features/tidewatch/activityLedgerStore';
import { selectAgentDailySummary, selectAgentRuns, selectAgentSources, selectAgentTimeline } from '@/features/tidewatch/agentTelemetry';
import { QuickCheckInPanel } from '@/components/tidewatch/QuickCheckInPanel';
import { codexBridgeStatus, connectCodexTelemetryBridge, deriveCodexBridgeDisplayState } from '@/features/tidewatch/codexTelemetryBridge';
import './TidewatchPage.css';

type TidewatchView = 'user' | 'agent';

const AGENT_EVENT_LABELS: Record<string, string> = { run_start: 'RUN', run_end: 'RUN', tool_call: 'TOOL', command: 'COMMAND', file_change: 'FILE', test: 'TEST', result: 'RESULT', error: 'ERROR' };
function formatDuration(value: number) { const seconds = Math.max(0, Math.round(value / 1000)); return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
function sourceName(sourceKind: string, sourceId: string) { if (sourceKind === 'codex') return 'Codex'; if (sourceKind === 'lunartide') return 'Lunartide Agent'; return sourceId; }

export function TidewatchPage() {
  const { events: activityEvents, hydrate: hydrateActivity } = useActivityLedgerStore();
  const [view, setView] = useState<TidewatchView>('user');
  const bridgeStatus = useSyncExternalStore(codexBridgeStatus.subscribe, codexBridgeStatus.getSnapshot);
  const bridgeDisplayState = deriveCodexBridgeDisplayState(bridgeStatus);

  useEffect(() => { hydrateActivity(); }, [hydrateActivity]);
  useEffect(() => view === 'agent' ? connectCodexTelemetryBridge() : undefined, [view]);

  const agentSources = useMemo(() => selectAgentSources(activityEvents), [activityEvents]);
  const agentRuns = useMemo(() => selectAgentRuns(activityEvents), [activityEvents]);
  const agentTimeline = useMemo(() => selectAgentTimeline(activityEvents), [activityEvents]);
  const agentToday = useMemo(() => selectAgentDailySummary(activityEvents), [activityEvents]);

  return <><section className="view tidewatch-page" data-testid="tidewatch-page-root"><div className="tidewatch-shell">
    <header className="tidewatch-header">
      <div className="tidewatch-hero-content">
        <BackButton to="/" />
        <div className="tidewatch-title-block"><h1>觀測站</h1><p>TIDEWATCH</p></div>
        <div className="tw-view-switch" role="tablist" aria-label="TIDEWATCH 檢視">
          {(['user', 'agent'] as const).map((item) => <button key={item} type="button" role="tab" id={`tidewatch-${item}-tab`} aria-controls={`tidewatch-${item}-panel`} aria-selected={view === item} className={view === item ? 'is-active' : ''} onClick={() => setView(item)}>{item.toUpperCase()}</button>)}
        </div>
      </div>
      <div className="tw-rune-hero" data-testid="tidewatch-rune-hero" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}branding/rune/tidewatch-hero-neutral.png`} alt="" draggable={false} />
      </div>
    </header>

    {view === 'user' ? <div id="tidewatch-user-panel" role="tabpanel" aria-labelledby="tidewatch-user-tab" className="tw-view-panel" data-testid="tidewatch-user-view">
      <QuickCheckInPanel />

    </div> : <div id="tidewatch-agent-panel" role="tabpanel" aria-labelledby="tidewatch-agent-tab" className="tw-agent-panel" data-testid="tidewatch-agent-view"><div className="tw-bridge-status" data-testid="tidewatch-codex-bridge" data-state={bridgeDisplayState}><span aria-hidden="true" /><strong>{bridgeDisplayState.toUpperCase()}</strong><small>CODEX RELAY · {bridgeStatus.hookStatus.toUpperCase()}</small></div>{agentTimeline.length === 0 ? <div className="tw-agent-empty"><span className="tw-agent-empty-mark" aria-hidden="true">◎</span><h2>{bridgeStatus.connected ? 'Codex Relay 已連接，等待可觀測事件。' : '尚未連接可觀測的智能體。'}</h2><p>連接後，這裡會顯示運行、工具調用、文件變更、測試和執行結果。</p><p className="tw-agent-empty-note">不要生成 demo 運行。目前不顯示推測或模擬活動。</p></div> : <div className="tw-agent-dashboard">
      <section className="tw-section" data-testid="tidewatch-agent-sources"><h2 className="tw-section-title">SOURCES</h2><div className="tw-agent-sources">{agentSources.map((source) => <div className="tw-agent-source" key={source.key}><div><strong>{sourceName(source.sourceKind, source.sourceId)}</strong>{source.agentId && <span>{source.agentId}</span>}{source.provider && <small>Provider · {source.provider}{source.model ? ` · ${source.model}` : ''}</small>}</div><span className={`tw-agent-status is-${source.status}`}>{source.status.toUpperCase()}</span></div>)}</div></section>
      {agentRuns[0] && <section className="tw-section" data-testid="tidewatch-current-run"><h2 className="tw-section-title">CURRENT RUN</h2><div className="tw-current-run"><div className="tw-current-run-head"><div><small>{sourceName(agentRuns[0].sourceKind, agentRuns[0].sourceId)}{agentRuns[0].agentId ? ` / ${agentRuns[0].agentId}` : ''}</small><h3>{agentRuns[0].title}</h3></div><span className={`tw-agent-status is-${agentRuns[0].status}`}>{agentRuns[0].status.toUpperCase()}</span></div><div className="tw-run-metrics"><span><small>DURATION</small>{formatDuration(agentRuns[0].durationMs)}</span><span><small>TOOLS</small>{agentRuns[0].toolCount}</span><span><small>FILES</small>{agentRuns[0].fileChangeCount}</span><span><small>TESTS</small>{agentRuns[0].testPassed} / {agentRuns[0].testFailed}</span></div></div></section>}
      <section className="tw-section" data-testid="tidewatch-agent-trace"><h2 className="tw-section-title">TRACE</h2><div className="tw-agent-trace">{agentTimeline.slice(0, 40).map((event) => <div className="tw-agent-event" key={event.id}><time>{new Date(event.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span className={`tw-event-kind is-${event.type}`}>{AGENT_EVENT_LABELS[event.type] ?? event.type}</span><strong>{event.title}</strong></div>)}</div></section>
      <section className="tw-section" data-testid="tidewatch-agent-today"><h2 className="tw-section-title">TODAY</h2><div className="tw-agent-today">{([['RUNS', agentToday.runs], ['COMPLETED', agentToday.completed], ['FAILED', agentToday.failed], ['TOOLS', agentToday.tools], ['FILES', agentToday.files], ['TESTS', agentToday.tests]] as const).map(([label, value]) => <span key={label}><small>{label}</small>{value}</span>)}</div></section>
    </div>}</div>}
  </div></section></>;
}
