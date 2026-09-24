import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceRecorderController, type RecordedVoiceResult, type RecorderGesture, type VoiceRecorderController } from '@/utils/voiceRecorderController';
import { isRecorderBusy, type RecorderStatus } from '@/utils/voiceRecorderMachine';

export type RecordedVoice = RecordedVoiceResult;

/**
 * React binding for the voice recorder controller.
 * Guarantees cleanup on unmount / route change: MediaRecorder stopped,
 * microphone tracks stopped, AudioContext closed, timers cleared.
 */
export function useVoiceRecorder(onComplete: (voice: RecordedVoice) => void, onError: (message: string) => void) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const controllerRef = useRef<VoiceRecorderController | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  });

  const getController = useCallback(() => {
    if (!controllerRef.current) {
      controllerRef.current = createVoiceRecorderController({
        onStatusChange: (next) => setStatus(next),
        onTick: (elapsed, wave) => {
          setElapsedMs(elapsed);
          setLiveWaveform(wave);
        },
        onComplete: (voice) => onCompleteRef.current(voice),
        onError: (message) => onErrorRef.current(message),
      });
    }
    return controllerRef.current;
  }, []);

  useEffect(() => () => {
    controllerRef.current?.destroy();
    controllerRef.current = null;
  }, []);

  const start = useCallback(() => getController().start(), [getController]);
  const setGesture = useCallback((gesture: RecorderGesture) => controllerRef.current?.setGesture(gesture), []);
  const commitLock = useCallback(() => controllerRef.current?.commitLock(), []);
  const release = useCallback(() => controllerRef.current?.release(), []);
  const pause = useCallback(() => controllerRef.current?.pause(), []);
  const resume = useCallback(() => controllerRef.current?.resume(), []);
  const cancel = useCallback(() => controllerRef.current?.cancel(), []);
  const send = useCallback(() => controllerRef.current?.send(), []);

  return {
    status,
    isBusy: isRecorderBusy(status),
    elapsedMs,
    liveWaveform,
    start,
    setGesture,
    commitLock,
    release,
    pause,
    resume,
    cancel,
    send,
  };
}
