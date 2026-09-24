import { useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { MemoryEntry } from '@/types';

export type MemoryOwner = 'user' | 'ai' | 'shared';
export type MemorySource = MemoryEntry['source'];

interface AddMemoryInput {
  title: string;
  content: string;
  owner?: MemoryOwner;
  createdBy?: 'user' | 'ai' | 'system';
  source?: MemorySource;
  type?: string;
  allowAiRecall?: boolean;
  localOnly?: boolean;
  sensitive?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export function useMemoryVault() {
  const rawEntries = useAppStore((s) => s.memoryEntries || []);
  const addRawEntry = useAppStore((s) => s.addMemoryEntry);
  const updateRawEntry = useAppStore((s) => s.updateMemoryEntry);
  const deleteRawEntry = useAppStore((s) => s.deleteMemoryEntry);

  const memories = useMemo(() =>
    rawEntries.map((e) => ({
      ...e,
      title: e.title || e.scene || '',
      content: e.content || e.bodyThoughts || '',
      owner: e.owner || 'user',
      createdBy: e.createdBy || 'user',
      source: e.source || 'manual',
      type: e.type || 'note',
      status: e.status || 'active',
      allowAiRecall: e.allowAiRecall !== false,
      localOnly: e.localOnly !== false,
      sensitive: e.sensitive === true,
      pinned: e.pinned === true,
      tags: e.tags || [],
    })),
  [rawEntries]);

  const addMemory = useCallback((input: AddMemoryInput) => {
    return addRawEntry({
      scene: input.title,
      triggerText: '',
      bodyThoughts: input.content,
      anxietyLevel: 0,
      nextStep: '',
      title: input.title,
      content: input.content,
      owner: input.owner || 'user',
      createdBy: input.createdBy || 'user',
      source: input.source || 'manual',
      type: input.type || 'note',
      status: 'active',
      allowAiRecall: input.allowAiRecall !== false,
      localOnly: input.localOnly !== false,
      sensitive: input.sensitive === true,
      tags: input.tags || [],
      metadata: input.metadata,
    } as any);
  }, [addRawEntry]);

  const updateMemory = useCallback((id: string, patch: Partial<MemoryEntry>) => {
    updateRawEntry(id, { ...patch, updatedAt: Date.now() } as any);
  }, [updateRawEntry]);

  const deleteMemory = useCallback((id: string) => {
    deleteRawEntry(id);
  }, [deleteRawEntry]);

  const pinMemory = useCallback((id: string, pinned: boolean) => {
    updateRawEntry(id, { pinned, status: pinned ? 'pinned' : 'active', updatedAt: Date.now() } as any);
  }, [updateRawEntry]);

  const toggleAiRecall = useCallback((id: string, allow: boolean) => {
    updateRawEntry(id, { allowAiRecall: allow, updatedAt: Date.now() } as any);
  }, [updateRawEntry]);

  const fadeMemory = useCallback((id: string) => {
    const deleteAfter = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    updateRawEntry(id, { status: 'fading', deleteAfter, updatedAt: Date.now() } as any);
  }, [updateRawEntry]);

  const restoreMemory = useCallback((id: string) => {
    updateRawEntry(id, { status: 'active', deleteAfter: undefined, updatedAt: Date.now() } as any);
  }, [updateRawEntry]);

  const getByOwner = useCallback((owner: MemoryOwner) =>
    memories.filter((m) => m.owner === owner),
  [memories]);

  const getBySource = useCallback((source: MemorySource) =>
    memories.filter((m) => m.source === source),
  [memories]);

  const searchMemories = useCallback((query: string, owner?: MemoryOwner) => {
    const q = query.trim().toLowerCase();
    if (!q) return owner ? getByOwner(owner) : memories;
    return memories.filter((m) => {
      if (owner && m.owner !== owner) return false;
      return (
        m.title?.toLowerCase().includes(q) ||
        m.content?.toLowerCase().includes(q) ||
        m.tags?.some((t) => t.toLowerCase().includes(q)) ||
        m.source?.toLowerCase().includes(q) ||
        m.type?.toLowerCase().includes(q)
      );
    });
  }, [memories, getByOwner]);

  const activeCount = useMemo(() =>
    memories.filter((m) => m.status === 'active' || m.status === 'pinned').length,
  [memories]);
  const pinnedCount = useMemo(() =>
    memories.filter((m) => m.status === 'pinned').length,
  [memories]);
  const fadingCount = useMemo(() =>
    memories.filter((m) => m.status === 'fading').length,
  [memories]);
  const aiRecallableCount = useMemo(() =>
    memories.filter((m) => !m.sensitive && m.allowAiRecall && m.status !== 'trash' && m.status !== 'fading').length,
  [memories]);

  return {
    memories,
    addMemory,
    updateMemory,
    deleteMemory,
    pinMemory,
    toggleAiRecall,
    fadeMemory,
    restoreMemory,
    getByOwner,
    getBySource,
    searchMemories,
    activeCount,
    pinnedCount,
    fadingCount,
    aiRecallableCount,
  };
}
