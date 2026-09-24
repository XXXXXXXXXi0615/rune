import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectTidewatchQuest } from '@/features/tidewatch/userOverview';
import { useQuestStore } from '@/store/useQuestStore';
import { useTidewatchPolicyStore } from '@/features/tidewatch/reviewPolicyStore';
import type { ReviewRecord, ReviewRequestType } from '@/features/tidewatch/types';
import { RuneReviewGate } from './RuneReviewGate';
import { consequenceSourceEventId } from '@/features/tidewatch/consequenceEngine';
import { ConsequenceWheelHost } from './ConsequenceWheel';
import { TidewatchRulebook, TidewatchRuleSummary } from './TidewatchRulebook';
import './QuickCheckInPanel.css';

function dueCopy(value?: string) { return value ? new Date(value).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '今天'; }

/** TIDEWATCH home — observation only. Daily check-in reporting lives on Home;
 * TIDEWATCH keeps the TIDEQUEST projection and the rulebook. */
export function QuickCheckInPanel() {
  const navigate = useNavigate();
  const quests = useQuestStore((state) => state.quests);
  const mainQuestByDate = useQuestStore((state) => state.mainQuestByDate);
  const claimQuest = useQuestStore((state) => state.claimQuest);
  const completeQuest = useQuestStore((state) => state.completeQuest);
  const [reviewType, setReviewType] = useState<ReviewRequestType | null>(null);
  const hydratePolicy = useTidewatchPolicyStore((state) => state.hydrate);
  const ensureConsequence = useTidewatchPolicyStore((state) => state.ensureConsequence);
  const [overrideReason, setOverrideReason] = useState<NonNullable<ReviewRecord['overrideReason']>>('health');
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const now = Date.now();
  const quest = useMemo(() => selectTidewatchQuest(quests, mainQuestByDate, new Date(now)), [quests, mainQuestByDate, now]);
  const openQuest = () => navigate('/quests', { state: quest ? { questId: quest.questId } : undefined });
  const questAction = () => { if (!quest) return navigate('/quests'); if (quest.status === 'available') claimQuest(quest.questId); else openQuest(); };
  const canonicalQuest = quest ? quests.find((item) => item.id === quest.questId) : undefined;
  useEffect(() => { void hydratePolicy(); }, [hydratePolicy]);
  useEffect(() => { for (const item of quests) { if (item.status === 'abandoned') void ensureConsequence(`quest-abandoned:${item.id}:${item.updatedAt}`, item.id, item.title, now); else if (item.dueAt && Date.parse(item.dueAt) < now && !['completed', 'archived'].includes(item.status)) void ensureConsequence(consequenceSourceEventId(item.id, item.dueAt), item.id, item.title, now); } }, [ensureConsequence, now, quests]);

  return <div className="tw-user-overview">
    <section className="tw-overview-card tw-quest-card" data-testid="tidewatch-today-quest" data-pet-safe-region="interactive">
      <header><div><span className="tw-card-eyebrow">今日任務</span><b>{quest ? (quest.completed ? '已完成' : quest.claimed ? '進行中' : '未領取') : '尚無任務'}</b></div><small>{quest?.dueAt ? `截止於 ${dueCopy(quest.dueAt)}` : 'TIDEQUEST'}</small></header>
      {quest ? <><h2>{quest.title}</h2><p>完成 {quest.estimatedMinutes ?? 25} 分鐘專注</p><div className="tw-quest-meta"><span><small>預計時長</small><strong>{quest.estimatedMinutes ?? 25} 分鐘</strong></span><span><small>完成獎勵</small><strong>+{quest.rewardMoonDew} 月印</strong></span><span><small>逾時後果</small><strong>{quest.failed ? '已逾時' : '真正逾期後建立後果'}</strong></span></div>{(quest.status === 'claimed' || quest.status === 'in_progress') && canonicalQuest ? <div className="tw-quest-review-actions"><button type="button" onClick={() => completeQuest(quest.questId)}>標記完成</button><button type="button" onClick={() => setReviewType('defer')}>申請稍後</button><button type="button" onClick={() => setReviewType('abandon')}>申請放棄</button></div> : <button type="button" onClick={questAction} disabled={quest.completed}>{quest.completed ? '已完成' : quest.status === 'available' ? '立即領取任務' : '查看今日任務'}</button>}{quest.status === 'available' && <button type="button" className="tw-quest-link" onClick={openQuest}>查看任務詳情</button>}</> : <><h2>今天還沒有領取任務</h2><p>前往 TIDEQUEST 選擇今日主線。</p><button type="button" onClick={() => navigate('/quests')}>前往 TIDEQUEST</button></>}
    </section>
    <TidewatchRuleSummary onOpen={() => setRulebookOpen(true)}/>
    <ConsequenceWheelHost overrideReason={overrideReason} onOverrideReasonChange={setOverrideReason}/>
    {rulebookOpen && <TidewatchRulebook onClose={() => setRulebookOpen(false)}/>}
    {reviewType && canonicalQuest && <RuneReviewGate quest={canonicalQuest} requestType={reviewType} onClose={() => setReviewType(null)} />}
  </div>;
}
