import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/layout/BackButton';
import { QuestEditorSheet } from '@/components/quests/QuestEditorSheet';
import { QuestIcon } from '@/components/icons/QuestIcon';
import { useQuestStore, getQuestDateKey, getQuestStreak, type Quest, type QuestStatus } from '@/store/useQuestStore';
import { useAppStore } from '@/store/useAppStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { toLocalDateString } from '@/utils/date';
import '@/styles/quests.css';

type QuestTab = 'today' | 'available' | 'active' | 'completed';
const TABS: Array<{ id: QuestTab; label: string }> = [{ id: 'today', label: '今日' }, { id: 'available', label: '可領取' }, { id: 'active', label: '執行中' }, { id: 'completed', label: '已完成' }];

export function QuestPage() {
  const navigate = useNavigate();
  const todos = useAppStore((state) => state.todos || []);
  const quests = useQuestStore((state) => state.quests);
  const migrate = useQuestStore((state) => state.migrateLegacyTodos);
  const claim = useQuestStore((state) => state.claimQuest);
  const start = useQuestStore((state) => state.startQuest);
  const complete = useQuestStore((state) => state.completeQuest);
  const undo = useQuestStore((state) => state.undoCompletion);
  const archive = useQuestStore((state) => state.archiveQuest);
  const setMain = useQuestStore((state) => state.setMainQuest);
  const mainQuestByDate = useQuestStore((state) => state.mainQuestByDate);
  const startFocus = useFocusSessionStore((state) => state.startSession);
  const showFocusWindow = useFocusIslandStore((state) => state.showWindow);
  const openFocusWindow = useFocusWindowStore((state) => state.openWindow);
  const [tab, setTab] = useState<QuestTab>('today');
  const [editorOpen, setEditorOpen] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);
  const today = toLocalDateString();

  useEffect(() => { migrate(todos); }, [migrate, todos]);
  const todayQuests = useMemo(() => quests.filter((quest) => getQuestDateKey(quest) === today && quest.status !== 'archived'), [quests, today]);
  const completedToday = todayQuests.filter((quest) => quest.status === 'completed').length;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const weekCompleted = quests.filter((quest) => quest.completedAt && new Date(quest.completedAt) >= weekStart).length;
  const mainQuest = quests.find((quest) => quest.id === mainQuestByDate[today]);
  const visible = useMemo(() => {
    if (tab === 'today') return todayQuests.filter((quest) => ['claimed', 'in_progress', 'completed'].includes(quest.status));
    if (tab === 'available') return quests.filter((quest) => quest.status === 'available').sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999'));
    if (tab === 'active') return quests.filter((quest) => quest.status === 'claimed' || quest.status === 'in_progress');
    return quests.filter((quest) => quest.status === 'completed').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  }, [quests, tab, todayQuests]);

  const execute = (quest: Quest) => {
    start(quest.id);
    startFocus({ durationMinutes: quest.estimatedMinutes || 25, restMinutes: 5, rounds: 1, task: quest.title, category: 'focus', roomType: 'computer', linkedQuestId: quest.id });
    showFocusWindow(); openFocusWindow();
  };

  return <section className="quest-page" data-testid="quest-page-root">
    <header className="quest-header"><BackButton to="/" /><div><QuestIcon size={28} className="quest-header-icon" /><p>把想推進的事裝進今天，慢慢完成。</p></div><div className="quest-header-actions"><button type="button" className="quest-tiderail" onClick={() => navigate('/quests/tiderail')}>潮軌</button><button type="button" className="quest-create" onClick={() => setEditorOpen(true)}>建立任務</button></div></header>
    <div className="quest-stats">
      <article><span>今日主線</span><strong>{mainQuest?.title || '尚未選擇'}</strong></article><article><span>今日已完成</span><strong>{completedToday}</strong></article><article><span>連續出勤</span><strong>{getQuestStreak(quests)} 天</strong></article><article><span>本週完成</span><strong>{weekCompleted}</strong></article>
    </div>
    <nav className="quest-tabs" role="tablist">{TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
    {visible.length === 0 ? <div className="quest-empty"><QuestIcon size={38} /><h2>{tab === 'today' ? '今天還沒有領取任務' : '現實世界還沒有生成任務'}</h2><p>{tab === 'today' ? '從任務板選一項，作為今天的行動目標。' : '先寫下一件今天準備推進的事情。'}</p><button type="button" onClick={() => tab === 'today' ? setTab('available') : setEditorOpen(true)}>{tab === 'today' ? '查看可領取任務' : '創建第一項任務'}</button></div> : <div className="quest-grid">{visible.map((quest) => <QuestCard key={quest.id} quest={quest} isMain={mainQuest?.id === quest.id} onClaim={() => claim(quest.id)} onStart={() => execute(quest)} onComplete={() => { if (complete(quest.id)) { setUndoId(quest.id); window.setTimeout(() => setUndoId((id) => id === quest.id ? null : id), 8000); } }} onArchive={() => archive(quest.id)} onMain={() => setMain(quest.id)} />)}</div>}
    {undoId && <div className="quest-undo">任務已結算 <button type="button" onClick={() => { undo(undoId); setUndoId(null); }}>撤銷</button></div>}
    {editorOpen && <QuestEditorSheet onClose={() => setEditorOpen(false)} />}
  </section>;
}

function QuestCard({ quest, isMain, onClaim, onStart, onComplete, onArchive, onMain }: { quest: Quest; isMain: boolean; onClaim: () => void; onStart: () => void; onComplete: () => void; onArchive: () => void; onMain: () => void }) {
  const completed = quest.subtasks.filter((item) => item.completed).length;
  const due = quest.dueAt ? new Date(quest.dueAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '沒有期限';
  const reward = quest.rewardTier === 'large' ? 10 : quest.rewardTier === 'normal' ? 5 : 2;
  const labels: Record<QuestStatus, string> = { available: '可領取', claimed: '已領取', in_progress: '執行中', completed: '已完成', abandoned: '已放棄', archived: '已封存' };
  return <article className={`quest-card is-${quest.status}`}>
    <div className="quest-card-head"><span>{quest.categoryId || '未分類'} · {quest.priority === 'high' ? '高優先' : quest.priority === 'low' ? '低優先' : '一般'}</span><b>{labels[quest.status]}</b></div>
    <h2>{quest.title}</h2>{quest.description && <p>{quest.description}</p>}
    <div className="quest-card-meta"><span>截止 {due}</span><span>預計 {quest.estimatedMinutes || 25} 分鐘</span><span>專注 {quest.focusedMinutes} 分鐘</span>{quest.subtasks.length > 0 && <span>步驟 {completed}/{quest.subtasks.length}</span>}</div>
    <div className="quest-reward">完成預覽 <strong>+{reward} 月印</strong>{isMain && <em>今日主線 +3</em>}</div>
    <footer>{quest.status === 'available' && <button type="button" onClick={onClaim}>領取任務</button>}{quest.status === 'claimed' && <button type="button" onClick={onStart}>開始執行</button>}{quest.status === 'in_progress' && <><button type="button" onClick={onStart}>繼續執行</button><button type="button" onClick={onComplete}>標記完成</button></>}{quest.status === 'completed' && <button type="button" onClick={onArchive}>歸檔</button>}{!isMain && quest.status !== 'completed' && <button type="button" className="quiet" onClick={onMain}>設為今日主線</button>}</footer>
  </article>;
}
