import { createContext, useContext } from 'react';
import type { ChatTheme } from '@/store/useChatThemeStore';

/** Draft theme override for isolated renderer previews. Never persists. */
export const BubbleSkinPreviewContext = createContext<ChatTheme | null>(null);

export function useBubbleSkinPreviewTheme(): ChatTheme | null {
  return useContext(BubbleSkinPreviewContext);
}
