import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Quest } from '@/store/useQuestStore';
import { useQuestStore } from '@/store/useQuestStore';
import { reviewRequirements, selectAdaptiveDifficultyExplanation } from '@/features/tidewatch/reviewGate';
import { toLocalDateString } from '@/utils/date';
import { useTidewatchPolicyStore } from '@/features/tidewatch/reviewPolicyStore';
import { applyApprovedReviewTransition } from '@/features/tidewatch/reviewTransition';
import type { ReviewRecord, ReviewRequestType, ReviewTone } from '@/features/tidewatch/types';
import './RuneReviewGate.css';

const TYPE_LABELS: Record<ReviewRequestType, string> = { defer: '稍後處理', extend: '延長期限', reduce: '縮減任務', pause: '暫停任務', abandon: '放棄任務' };
const TONE_COPY: Record<ReviewTone, { title: string; intro: string }> = {
  restrained: { title: 'Rune Review', intro: '說明原因與下一步，我會依規則檢查。' },
  strict: { title: 'Rune 嚴格審核', intro: '把理由說完整。通過規則後才會更動任務。' },
  master: { title: 'Rune Review', intro: '別含糊。理由、復原方式、下一步，一項都別漏。' },
};

interface RuneReviewGateProps { quest: Quest; requestType: ReviewRequestType; onClose: () => void }

export function RuneReviewGate({ quest, requestType, onClose }: RuneReviewGateProps) {
  const titleId = useId(); const closeRef = useRef<HTMLButtonElement>(null); const sheetRef = useRef<HTMLElement>(null); const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const preferences = useTidewatchPolicyStore((state) => state.preferences);
  const reviews = useTidewatchPolicyStore((state) => state.reviews);
  const setPreferences = useTidewatchPolicyStore((state) => state.setPreferences);
  const submitReview = useTidewatchPolicyStore((state) => state.submitReview);
  const acceptConditions = useTidewatchPolicyStore((state) => state.acceptConditions);
  const [reason, setReason] = useState(''); const [nextAction, setNextAction] = useState(''); const [recoveryPlan, setRecoveryPlan] = useState(''); const [resumeAt, setResumeAt] = useState(''); const [acknowledged, setAcknowledged] = useState(false); const [result, setResult] = useState<ReviewRecord | null>(null); const [busy, setBusy] = useState(false);
  const baseDifficulty = preferences.baseDifficultyByType?.[requestType] ?? preferences.baseDifficulty;
  const today = new Date();
  const difficulty = selectAdaptiveDifficultyExplanation(baseDifficulty, preferences.difficultyMode === 'adaptive', reviews, today, Boolean(preferences.useBaseDifficultyByDate?.[toLocalDateString(today)])).todayDerivedDifficulty;
  const requirements = reviewRequirements(difficulty); const copy = TONE_COPY[preferences.tone];
  const apply = (record: ReviewRecord) => applyApprovedReviewTransition(record, quest, useQuestStore.getState());

  useEffect(() => { const previous = document.activeElement as HTMLElement | null; closeRef.current?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { onCloseRef.current(); return; } if (event.key !== 'Tab') return; const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])') || []); if (focusable.length === 0) return; const index = focusable.indexOf(document.activeElement as HTMLElement); const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : (index >= focusable.length - 1 ? 0 : index + 1); event.preventDefault(); focusable[next].focus(); }; document.addEventListener('keydown', onKey); return () => { document.removeEventListener('keydown', onKey); previous?.focus(); }; }, []);
  const submit = async () => { setBusy(true); try { const record = await submitReview({ questId: quest.id, questTitle: quest.title, requestType, reason, nextAction, recoveryPlan, resumeAt: resumeAt ? new Date(resumeAt).toISOString() : undefined, consequenceAcknowledged: acknowledged }); setResult(record); if (record.decision.decision === 'approved') apply(record); } finally { setBusy(false); } };
  const accept = async () => { if (!result) return; const accepted = await acceptConditions(result.id); if (accepted && apply(accepted)) onClose(); };

  return createPortal(<div className="tw-review-layer" data-testid="rune-review-gate"><button className="tw-review-scrim" type="button" aria-label="關閉 Rune Review" onClick={onClose}/><section ref={sheetRef} className="tw-review-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <header><div><span>{'★'.repeat(difficulty)}{'☆'.repeat(5 - difficulty)}</span><h2 id={titleId}>{copy.title}</h2><p>{copy.intro}</p></div><button ref={closeRef} type="button" aria-label="關閉" onClick={onClose}>×</button></header>
    <div className="tw-review-summary"><small>{TYPE_LABELS[requestType]}</small><strong>{quest.title}</strong><span>{quest.estimatedMinutes || 25} 分鐘 · {quest.status === 'in_progress' ? '執行中' : '已領取'}</span></div>
    <div className="tw-review-preferences"><label>本類難度<select value={baseDifficulty} onChange={(event) => void setPreferences({ baseDifficultyByType: { ...preferences.baseDifficultyByType, [requestType]: Number(event.target.value) } })}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} 星</option>)}</select></label><label>模式<select value={preferences.difficultyMode} onChange={(event) => void setPreferences({ difficultyMode: event.target.value as 'fixed' | 'adaptive' })}><option value="fixed">固定</option><option value="adaptive">自適應</option></select></label><label>語氣<select value={preferences.tone} onChange={(event) => void setPreferences({ tone: event.target.value as ReviewTone })}><option value="restrained">克制</option><option value="strict">嚴格</option><option value="master">掌控</option></select></label></div>
    <ul className="tw-review-requirements">{requirements.map((item) => <li key={item}>{item}</li>)}</ul>
    <label className="tw-review-field"><span>理由 <small>{Array.from(reason.replace(/\s/g, '')).length} 字</small></span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="說明現在的阻礙與判斷。" rows={4}/></label>
    {difficulty >= 3 && <><label className="tw-review-field"><span>具體下一步</span><input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="下一個可以執行的動作"/></label><label className="tw-review-field"><span>恢復計畫</span><textarea value={recoveryPlan} onChange={(event) => setRecoveryPlan(event.target.value)} placeholder="準備如何恢復進度" rows={2}/></label></>}
    {difficulty >= 4 && <label className="tw-review-field"><span>恢復時間</span><input type="datetime-local" value={resumeAt} onChange={(event) => setResumeAt(event.target.value)}/></label>}
    {difficulty >= 5 && <label className="tw-review-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>我已理解未來真正逾期時可能產生後果。</span></label>}
    {result && <div className={`tw-review-decision is-${result.decision.decision}`} role="status"><strong>{result.decision.decision === 'approved' ? '審核通過' : result.decision.decision === 'conditional' ? '有條件通過' : '未通過'}</strong><p>{result.decision.message}</p>{result.decision.conditions?.map((condition) => <small key={condition}>{condition}</small>)}</div>}
    <footer>{result?.decision.decision === 'conditional' ? <button type="button" className="is-primary" onClick={accept}>接受條件並執行</button> : <button type="button" className="is-primary" onClick={submit} disabled={busy}>{busy ? '審核中…' : '送出審核'}</button>}<button type="button" onClick={onClose}>取消</button></footer>
  </section></div>, document.body);
}
