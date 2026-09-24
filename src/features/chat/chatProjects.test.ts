import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultStore, normalizeStore } from '@/store/storage';
import { useAppStore } from '@/store/useAppStore';
import type { Conversation, Message } from '@/types';

function conversation(id: string, patch: Partial<Conversation> = {}): Conversation {
  return { id, title: id, messages: [], createdAt: 10, updatedAt: 20, lastMessageAt: 20, kind: 'direct', type: 'direct', ...patch };
}

describe('Chat Projects Phase 1 ownership', () => {
  beforeEach(() => {
    useAppStore.setState({ ...createDefaultStore(), aiTyping: false });
  });

  it('hydrates legacy state with no projects without changing conversations', () => {
    const legacy = conversation('legacy', { messages: [{ id: 'm1', type: 'text', sender: 'me', content: '保留', time: 'now', status: 'sent' } as Message] });
    const normalized = normalizeStore({ ...createDefaultStore(), chatProjects: undefined as never, conversations: [legacy] });
    expect(normalized.chatProjects).toEqual([]);
    expect(normalized.conversations[0]).toMatchObject({ id: legacy.id, messages: legacy.messages, createdAt: legacy.createdAt, updatedAt: legacy.updatedAt, lastMessageAt: legacy.lastMessageAt });
    expect(normalized.conversations[0].projectId).toBeUndefined();
    expect(normalizeStore(normalized)).toEqual(normalized);
  });

  it('creates and renames project metadata in the canonical app store', () => {
    const projectId = useAppStore.getState().createChatProject('  月潮專案  ');
    expect(projectId).toMatch(/^chat-project-/);
    expect(useAppStore.getState().chatProjects[0].name).toBe('月潮專案');
    useAppStore.getState().renameChatProject(projectId, '新名稱');
    expect(useAppStore.getState().chatProjects[0].name).toBe('新名稱');
  });

  it('creates a canonical conversation inside a project', () => {
    const projectId = useAppStore.getState().createChatProject('Project A');
    const conversationId = useAppStore.getState().createConversationInProject(projectId);
    const state = useAppStore.getState();
    expect(state.activeConversationId).toBe(conversationId);
    expect(state.conversations.find((item) => item.id === conversationId)).toMatchObject({ projectId, messages: [] });
  });

  it('moves an existing conversation without changing its id or messages', () => {
    const message = { id: 'm1', type: 'text', sender: 'me', content: '原訊息', time: 'now', status: 'sent' } as Message;
    useAppStore.setState({ conversations: [conversation('existing', { messages: [message] })] });
    const projectId = useAppStore.getState().createChatProject('Project A');
    useAppStore.getState().assignConversationToProject('existing', projectId);
    const moved = useAppStore.getState().conversations[0];
    expect(moved.id).toBe('existing');
    expect(moved.messages).toEqual([message]);
    useAppStore.getState().assignConversationToProject('existing', undefined);
    expect(useAppStore.getState().conversations[0].projectId).toBeUndefined();
  });

  it('deletes only project metadata and returns conversations to unassigned', () => {
    const projectId = useAppStore.getState().createChatProject('Project A');
    const message = { id: 'm1', type: 'text', sender: 'me', content: '不可遺失', time: 'now', status: 'sent' } as Message;
    useAppStore.setState({ conversations: [conversation('existing', { projectId, messages: [message], pinned: true, archived: true })] });
    useAppStore.getState().deleteChatProject(projectId);
    const state = useAppStore.getState();
    expect(state.chatProjects).toEqual([]);
    expect(state.conversations[0]).toMatchObject({ id: 'existing', messages: [message], pinned: true, archived: true });
    expect(state.conversations[0].projectId).toBeUndefined();
  });

  it('keeps soft-delete retention metadata when project membership changes', () => {
    const projectId = useAppStore.getState().createChatProject('Project A');
    useAppStore.setState({ conversations: [conversation('deleted', { deletedAt: 100, purgeAt: 200 })] });
    useAppStore.getState().assignConversationToProject('deleted', projectId);
    expect(useAppStore.getState().conversations[0]).toMatchObject({ projectId, deletedAt: 100, purgeAt: 200 });
  });
});
