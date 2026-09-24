import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CallEventEntry,
  CallEventType,
  CallParticipantSnapshot,
  CallRecord,
  CallTranscriptEntry,
  SharedCallContext,
  SimulatedCallKind,
  SimulatedCallState,
} from '@/types';
import { canTransitionCall, isCallLive } from '@/utils/callMachine';
import { generateCallGreeting, generateCallReply } from '@/utils/simulatedCallReply';

export interface ActiveCallSession {
  id: string;
  kind: SimulatedCallKind;
  state: SimulatedCallState;
  conversationId?: string;
  identityId: string;
  identityName: string;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  micOn: boolean;
  cameraOn: boolean;
  speakerOn: boolean;
  captionsOn: boolean;
  backgroundPresetId: string;
  minimized: boolean;
  aiSpeaking: boolean;
  transcript: CallTranscriptEntry[];
  events: CallEventEntry[];
  sharedContexts: SharedCallContext[];
  reactions: { id: string; name: string; at: number }[];
  endReason?: string;
}

interface StartCallInput {
  kind: SimulatedCallKind;
  identityId: string;
  identityName: string;
  identityKind?: 'ai' | 'user';
  portraitAssetId?: string;
  conversationId?: string;
  autoConnect?: boolean;
}

interface CallStoreState {
  session: ActiveCallSession | null;
  records: CallRecord[];
  startCall: (input: StartCallInput) => string | null;
  answerCall: () => void;
  transitionCall: (to: SimulatedCallState) => boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  toggleCaptions: () => void;
  setBackground: (presetId: string) => void;
  addReaction: (name: string) => void;
  shareContext: (context: Omit<SharedCallContext, 'id' | 'at'>) => void;
  setMinimized: (minimized: boolean) => void;
  sendCallText: (text: string) => void;
  appendAiLine: (text: string) => void;
  hangUp: (reason?: string) => void;
  failCall: (reason: string) => void;
  dismissCall: () => void;
  deleteRecord: (id: string) => void;
}

let pendingTimers: ReturnType<typeof setTimeout>[] = [];

function schedule(fn: () => void, ms: number) {
  const id = setTimeout(fn, ms);
  pendingTimers.push(id);
  return id;
}

function clearCallTimers() {
  pendingTimers.forEach((id) => clearTimeout(id));
  pendingTimers = [];
}

function makeEvent(type: CallEventType, detail?: string): CallEventEntry {
  return { id: crypto.randomUUID(), type, detail, at: Date.now() };
}

function selfSnapshot(): CallParticipantSnapshot {
  let displayName = '我';
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('lunartide_data') : null;
    const parsed = raw ? JSON.parse(raw) : null;
    displayName = parsed?.state?.profile?.displayName || parsed?.state?.userName || '我';
  } catch { /* keep default */ }
  return { identityId: 'self', displayName, kind: 'user' };
}

export const useCallStore = create<CallStoreState>()(
  persist(
    (set, get) => ({
      session: null,
      records: [],

      startCall: (input) => {
        const current = get().session;
        if (current && isCallLive(current.state)) return null;
        clearCallTimers();
        const id = crypto.randomUUID();
        const session: ActiveCallSession = {
          id,
          kind: input.kind,
          state: 'ringing',
          conversationId: input.conversationId,
          identityId: input.identityId,
          identityName: input.identityName,
          startedAt: Date.now(),
          micOn: true,
          cameraOn: input.kind === 'video',
          speakerOn: true,
          captionsOn: false,
          backgroundPresetId: 'default',
          minimized: false,
          aiSpeaking: false,
          transcript: [],
          events: [makeEvent('state', 'ringing')],
          sharedContexts: [],
          reactions: [],
        };
        set({ session });
        if (input.autoConnect !== false) {
          schedule(() => { if (get().session?.id === id && get().session?.state === 'ringing') get().answerCall(); }, 1800);
        }
        return id;
      },

      answerCall: () => {
        const state = get();
        if (!state.session || state.session.state !== 'ringing') return;
        if (!state.transitionCall('connecting')) return;
        const sessionId = state.session.id;
        schedule(() => {
          const now = get();
          if (now.session?.id === sessionId && now.session.state === 'connecting') {
            now.transitionCall('active');
            const greeting = generateCallGreeting(now.session.identityName);
            now.appendAiLine(greeting);
          }
        }, 900);
      },

      transitionCall: (to) => {
        const session = get().session;
        if (!session || !canTransitionCall(session.state, to)) return false;
        set({
          session: {
            ...session,
            state: to,
            connectedAt: to === 'active' && !session.connectedAt ? Date.now() : session.connectedAt,
            endedAt: to === 'ended' || to === 'failed' ? Date.now() : session.endedAt,
            events: [...session.events, makeEvent('state', to)],
          },
        });
        return true;
      },

      toggleMic: () => set((s) => s.session ? {
        session: { ...s.session, micOn: !s.session.micOn, events: [...s.session.events, makeEvent('mic', s.session.micOn ? 'off' : 'on')] },
      } : {}),

      toggleCamera: () => set((s) => s.session ? {
        session: { ...s.session, cameraOn: !s.session.cameraOn, events: [...s.session.events, makeEvent('camera', s.session.cameraOn ? 'off' : 'on')] },
      } : {}),

      toggleSpeaker: () => set((s) => s.session ? {
        session: { ...s.session, speakerOn: !s.session.speakerOn, events: [...s.session.events, makeEvent('speaker', s.session.speakerOn ? 'off' : 'on')] },
      } : {}),

      toggleCaptions: () => set((s) => s.session ? {
        session: { ...s.session, captionsOn: !s.session.captionsOn, events: [...s.session.events, makeEvent('captions', s.session.captionsOn ? 'off' : 'on')] },
      } : {}),

      setBackground: (presetId) => set((s) => s.session ? {
        session: { ...s.session, backgroundPresetId: presetId, events: [...s.session.events, makeEvent('background', presetId)] },
      } : {}),

      addReaction: (name) => set((s) => s.session ? {
        session: {
          ...s.session,
          reactions: [...s.session.reactions.slice(-11), { id: crypto.randomUUID(), name, at: Date.now() }],
          events: [...s.session.events, makeEvent('reaction', name)],
        },
      } : {}),

      shareContext: (context) => set((s) => s.session ? {
        session: {
          ...s.session,
          sharedContexts: [...s.session.sharedContexts, { ...context, id: crypto.randomUUID(), at: Date.now() }],
          events: [...s.session.events, makeEvent('context-share', `${context.type}:${context.title}`)],
        },
      } : {}),

      setMinimized: (minimized) => set((s) => s.session ? {
        session: { ...s.session, minimized, events: [...s.session.events, makeEvent('minimize', minimized ? 'on' : 'off')] },
      } : {}),

      sendCallText: (text) => {
        const trimmed = text.trim();
        const session = get().session;
        if (!trimmed || !session || session.state !== 'active') return;
        const entry: CallTranscriptEntry = { id: crypto.randomUUID(), speaker: 'me', text: trimmed, at: Date.now() };
        set({ session: { ...session, transcript: [...session.transcript, entry], aiSpeaking: true } });
        const sessionId = session.id;
        schedule(() => {
          const now = get();
          if (now.session?.id !== sessionId || now.session.state !== 'active') return;
          now.appendAiLine(generateCallReply(trimmed, now.session.identityName));
        }, 900);
      },

      appendAiLine: (text) => set((s) => {
        if (!s.session) return {};
        const entry: CallTranscriptEntry = {
          id: crypto.randomUUID(),
          speaker: 'ai',
          identityId: s.session.identityId,
          text,
          at: Date.now(),
        };
        const sessionId = s.session.id;
        schedule(() => {
          const now = get();
          if (now.session?.id === sessionId) set({ session: { ...now.session, aiSpeaking: false } });
        }, Math.min(6000, 1200 + text.length * 55));
        return { session: { ...s.session, transcript: [...s.session.transcript, entry], aiSpeaking: true } };
      }),

      hangUp: (reason) => {
        const session = get().session;
        if (!session || session.state === 'ended' || session.state === 'failed') return;
        clearCallTimers();
        const endedAt = Date.now();
        const durationMs = session.connectedAt ? endedAt - session.connectedAt : 0;
        const events = [...session.events, makeEvent('hangup', reason)];
        const record: CallRecord = {
          id: session.id,
          kind: session.kind,
          conversationId: session.conversationId,
          startedAt: session.startedAt,
          connectedAt: session.connectedAt,
          endedAt,
          durationMs,
          participants: [
            selfSnapshot(),
            { identityId: session.identityId, displayName: session.identityName, kind: 'ai' },
          ],
          transcript: session.transcript,
          events,
          sharedContextIds: session.sharedContexts.map((context) => context.id),
          sharedContexts: session.sharedContexts,
          endReason: reason,
        };
        set((s) => ({
          session: { ...session, state: 'ended', endedAt, aiSpeaking: false, minimized: false, events },
          records: [record, ...s.records].slice(0, 100),
        }));
      },

      failCall: (reason) => {
        const session = get().session;
        if (!session || !canTransitionCall(session.state, 'failed')) return;
        clearCallTimers();
        set({
          session: {
            ...session,
            state: 'failed',
            endedAt: Date.now(),
            aiSpeaking: false,
            endReason: reason,
            events: [...session.events, makeEvent('state', `failed:${reason}`)],
          },
        });
      },

      dismissCall: () => {
        clearCallTimers();
        set({ session: null });
      },

      deleteRecord: (id) => set((s) => ({ records: s.records.filter((record) => record.id !== id) })),
    }),
    {
      name: 'lunartide-calls',
      partialize: (state) => ({ records: state.records }),
    },
  ),
);
