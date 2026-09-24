import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCompanionBoardStore } from '@/store/useCompanionBoardStore';

describe('useCompanionBoardStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    useCompanionBoardStore.setState({ boardItems: [] });
  });

  it('adds, edits, pins, reorders and deletes canonical BoardItems', () => {
    const first = useCompanionBoardStore.getState().addBoardItem({ type: 'note', title: '第一則', note: '內容' });
    vi.mocked(crypto.randomUUID).mockReturnValue('00000000-0000-4000-8000-000000000002');
    const second = useCompanionBoardStore.getState().addBoardItem({ type: 'image', title: '第二則', note: '', imageUrl: 'data:image/png;base64,a', mimeType: 'image/png', hasAlpha: true });
    expect(useCompanionBoardStore.getState().boardItems.map(item => item.id)).toEqual([second, first]);
    expect(useCompanionBoardStore.getState().boardItems[0]).toMatchObject({ mimeType: 'image/png', hasAlpha: true });
    useCompanionBoardStore.getState().updateBoardItem(first, { title: '已編輯' });
    expect(useCompanionBoardStore.getState().boardItems.find(item => item.id === first)?.title).toBe('已編輯');
    useCompanionBoardStore.getState().toggleBoardItemPinned(first);
    expect(useCompanionBoardStore.getState().boardItems[0]).toMatchObject({ id: first, pinned: true, order: 0 });
    useCompanionBoardStore.getState().moveBoardItem(first, 1);
    expect(useCompanionBoardStore.getState().boardItems[0].id).toBe(first);
    useCompanionBoardStore.getState().deleteBoardItem(first);
    expect(useCompanionBoardStore.getState().boardItems.map(item => item.id)).toEqual([second]);
  });
});
