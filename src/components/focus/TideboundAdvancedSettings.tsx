import { useState } from 'react';

interface TideboundAdvancedSettingsProps {
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
}

export function TideboundAdvancedSettings({
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
}: TideboundAdvancedSettingsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`tb-advanced${expanded ? ' tb-advanced--open' : ''}`}>
      <button
        type="button"
        className="tb-advanced-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span>更多設置</span>
        <svg
          viewBox="0 0 24 24"
          width={16}
          height={16}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`tb-chevron${expanded ? ' tb-chevron--open' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="tb-advanced-body">
          <label className="tb-toggle-row">
            <span>月潮見證</span>
            <button
              type="button"
              className={`tb-toggle${witnessEnabled ? ' tb-toggle--on' : ''}`}
              onClick={() => onWitnessChange(!witnessEnabled)}
              role="switch"
              aria-checked={witnessEnabled}
            >
              <span className="tb-toggle-knob" />
            </button>
          </label>

          <label className={`tb-toggle-row tb-toggle-row--sub${!witnessEnabled ? ' tb-toggle-row--disabled' : ''}`}>
            <span>允許 AI 參考</span>
            <button
              type="button"
              className={`tb-toggle${allowRecall && witnessEnabled ? ' tb-toggle--on' : ''}`}
              onClick={() => { if (witnessEnabled) onRecallChange(!allowRecall); }}
              role="switch"
              aria-checked={allowRecall}
              disabled={!witnessEnabled}
            >
              <span className="tb-toggle-knob" />
            </button>
          </label>

          <label className="tb-toggle-row">
            <span>自動寫入記憶</span>
            <button
              type="button"
              className={`tb-toggle${autoMemory ? ' tb-toggle--on' : ''}`}
              onClick={() => onAutoMemoryChange(!autoMemory)}
              role="switch"
              aria-checked={autoMemory}
            >
              <span className="tb-toggle-knob" />
            </button>
          </label>

          <label className="tb-toggle-row">
            <span>完成提醒</span>
            <button
              type="button"
              className={`tb-toggle${reminderEnabled ? ' tb-toggle--on' : ''}`}
              onClick={() => onReminderChange(!reminderEnabled)}
              role="switch"
              aria-checked={reminderEnabled}
            >
              <span className="tb-toggle-knob" />
            </button>
          </label>

          <label className="tb-toggle-row">
            <span>專注音效</span>
            <button
              type="button"
              className={`tb-toggle${soundEnabled ? ' tb-toggle--on' : ''}`}
              onClick={() => onSoundChange(!soundEnabled)}
              role="switch"
              aria-checked={soundEnabled}
            >
              <span className="tb-toggle-knob" />
            </button>
          </label>
        </div>
      )}
    </div>
  );
}
