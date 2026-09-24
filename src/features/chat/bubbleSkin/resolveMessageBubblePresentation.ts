import type { CSSProperties } from 'react';
import type { Message } from '@/types';
import type { ChatTheme } from '@/store/useChatThemeStore';
import type {
  BubbleOrientation,
  BubbleRole,
  BubbleSkinPosition,
  BubbleSkinSource,
  BubbleTailKind,
  ChatBubbleSkin,
  ImageBubbleSkin,
  MessageBubblePresentation,
} from './types';

export interface ResolveMessageBubblePresentationInput {
  /** Active Chat Theme — the single presentation owner. */
  theme: ChatTheme;
  isSelf: boolean;
  isGroup: boolean;
  messageType: Message['type'];
  position: BubbleSkinPosition;
}

const isImageSkin = (skin: ChatBubbleSkin | undefined | null): skin is ImageBubbleSkin =>
  Boolean(skin && skin.mode === 'image');

const sourceId = (source: BubbleSkinSource): string => (source.kind === 'url' ? source.url : source.assetId);

/**
 * Single, pure bubble presentation resolver.
 *
 * Deterministic: same inputs → same output. No store writes, no mutation, no
 * message rewriting, no historical snapshot migration.
 *
 * CSS mode is the fallback contract: when no image skin exists, or the message
 * structure is not skinnable, or the orientation cannot be presented, the
 * output is `skinMode: 'css'` and the canonical CSS rendering is untouched.
 */
export function resolveMessageBubblePresentation({
  theme,
  isSelf,
  isGroup,
  messageType,
  position,
}: ResolveMessageBubblePresentationInput): MessageBubblePresentation {
  const role: BubbleRole = isSelf ? 'self' : isGroup ? 'group-participant' : 'agent';
  const orientation: BubbleOrientation = isSelf ? 'right' : 'left';
  const tailKind: BubbleTailKind = position === 'only' || position === 'last' ? 'css' : 'none';
  const base: MessageBubblePresentation = { role, orientation, skinMode: 'css', image: null, tail: { kind: tailKind } };

  const skin = theme.bubbleSkin;
  // Phase 1A skins ordinary text bubbles only. Every other message structure
  // keeps the canonical CSS presentation.
  if (messageType !== 'text' || !isImageSkin(skin)) return base;

  const mirror = skin.mirror ?? { allowed: false };
  const directional = orientation === 'right' ? mirror.rightAsset : mirror.leftAsset;
  const mirrored = !directional && orientation === 'left' && mirror.allowed === true;
  const cssFallback = !directional && orientation === 'left' && mirror.allowed !== true;
  const source = directional ?? skin.source;
  const edgeWidth = skin.edgeWidth ?? skin.slice;
  const tail = skin.tail ?? { kind: 'image-integrated' as BubbleTailKind };

  return {
    role,
    orientation,
    skinMode: 'image',
    tail,
    image: {
      source,
      slice: skin.slice,
      insets: skin.insets,
      edgeWidth,
      edgeMode: skin.edgeMode ?? 'stretch',
      mirrored,
      cssFallback,
      tail,
    },
  };
}

/** Compact, test-friendly description: `css` or `image:<orientation>:<src>:<direct|mirror|css>`. */
export function describeBubblePresentation(presentation: MessageBubblePresentation): string {
  if (presentation.skinMode !== 'image' || !presentation.image) return 'css';
  const image = presentation.image;
  const mode = image.cssFallback ? 'css' : image.mirrored ? 'mirror' : 'direct';
  return `image:${presentation.orientation}:${sourceId(image.source)}:${mode}`;
}

/**
 * Whether the canonical CSS tail notch should render for this bubble.
 * Image skins own their tail geometry unless they explicitly delegate it to CSS.
 */
export function shouldShowCssTail(presentation: MessageBubblePresentation): boolean {
  if (presentation.skinMode === 'image' && presentation.image && !presentation.image.cssFallback) {
    return presentation.image.tail.kind === 'css';
  }
  return presentation.tail.kind === 'css';
}

/**
 * Pure CSS-variable mapping for the 9-slice decorative layer.
 * Returns an empty object for CSS presentation so the fallback stays untouched.
 */
export function bubblePresentationStyleVars(presentation: MessageBubblePresentation): CSSProperties {
  const image = presentation.image;
  if (presentation.skinMode !== 'image' || !image || image.cssFallback) return {};
  const { slice, insets, edgeWidth, edgeMode, mirrored } = image;
  return {
    '--bubble-skin-slice': `${slice.top} ${slice.right} ${slice.bottom} ${slice.left}`,
    '--bubble-skin-edge-width': `${edgeWidth.top}px ${edgeWidth.right}px ${edgeWidth.bottom}px ${edgeWidth.left}px`,
    '--bubble-skin-edge-mode': edgeMode,
    '--bubble-skin-mirrored': mirrored ? '1' : '0',
    '--bubble-skin-pad-top': `${insets.top}px`,
    '--bubble-skin-pad-right': `${insets.right}px`,
    '--bubble-skin-pad-bottom': `${insets.bottom}px`,
    '--bubble-skin-pad-left': `${insets.left}px`,
  } as CSSProperties;
}
