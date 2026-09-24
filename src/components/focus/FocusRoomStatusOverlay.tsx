import type { RoomStatus } from '@/components/focus/FocusRoomPanel';

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface FocusRoomStatusOverlayProps {
  status: RoomStatus;
  task?: string;
  remaining: number;
  currentRound: number;
  totalRounds: number;
  elapsed: number;
}

const STATUS_ICONS: Record<RoomStatus, string> = {
  idle: '○',
  running: '▶',
  paused: 'Ⅱ',
  break: '◇',
  completed: '✓',
  interrupted: '×',
  sleeping: '–',
};

export function FocusRoomStatusOverlay({
  status,
  task,
  remaining,
  currentRound,
  totalRounds,
  elapsed,
}: FocusRoomStatusOverlayProps) {
  return (
    <div className="focus-room-overlay" data-room-status={status}>
      <div className="focus-room-overlay-inner">
        <span className="focus-room-overlay-icon">{STATUS_ICONS[status]}</span>
        {task && <span className="focus-room-overlay-task">{task}</span>}
        {(status === 'running' || status === 'break' || status === 'paused') && (
          <span className="focus-room-overlay-timer">
            {fmtTime(remaining)}{' '}
            <small>
              第 {currentRound}/{totalRounds} 輪
            </small>
          </span>
        )}
        {(status === 'completed' || status === 'interrupted') && (
          <span className="focus-room-overlay-elapsed">
            已專注 {Math.round(elapsed / 60)} 分鐘
          </span>
        )}
      </div>
    </div>
  );
}
