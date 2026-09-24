export type RecorderStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'cancel-ready'
  | 'lock-ready'
  | 'locked'
  | 'paused'
  | 'finalizing'
  | 'failed';

export type RecorderEvent =
  | 'REQUEST'
  | 'GRANTED'
  | 'DENIED'
  | 'CANCEL_ENTER'
  | 'CANCEL_EXIT'
  | 'LOCK_ENTER'
  | 'LOCK_EXIT'
  | 'LOCK_COMMIT'
  | 'RELEASE'
  | 'PAUSE'
  | 'RESUME'
  | 'CANCEL'
  | 'SEND'
  | 'FINALIZED'
  | 'FAIL'
  | 'RESET';

const TRANSITIONS: Record<RecorderStatus, Partial<Record<RecorderEvent, RecorderStatus>>> = {
  idle: { REQUEST: 'requesting-permission' },
  'requesting-permission': { GRANTED: 'recording', DENIED: 'failed', RELEASE: 'finalizing', FAIL: 'failed', CANCEL: 'finalizing' },
  recording: {
    CANCEL_ENTER: 'cancel-ready',
    LOCK_ENTER: 'lock-ready',
    LOCK_COMMIT: 'locked',
    RELEASE: 'finalizing',
    CANCEL: 'finalizing',
    SEND: 'finalizing',
    FAIL: 'failed',
  },
  'cancel-ready': { CANCEL_EXIT: 'recording', RELEASE: 'finalizing', CANCEL: 'finalizing', FAIL: 'failed' },
  'lock-ready': { LOCK_EXIT: 'recording', LOCK_COMMIT: 'locked', RELEASE: 'locked', CANCEL: 'finalizing', SEND: 'finalizing', FAIL: 'failed' },
  locked: { PAUSE: 'paused', CANCEL: 'finalizing', SEND: 'finalizing', FAIL: 'failed' },
  paused: { RESUME: 'locked', CANCEL: 'finalizing', SEND: 'finalizing', FAIL: 'failed' },
  finalizing: { FINALIZED: 'idle', FAIL: 'failed' },
  failed: { RESET: 'idle', REQUEST: 'requesting-permission' },
};

/** Pure transition function — returns the same state for illegal events. */
export function recorderTransition(status: RecorderStatus, event: RecorderEvent): RecorderStatus {
  return TRANSITIONS[status]?.[event] ?? status;
}

export function isRecorderBusy(status: RecorderStatus): boolean {
  return status !== 'idle' && status !== 'failed';
}

/** Recording is actively capturing audio (waveform / timer should advance). */
export function isCapturing(status: RecorderStatus): boolean {
  return status === 'recording' || status === 'cancel-ready' || status === 'lock-ready' || status === 'locked';
}
