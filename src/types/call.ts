// ================================================================
// Chat Call Types — Phase 1
// Designed for chat-integrated calls. Separate from SimulatedCall.
// ================================================================

export type ChatCallStatus =
  | 'idle'
  | 'ringing'
  | 'connecting'
  | 'active'
  | 'ending'
  | 'ended';

export type CallDirection = 'incoming' | 'outgoing';
export type CallMode = 'voice' | 'video';
export type CallPresentationMode = 'full' | 'floating' | 'bubble';
export type CallInitiator = 'user' | 'lunaris';

export interface ChatCallSession {
  id: string;
  conversationId: string;
  direction: CallDirection;
  mode: CallMode;
  status: ChatCallStatus;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  initiator: CallInitiator;
  callReason?: string;
  muteState: boolean;
  speakerState: boolean;
  cameraState: boolean;
  transcript: CallTranscriptLine[];
  quickReplySent?: boolean;
  quickReplyText?: string;
  videoScene?: CallVideoScene;
}

export interface CallTranscriptLine {
  id: string;
  speaker: 'user' | 'lunaris';
  text: string;
  at: number;
  isStreaming?: boolean;
}

export interface CallAppearance {
  backgroundAssetId?: string;
  backgroundFit?: 'cover' | 'contain';
  backgroundPositionX?: number;  // 0–100
  backgroundPositionY?: number;  // 0–100
  backgroundOpacity?: number;    // 0–1
  overlayEnabled?: boolean;
  overlayOpacity?: number;       // 0–0.8
  backdropBlur?: number;         // 0–24
  tintEnabled: boolean;
  tone: 'warm' | 'cool' | 'neutral';
}

export const DEFAULT_APPEARANCE: CallAppearance = {
  tintEnabled: true,
  tone: 'warm',
  backgroundFit: 'cover',
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  backgroundOpacity: 1,
  overlayEnabled: true,
  overlayOpacity: 0.42,
  backdropBlur: 3,
};

export type PipCorner = 'left-top' | 'right-top' | 'left-bottom' | 'right-bottom';

export interface CallVideoScene {
  partnerVideoAssetId?: string;
  selfVideoAssetId?: string;
  partnerFit: 'cover' | 'contain';
  partnerPositionX: number;  // 0–100
  partnerPositionY: number;  // 0–100
  selfFit: 'cover' | 'contain';
  selfPositionX: number;   // 0–100
  selfPositionY: number;   // 0–100
  selfMirror: boolean;
  selfPreviewVisible: boolean;
  pipCorner: PipCorner;
}

export const DEFAULT_VIDEO_SCENE: CallVideoScene = {
  partnerFit: 'contain',
  partnerPositionX: 50,
  partnerPositionY: 50,
  selfFit: 'cover',
  selfPositionX: 95,
  selfPositionY: 95,
  selfMirror: false,
  selfPreviewVisible: true,
  pipCorner: 'right-top',
};

export interface IncomingCallRequest {
  conversationId: string;
  reason?: string;
  mode?: CallMode;
}

// State transition map
export const CALL_TRANSITIONS: Record<ChatCallStatus, ChatCallStatus[]> = {
  idle: ['ringing', 'connecting'],
  ringing: ['connecting', 'ended'],
  connecting: ['active', 'ended'],
  active: ['ending'],
  ending: ['ended'],
  ended: [],
};

export function canTransition(from: ChatCallStatus, to: ChatCallStatus): boolean {
  return CALL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isCallActive(status: ChatCallStatus): boolean {
  return status === 'ringing' || status === 'connecting' || status === 'active' || status === 'ending';
}

export const QUICK_REPLIES = [
  { key: 'busy' as const, text: '在忙' },
  { key: 'outside' as const, text: '在外面' },
  { key: 'text' as const, text: '想打字聊' },
] as const;

export type QuickReplyKey = typeof QUICK_REPLIES[number]['key'];
