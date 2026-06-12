import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface WaterSettingsProps {
  onDone: () => void;
}

export function WaterSettings({ onDone }: WaterSettingsProps) {
  const water = useAppStore((s) => s.water);
  const updateWaterSettings = useAppStore((s) => s.updateWaterSettings);
  const [goalMl, setGoalMl] = useState(String(water.goalMl));
  const [cupMl, setCupMl] = useState(String(water.cupMl));

  const handleSave = () => {
    const goal = Math.max(100, Math.min(10000, Number(goalMl) || 2000));
    const cup = Math.max(50, Math.min(2000, Number(cupMl) || 200));
    updateWaterSettings(goal, cup);
    onDone();
  };

  return (
    <div className="drawer-form">
      <div>
        <label>每日目標 (ml)</label>
        <input
          type="number"
          value={goalMl}
          onChange={(e) => setGoalMl(e.target.value)}
          min={100}
          max={10000}
          step={50}
        />
      </div>

      <div>
        <label>杯子容量 (ml)</label>
        <input
          type="number"
          value={cupMl}
          onChange={(e) => setCupMl(e.target.value)}
          min={50}
          max={2000}
          step={10}
        />
      </div>

      <div className="drawer-form-actions">
        <button className="btn-ghost" onClick={onDone}>
          取消
        </button>
        <button className="btn-primary" onClick={handleSave}>
          儲存
        </button>
      </div>
    </div>
  );
}
