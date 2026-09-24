import { useNavigate } from 'react-router-dom';
import { useQuestStore, getQuestDateKey, type Quest } from '@/store/useQuestStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { toLocalDateString } from '@/utils/date';
import { AppIcon } from '@/components/icons/AppIcon';

export function TodayQuestWidget() {
  const navigate = useNavigate();
  const quests = useQuestStore((state) => state.quests);
  const mainQuestByDate = useQuestStore((state) => state.mainQuestByDate);
  const startQuest = useQuestStore((state) => state.startQuest);
  const startSession = useFocusSessionStore((state) => state.startSession);
  const showFocusWindow = useFocusIslandStore((state) => state.showWindow);
  const openFocusWindow = useFocusWindowStore((state) => state.openWindow);

  const today = toLocalDateString();
  const todayQuests = quests.filter(
    (quest) => getQuestDateKey(quest) === today && quest.status !== 'archived',
  );
  const completed = todayQuests.filter((quest) => quest.status === 'completed').length;
  const total = todayQuests.length;
  const main = quests.find((quest) => quest.id === mainQuestByDate[today]);

  const execute = (quest: Quest) => {
    startQuest(quest.id);
    startSession({
      durationMinutes: quest.estimatedMinutes || 25,
      restMinutes: 5,
      rounds: 1,
      task: quest.title,
      category: 'focus',
      roomType: 'computer',
      linkedQuestId: quest.id,
    });
    showFocusWindow();
    openFocusWindow();
  };

  const empty = total === 0;

  return (
    <div
      className="dt-widget dt-widget--quest"
      onClick={() => navigate('/quests')}
      role="button"
      tabIndex={0}
      aria-label="今日任務"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/quests');
        }
      }}
    >
      <div className="dt-widget-inner">
        <div className="dt-widget-top">
          <div className="dt-widget-date">今日任務</div>
          <div className="dt-widget-quest-icon">
            <AppIcon name="quest" size={24} />
          </div>
        </div>

        <div className="dt-widget-body">
          {empty ? (
            <div className="dt-widget-status dt-widget-status--empty">
              <span className="dt-status-label">今天還沒有任務</span>
              <span className="dt-status-sub">建立今日主線</span>
            </div>
          ) : (
            <div className="dt-widget-status">
              <span className="dt-status-label">
                已完成 {completed} / 共 {total}
              </span>
              {main && <span className="dt-status-sub">{main.title}</span>}
            </div>
          )}

          <div className="dt-widget-reward">
            {main && main.status !== 'completed' && (
              <button
                type="button"
                className="dt-cta-button dt-cta-button--quest"
                onClick={(e) => {
                  e.stopPropagation();
                  execute(main);
                }}
              >
                開始執行
              </button>
            )}
            {!main && !empty && completed < total && (
              <span className="dt-reward-item">尚有 {total - completed} 項待完成</span>
            )}
            {completed === total && total > 0 && (
              <span className="dt-reward-item dt-reward-item--done">全部完成</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
