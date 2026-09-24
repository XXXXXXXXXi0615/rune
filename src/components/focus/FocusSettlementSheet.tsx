import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FOCUS_ACHIEVEMENTS, getFocusMilestoneProgress, getNextFocusMilestone, useFocusCareerStore } from '@/store/useFocusCareerStore';
import { useQuestStore } from '@/store/useQuestStore';
import { toLocalDateString } from '@/utils/date';
import './FocusSettlementSheet.css';

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours) return `${hours} 小時 ${minutes} 分`;
  if (minutes) return `${minutes} 分 ${remainder} 秒`;
  return `${remainder} 秒`;
};

export function FocusSettlementSheet() {
  const navigate = useNavigate();
  const settlement = useFocusCareerStore((state) => state.pendingSettlement);
  const dismiss = useFocusCareerStore((state) => state.dismissSettlement);
  const quests = useQuestStore((state) => state.quests);
  const mainQuestId = useQuestStore((state) => state.mainQuestByDate[toLocalDateString()]);
  const mainQuest = quests.find((quest) => quest.id === mainQuestId);

  if (!settlement || settlement.outcome !== 'completed') return null;
  const next = getNextFocusMilestone(settlement.totalFocusSeconds);
  const progress = next ? getFocusMilestoneProgress(settlement.totalFocusSeconds, next.seconds) : 100;
  const unlocked = settlement.achievementIds
    .map((id) => FOCUS_ACHIEVEMENTS.find((achievement) => achievement.id === id))
    .filter((item): item is (typeof FOCUS_ACHIEVEMENTS)[number] => Boolean(item));

  const close = () => dismiss(settlement.sessionId);
  const go = (route: string) => { close(); navigate(route); };

  return createPortal(
    <div className="focus-settlement-backdrop" role="presentation">
      <section className="focus-settlement-sheet" role="dialog" aria-modal="true" aria-labelledby="focus-settlement-title" data-testid="focus-settlement-sheet">
        <div className="focus-settlement-handle" aria-hidden="true" />
        <header>
          <span>TIDEBOUND · SESSION SETTLEMENT</span>
          <h2 id="focus-settlement-title">這次航程已靠岸</h2>
          <p>時間已正式寫入生涯紀錄。這次不是草稿，也不是 checkpoint。</p>
        </header>

        <div className="focus-settlement-metrics">
          <div><span>本次專注</span><strong>{formatDuration(settlement.sessionFocusSeconds)}</strong></div>
          <div><span>今日專注</span><strong>{formatDuration(settlement.todayFocusSeconds)}</strong></div>
          <div><span>生涯專注</span><strong>{formatDuration(settlement.totalFocusSeconds)}</strong></div>
          <div><span>航程總數</span><strong>{settlement.focusSessionCount}</strong></div>
        </div>

        <div className="focus-settlement-milestone">
          <div><span>下一潮痕</span><strong>{next?.title ?? '目前里程碑已完成'}</strong></div>
          <span>{Math.round(progress)}%</span>
          <div className="focus-settlement-progress" aria-label={`里程碑進度 ${Math.round(progress)}%`}><i style={{ width: `${progress}%` }} /></div>
        </div>

        {unlocked.length > 0 && (
          <div className="focus-settlement-unlocks" aria-label="本次解鎖成就">
            <span>本次新解鎖</span>
            {unlocked.map((achievement) => (
              <article key={achievement.id}>
                <i aria-hidden="true">☾</i>
                <div><strong>{achievement.title}</strong><small>{achievement.description}</small></div>
              </article>
            ))}
          </div>
        )}

        <footer>
          <button type="button" className="focus-settlement-primary" onClick={close}>完成</button>
          <button type="button" onClick={() => go('/quests')}>{mainQuest ? '回到主任務' : '前往 TIDEQUEST'}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
