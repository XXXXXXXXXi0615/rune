import { describe, expect, it } from 'vitest';
import { isCapturing, isRecorderBusy, recorderTransition, type RecorderStatus } from './voiceRecorderMachine';

describe('recorder state machine', () => {
  it('walks the happy path: idle → requesting → recording → finalizing → idle', () => {
    let state: RecorderStatus = 'idle';
    state = recorderTransition(state, 'REQUEST');
    expect(state).toBe('requesting-permission');
    state = recorderTransition(state, 'GRANTED');
    expect(state).toBe('recording');
    state = recorderTransition(state, 'RELEASE');
    expect(state).toBe('finalizing');
    state = recorderTransition(state, 'FINALIZED');
    expect(state).toBe('idle');
  });

  it('supports cancel-ready with exit back to recording', () => {
    let state: RecorderStatus = 'recording';
    state = recorderTransition(state, 'CANCEL_ENTER');
    expect(state).toBe('cancel-ready');
    state = recorderTransition(state, 'CANCEL_EXIT');
    expect(state).toBe('recording');
    state = recorderTransition(state, 'CANCEL_ENTER');
    state = recorderTransition(state, 'RELEASE');
    expect(state).toBe('finalizing');
  });

  it('supports lock-ready → locked → paused → locked → finalizing', () => {
    let state: RecorderStatus = 'recording';
    state = recorderTransition(state, 'LOCK_ENTER');
    expect(state).toBe('lock-ready');
    state = recorderTransition(state, 'LOCK_COMMIT');
    expect(state).toBe('locked');
    state = recorderTransition(state, 'PAUSE');
    expect(state).toBe('paused');
    state = recorderTransition(state, 'RESUME');
    expect(state).toBe('locked');
    state = recorderTransition(state, 'SEND');
    expect(state).toBe('finalizing');
  });

  it('releasing inside the lock zone locks hands-free', () => {
    expect(recorderTransition('lock-ready', 'RELEASE')).toBe('locked');
    expect(recorderTransition('lock-ready', 'LOCK_EXIT')).toBe('recording');
  });

  it('permission denial fails, and failed can restart', () => {
    expect(recorderTransition('requesting-permission', 'DENIED')).toBe('failed');
    expect(recorderTransition('failed', 'RESET')).toBe('idle');
    expect(recorderTransition('failed', 'REQUEST')).toBe('requesting-permission');
  });

  it('ignores illegal events', () => {
    expect(recorderTransition('idle', 'PAUSE')).toBe('idle');
    expect(recorderTransition('idle', 'RELEASE')).toBe('idle');
    expect(recorderTransition('locked', 'GRANTED')).toBe('locked');
    expect(recorderTransition('finalizing', 'REQUEST')).toBe('finalizing');
  });

  it('classifies busy and capturing states', () => {
    expect(isRecorderBusy('idle')).toBe(false);
    expect(isRecorderBusy('failed')).toBe(false);
    expect(isRecorderBusy('recording')).toBe(true);
    expect(isRecorderBusy('finalizing')).toBe(true);
    expect(isCapturing('recording')).toBe(true);
    expect(isCapturing('locked')).toBe(true);
    expect(isCapturing('finalizing')).toBe(false);
  });
});
