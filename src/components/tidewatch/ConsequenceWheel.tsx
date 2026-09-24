import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { eligibleConsequenceItems, shouldFulfillTimerConsequence } from '@/features/tidewatch/consequenceEngine';
import { useTidewatchPolicyStore } from '@/features/tidewatch/reviewPolicyStore';
import type { ConsequenceExecutionType, ReviewRecord, TidewatchConsequence } from '@/features/tidewatch/types';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { useAppStore } from '@/store/useAppStore';
import './ConsequenceWheel.css';

const EMPTY_DRAFT = { title: '', intensity: 1, executionType: 'manual' as ConsequenceExecutionType, durationMinutes: 20 };

export function ConsequencePoolEditor({ onClose }: { onClose: () => void }) {
  const preferences = useTidewatchPolicyStore((state) => state.consequencePreferences);
  const setIntensity = useTidewatchPolicyStore((state) => state.setConsequenceIntensity);
  const upsert = useTidewatchPolicyStore((state) => state.upsertConsequencePoolItem);
  const remove = useTidewatchPolicyStore((state) => state.deleteConsequencePoolItem);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState('');
  return <section className="tw-pool-editor" aria-labelledby="tw-pool-title">
    <header><div><small>USER CONSEQUENCE POOL</small><h2 id="tw-pool-title">編輯後果清單</h2></div><button type="button" onClick={onClose} aria-label="返回轉盤">×</button></header>
    <label className="tw-intensity">後果強度 <output>{preferences.intensity} 星</output><input aria-label="後果強度" type="range" min="1" max="5" value={preferences.intensity} onChange={(event) => void setIntensity(Number(event.target.value))}/></label>
    <div className="tw-pool-list">{preferences.pool.map((item) => <article key={item.id}>
      <button type="button" className="tw-pool-toggle" aria-pressed={item.enabled} onClick={() => void upsert({ ...item, enabled: !item.enabled })}>{item.enabled ? '啟用' : '停用'}</button>
      <span><strong>{item.title}</strong><small>{item.intensity} 星 · {item.executionType === 'timer' ? `${item.durationMinutes ?? 20} 分鐘計時` : '手動完成'}</small></span>
      <button type="button" className="tw-pool-delete" onClick={() => void remove(item.id)} aria-label={`刪除 ${item.title}`}>刪除</button>
    </article>)}</div>
    <form className="tw-pool-form" onSubmit={async (event) => { event.preventDefault(); const result = await upsert({ id: crypto.randomUUID(), ...draft, enabled: true, weight: 1 }); if (!result.ok) return setError(result.reason ?? '無法新增'); setDraft(EMPTY_DRAFT); setError(''); }}>
      <input aria-label="後果內容" placeholder="新增安全、可完成的後果" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/>
      <div><label>強度<select aria-label="項目強度" value={draft.intensity} onChange={(event) => setDraft({ ...draft, intensity: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} 星</option>)}</select></label><label>執行<select aria-label="執行方式" value={draft.executionType} onChange={(event) => setDraft({ ...draft, executionType: event.target.value as ConsequenceExecutionType })}><option value="manual">手動</option><option value="timer">計時</option></select></label>{draft.executionType === 'timer' && <label>分鐘<input aria-label="計時分鐘" type="number" min="1" max="180" value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })}/></label>}</div>
      {error && <p role="alert">{error}</p>}<button type="submit">加入清單</button>
    </form>
  </section>;
}

function WheelDialog({ consequence, onClose }: { consequence: TidewatchConsequence; onClose: () => void }) {
  const preferences = useTidewatchPolicyStore((state) => state.consequencePreferences);
  const resolve = useTidewatchPolicyStore((state) => state.resolveConsequence);
  const activate = useTidewatchPolicyStore((state) => state.activateConsequence);
  const [editing, setEditing] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const eligible = useMemo(() => eligibleConsequenceItems(preferences.pool, preferences.intensity), [preferences]);
  const selected = consequence.selectedItemSnapshot;
  return <div className="tw-wheel-backdrop" role="presentation"><section className="tw-wheel-dialog" role="dialog" aria-modal="true" aria-labelledby="tw-wheel-title" data-pet-safe-region="critical" data-lifecycle={consequence.lifecycle}>
    {editing ? <ConsequencePoolEditor onClose={() => setEditing(false)}/> : <>
      <header><div><small>CONSEQUENCE</small><h2 id="tw-wheel-title">任務未完成</h2><p>請接受今天的後果。</p></div><button type="button" onClick={onClose} aria-label="關閉後果轉盤">×</button></header>
      {selected ? <div className="tw-wheel-result" role="status"><span>抽中結果</span><p>你抽中了：</p><strong>{selected.title}</strong><small>{selected.intensity} 星 · {selected.executionType === 'timer' ? `${selected.durationMinutes ?? 20} 分鐘` : '手動執行'}</small><button type="button" className="is-primary" onClick={() => void activate(consequence.id).then(onClose)}>接受後果</button><button type="button" onClick={() => setEditing(true)}>重新查看規則</button></div> : eligible.length ? <>
        <div className={`tw-wheel${spinning ? ' is-spinning' : ''}`} aria-label={`可抽取 ${eligible.length} 個後果項目`}><div>{eligible.map((item, index) => <span key={item.id} style={{ transform: `rotate(${(360 / eligible.length) * index}deg)` }}>{item.title}</span>)}</div><i aria-hidden="true">◆</i></div>
        <button type="button" className="is-primary tw-spin-button" disabled={spinning} onClick={async () => { setSpinning(true); await resolve(consequence.id); window.setTimeout(() => setSpinning(false), 420); }}>開始抽取</button><button type="button" className="tw-edit-pool" onClick={() => setEditing(true)}>編輯後果清單</button>
      </> : <div className="tw-wheel-empty"><strong>目前沒有可用的後果項目</strong><p>請啟用強度範圍內的安全項目。</p><button type="button" className="is-primary" onClick={() => setEditing(true)}>編輯後果清單</button></div>}
    </>}
  </section></div>;
}

export function ConsequenceWheelHost({ overrideReason, onOverrideReasonChange }: { overrideReason: NonNullable<ReviewRecord['overrideReason']>; onOverrideReasonChange: (value: NonNullable<ReviewRecord['overrideReason']>) => void }) {
  const consequences = useTidewatchPolicyStore((state) => state.consequences);
  const safetyOverride = useTidewatchPolicyStore((state) => state.safetyOverride);
  const fulfill = useTidewatchPolicyStore((state) => state.fulfillConsequence);
  const activate = useTidewatchPolicyStore((state) => state.activateConsequence);
  const focusSessionId = useFocusSessionStore((state) => state.sessionId);
  const focusStatus = useFocusSessionStore((state) => state.status);
  const lastSettlement = useFocusSessionStore((state) => state.lastSettlement);
  const focusSessionLog = useAppStore((state) => state.focusSessionLog);
  const completedFocusSessionIds = useMemo(() => (focusSessionLog ?? []).filter((entry) => entry.status === 'completed').map((entry) => entry.sessionId ?? entry.id), [focusSessionLog]);
  const startSession = useFocusSessionStore((state) => state.startSession);
  const showFocusWindow = useFocusIslandStore((state) => state.showWindow);
  const openFocusWindow = useFocusWindowStore((state) => state.openWindow);
  const unresolved = consequences.find((item) => item.lifecycle === 'pending' || item.lifecycle === 'revealed');
  const active = consequences.find((item) => item.lifecycle === 'active');
  const completed = consequences.filter((item) => item.lifecycle === 'fulfilled' && item.selectedItemSnapshot).sort((a, b) => (b.fulfilledAt ?? 0) - (a.fulfilledAt ?? 0))[0];
  const setFeedback = useTidewatchPolicyStore((state) => state.setConsequenceFeedback);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { if (unresolved) setOpenId(unresolved.id); }, [unresolved?.id]);
  useEffect(() => { if (!active) return; const persistedCompletion = active.timerSessionId && completedFocusSessionIds.includes(active.timerSessionId) ? { sessionId: active.timerSessionId, outcome: 'completed' } : null; if (shouldFulfillTimerConsequence(active, lastSettlement ?? persistedCompletion)) void fulfill(active.id); }, [active, completedFocusSessionIds, fulfill, lastSettlement]);
  const startTimer = () => {
    if (!active?.selectedItemSnapshot) return;
    startSession({ durationMinutes: active.selectedItemSnapshot.durationMinutes ?? 20, restMinutes: 5, rounds: 1, task: `後果 · ${active.selectedItemSnapshot.title}`, category: 'focus', roomType: 'computer' });
    const sessionId = useFocusSessionStore.getState().sessionId ?? undefined;
    void activate(active.id, Date.now(), sessionId); showFocusWindow(); openFocusWindow();
  };
  return <>
    {(unresolved || active) && <section className="tw-overview-card tw-consequence-card" data-testid="tidewatch-consequence-foundation" data-pet-safe-region="critical"><header><div><small>CONSEQUENCE</small><h2>{active ? '執行中的後果' : '待揭曉後果'}</h2></div><b>{active ? 'ACTIVE' : 'PENDING'}</b></header>
      {active?.selectedItemSnapshot ? <><strong className="tw-active-title">{active.selectedItemSnapshot.title}</strong><p>尚有一項後果待完成。</p><p>{active.selectedItemSnapshot.executionType === 'timer' ? `${active.selectedItemSnapshot.durationMinutes ?? 20} 分鐘 · 使用 TIDEBOUND` : '完成後由你確認履行。'}</p>{active.selectedItemSnapshot.executionType === 'manual' ? <button type="button" className="is-primary" onClick={() => void fulfill(active.id)}>標記已完成</button> : active.timerSessionId && focusSessionId === active.timerSessionId && ['running','paused'].includes(focusStatus) ? <button type="button" className="is-primary" onClick={() => { showFocusWindow(); openFocusWindow(); }}>繼續</button> : <button type="button" className="is-primary" onClick={startTimer}>啟動 TIDEBOUND</button>}</> : <><p>尚有一項後果待完成。</p><button type="button" className="is-primary" onClick={() => setOpenId(unresolved?.id ?? null)}>繼續</button></>}
      <div className="tw-safety-override"><label>規則例外<select value={overrideReason} onChange={(event) => onOverrideReasonChange(event.target.value as NonNullable<ReviewRecord['overrideReason']>)}><option value="emergency">緊急狀況</option><option value="health">健康因素</option><option value="accidental_configuration">設定錯誤</option><option value="other">其他正當理由</option></select></label><button type="button" onClick={() => { const item = active ?? unresolved; if (item) void safetyOverride({ questId: item.questId, questTitle: item.questTitleSnapshot, reason: overrideReason }); }}>套用規則例外</button></div>
    </section>}
    {!unresolved && !active && completed && <section className="tw-overview-card tw-consequence-complete" data-testid="tidewatch-consequence-completion" data-pet-safe-region="critical"><small>COMPLETED</small><h2>後果已完成</h2><strong>{completed.selectedItemSnapshot?.title}</strong><time>{new Date(completed.fulfilledAt ?? completed.updatedAt).toLocaleString('zh-TW')}</time><div role="group" aria-label="後果體感">{([['too_light','太輕'],['right','剛好'],['too_heavy','太重']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={completed.perceivedIntensity === value} onClick={() => void setFeedback(completed.id, value)}>{label}</button>)}</div></section>}
    {openId && consequences.find((item) => item.id === openId && (item.lifecycle === 'pending' || item.lifecycle === 'revealed')) && createPortal(<WheelDialog consequence={consequences.find((item) => item.id === openId)!} onClose={() => setOpenId(null)}/>, document.body)}
  </>;
}
