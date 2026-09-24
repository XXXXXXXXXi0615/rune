import type { CSSProperties } from 'react';

export type ChatPerchState = 'idle' | 'focused' | 'typing' | 'paused' | 'sending' | 'waiting' | 'received' | 'sleepy';

type AlphaBounds = readonly [left: number, top: number, right: number, bottom: number];

export const CHAT_PERCH_ASSETS: Record<ChatPerchState, {
  file: string;
  rawWidth: number;
  rawHeight: number;
  alphaBounds: AlphaBounds;
}> = {
  idle: { file: 'rune_idle.png', rawWidth: 1254, rawHeight: 1254, alphaBounds: [5, 178, 1252, 1114] },
  focused: { file: 'rune_focused.png', rawWidth: 1254, rawHeight: 1254, alphaBounds: [91, 6, 1240, 1229] },
  typing: { file: 'rune_typing.png', rawWidth: 1254, rawHeight: 1254, alphaBounds: [0, 12, 1254, 1241] },
  paused: { file: 'rune_paused.png', rawWidth: 1254, rawHeight: 1254, alphaBounds: [135, 29, 1226, 1217] },
  sending: { file: 'rune_sending.png', rawWidth: 1402, rawHeight: 1122, alphaBounds: [2, 18, 1402, 1042] },
  waiting: { file: 'rune_waiting.png', rawWidth: 1254, rawHeight: 1254, alphaBounds: [2, 159, 1254, 1065] },
  received: { file: 'rune_received.png', rawWidth: 1254, rawHeight: 1254, alphaBounds: [16, 23, 1252, 1237] },
  sleepy: { file: 'rune_sleepy.png', rawWidth: 1254, rawHeight: 1254, alphaBounds: [0, 279, 1254, 1009] },
};

export function ChatPerch({ state }: { state: ChatPerchState }) {
  const asset = CHAT_PERCH_ASSETS[state];
  const [left, top, right, bottom] = asset.alphaBounds;
  const visibleWidth = right - left;
  const visibleHeight = bottom - top;
  const style = {
    '--chat-perch-visible-aspect': visibleWidth / visibleHeight,
    '--chat-perch-image-width-ratio': asset.rawWidth / visibleHeight,
    '--chat-perch-image-height-ratio': asset.rawHeight / visibleHeight,
    '--chat-perch-image-right-pad-ratio': (asset.rawWidth - right) / visibleHeight,
    '--chat-perch-image-bottom-pad-ratio': (asset.rawHeight - bottom) / visibleHeight,
  } as CSSProperties;
  const src = `${import.meta.env.BASE_URL}assets/chat-perch/rune/${asset.file}`;
  return (
    <div
      className="chat-perch"
      data-testid="chat-perch"
      data-state={state}
      data-visible-width={visibleWidth}
      data-visible-height={visibleHeight}
      style={style}
      aria-hidden="true"
    >
      <img className="chat-perch__image" src={src} alt="" draggable={false} />
    </div>
  );
}
