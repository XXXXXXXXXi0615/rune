import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCallStore } from './useCallStore';
import { canTransitionCall } from '@/utils/callMachine';

function startTestCall(kind: 'voice' | 'video' = 'video') {
  return useCallStore.getState().startCall({
    kind,
    identityId: 'lunaris',
    identityName: 'LUNARIS',
    conversationId: 'conv-1',
    autoConnect: false,
  });
}

describe('simulated call store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCallStore.setState({ session: null, records: [] });
  });

  afterEach(() => {
    useCallStore.getState().dismissCall();
    vi.useRealTimers();
  });

  it('call state machine: ringing → connecting → active, with guarded transitions', () => {
    const id = startTestCall();
    expect(id).toBeTruthy();
    expect(useCallStore.getState().session?.state).toBe('ringing');

    useCallStore.getState().answerCall();
    expect(useCallStore.getState().session?.state).toBe('connecting');
    vi.advanceTimersByTime(1000);
    expect(useCallStore.getState().session?.state).toBe('active');
    expect(useCallStore.getState().session?.connectedAt).toBeTruthy();

    expect(useCallStore.getState().transitionCall('ringing' as never)).toBe(false);
    expect(useCallStore.getState().transitionCall('reconnecting')).toBe(true);
    expect(useCallStore.getState().transitionCall('active')).toBe(true);
    expect(canTransitionCall('ended', 'active')).toBe(false);
  });

  it('only one active call session at a time', () => {
    expect(startTestCall()).toBeTruthy();
    expect(startTestCall()).toBeNull();
    useCallStore.getState().hangUp('test');
    expect(useCallStore.getState().session?.state).toBe('ended');
    expect(startTestCall()).toBeTruthy();
  });

  it('camera / mic / speaker / captions toggles keep real state and log events', () => {
    startTestCall();
    const store = useCallStore.getState();
    expect(useCallStore.getState().session?.micOn).toBe(true);
    store.toggleMic();
    expect(useCallStore.getState().session?.micOn).toBe(false);
    store.toggleCamera();
    expect(useCallStore.getState().session?.cameraOn).toBe(false);
    store.toggleCamera();
    expect(useCallStore.getState().session?.cameraOn).toBe(true);
    store.toggleCaptions();
    expect(useCallStore.getState().session?.captionsOn).toBe(true);
    const events = useCallStore.getState().session?.events || [];
    expect(events.filter((event) => event.type === 'mic')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'camera')).toHaveLength(2);
    expect(events.filter((event) => event.type === 'captions')).toHaveLength(1);
  });

  it('call transcript records both speakers', () => {
    startTestCall();
    useCallStore.getState().answerCall();
    vi.advanceTimersByTime(1000);
    const greetingCount = useCallStore.getState().session?.transcript.length || 0;

    useCallStore.getState().sendCallText('你好嗎？');
    let transcript = useCallStore.getState().session?.transcript || [];
    expect(transcript).toHaveLength(greetingCount + 1);
    expect(transcript.at(-1)?.speaker).toBe('me');

    vi.advanceTimersByTime(1000);
    transcript = useCallStore.getState().session?.transcript || [];
    expect(transcript).toHaveLength(greetingCount + 2);
    expect(transcript.at(-1)?.speaker).toBe('ai');
    expect(transcript.at(-1)?.text.length).toBeGreaterThan(0);
  });

  it('hangup persists a record with participant snapshot, transcript, events, duration and shared context ids', () => {
    startTestCall();
    useCallStore.getState().answerCall();
    vi.advanceTimersByTime(1000);
    useCallStore.getState().shareContext({ type: 'journal', title: '昨晚的手記', refId: 'j-1' });
    useCallStore.getState().sendCallText('潮水記得每一次靠岸');
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(4000);

    useCallStore.getState().hangUp('user');
    const state = useCallStore.getState();
    expect(state.session?.state).toBe('ended');
    expect(state.records).toHaveLength(1);
    const record = state.records[0];
    expect(record.participants.map((participant) => participant.identityId)).toEqual(['self', 'lunaris']);
    expect(record.participants[1].displayName).toBe('LUNARIS');
    expect(record.transcript.length).toBeGreaterThanOrEqual(2);
    expect(record.durationMs).toBeGreaterThan(0);
    expect(record.sharedContextIds).toHaveLength(1);
    expect(record.events.some((event) => event.type === 'hangup')).toBe(true);
    expect(record.events.some((event) => event.type === 'context-share')).toBe(true);
  });

  it('hangup cleanup: pending timers stop and dismiss clears the session', () => {
    startTestCall();
    useCallStore.getState().answerCall();
    vi.advanceTimersByTime(1000);
    useCallStore.getState().sendCallText('這句話不該有回覆');
    useCallStore.getState().hangUp('user');
    const countAfterHangup = useCallStore.getState().session?.transcript.length;
    vi.advanceTimersByTime(5000);
    expect(useCallStore.getState().session?.transcript.length).toBe(countAfterHangup);
    expect(useCallStore.getState().session?.state).toBe('ended');

    useCallStore.getState().dismissCall();
    expect(useCallStore.getState().session).toBeNull();
    expect(useCallStore.getState().records).toHaveLength(1);
  });

  it('failCall marks the session failed without a record', () => {
    startTestCall();
    useCallStore.getState().failCall('network');
    expect(useCallStore.getState().session?.state).toBe('failed');
    expect(useCallStore.getState().session?.endReason).toBe('network');
    expect(useCallStore.getState().records).toHaveLength(0);
  });
});
