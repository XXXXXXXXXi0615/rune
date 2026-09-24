import { describe, expect, it } from 'vitest';
import type { TextMessage } from '@/types';
import { getVisibleMessages, isMessageAvailableForReply, isMessageVisibleToSelf } from '@/features/chat/messageVisibility';

const message = (patch: Partial<TextMessage> = {}): TextMessage => ({
  id: 'm1', sender: 'me', type: 'text', content: '保留正文',
  time: new Date(0).toISOString(), status: 'sent', ...patch,
});

describe('message visibility', () => {
  it('keeps legacy messages visible', () => {
    expect(isMessageVisibleToSelf(message())).toBe(true);
  });

  it.each(['deletedAt', 'deletedForSelfAt', 'deletedForAllAt'] as const)('hides %s messages', (field) => {
    expect(getVisibleMessages([message({ [field]: 1 })])).toEqual([]);
  });

  it('treats a hidden reply target as deleted without removing its canonical body', () => {
    const hidden = message({ deletedForAllAt: 1 });
    expect(isMessageAvailableForReply(hidden)).toBe(false);
    expect(hidden.content).toBe('保留正文');
  });
});
