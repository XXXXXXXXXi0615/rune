import type { FocusAchievement } from '@/features/focus/getFocusStatistics';
import { AchievementIcon } from './FocusIcons';

interface Props {
  achievements: FocusAchievement[];
}

export function FocusAchievementGrid({ achievements }: Props) {
  return (
    <div className="fsv-achievements">
      <div className="fsv-section-title">成就</div>
      <div className="fsv-ach-grid">
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className={`fsv-ach-card${ach.unlocked ? ' is-unlocked' : ''}`}
          >
            <div className="fsv-ach-icon">
              <AchievementIcon id={ach.icon} size={28} />
            </div>
            <div className="fsv-ach-info">
              <div className="fsv-ach-title">{ach.title}</div>
              <div className="fsv-ach-desc">{ach.description}</div>
              <div className="fsv-ach-progress">
                <div className="fsv-ach-bar">
                  <div
                    className="fsv-ach-bar-fill"
                    style={{ width: `${Math.round((ach.progress / ach.target) * 100)}%` }}
                  />
                </div>
                <span className="fsv-ach-progress-text">
                  {ach.progress} / {ach.target}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
