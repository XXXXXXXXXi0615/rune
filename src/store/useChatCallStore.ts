import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ChatCallSession,
  ChatCallStatus,
  CallDirection,
  CallMode,
  CallAppearance,
  CallTranscriptLine,
  CallVideoScene,
  CallPresentationMode,
  IncomingCallRequest,
} from '@/types/call';
import { canTransition, isCallActive, DEFAULT_APPEARANCE, DEFAULT_VIDEO_SCENE } from '@/types/call';

interface ChatCallState {
  session: ChatCallSession | null;
  appearance: CallAppearance;
  presentationMode: CallPresentationMode;

  // Actions
  requestIncomingCall: (req: IncomingCallRequest) => string;
  initiateOutgoingCall: (params: { conversationId: string; mode: CallMode }) => string;
  acceptCall: () => void;
  declineCall: () => void;
  declineWithReply: (text: string) => void;
  connectCall: () => void;
  activateCall: () => void;
  endCall: () => void;
  finalizeCall: () => void;
  dismissCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
  appendTranscript: (line: Pick<CallTranscriptLine, 'speaker' | 'text' | 'isStreaming'>) => void;
  updateTranscriptLine: (id: string, text: string, isStreaming?: boolean) => void;
  setAppearance: (patch: Partial<CallAppearance>) => void;
  resetAppearance: () => void;
  setVideoScene: (patch: Partial<CallVideoScene>) => void;
  resetVideoScene: () => void;
  resetAllDefaults: () => void;
  setPresentationMode: (mode: CallPresentationMode) => void;
}

function makeId(): string {
  return crypto.randomUUID();
}

export const useChatCallStore = create<ChatCallState>()(
  persist(
    (set, get) => ({
      session: null,
      appearance: { ...DEFAULT_APPEARANCE },
      presentationMode: 'full',

      requestIncomingCall: (req) => {
        if (get().session && isCallActive(get().session!.status)) return '';
        const id = makeId();
        const mode: CallMode = req.mode ?? 'voice';
        const session: ChatCallSession = {
          id,
          conversationId: req.conversationId,
          direction: 'incoming',
          mode,
          status: 'ringing',
          startedAt: Date.now(),
          initiator: 'lunaris',
          callReason: req.reason,
          muteState: false,
          speakerState: true,
          cameraState: mode === 'video',
          transcript: [],
          videoScene: mode === 'video' ? { ...DEFAULT_VIDEO_SCENE } : undefined,
        };
        set({ session });
        return id;
      },

      initiateOutgoingCall: (params) => {
        if (get().session && isCallActive(get().session!.status)) return '';
        const id = makeId();
        const mode = params.mode;
        const session: ChatCallSession = {
          id,
          conversationId: params.conversationId,
          direction: 'outgoing',
          mode,
          status: 'connecting',
          startedAt: Date.now(),
          initiator: 'user',
          muteState: false,
          speakerState: true,
          cameraState: mode === 'video',
          transcript: [],
          videoScene: mode === 'video' ? { ...DEFAULT_VIDEO_SCENE } : undefined,
        };
        set({ session, presentationMode: 'full' });
        return id;
      },

      acceptCall: () => {
        const session = get().session;
        if (!session || session.status !== 'ringing') return;
        set({
          session: {
            ...session,
            status: 'connecting',
          },
        });
        // Simulate connection delay then activate
        setTimeout(() => {
          const current = get().session;
          if (current?.id === session.id && current.status === 'connecting') {
            get().activateCall();
          }
        }, 900);
      },

      declineCall: () => {
        const session = get().session;
        if (!session || session.status !== 'ringing') return;
        set({
          session: {
            ...session,
            status: 'ended',
            endedAt: Date.now(),
          },
        });
      },

      declineWithReply: (text) => {
        const session = get().session;
        if (!session || session.status !== 'ringing') return;
        set({
          session: {
            ...session,
            status: 'ended',
            endedAt: Date.now(),
            quickReplySent: true,
            quickReplyText: text,
          },
        });
      },

      connectCall: () => {
        const session = get().session;
        if (!session || !canTransition(session.status, 'connecting')) return;
        set({ session: { ...session, status: 'connecting' } });
      },

      activateCall: () => {
        const session = get().session;
        if (!session || !canTransition(session.status, 'active')) return;
        set({
          session: {
            ...session,
            status: 'active',
            connectedAt: Date.now(),
          },
        });
      },

      endCall: () => {
        const session = get().session;
        if (!session || !canTransition(session.status, 'ending')) return;
        set({
          session: {
            ...session,
            status: 'ending',
          },
        });
      },

      finalizeCall: () => {
        const session = get().session;
        if (!session || !canTransition(session.status, 'ended')) return;
        set({
          session: {
            ...session,
            status: 'ended',
            endedAt: Date.now(),
          },
        });
      },

      dismissCall: () => {
        set({ session: null, presentationMode: 'full' });
      },

      setPresentationMode: (presentationMode) => set({ presentationMode }),

      toggleMute: () =>
        set((s) =>
          s.session
            ? { session: { ...s.session, muteState: !s.session.muteState } }
            : {},
        ),

      toggleSpeaker: () =>
        set((s) =>
          s.session
            ? { session: { ...s.session, speakerState: !s.session.speakerState } }
            : {},
        ),

      toggleCamera: () =>
        set((s) =>
          s.session
            ? { session: { ...s.session, cameraState: !s.session.cameraState } }
            : {},
        ),

      appendTranscript: (line) =>
        set((s) => {
          if (!s.session) return {};
          const entry: CallTranscriptLine = {
            id: makeId(),
            speaker: line.speaker,
            text: line.text,
            at: Date.now(),
            isStreaming: line.isStreaming,
          };
          return {
            session: {
              ...s.session,
              transcript: [...s.session.transcript, entry],
            },
          };
        }),

      updateTranscriptLine: (id, text, isStreaming) =>
        set((s) => {
          if (!s.session) return {};
          const transcript = s.session.transcript.map((line) =>
            line.id === id ? { ...line, text, isStreaming } : line,
          );
          return { session: { ...s.session, transcript } };
        }),

      setAppearance: (patch) =>
        set((s) => ({
          appearance: { ...s.appearance, ...patch },
        })),

      resetAppearance: () =>
        set({ appearance: { ...DEFAULT_APPEARANCE } }),

      setVideoScene: (patch) =>
        set((s) => {
          if (!s.session) return {};
          const current = s.session.videoScene ?? { ...DEFAULT_VIDEO_SCENE };
          return {
            session: {
              ...s.session,
              videoScene: { ...current, ...patch },
            },
          };
        }),

      resetVideoScene: () =>
        set((s) => {
          if (!s.session) return {};
          return {
            session: {
              ...s.session,
              videoScene: { ...DEFAULT_VIDEO_SCENE },
            },
          };
        }),

      resetAllDefaults: () =>
        set((s) => ({
          appearance: { ...DEFAULT_APPEARANCE },
          session: s.session
            ? { ...s.session, videoScene: { ...DEFAULT_VIDEO_SCENE } }
            : s.session,
        })),
    }),
    {
      name: 'lunartide-chat-call',
      partialize: (state) => ({
        appearance: state.appearance,
        session: state.session,
        presentationMode: state.presentationMode,
      }),
      // Phase 2A.2: 持久化 active session — reload 後 timer 不從 0:00 開始。
      // ChatCallHost 在 mount 時檢查 session.startedAt 距離現在是否超過
      // 30 分鐘；超過則自動結束。
    },
  ),
);
