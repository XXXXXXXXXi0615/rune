/**
 * Chat Bubble Skin — Phase 1A presentation types.
 *
 * Presentation-only. Nothing here is persisted on messages, SenderSnapshot,
 * conversations or participants. `useChatThemeStore` remains the single theme
 * owner; `ChatTheme.bubbleSkin` is an optional, backward-compatible reference
 * to canonical assets.
 */

export type BubbleRole = 'self' | 'agent' | 'group-participant';
export type BubbleOrientation = 'left' | 'right';
export type BubbleSkinMode = 'css' | 'image';
export type BubbleSkinPosition = 'first' | 'middle' | 'last' | 'only';
export type BubbleSkinEdgeMode = 'stretch' | 'repeat' | 'round' | 'space';

/** Tail ownership — presentation only; never stored on the message. */
export type BubbleTailKind = 'none' | 'css' | 'image-integrated' | 'separate-image';

/** 9-slice geometry, in CSS pixels. */
export interface BubbleSkinSlice {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Safe content region inside the artwork, in CSS pixels. */
export interface BubbleSkinInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Canonical asset reference. `asset` points at the IndexedDB asset layer
 * (`src/store/assets.ts`); `url` points at a static canonical public asset.
 * Base64 payloads must never be embedded here.
 */
export type BubbleSkinSource =
  | { kind: 'asset'; assetId: string }
  | { kind: 'url'; url: string };

export interface BubbleSkinMirror {
  /** Mirrored decorative presentation is allowed for the left orientation. */
  allowed: boolean;
  /** Explicit directional assets always win over mirroring. */
  leftAsset?: BubbleSkinSource;
  rightAsset?: BubbleSkinSource;
}

export interface ImageBubbleSkin {
  mode: 'image';
  source: BubbleSkinSource;
  slice: BubbleSkinSlice;
  insets: BubbleSkinInsets;
  mirror: BubbleSkinMirror;
  tail: { kind: BubbleTailKind };
  /** 9-slice edge behaviour; defaults to `stretch`. */
  edgeMode?: BubbleSkinEdgeMode;
  /** Edge widths; default to `slice`. */
  edgeWidth?: BubbleSkinSlice;
}

export interface CssBubbleSkin {
  mode: 'css';
}

export type ChatBubbleSkin = CssBubbleSkin | ImageBubbleSkin;

export interface BubbleImagePresentation {
  source: BubbleSkinSource;
  slice: BubbleSkinSlice;
  insets: BubbleSkinInsets;
  edgeWidth: BubbleSkinSlice;
  edgeMode: BubbleSkinEdgeMode;
  /** Decorative layer is presented mirrored (left orientation, no left asset). */
  mirrored: boolean;
  /**
   * True when the skin exists but cannot be presented for this orientation
   * (mirroring disallowed and no directional asset). Renderer uses CSS.
   */
  cssFallback: boolean;
  tail: { kind: BubbleTailKind };
}

export interface MessageBubblePresentation {
  role: BubbleRole;
  orientation: BubbleOrientation;
  skinMode: BubbleSkinMode;
  /** Null for CSS presentation (and for unsupported message structures). */
  image: BubbleImagePresentation | null;
  /** Tail ownership resolved for this bubble. */
  tail: { kind: BubbleTailKind };
}
