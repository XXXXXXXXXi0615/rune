import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Quest } from '@/store/useQuestStore';
import { useQuestStore } from '@/store/useQuestStore';

const COMPLETION_MOTION_MS = 260;

function sortByCompletion(quests: readonly Quest[]): string[] {
  return [...quests]
    .sort((left, right) => Number(left.status === 'completed') - Number(right.status === 'completed'))
    .map((quest) => quest.id);
}

export function CalendarTodoList({ quests }: { quests: readonly Quest[] }) {
  const toggleQuestCompletion = useQuestStore((state) => state.toggleQuestCompletion);
  const reduceMotion = Boolean(useReducedMotion());
  const [visualOrder, setVisualOrder] = useState<string[]>(() => sortByCompletion(quests));
  const timersRef = useRef(new Map<string, number>());
  const questIds = useMemo(() => new Set(quests.map((quest) => quest.id)), [quests]);

  useEffect(() => {
    setVisualOrder((current) => {
      const retained = current.filter((id) => questIds.has(id));
      const added = quests.map((quest) => quest.id).filter((id) => !retained.includes(id));
      return [...retained, ...added];
    });
  }, [questIds, quests]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const reorder = useCallback(() => {
    const current = useQuestStore.getState().quests.filter((quest) => questIds.has(quest.id));
    setVisualOrder(sortByCompletion(current));
  }, [questIds]);

  const toggle = useCallback((quest: Quest) => {
    const existingTimer = timersRef.current.get(quest.id);
    if (existingTimer) window.clearTimeout(existingTimer);
    if (!toggleQuestCompletion(quest.id)) return;

    if (reduceMotion) {
      reorder();
      return;
    }

    const timer = window.setTimeout(() => {
      timersRef.current.delete(quest.id);
      reorder();
    }, COMPLETION_MOTION_MS);
    timersRef.current.set(quest.id, timer);
  }, [reduceMotion, reorder, toggleQuestCompletion]);

  const questsById = useMemo(() => new Map(quests.map((quest) => [quest.id, quest])), [quests]);
  const orderedQuests = visualOrder.map((id) => questsById.get(id)).filter((quest): quest is Quest => Boolean(quest));

  return (
    <section className="calendar-todo-list" aria-label="當日待辦" data-testid="calendar-todo-list">
      {orderedQuests.length === 0 ? (
        <p className="calendar-todo-empty">今天沒有待辦。</p>
      ) : (
        <div className="calendar-todo-rows">
          {orderedQuests.map((quest) => {
            const completed = quest.status === 'completed';
            return (
              <motion.div
                layout={!reduceMotion}
                transition={{ layout: { duration: 0.26, ease: [0.2, 0.85, 0.3, 1] } }}
                key={quest.id}
                className={`calendar-todo-row${completed ? ' is-completed' : ''}`}
                data-quest-id={quest.id}
                data-completed={completed}
              >
                <span className="calendar-todo-title"><span>{quest.title}</span></span>
                <button
                  type="button"
                  className="calendar-todo-toggle"
                  aria-label={completed ? `取消完成：${quest.title}` : `完成：${quest.title}`}
                  aria-pressed={completed}
                  onClick={() => toggle(quest)}
                >
                  <span aria-hidden="true" className="calendar-todo-ring">
                    <svg viewBox="0 0 20 20"><path d="m5 10.4 3 3L15.3 6" /></svg>
                  </span>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
