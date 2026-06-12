import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BackButton } from '@/components/layout/BackButton';
import { Card } from '@/components/ui/Card';
import { CalendarView } from '@/components/calendar/CalendarView';
import { TodoSection } from '@/components/calendar/TodoSection';
import { CountdownSection } from '@/components/calendar/CountdownSection';
import { WaterSection } from '@/components/calendar/WaterSection';
import { TodoSheet } from '@/components/calendar/TodoSheet';
import { useAppStore } from '@/store/useAppStore';
import { t, getLanguage } from '@/i18n';
import type { TodoItem } from '@/types';

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CalendarPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const todos = useAppStore((s) => s.todos);
  const countdowns = useAppStore((s) => s.countdowns);
  const water = useAppStore((s) => s.water);
  const memoryEntries = useAppStore((s) => s.memoryEntries);
  const diaryEntries = useAppStore((s) => s.diaryEntries);
  const music = useAppStore((s) => s.music);
  const resetWaterIfNeeded = useAppStore((s) => s.resetWaterIfNeeded);

  const today = new Date();
  const todayStr = formatDateStr(today);
  const initialParams = new URLSearchParams(location.search);
  const initialQueryDate = initialParams.get('date');
  const [selectedDate, setSelectedDate] = useState(initialQueryDate || todayStr);
  const [todoSheetOpen, setTodoSheetOpen] = useState(initialParams.get('action') === 'new');
  const [editingTodo, setEditingTodo] = useState<TodoItem | undefined>();

  useEffect(() => {
    resetWaterIfNeeded();
  }, [resetWaterIfNeeded]);

  const todoSummaries = useMemo(() => {
    const summaries = new Map<string, { total: number; completed: number; incomplete: number; highPriority: boolean }>();
    for (const todo of todos) {
      const current = summaries.get(todo.date) || { total: 0, completed: 0, incomplete: 0, highPriority: false };
      current.total += 1;
      if (todo.completed) current.completed += 1;
      else current.incomplete += 1;
      if (!todo.completed && todo.priority === 'high') current.highPriority = true;
      summaries.set(todo.date, current);
    }
    return summaries;
  }, [todos]);

  const memoryDates = useMemo(() => {
    const s = new Set<string>();
    for (const m of memoryEntries) {
      const d = new Date(m.createdAt).toISOString().slice(0, 10);
      s.add(d);
    }
    return s;
  }, [memoryEntries]);

  const waterDates = useMemo(() => {
    const s = new Set<string>();
    const logs = water.dailyLogs || {};
    for (const d of Object.keys(logs)) {
      if ((logs[d] || 0) > 0) s.add(d);
    }
    if (water.todayMl > 0) s.add(water.updatedDate || todayStr);
    return s;
  }, [water, todayStr]);

  const allPending = todos.filter((todo) => !todo.completed).length;

  // Date emotions: anxietyLevel → emoji, diaryMood → emoji
  const dateEmotions = useMemo(() => {
    const m = new Map<string, string[]>();
    const emojiMap: Record<string, string> = { joy: '😊', calm: '😌', tired: '😴', anxious: '😰', blank: '💭' };
    for (const mem of memoryEntries) {
      const d = new Date(mem.createdAt).toISOString().slice(0, 10);
      const em = mem.anxietyLevel >= 7 ? '😭' : mem.anxietyLevel >= 5 ? '😡' : mem.anxietyLevel >= 3 ? '😊' : '😴';
      const arr = m.get(d) || [];
      if (!arr.includes(em)) arr.push(em);
      m.set(d, arr);
    }
    for (const de of diaryEntries) {
      const em = emojiMap[de.mood || 'blank'] || '💭';
      const arr = m.get(de.date) || [];
      if (!arr.includes(em)) arr.push(em);
      m.set(de.date, arr);
    }
    // Music track creation dates
    for (const t of music.tracks) {
      const d = new Date(t.createdAt).toISOString().slice(0, 10);
      const arr = m.get(d) || [];
      if (!arr.includes('🎵')) arr.push('🎵');
      m.set(d, arr);
    }
    return m;
  }, [memoryEntries, diaryEntries, music.tracks]);

  const lang = getLanguage();
  const locale = lang === 'en' ? 'en-US' : 'zh-TW';
  const selDate = new Date(selectedDate + 'T00:00:00');
  const weekdayLabel = selDate.toLocaleDateString(locale, { weekday: 'short' });
  const dateLabel = selDate.toLocaleDateString(locale, { month: 'long', day: 'numeric' });

  return (
    <section id="calendar-view" className="view">
      <BackButton to="/" />
      <Header eyebrow={t('calendar.eyebrow')} title={t('calendar.title')} />

      <Card>
        <CalendarView
          todoSummaries={todoSummaries}
          memoryDates={memoryDates}
          waterDates={waterDates}
          dateEmotions={dateEmotions}
          selectedDate={selectedDate}
          todayStr={todayStr}
          onSelectDate={setSelectedDate}
        />
        <div className="today-summary">
          <span className="today-summary-date">{dateLabel}</span>
          <span className="today-summary-weekday">{weekdayLabel}</span>
          <div className="today-summary-stats">
            {allPending > 0 && <span>{t('calendar.pendingTodos').replace('{n}', String(allPending))}</span>}
            {countdowns.length > 0 && <span>{t('calendar.countdowns').replace('{n}', String(countdowns.length))}</span>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="calendar-section">
          <TodoSection
            todos={todos}
            selectedDate={selectedDate}
            onAddTodo={() => {
              setEditingTodo(undefined);
              setTodoSheetOpen(true);
            }}
            onEditTodo={(todo) => {
              setEditingTodo(todo);
              setTodoSheetOpen(true);
            }}
          />
        </div>
      </Card>

      <Card>
        <div className="calendar-section">
          <CountdownSection countdowns={countdowns} />
        </div>
      </Card>

      <Card>
        <div className="calendar-section">
          <WaterSection water={water} selectedDate={selectedDate} todayStr={todayStr} />
        </div>
      </Card>

      {todoSheetOpen && (
        <TodoSheet
          initialDate={selectedDate}
          todo={editingTodo}
          onClose={() => {
            setTodoSheetOpen(false);
            setEditingTodo(undefined);
            if (location.search) navigate('/calendar', { replace: true });
          }}
        />
      )}
    </section>
  );
}
