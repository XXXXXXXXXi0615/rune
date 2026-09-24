import { describe, expect, it } from 'vitest';
import { resolveDirectChatCounterpartTitle } from './headerIdentity';

const LUNARIS = { id: 'builtin-lunaris', name: 'LUNARIS' };
const IRIS = { id: 'character-iris', name: 'IRIS' };

describe('resolveDirectChatCounterpartTitle', () => {
  it('prefers the counterpart display name', () => {
    expect(resolveDirectChatCounterpartTitle({ characterIds: ['character-iris'] }, [LUNARIS, IRIS], '智能體')).toBe('IRIS');
  });

  it('falls back to the counterpart id when the display name is empty', () => {
    expect(resolveDirectChatCounterpartTitle({ characterIds: ['character-blank'] }, [LUNARIS, { id: 'character-blank', name: '   ' }], '智能體')).toBe('character-blank');
  });

  it('falls back to the builtin counterpart when the conversation has no character reference', () => {
    expect(resolveDirectChatCounterpartTitle({ characterIds: [] }, [LUNARIS], '智能體')).toBe('LUNARIS');
  });

  it('falls back to the persona name when no counterpart character exists', () => {
    expect(resolveDirectChatCounterpartTitle({ characterIds: ['missing'] }, [], 'RIME')).toBe('RIME');
  });

  it('keeps the default agent name as the last resort', () => {
    expect(resolveDirectChatCounterpartTitle(null, [], null)).toBe('智能體');
  });

  it('keeps the legacy Rune id mapping', () => {
    expect(resolveDirectChatCounterpartTitle({ characterIds: ['rune_alpha'] }, [{ id: 'rune_alpha', name: 'Rune' }], '智能體')).toBe('Rime');
  });

  it('never composes the local user identity into the title', () => {
    const title = resolveDirectChatCounterpartTitle({ characterIds: ['character-iris'] }, [IRIS], '智能體');
    expect(title).not.toContain('×');
    expect(title).toBe('IRIS');
  });
});
