import { useMemo } from 'react';
import { useFocusSessionStore, type FocusSessionStatus } from '@/store/useFocusSessionStore';
import { getNextFocusMilestone, useFocusCareerStore } from '@/store/useFocusCareerStore';
import { FocusRoomScene, getFocusRoom } from '@/components/focus/FocusRoomScene';
import { FocusRoomStatusOverlay } from '@/components/focus/FocusRoomStatusOverlay';
import { TideboundDurationControl } from '@/components/focus/TideboundDurationControl';
import { TideboundAdvancedSettings } from '@/components/focus/TideboundAdvancedSettings';
import type { FocusRoomType } from '@/components/focus/types';
import '@/components/focus/focus-room.css';

export type RoomStatus = FocusSessionStatus | 'break' | 'sleeping';

function deriveRoomStatus(): RoomStatus {
  const session = useFocusSessionStore.getState();
  if (session.status === 'running' && session.sessionCategory === 'rest') return 'sleeping';
  if (session.status === 'running' && (session.phase === 'break' || session.sessionCategory === 'break')) return 'break';
  if (session.status === 'running') return 'running';
  if (session.status === 'paused') return 'paused';
  if (session.status === 'completed') return 'completed';
  if (session.status === 'interrupted') return 'interrupted';
  return 'idle';
}

interface FocusRoomPanelProps {
  selectedRoom: FocusRoomType;
  task?: string;
  durationMinutes?: number;
  breakMinutes?: number;
  rounds?: number;
  loopMode?: boolean;
  witnessEnabled?: boolean;
  allowRecall?: boolean;
  autoMemory?: boolean;
  reminderEnabled?: boolean;
  soundEnabled?: boolean;
  onRoomSelect?: (room: FocusRoomType) => void;
  onTaskChange?: (task: string) => void;
  onDurationChange?: (minutes: number) => void;
  onBreakChange?: (minutes: number) => void;
  onRoundsChange?: (rounds: number) => void;
  onLoopModeChange?: (enabled: boolean) => void;
  onWitnessChange?: (enabled: boolean) => void;
  onRecallChange?: (enabled: boolean) => void;
  onAutoMemoryChange?: (enabled: boolean) => void;
  onReminderChange?: (enabled: boolean) => void;
  onSoundChange?: (enabled: boolean) => void;
  onPause?: () => void;
  onResume?: () => void;
  onEnd?: () => void;
}

export function FocusRoomPanel({
  selectedRoom,
  task: draftTask = '',
  durationMinutes = 25,
  breakMinutes = 5,
  rounds = 1,
  loopMode = false,
  witnessEnabled = true,
  allowRecall = true,
  autoMemory = true,
  reminderEnabled = true,
  soundEnabled = false,
  onRoomSelect,
  onTaskChange,
  onDurationChange,
  onBreakChange,
  onRoundsChange,
  onLoopModeChange,
  onWitnessChange,
  onRecallChange,
  onAutoMemoryChange,
  onReminderChange,
  onSoundChange,
  onPause,
  onResume,
  onEnd,
}: FocusRoomPanelProps) {
  const session = useFocusSessionStore();
  const roomStatus: RoomStatus = useMemo(
    () => deriveRoomStatus(),
    [session.status, session.phase, session.sessionCategory],
  );
  const active = session.status === 'running' || session.status === 'paused';
  const room = getFocusRoom(selectedRoom);
  const careerStats = useFocusCareerStore((state) => state.stats);
  const nextMilestone = getNextFocusMilestone(careerStats.totalFocusSeconds);

  return (
    <div className="focus-room-panel" data-room-status={roomStatus} data-room-category={room.category}>
      {active ? (
        <>
          <FocusRoomStatusOverlay
            status={roomStatus}
            task={session.task}
            remaining={session.remainingSeconds}
            currentRound={session.currentRound}
            totalRounds={session.rounds || 1}
            elapsed={session.elapsedFocusSeconds}
          />
          <FocusRoomScene status={roomStatus} selectedRoom={selectedRoom} active />
          <div className="focus-room-active-actions">
            {session.status === 'running'
              ? <button type="button" className="tb-btn" onClick={onPause}>暫停</button>
              : <button type="button" className="tb-btn" onClick={onResume}>繼續</button>}
            <button type="button" className="tb-btn tb-btn--danger" onClick={onEnd}>結束</button>
          </div>
        </>
      ) : (
        <>
          <div className="focus-room-career-strip">
            <span><small>生涯專注時長</small><strong>{Math.floor(careerStats.totalFocusSeconds / 3600)}h {Math.floor((careerStats.totalFocusSeconds % 3600) / 60)}m</strong></span>
            <span><small>下一潮痕</small><strong>{nextMilestone?.title ?? 'Phase 1 已集齊'}</strong></span>
          </div>
          <div className="focus-room-timer-section">
            <span className="focus-room-section-label">這一輪的時間</span>
            <strong>{String(durationMinutes).padStart(2, '0')}:00</strong>
            <TideboundDurationControl minutes={durationMinutes} onChange={(minutes) => onDurationChange?.(minutes)} />
          </div>

          <div className="focus-room-task-section">
            <label htmlFor="tidebound-room-task">這一輪要做什麼</label>
            <input id="tidebound-room-task" type="text" className="tb-task-input" value={draftTask} onChange={(event) => onTaskChange?.(event.target.value)} placeholder="這一輪只做什麼？（可留空）" />
          </div>

          <FocusRoomScene
            status="idle"
            selectedRoom={selectedRoom}
            onRoomSelect={onRoomSelect}
            onSuggestedMinutes={(minutes) => onDurationChange?.(minutes)}
          />

          <div className="focus-room-more-settings">
            <div className="focus-room-config-row">
              <label><span>休息</span><span className="focus-room-stepper"><button type="button" onClick={() => onBreakChange?.(Math.max(1, breakMinutes - 1))}>−</button><b>{breakMinutes} 分</b><button type="button" onClick={() => onBreakChange?.(Math.min(30, breakMinutes + 1))}>+</button></span></label>
              <label><span>輪數</span><span className="focus-room-stepper"><button type="button" onClick={() => onRoundsChange?.(Math.max(1, rounds - 1))}>−</button><b>{rounds} 輪</b><button type="button" onClick={() => onRoundsChange?.(Math.min(12, rounds + 1))}>+</button></span></label>
            </div>
            <label className="tb-toggle-row"><span>循環模式<small>完成後自動開始下一輪</small></span><button type="button" className={`tb-toggle${loopMode ? ' tb-toggle--on' : ''}`} onClick={() => onLoopModeChange?.(!loopMode)} role="switch" aria-checked={loopMode}><span className="tb-toggle-knob" /></button></label>
            <TideboundAdvancedSettings witnessEnabled={witnessEnabled} allowRecall={allowRecall} autoMemory={autoMemory} reminderEnabled={reminderEnabled} soundEnabled={soundEnabled} onWitnessChange={(value) => onWitnessChange?.(value)} onRecallChange={(value) => onRecallChange?.(value)} onAutoMemoryChange={(value) => onAutoMemoryChange?.(value)} onReminderChange={(value) => onReminderChange?.(value)} onSoundChange={(value) => onSoundChange?.(value)} />
          </div>

        </>
      )}
    </div>
  );
}
