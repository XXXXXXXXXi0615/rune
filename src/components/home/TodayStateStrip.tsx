import { useNavigate } from 'react-router-dom';
import { useTodayState } from '@/features/home/useTodayState';
import { useTideRailStore } from '@/store/useTideRailStore';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import './TodayStateStrip.css';

export function TodayStateStrip() {
  const state = useTodayState();
  const navigate = useNavigate();
  const openRitual = useTideRailStore((store) => store.openWindow);
  const items = [
    state.checkin.available && { id: 'checkin', tone: state.checkin.status, label: state.checkin.status === 'completed' ? '已打卡 ✓' : state.checkin.status === 'late' ? '已打卡 · 遲到' : state.checkin.status === 'missed' ? '今日漏簽' : '尚未打卡', action: () => openRitual('checkin') },
    state.hydration.available && { id: 'hydration', tone: state.hydration.completed ? 'completed' : 'pending', label: `飲水 ${state.hydration.currentMl} / ${state.hydration.goalMl}`, action: () => openRitual('hydration') },
    state.mainQuest.available && { id: 'mainQuest', tone: state.mainQuest.status, label: state.mainQuest.status === 'none' ? '主線未建立' : `主線 · ${state.mainQuest.title}`, action: () => navigate('/quests') },
    state.moonlex.available && { id: 'moonlex', tone: state.moonlex.completed ? 'completed' : 'pending', label: `MoonLex ${state.moonlex.completedCount} / ${state.moonlex.targetCount}`, action: () => navigate('/moonlex') },
    state.tidebound.available && { id: 'tidebound', tone: state.tidebound.active ? 'active' : state.tidebound.focusedMinutes > 0 ? 'completed' : 'pending', label: state.tidebound.active ? `專注中 · ${state.tidebound.focusedMinutes} 分` : `專注 ${state.tidebound.focusedMinutes} 分`, action: () => {
      useFocusWindowStore.getState().openWindow();
      useFocusIslandStore.getState().showWindow();
    } },
    state.period.available && { id: 'period', tone: 'active', label: state.period.label!, action: () => navigate('/period') },
  ].filter(Boolean) as Array<{ id: string; tone: string; label: string; action: () => void }>;
  if (items.length === 0) return null;
  return <section className="today-state-strip today-storybook-ribbon" aria-label={`今天 ${state.dateKey}`} data-testid="today-state-strip"><span className="today-state-strip__label">今天</span><div className="today-state-strip__scroller">{items.map((item) => <button key={item.id} type="button" className={`today-state-chip is-${item.tone}`} data-today-state-id={item.id} onClick={item.action} aria-label={item.label}><span>{item.label}</span></button>)}</div></section>;
}
