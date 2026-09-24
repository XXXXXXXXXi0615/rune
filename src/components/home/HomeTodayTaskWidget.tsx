import { useNavigate } from 'react-router-dom';
import { useQuestStore } from '@/store/useQuestStore';
import { toLocalDateString } from '@/utils/date';
import type { HomeWidgetSize } from '@/features/home/types';
import { HomeWidgetIcon } from './HomeWidgetIcon';

export function HomeTodayTaskWidget({ size }: { size: HomeWidgetSize }) {
  const navigate = useNavigate();
  const quests = useQuestStore((s) => s.quests);
  const safeQuests = quests ?? [];
  const mainQuestId = useQuestStore((s) => s.mainQuestByDate?.[toLocalDateString()]);
  const mainQuest = safeQuests.find((q) => q.id === mainQuestId);
  const activeTasks = safeQuests.filter((q) => q.status === 'in_progress' || q.status === 'available');
  const title = mainQuest?.title ?? activeTasks[0]?.title ?? null;

  if (!title) {
    return (
      <button type="button" className="hwg-widget hwg-widget--task home-task-card" data-home-widget-id="home-today-task"
        data-pet-safe-region="interactive"
        data-home-widget-state="empty"
        data-home-widget-size={size}
        onClick={() => navigate('/quests')}>
        <div className="home-task-card__copy">
          <span className="hw-kicker">今日主線</span>
          <strong className="hw-title">今天還沒有決定航向</strong>
          {size !== 'small' && <span className="home-task-card__action">建立今日主線</span>}
        </div>
        <div className="home-task-route" aria-hidden="true">
          <i /><i /><i className="is-destination"><HomeWidgetIcon name="task" size="xs" decorative /></i>
        </div>
      </button>
    );
  }

  const subtasks = mainQuest?.subtasks ?? [];
  const completed = subtasks.filter((task) => task.completed).length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <button type="button" className="hwg-widget hwg-widget--task home-task-card" data-home-widget-id="home-today-task"
      data-pet-safe-region="interactive"
      data-home-widget-state="active"
      data-home-widget-size={size}
      onClick={() => navigate('/quests')}
      >
      <div className="home-task-card__copy">
        <span className="hw-kicker">今日主線</span>
        <strong className="hw-title">{title}</strong>
        {size !== 'small' && <span className="hw-meta">{total > 0 ? `完成 ${completed} / ${total}` : `${activeTasks.length} 項進行中`}</span>}
      </div>
      <div className="home-task-progress" aria-label={total > 0 ? `完成 ${completed} / ${total}` : '主線進行中'}>
        <span style={{ width: `${progress}%` }} />
        <i /><i /><i />
      </div>
    </button>
  );
}
