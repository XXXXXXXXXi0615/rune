import { DAILY_MOOD_IDS, useDailyMoodStore, type MoodId } from '@/store/useDailyMoodStore';

const MOOD_PRESENTATION: Record<MoodId, { emoji: string; label: string }> = {
  calm: { emoji: '😌', label: '平靜' },
  good: { emoji: '🙂', label: '不錯' },
  neutral: { emoji: '😐', label: '普通' },
  sad: { emoji: '😢', label: '難過' },
  angry: { emoji: '😠', label: '生氣' },
  overwhelmed: { emoji: '😵', label: '不堪負荷' },
};

export function DailyMoodBar({ dateKey, todayKey }: { dateKey: string; todayKey: string }) {
  const mood = useDailyMoodStore((state) => state.moods[dateKey]);
  const toggleMood = useDailyMoodStore((state) => state.toggleMood);
  const isToday = dateKey === todayKey;
  const isFuture = dateKey > todayKey;

  return (
    <section className="dt-daily-mood" data-testid="daily-mood" aria-label={isToday ? '今日心情' : `${dateKey} 心情`}>
      <div className="dt-daily-mood__head"><span>MOOD</span><strong>{isToday ? '今日心情' : dateKey}</strong></div>
      {isToday ? (
        <div className="dt-daily-mood__choices" role="group" aria-label="選擇今日心情">
          {DAILY_MOOD_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="dt-daily-mood__button"
              aria-label={`今日心情：${MOOD_PRESENTATION[id].label}`}
              aria-pressed={mood === id}
              onClick={() => toggleMood(todayKey, id)}
              data-mood-id={id}
            ><span aria-hidden="true">{MOOD_PRESENTATION[id].emoji}</span></button>
          ))}
        </div>
      ) : (
        <div className="dt-daily-mood__readonly" data-testid="daily-mood-readonly">
          {isFuture ? '尚未到來' : mood ? <><span aria-hidden="true">{MOOD_PRESENTATION[mood].emoji}</span><span>{MOOD_PRESENTATION[mood].label}</span></> : '未記錄'}
        </div>
      )}
    </section>
  );
}
