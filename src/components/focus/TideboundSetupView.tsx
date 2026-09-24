import { TideboundModeGrid, type TideboundModeDef, TIDEBOUND_MODES } from './TideboundModeGrid';
import { TideboundDurationControl } from './TideboundDurationControl';
import { TideboundAdvancedSettings } from './TideboundAdvancedSettings';
import type { TideboundMode } from './types';

interface TideboundSetupViewProps {
  task: string;
  onTaskChange: (task: string) => void;
  mode: TideboundMode | null;
  onModeSelect: (mode: TideboundMode, minutes: number) => void;
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  breakMinutes: number;
  onBreakChange: (minutes: number) => void;
  rounds: number;
  onRoundsChange: (rounds: number) => void;
  loopMode: boolean;
  onLoopModeChange: (v: boolean) => void;
  witnessEnabled: boolean;
  allowRecall: boolean;
  autoMemory: boolean;
  reminderEnabled: boolean;
  soundEnabled: boolean;
  onWitnessChange: (v: boolean) => void;
  onRecallChange: (v: boolean) => void;
  onAutoMemoryChange: (v: boolean) => void;
  onReminderChange: (v: boolean) => void;
  onSoundChange: (v: boolean) => void;
  onStart: () => void;
  showTitle?: boolean;
  onOpenAdvanced?: () => void;
}

function clampRounds(n: number): number {
  return Math.max(1, Math.min(12, Number.isFinite(n) ? Math.round(n) : 1));
}

export function TideboundSetupView({
  task,
  onTaskChange,
  mode,
  onModeSelect,
  durationMinutes,
  onDurationChange,
  breakMinutes,
  onBreakChange,
  rounds,
  onRoundsChange,
  loopMode,
  onLoopModeChange,
  witnessEnabled,
  allowRecall,
  autoMemory,
  reminderEnabled,
  soundEnabled,
  onWitnessChange,
  onRecallChange,
  onAutoMemoryChange,
  onReminderChange,
  onSoundChange,
  onStart,
  showTitle = true,
}: TideboundSetupViewProps) {
  return (
    <div className="tb-setup">
      {showTitle && (
        <div className="tb-setup-header">
          <h2 className="tb-setup-title">TIDEBOUND · 開始這一輪</h2>
        </div>
      )}

      <div className="tb-task-section">
        <input
          type="text"
          className="tb-task-input"
          value={task}
          onChange={(e) => onTaskChange(e.target.value)}
          placeholder="這一輪只做什麼？（可留空）"
          aria-label="任務名稱"
        />
        {!task.trim() && (
          <span className="tb-task-hint">不填也可以，我會陪你進入狀態。</span>
        )}
      </div>

      <TideboundModeGrid
        selectedMode={mode}
        onSelect={onModeSelect}
      />

      <TideboundDurationControl
        minutes={durationMinutes}
        onChange={onDurationChange}
      />

      <div className="tb-config-row">
        <label className="tb-config-item">
          <span className="tb-config-label">休息</span>
          <div className="tb-config-stepper">
            <button
              type="button"
              className="tb-stepper-btn"
              onClick={() => onBreakChange(Math.max(1, breakMinutes - 1))}
              aria-label="减少休息时间"
            >−</button>
            <span className="tb-config-value">{breakMinutes} 分</span>
            <button
              type="button"
              className="tb-stepper-btn"
              onClick={() => onBreakChange(Math.min(30, breakMinutes + 1))}
              aria-label="增加休息时间"
            >+</button>
          </div>
        </label>

        <label className="tb-config-item">
          <span className="tb-config-label">輪數</span>
          <div className="tb-config-stepper">
            <button
              type="button"
              className="tb-stepper-btn"
              onClick={() => onRoundsChange(clampRounds(rounds - 1))}
              aria-label="减少轮数"
            >−</button>
            <span className="tb-config-value">{rounds} 輪</span>
            <button
              type="button"
              className="tb-stepper-btn"
              onClick={() => onRoundsChange(clampRounds(rounds + 1))}
              aria-label="增加轮数"
            >+</button>
          </div>
        </label>
      </div>

      <label className="tb-toggle-row">
        <span>循環模式<small>完成後自動開始下一輪</small></span>
        <button
          type="button"
          className={`tb-toggle${loopMode ? ' tb-toggle--on' : ''}`}
          onClick={() => onLoopModeChange(!loopMode)}
          role="switch"
          aria-checked={loopMode}
        >
          <span className="tb-toggle-knob" />
        </button>
      </label>

      <button type="button" className="tb-cta" onClick={onStart}>
        開始這一輪
      </button>

      <TideboundAdvancedSettings
        witnessEnabled={witnessEnabled}
        allowRecall={allowRecall}
        autoMemory={autoMemory}
        reminderEnabled={reminderEnabled}
        soundEnabled={soundEnabled}
        onWitnessChange={onWitnessChange}
        onRecallChange={onRecallChange}
        onAutoMemoryChange={onAutoMemoryChange}
        onReminderChange={onReminderChange}
        onSoundChange={onSoundChange}
      />
    </div>
  );
}
