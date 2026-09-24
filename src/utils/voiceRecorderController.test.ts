import { describe, expect, it, vi } from 'vitest';
import { createVoiceRecorderController, type RecorderDeps } from './voiceRecorderController';
import type { RecorderStatus } from './voiceRecorderMachine';

interface Harness {
  deps: RecorderDeps;
  track: { stop: ReturnType<typeof vi.fn> };
  contextClose: ReturnType<typeof vi.fn>;
  recorder: {
    state: 'inactive' | 'recording' | 'paused';
    mimeType: string;
    ondataavailable: ((event: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
    start: (timeslice?: number) => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
  };
  tick: (times?: number) => void;
  advance: (ms: number) => void;
  activeIntervals: () => number;
}

function makeHarness(): Harness {
  let now = 0;
  const intervals = new Map<number, () => void>();
  let nextIntervalId = 1;
  const track = { stop: vi.fn() };
  const contextClose = vi.fn(async () => {});
  const recorder: Harness['recorder'] = {
    state: 'inactive',
    mimeType: 'audio/webm',
    ondataavailable: null,
    onstop: null,
    start() {
      this.state = 'recording';
      this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'audio/webm' }) });
    },
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    },
    pause() { this.state = 'paused'; },
    resume() { this.state = 'recording'; },
  };
  const analyser = {
    fftSize: 0,
    frequencyBinCount: 8,
    getByteTimeDomainData: (data: Uint8Array) => { data.fill(180); },
  };
  const deps: RecorderDeps = {
    getUserMedia: async () => ({ getTracks: () => [track] }),
    createRecorder: () => recorder,
    createAudioContext: () => ({
      createMediaStreamSource: () => ({ connect: () => undefined }),
      createAnalyser: () => analyser,
      close: contextClose,
    }),
    now: () => now,
    setInterval: (fn: () => void) => {
      const id = nextIntervalId++;
      intervals.set(id, fn);
      return id;
    },
    clearInterval: (id: number) => { intervals.delete(id); },
  };
  return {
    deps,
    track,
    contextClose,
    recorder,
    tick: (times = 1) => {
      for (let index = 0; index < times; index++) {
        now += 50;
        [...intervals.values()].forEach((fn) => fn());
      }
    },
    advance: (ms) => { now += ms; },
    activeIntervals: () => intervals.size,
  };
}

function makeCallbacks() {
  const statuses: RecorderStatus[] = [];
  return {
    statuses,
    callbacks: {
      onStatusChange: (status: RecorderStatus) => statuses.push(status),
      onTick: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    },
  };
}

describe('voice recorder controller', () => {
  it('records and completes with 64-peak waveform and real duration', async () => {
    const harness = makeHarness();
    const { statuses, callbacks } = makeCallbacks();
    const controller = createVoiceRecorderController(callbacks, harness.deps);

    await controller.start();
    expect(statuses).toEqual(['requesting-permission', 'recording']);
    harness.tick(10);
    controller.release();
    expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    const voice = callbacks.onComplete.mock.calls[0][0];
    expect(voice.durationMs).toBe(500);
    expect(voice.waveform).toHaveLength(64);
    expect(voice.blob.size).toBeGreaterThan(0);
    expect(controller.getStatus()).toBe('idle');
  });

  it('cancel gesture discards the recording', async () => {
    const harness = makeHarness();
    const { callbacks } = makeCallbacks();
    const controller = createVoiceRecorderController(callbacks, harness.deps);
    await controller.start();
    harness.tick(4);
    controller.setGesture('cancel');
    expect(controller.getStatus()).toBe('cancel-ready');
    controller.release();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(controller.getStatus()).toBe('idle');
    expect(harness.track.stop).toHaveBeenCalled();
  });

  it('lock gesture allows pause / resume / send with paused time excluded', async () => {
    const harness = makeHarness();
    const { callbacks } = makeCallbacks();
    const controller = createVoiceRecorderController(callbacks, harness.deps);
    await controller.start();
    harness.tick(4);
    controller.setGesture('lock');
    expect(controller.getStatus()).toBe('lock-ready');
    controller.commitLock();
    expect(controller.getStatus()).toBe('locked');
    controller.pause();
    expect(controller.getStatus()).toBe('paused');
    harness.advance(1000);
    controller.resume();
    expect(controller.getStatus()).toBe('locked');
    harness.tick(2);
    controller.send();
    expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    expect(callbacks.onComplete.mock.calls[0][0].durationMs).toBe(300);
  });

  it('permission denial reports an error and returns to idle', async () => {
    const harness = makeHarness();
    harness.deps.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); };
    const { statuses, callbacks } = makeCallbacks();
    const controller = createVoiceRecorderController(callbacks, harness.deps);
    await controller.start();
    expect(callbacks.onError).toHaveBeenCalledWith('麥克風權限被拒絕，請在瀏覽器設定中允許後再試。');
    expect(statuses).toContain('failed');
    expect(controller.getStatus()).toBe('idle');
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });

  it('destroy (route change / unmount) stops recorder, stops tracks, closes AudioContext and clears timers', async () => {
    const harness = makeHarness();
    const { callbacks } = makeCallbacks();
    const controller = createVoiceRecorderController(callbacks, harness.deps);
    await controller.start();
    harness.tick(4);
    expect(harness.activeIntervals()).toBe(1);

    controller.destroy();

    expect(harness.recorder.state).toBe('inactive');
    expect(harness.track.stop).toHaveBeenCalled();
    expect(harness.contextClose).toHaveBeenCalled();
    expect(harness.activeIntervals()).toBe(0);
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(controller.getStatus()).toBe('idle');
  });
});
