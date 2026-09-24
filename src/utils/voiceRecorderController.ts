import { normalizeWaveform, MAX_VOICE_DURATION_MS, WAVEFORM_PEAK_COUNT } from '@/utils/voiceMessage';
import { recorderTransition, isCapturing, type RecorderStatus } from '@/utils/voiceRecorderMachine';

export interface RecordedVoiceResult {
  blob: Blob;
  durationMs: number;
  waveform: number[];
  mimeType: string;
}

export interface RecorderCallbacks {
  onStatusChange: (status: RecorderStatus) => void;
  onTick: (elapsedMs: number, liveWaveform: number[]) => void;
  onComplete: (voice: RecordedVoiceResult) => void;
  onError: (message: string) => void;
}

interface MinimalTrack { stop: () => void }
interface MinimalStream { getTracks: () => MinimalTrack[] }
interface MinimalAnalyser {
  fftSize: number;
  frequencyBinCount: number;
  getByteTimeDomainData: (data: Uint8Array) => void;
}
interface MinimalAudioContext {
  createMediaStreamSource: (stream: MinimalStream) => { connect: (node: MinimalAnalyser) => void };
  createAnalyser: () => MinimalAnalyser;
  close: () => Promise<void>;
}
interface MinimalRecorder {
  state: 'inactive' | 'recording' | 'paused';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start: (timeslice?: number) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export interface RecorderDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MinimalStream>;
  createRecorder: (stream: MinimalStream) => MinimalRecorder;
  createAudioContext: () => MinimalAudioContext;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
}

function defaultDeps(): RecorderDeps | null {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    return null;
  }
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createRecorder: (stream) => new MediaRecorder(stream as MediaStream) as unknown as MinimalRecorder,
    createAudioContext: () => new AudioContext() as unknown as MinimalAudioContext,
    now: () => Date.now(),
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id),
  };
}

export type RecorderGesture = 'none' | 'cancel' | 'lock';

/**
 * Framework-agnostic recorder controller implementing the full state machine:
 * idle → requesting-permission → recording → (cancel-ready | lock-ready) →
 * locked ⇄ paused → finalizing → idle, with a failed branch.
 *
 * destroy() always stops the MediaRecorder, stops microphone tracks, closes
 * the AudioContext, and clears timers — safe for route changes / unmount.
 */
export function createVoiceRecorderController(callbacks: RecorderCallbacks, deps?: RecorderDeps) {
  let status: RecorderStatus = 'idle';
  let stream: MinimalStream | undefined;
  let context: MinimalAudioContext | undefined;
  let recorder: MinimalRecorder | undefined;
  let analyser: MinimalAnalyser | undefined;
  let tickId: number | undefined;
  let chunks: Blob[] = [];
  let samples: number[] = [];
  let live: number[] = [];
  let startedAt = 0;
  let sessionActive = false;
  let pausedTotal = 0;
  let pausedAt = 0;
  let pausedAtSet = false;
  let cancelled = false;
  let destroyed = false;
  let resolvedDeps: RecorderDeps | undefined | null;

  const emit = (event: Parameters<typeof recorderTransition>[1]) => {
    const next = recorderTransition(status, event);
    if (next !== status) {
      status = next;
      callbacks.onStatusChange(status);
    }
    return status;
  };

  /** Read status through a call so TS control-flow narrowing does not go stale after emit(). */
  const currentStatus = (): RecorderStatus => status;

  const stopTimers = () => {
    if (tickId !== undefined && resolvedDeps) resolvedDeps.clearInterval(tickId);
    tickId = undefined;
  };

  const releaseHardware = () => {
    stopTimers();
    stream?.getTracks().forEach((track) => {
      try { track.stop(); } catch { /* already stopped */ }
    });
    stream = undefined;
    if (context) void context.close().catch(() => undefined);
    context = undefined;
    analyser = undefined;
  };

  const elapsedNow = () => {
    if (!sessionActive || !resolvedDeps) return 0;
    const pausedSpan = pausedAtSet ? resolvedDeps.now() - pausedAt : 0;
    return Math.max(0, resolvedDeps.now() - startedAt - pausedTotal - pausedSpan);
  };

  const finalize = (asCancelled: boolean) => {
    if (status === 'idle' || status === 'failed' || status === 'finalizing') return;
    cancelled = asCancelled;
    emit(asCancelled ? 'CANCEL' : 'SEND');
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { handleStopped(); }
    } else {
      handleStopped();
    }
  };

  function handleStopped() {
    const durationMs = elapsedNow();
    const mimeType = recorder?.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type: mimeType });
    releaseHardware();
    recorder = undefined;
    startedAt = 0;
    sessionActive = false;
    pausedTotal = 0;
    pausedAt = 0;
    pausedAtSet = false;
    live = [];
    const wasCancelled = cancelled;
    const waveform = normalizeWaveform(samples);
    chunks = [];
    samples = [];
    emit('FINALIZED');
    callbacks.onTick(0, []);
    if (!wasCancelled && !destroyed && blob.size > 0) {
      callbacks.onComplete({ blob, durationMs, waveform, mimeType });
    }
  }

  const fail = (message: string) => {
    releaseHardware();
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* noop */ }
    }
    recorder = undefined;
    chunks = [];
    samples = [];
    live = [];
    emit('FAIL');
    callbacks.onError(message);
    emit('RESET');
  };

  return {
    getStatus: () => status,
    getElapsedMs: () => elapsedNow(),

    async start() {
      if (destroyed || (status !== 'idle' && status !== 'failed')) return;
      resolvedDeps = deps ?? defaultDeps();
      if (!resolvedDeps) {
        status = 'failed';
        callbacks.onStatusChange(status);
        callbacks.onError('此瀏覽器暫不支援錄音。');
        emit('RESET');
        return;
      }
      emit('REQUEST');
      try {
        const granted = await resolvedDeps.getUserMedia({ audio: true });
        if (destroyed) {
          granted.getTracks().forEach((track) => track.stop());
          return;
        }
        if (currentStatus() !== 'requesting-permission') {
          // released / cancelled while waiting for permission
          granted.getTracks().forEach((track) => track.stop());
          cancelled = true;
          handleStopped();
          return;
        }
        stream = granted;
        context = resolvedDeps.createAudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(granted).connect(analyser);
        recorder = resolvedDeps.createRecorder(granted);
        chunks = [];
        samples = [];
        live = [];
        cancelled = false;
        startedAt = resolvedDeps.now();
        sessionActive = true;
        pausedTotal = 0;
        pausedAt = 0;
        pausedAtSet = false;
        recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onstop = () => handleStopped();
        recorder.start(200);
        emit('GRANTED');
        const data = new Uint8Array(analyser.frequencyBinCount);
        tickId = resolvedDeps.setInterval(() => {
          if (!analyser || !resolvedDeps) return;
          if (isCapturing(status) && status !== 'paused') {
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (let index = 0; index < data.length; index++) {
              const value = Math.abs(data[index] - 128) / 128;
              if (value > peak) peak = value;
            }
            samples.push(peak);
            live = [...live.slice(-(WAVEFORM_PEAK_COUNT - 1)), peak];
          }
          const elapsed = elapsedNow();
          callbacks.onTick(elapsed, live);
          if (elapsed >= MAX_VOICE_DURATION_MS) finalize(false);
        }, 50);
      } catch (error) {
        if (currentStatus() === 'finalizing') {
          cancelled = true;
          handleStopped();
          return;
        }
        emit('DENIED');
        callbacks.onError(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? '麥克風權限被拒絕，請在瀏覽器設定中允許後再試。'
            : '無法開始錄音，請檢查麥克風。',
        );
        releaseHardware();
        emit('RESET');
      }
    },

    setGesture(gesture: RecorderGesture) {
      if (gesture === 'cancel') {
        if (status === 'lock-ready') emit('LOCK_EXIT');
        emit('CANCEL_ENTER');
      } else if (gesture === 'lock') {
        if (status === 'cancel-ready') emit('CANCEL_EXIT');
        emit('LOCK_ENTER');
      } else {
        if (status === 'cancel-ready') emit('CANCEL_EXIT');
        if (status === 'lock-ready') emit('LOCK_EXIT');
      }
    },

    commitLock() {
      emit('LOCK_COMMIT');
    },

    release() {
      if (status === 'cancel-ready') {
        finalize(true);
      } else if (status === 'lock-ready') {
        emit('RELEASE');
      } else if (status === 'recording') {
        finalize(false);
      } else if (status === 'requesting-permission') {
        emit('RELEASE');
        cancelled = true;
        // stream not yet granted — start() will notice the state change.
      }
    },

    pause() {
      if (currentStatus() !== 'locked' || !recorder || !resolvedDeps) return;
      try { recorder.pause(); } catch { return; }
      pausedAt = resolvedDeps.now();
      pausedAtSet = true;
      emit('PAUSE');
    },

    resume() {
      if (currentStatus() !== 'paused' || !recorder || !resolvedDeps) return;
      try { recorder.resume(); } catch { return; }
      if (pausedAtSet) pausedTotal += resolvedDeps.now() - pausedAt;
      pausedAt = 0;
      pausedAtSet = false;
      emit('RESUME');
    },

    cancel() { finalize(true); },
    send() { finalize(false); },
    failWith(message: string) { fail(message); },

    destroy() {
      destroyed = true;
      cancelled = true;
      stopTimers();
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch { /* noop */ }
      }
      recorder = undefined;
      releaseHardware();
      chunks = [];
      samples = [];
      live = [];
      status = 'idle';
    },
  };
}

export type VoiceRecorderController = ReturnType<typeof createVoiceRecorderController>;
