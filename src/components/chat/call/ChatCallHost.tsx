import { useState, useEffect, useCallback, useRef } from 'react';
import { useChatCallStore } from '@/store/useChatCallStore';
import { useAppStore, selectAgentDisplayName } from '@/store/useAppStore';
import { IncomingCallOverlay } from './IncomingCallOverlay';
import { ActiveCallView, EndedCallShell, type VoiceCallState, formatCallDuration } from './ActiveCallView';
import { CallSettingsSheet } from './CallSettingsSheet';
import { isCallActive } from '@/types/call';
import { transcribeAudio } from '@/services/transcriptionService';
import { synthesizeSpeech } from '@/utils/ttsClient';
import { useVoiceRecorder, type RecordedVoice } from '@/hooks/useVoiceRecorder';

interface ChatCallHostProps {
  conversationId: string;
  isMobile: boolean;
  isAiStreaming: boolean;
  streamingText: string;
  onSendQuickReply: (text: string) => void;
  /** Called when the call ends — write a call event into canonical Chat */
  onCallEvent: (text: string) => void;
  micPermState?: PermissionState;
}

export function ChatCallHost({
  conversationId,
  isMobile,
  isAiStreaming,
  streamingText,
  onSendQuickReply,
  onCallEvent,
  micPermState,
}: ChatCallHostProps) {
  const session = useChatCallStore((s) => s.session);
  const appearance = useChatCallStore((s) => s.appearance);
  const acceptCall = useChatCallStore((s) => s.acceptCall);
  const declineCall = useChatCallStore((s) => s.declineCall);
  const declineWithReply = useChatCallStore((s) => s.declineWithReply);
  const endCall = useChatCallStore((s) => s.endCall);
  const finalizeCall = useChatCallStore((s) => s.finalizeCall);
  const dismissCall = useChatCallStore((s) => s.dismissCall);
  const toggleMute = useChatCallStore((s) => s.toggleMute);
  const toggleSpeaker = useChatCallStore((s) => s.toggleSpeaker);
  const toggleCamera = useChatCallStore((s) => s.toggleCamera);
  const appendTranscript = useChatCallStore((s) => s.appendTranscript);
  const updateTranscriptLine = useChatCallStore((s) => s.updateTranscriptLine);
  const setAppearance = useChatCallStore((s) => s.setAppearance);
  const setVideoScene = useChatCallStore((s) => s.setVideoScene);
  const resetAllDefaults = useChatCallStore((s) => s.resetAllDefaults);
  const initiateOutgoingCall = useChatCallStore((s) => s.initiateOutgoingCall);

  const [elapsed, setElapsed] = useState(0);
  const [elapsedAtEnd, setElapsedAtEnd] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const prevAiStreamingRef = useRef(false);
  const streamingLineIdRef = useRef<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceCallState>('idle');
  const [micStreaming, setMicStreaming] = useState(false);
  const micPermDenied = micPermState === 'denied';

  // Expose store for e2e testing (before any early return so it always runs)
  useEffect(() => { (window as any).__chatCallStore = useChatCallStore; }, []);

  // Voice recorder — callbacks handle result
  const handleRecorderComplete = useCallback(async (voice: RecordedVoice) => {
    setMicStreaming(false);
    setVoiceState('transcribing');
    // Build STT config from store
    const providerState = useAppStore.getState();
    const providers = providerState.providers ?? [];
    const firstOpenAi = providers.find((p: any) => p.type === 'openai' && p.apiKey);
    const sttConfig = {
      provider: 'openai',
      model: 'whisper-1',
      apiKey: firstOpenAi?.apiKey ?? '',
      baseUrl: firstOpenAi?.baseUrl ?? 'https://api.openai.com/v1',
    };
    try {
      const transcript = await transcribeAudio(voice.blob, sttConfig as any);
      const text = transcript.text.trim();
      if (text) {
        appendTranscript({ speaker: 'user', text, isStreaming: false });
        onSendQuickReply(text);
      }
    } catch {
      appendTranscript({ speaker: 'user', text: '(語音辨識失敗，請改用文字輸入)', isStreaming: false });
    }
    if (!isAiStreaming) setVoiceState('thinking');
  }, [appendTranscript, onSendQuickReply, isAiStreaming]);

  const handleRecorderError = useCallback((_msg: string) => {
    setMicStreaming(false);
    setVoiceState('idle');
  }, []);

  const recorder = useVoiceRecorder(handleRecorderComplete, handleRecorderError);

  // ── Auto-activate outgoing calls ──
  useEffect(() => {
    if (session?.direction !== 'outgoing' || session?.status !== 'connecting') return;
    const id = setTimeout(() => {
      const cs = useChatCallStore.getState().session;
      if (cs?.id === session.id && cs.status === 'connecting') {
        useChatCallStore.getState().activateCall();
      }
    }, 600);
    return () => clearTimeout(id);
  }, [session?.id, session?.status, session?.direction]);

  // ── Stale session cleanup (reload recovery) ──
  useEffect(() => {
    const cs = useChatCallStore.getState().session;
    if (!cs) return;
    const isExpired = cs.startedAt > 0
      && (Date.now() - cs.startedAt) > 30 * 60 * 1000;
    if (isExpired || cs.status === 'ended') {
      if (cs.status === 'active' || cs.status === 'connecting') {
        useChatCallStore.getState().finalizeCall();
      }
      useChatCallStore.getState().dismissCall();
    }
  }, []); // once on mount

  // Timer — covers both connecting (outgoing) and active
  useEffect(() => {
    const active = session?.status === 'active' || session?.status === 'connecting';
    if (!active) { setElapsed(0); return; }
    const start = session!.connectedAt || session!.startedAt;
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.status, session?.connectedAt, session?.startedAt, session?.id]);

  // Transcript bridge
  useEffect(() => {
    if (!session || session.status !== 'active') return;
    if (isAiStreaming && !prevAiStreamingRef.current && streamingText) { streamingLineIdRef.current = null; }
    if (isAiStreaming && streamingText) {
      if (streamingLineIdRef.current) {
        updateTranscriptLine(streamingLineIdRef.current, streamingText, true);
      } else {
        const cs = useChatCallStore.getState().session;
        if (cs) {
          const lastLine = cs.transcript[cs.transcript.length - 1];
          if (lastLine?.isStreaming && lastLine.speaker === 'lunaris') {
            updateTranscriptLine(lastLine.id, streamingText, true);
            streamingLineIdRef.current = lastLine.id;
          } else {
            appendTranscript({ speaker: 'lunaris', text: streamingText, isStreaming: true });
            setTimeout(() => {
              const cs2 = useChatCallStore.getState().session;
              const last = cs2?.transcript[cs2.transcript.length - 1];
              if (last?.isStreaming) streamingLineIdRef.current = last.id;
            }, 0);
          }
        }
      }
    }
    if (!isAiStreaming && prevAiStreamingRef.current && streamingLineIdRef.current) {
      updateTranscriptLine(streamingLineIdRef.current, streamingText || '', false);
      streamingLineIdRef.current = null;
    }
    prevAiStreamingRef.current = isAiStreaming;
  }, [isAiStreaming, streamingText, session?.status, session?.id]);

  const handleDeclineWithReply = useCallback((text: string) => {
    onSendQuickReply(text);
    declineWithReply(text);
  }, [onSendQuickReply, declineWithReply]);

  const handleEnd = useCallback(() => {
    endCall();
    const duration = elapsed;
    setElapsedAtEnd(duration);
    const modeLabel = session?.mode === 'video' ? '視訊通話' : '語音通話';
    onCallEvent(`${modeLabel} · ${formatCallDuration(duration)}`);
    setTimeout(() => finalizeCall(), 320);
  }, [endCall, finalizeCall, elapsed, onCallEvent, session?.mode]);

  const handleStartMic = useCallback(() => {
    if (micPermDenied) return;
    setMicStreaming(true);
    setVoiceState('listening');
    recorder.start();
  }, [micPermDenied, recorder]);

  const handleStopMic = useCallback(() => {
    recorder.cancel();
    setMicStreaming(false);
    setVoiceState('idle');
  }, [recorder]);

  const handleTextSubmit = useCallback((text: string) => {
    appendTranscript({ speaker: 'user', text, isStreaming: false });
    onSendQuickReply(text);
    setVoiceState('thinking');
  }, [appendTranscript, onSendQuickReply]);

  // AI streaming finished → trigger TTS
  useEffect(() => {
    if (!session || session.status !== 'active') return;
    if (!isAiStreaming && prevAiStreamingRef.current && streamingText?.trim()) {
      setVoiceState('speaking');
      const partner = useAppStore.getState().partner;
      synthesizeSpeech(streamingText.trim(), partner?.characterVoice).then(blob => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); setVoiceState('idle'); };
        audio.onerror = () => { URL.revokeObjectURL(url); setVoiceState('idle'); };
        audio.play().catch(() => { URL.revokeObjectURL(url); setVoiceState('idle'); });
      }).catch(() => setVoiceState('idle'));
    }
    if (isAiStreaming && !prevAiStreamingRef.current && streamingText) setVoiceState('thinking');
  }, [isAiStreaming, streamingText, session?.status, session?.id]);

  const handleDismissEnded = () => dismissCall();
  useEffect(() => {
    if (session?.status === 'ended') {
      const t = setTimeout(() => dismissCall(), 10000);
      return () => clearTimeout(t);
    }
  }, [session?.status, session?.id]);

  // Mobile: suppress the bottom dock while a call is on screen (full-screen portal).
  useEffect(() => {
    const active = isMobile
      && !!session
      && (session.status === 'connecting' || session.status === 'active' || session.status === 'ending');
    document.body.classList.toggle('cc-call-active', active);
    return () => {
      if (isMobile) document.body.classList.remove('cc-call-active');
    };
  }, [isMobile, session?.status, session?.id]);

  if (!session || session.conversationId !== conversationId) return null;

  if (session.status === 'ringing' && session.direction === 'incoming') {
    return <IncomingCallOverlay callReason={session.callReason} callMode={session.mode} onAccept={acceptCall} onDecline={declineCall} onDeclineWithReply={handleDeclineWithReply} />;
  }

  if (session.status === 'connecting' || session.status === 'active' || session.status === 'ending') {
    return (
      <>
        <ActiveCallView session={session} appearance={appearance} elapsed={elapsed}
          onEnd={handleEnd} onToggleMute={toggleMute} onToggleSpeaker={toggleSpeaker} onToggleCamera={toggleCamera}
          onOpenSettings={() => setShowSettings(true)} isMobile={isMobile}
          voiceState={voiceState} micStreaming={micStreaming} micPermDenied={micPermDenied}
          liveWaveform={micStreaming ? recorder.liveWaveform : null}
          onStartMic={handleStartMic} onStopMic={handleStopMic} onTextSubmit={handleTextSubmit} />
        {showSettings && <CallSettingsSheet appearance={appearance} callMode={session.mode} videoScene={session.videoScene} onApply={setAppearance} onApplyVideoScene={setVideoScene} onResetAll={resetAllDefaults} onClose={() => setShowSettings(false)} />}
      </>
    );
  }

  if (session.status === 'ended') {
    const pn = selectAgentDisplayName(useAppStore.getState().partner);
    return (
      <EndedCallShell
        mode={session.mode}
        partnerName={pn}
        elapsed={elapsedAtEnd}
        isMobile={isMobile}
        onDismiss={handleDismissEnded}
        onRetry={() => {
          const mode = session.mode;
          dismissCall();
          initiateOutgoingCall({ conversationId, mode });
        }}
      />
    );
  }

  return null;
}
