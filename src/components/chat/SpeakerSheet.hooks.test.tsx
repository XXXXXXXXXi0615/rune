// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { ChatIdentity, Conversation } from '@/types';

const setCurrentSpeaker = vi.fn();
const identityState: { identities: ChatIdentity[] } = { identities: [] };

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector({ setCurrentSpeaker }),
}));

vi.mock('@/store/useIdentityStore', () => ({
  useIdentityStore: (selector: (state: unknown) => unknown) => selector(identityState),
}));

vi.mock('@/store/usePresenceStore', () => ({
  PRESENCE_LABELS: { online: '在線', invisible: '隱身', busy: '忙碌', offline: '離線' },
  usePresenceStore: (selector: (state: unknown) => unknown) =>
    selector({
      getPresence: () => ({ visiblePresenceStatus: 'online' }),
      setPresence: vi.fn(),
      setCustomText: vi.fn(),
    }),
}));

vi.mock('@/store/avatarBlobStorage', () => ({
  getBlob: vi.fn(async () => undefined),
  blobToDataURL: vi.fn(async () => ''),
}));

import { SpeakerSheet } from '@/components/chat/GroupChatPanels';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function identity(id: string, kind: ChatIdentity['kind']): ChatIdentity {
  return {
    id,
    displayName: id.toUpperCase(),
    kind,
    avatarVariants: [],
  } as unknown as ChatIdentity;
}

function groupConversation(id: string, participantIds: string[], currentSpeakerParticipantId?: string): Conversation {
  return {
    id,
    title: `群聊 ${id}`,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
    kind: 'group',
    groupParticipants: participantIds.map((identityId) => ({ identityId })),
    currentSpeakerParticipantId,
  } as unknown as Conversation;
}

function directConversation(id: string): Conversation {
  return {
    id,
    title: `私聊 ${id}`,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
    kind: 'direct',
    participants: [
      { id: 'self', name: '我', isSelf: true },
      { id: 'lunaris', name: 'LUNARIS' },
    ],
  } as unknown as Conversation;
}

describe('SpeakerSheet hook order regression', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const renderSheet = (conversation: Conversation, open: boolean) => {
    act(() => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(
            MemoryRouter,
            null,
            createElement(SpeakerSheet, { conversation, open, onClose: () => {} }),
          ),
        ),
      );
    });
  };

  const expectNoHookOrderErrors = () => {
    const messages = consoleErrorSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' '));
    const hookErrors = messages.filter((message: string) =>
      message.includes('Rendered more hooks')
      || message.includes('Rendered fewer hooks')
      || message.includes('change in the order of Hooks'),
    );
    expect(hookErrors).toEqual([]);
  };

  beforeEach(() => {
    identityState.identities = [
      identity('self', 'user'),
      identity('lunaris', 'ai'),
      identity('clawd', 'ai'),
    ];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    consoleErrorSpy = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  it('closed → open → closed keeps hook order stable', () => {
    const conversation = groupConversation('g1', ['self', 'lunaris'], 'self');
    renderSheet(conversation, false);
    renderSheet(conversation, true);
    expect(document.querySelector('.mc-speaker-sheet')).not.toBeNull();
    renderSheet(conversation, false);
    expect(document.querySelector('.mc-speaker-sheet')).toBeNull();
    expectNoHookOrderErrors();
  });

  it('open on first render (refresh with sheet open)', () => {
    renderSheet(groupConversation('g1', ['self', 'lunaris'], 'self'), true);
    expect(document.querySelector('.mc-speaker-sheet')).not.toBeNull();
    expectNoHookOrderErrors();
  });

  it('self remains selectable when AI members are added or removed', () => {
    identityState.identities = [identity('self', 'user')];
    const withoutAi = groupConversation('g1', ['self'], 'self');
    renderSheet(withoutAi, true);
    expect(document.querySelector('.mc-speaker-grid')).not.toBeNull();

    identityState.identities = [identity('self', 'user'), identity('lunaris', 'ai')];
    renderSheet(groupConversation('g1', ['self', 'lunaris'], 'self'), true);
    expect(document.querySelector('.mc-speaker-grid')).not.toBeNull();
    expect(document.querySelector('.mc-speaker-empty')).toBeNull();

    identityState.identities = [identity('self', 'user')];
    renderSheet(withoutAi, true);
    expect(document.querySelector('.mc-speaker-grid')).not.toBeNull();
    expectNoHookOrderErrors();
  });

  it('direct → group and group A → group B', () => {
    renderSheet(directConversation('d1'), true);
    renderSheet(groupConversation('g1', ['self', 'lunaris'], 'self'), true);
    renderSheet(groupConversation('g2', ['self', 'clawd'], 'clawd'), true);
    expectNoHookOrderErrors();
  });

  it('user speaker → narrator speaker', () => {
    renderSheet(groupConversation('g1', ['self', 'lunaris'], 'self'), true);
    renderSheet(groupConversation('g1', ['self', 'lunaris'], 'narrator'), true);
    expectNoHookOrderErrors();
  });

  it('rapid open/close 10 times', () => {
    const conversation = groupConversation('g1', ['self', 'lunaris'], 'self');
    for (let i = 0; i < 10; i += 1) {
      renderSheet(conversation, true);
      renderSheet(conversation, false);
    }
    expectNoHookOrderErrors();
  });

  it('manual switching permission disables identity selection without legacy linking copy', () => {
    const conversation = { ...groupConversation('g1', ['self'], 'self'), manualSpeakerSwitchingEnabled: false };
    renderSheet(conversation, true);
    expect(document.querySelector('.mc-speaker-empty')?.textContent).toContain('已關閉手動身份切換');
    expect(document.querySelector('.mc-speaker-grid')).toBeNull();
    expect(document.body.textContent).not.toContain('連結月潮');
    expect(document.querySelectorAll('.luna-offline-banner').length).toBe(0);
    expectNoHookOrderErrors();
  });
});
