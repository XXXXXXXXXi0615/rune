import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { Conversation } from '@/types';
import { ConversationAvatar } from '@/components/chat/ConversationAvatars';
import { getDuplicateDraftIds } from '@/utils/conversationAvatar';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import { getVisibleMessages } from '@/features/chat/messageVisibility';

function lastMessagePreview(conv: Conversation): string {
  const visibleMessages = getVisibleMessages(conv.messages);
  const last = visibleMessages[visibleMessages.length - 1];
  if (!last) return '尚無訊息';
  if (last.revoked) return '已收回訊息';
  if (last.type === 'text') {
    // Collapse newlines for compact display; CSS line-clamp:2 handles overflow
    const collapsed = last.content.replace(/\n+/g, ' ');
    const preview = collapsed.length > 120 ? collapsed.slice(0, 119) + '…' : collapsed;
    if (conv.kind !== 'group') return preview;
    const participant = conv.participants?.find((item) => item.id === last.senderParticipantId);
    return `${participant?.groupNickname || participant?.name || '成員'}：${preview}`;
  }
  if (last.type === 'image') return '[圖片]';
  if (last.type === 'file') return `[檔案] ${last.fileName || ''}`;
  if (last.type === 'sticker') return '[貼圖]';
  return '尚無訊息';
}

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function relativeTime(ts: number): string {
  const now = new Date();
  const date = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((todayStart.getTime() - msgStart.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    // Today → HH:mm
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  if (dayDiff === 1) return '昨天';
  if (dayDiff < 7) return WEEKDAY_LABELS[date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export interface ConversationListProps {
  onSelect?: (id: string) => void;
  compact?: boolean;
  showToolbar?: boolean;
  enableProjects?: boolean;
  onSelectionModeChange?: (active: boolean) => void;
}

export function ConversationList({ onSelect, compact, showToolbar = true, enableProjects = false, onSelectionModeChange }: ConversationListProps) {
  const allConversations = useAppStore((s) => s.conversations || []);
  const chatProjects = useAppStore((s) => s.chatProjects || []);
  const conversations = allConversations.filter((c) => !c.deletedAt);
  const activeId = useAppStore((s) => s.activeConversationId);
  const setActive = useAppStore((s) => s.setActiveConversation);
  const createConv = useAppStore((s) => s.createConversation);
  const deleteConv = useAppStore((s) => s.deleteConversation);
  const deleteManyConv = useAppStore((s) => s.deleteConversations);
  const updateManyConv = useAppStore((s) => s.updateConversationsBatch);
  const renameConv = useAppStore((s) => s.renameConversation);
  const pinConv = useAppStore((s) => s.pinConversation);
  const archiveConv = useAppStore((s) => s.archiveConversation);
  const markRead = useAppStore((s) => s.markConversationRead);
  const createProject = useAppStore((s) => s.createChatProject);
  const renameProject = useAppStore((s) => s.renameChatProject);
  const archiveProject = useAppStore((s) => s.archiveChatProject);
  const deleteProject = useAppStore((s) => s.deleteChatProject);
  const assignToProject = useAppStore((s) => s.assignConversationToProject);
  const createConversationInProject = useAppStore((s) => s.createConversationInProject);
  const showToast = useToastStore((s) => s.showToast);

  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [listMode, setListMode] = useState<'recent' | 'projects'>('recent');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => new Set());
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [moveConversationId, setMoveConversationId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; flip: boolean } | null>(null);

  useEffect(() => {
    if (renameId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameId]);

  useEffect(() => {
    onSelectionModeChange?.(selectionMode);
    return () => onSelectionModeChange?.(false);
  }, [onSelectionModeChange, selectionMode]);

  // Phase 1.1B: Position context menu relative to its anchor button via bounding rect
  const recalcMenu = useCallback(() => {
    if (!menuId || !menuAnchorRef.current) { setMenuPos(null); return; }
    const btnRect = menuAnchorRef.current.getBoundingClientRect();
    const menuH = 180; // estimated — actual height bounded by max-height
    const menuW = 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;
    const pad = 12;

    let left = btnRect.right - menuW;
    if (left < pad) left = btnRect.left;
    if (left + menuW > vw - pad) left = vw - menuW - pad;

    const below = btnRect.bottom + gap + menuH <= vh - pad;
    const top = below ? btnRect.bottom + gap : btnRect.top - menuH - gap;

    setMenuPos({ left, top, flip: !below });
  }, [menuId]);

  useEffect(() => {
    if (!menuId) { setMenuPos(null); return; }
    recalcMenu();
    window.addEventListener('resize', recalcMenu, { passive: true });
    document.querySelector('.conv-list-scroll')?.addEventListener('scroll', recalcMenu, { passive: true });
    return () => {
      window.removeEventListener('resize', recalcMenu);
      document.querySelector('.conv-list-scroll')?.removeEventListener('scroll', recalcMenu);
    };
  }, [menuId, recalcMenu]);

  // Escape + outside click to close
  useEffect(() => {
    if (!menuId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuId(null); menuAnchorRef.current?.focus(); } };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.conv-context-menu-portal')) return;
      if (target.closest('.conv-card-menu-btn')) return;
      setMenuId(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClickOutside, true);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('click', onClickOutside, true); };
  }, [menuId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const displayTitle = c.customTitle || c.title;
      if (displayTitle.toLowerCase().includes(q)) return true;
      if (lastMessagePreview(c).toLowerCase().includes(q)) return true;
      return getVisibleMessages(c.messages).some((m) => m.type === 'text' && m.content.toLowerCase().includes(q));
    });
  }, [conversations, query]);

  const pinned = useMemo(() => filtered.filter((c) => c.pinned && !c.archived), [filtered]);
  const recent = useMemo(() => filtered.filter((c) => !c.pinned && !c.archived), [filtered]);
  const archived = useMemo(() => conversations.filter((c) => c.archived), [conversations]);

  const sortedPinned = useMemo(
    () => [...pinned].sort((a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt)),
    [pinned],
  );
  const sortedRecent = useMemo(
    () => [...recent].sort((a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt)),
    [recent],
  );
  const sortedProjects = useMemo(
    () => [...chatProjects].sort((a, b) => b.updatedAt - a.updatedAt),
    [chatProjects],
  );
  const projectConversationMap = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    for (const project of chatProjects) map.set(project.id, []);
    for (const conversation of filtered) {
      if (conversation.archived || !conversation.projectId || !map.has(conversation.projectId)) continue;
      map.get(conversation.projectId)!.push(conversation);
    }
    for (const items of map.values()) items.sort((a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt));
    return map;
  }, [chatProjects, filtered]);
  const unassignedConversations = useMemo(
    () => filtered.filter((conversation) => !conversation.archived && (!conversation.projectId || !chatProjects.some((project) => project.id === conversation.projectId))).sort((a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt)),
    [chatProjects, filtered],
  );
  const visibleConversationIds = useMemo(
    () => [...sortedPinned, ...sortedRecent].map((c) => c.id),
    [sortedPinned, sortedRecent],
  );
  const selectedCount = selectedIds.size;
  const allVisibleSelected = visibleConversationIds.length > 0 && visibleConversationIds.every((id) => selectedIds.has(id));

  const handleNewChat = () => {
    const id = createConv();
    setSelectionMode(false);
    setSelectedIds(new Set());
    onSelect?.(id);
  };

  const handleCreateProject = () => {
    const id = createProject(projectName);
    if (!id) return;
    setExpandedProjectIds((current) => new Set(current).add(id));
    setProjectName('');
    setCreateProjectOpen(false);
  };

  const handleCreateProjectChat = (projectId: string) => {
    const id = createConversationInProject(projectId);
    onSelect?.(id);
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const handleSelect = (id: string) => {
    if (selectionMode) {
      toggleSelected(id);
      return;
    }
    setActive(id);
    markRead(id);
    onSelect?.(id);
    setMenuId(null);
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setMenuId(null);
    setConfirmDeleteId(null);
    setRenameId(null);
    setRenameValue('');
  };

  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBatchDeleteConfirmOpen(false);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleConversationIds.forEach((id) => next.delete(id));
      } else {
        visibleConversationIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const syncActiveAfterDelete = (deletedIds: Set<string>) => {
    if (!activeId || !deletedIds.has(activeId)) return;
    const nextActive = useAppStore.getState().activeConversationId;
    if (nextActive) onSelect?.(nextActive);
  };

  const startRename = (c: Conversation) => {
    setRenameId(c.id);
    setRenameValue(c.customTitle || c.title);
    setMenuId(null);
  };

  const commitRename = () => {
    if (renameId) {
      const trimmed = renameValue.trim();
      if (trimmed) renameConv(renameId, trimmed);
    }
    setRenameId(null);
    setRenameValue('');
  };

  const shareConversation = async (c: Conversation) => {
    const title = c.customTitle || c.title || '新對話';
    const text = c.messages.map((message) => `${message.sender === 'me' ? '我' : '智能體'}：${message.type === 'text' ? message.content : `[${message.type}]`}`).join('\n');
    try {
      if (navigator.share) await navigator.share({ title, text });
      else { await navigator.clipboard.writeText(`${title}\n\n${text}`); showToast('對話內容已複製'); }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') showToast('分享對話失敗');
    } finally { setMenuId(null); }
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      try {
        deleteConv(id);
        syncActiveAfterDelete(new Set([id]));
        setConfirmDeleteId(null);
        setMenuId(null);
      } catch {
        showToast('刪除對話失敗');
      }
    } else {
      setConfirmDeleteId(id);
    }
  };

  const duplicateDraftIds = useMemo(() => getDuplicateDraftIds(conversations), [conversations]);
  const emptyCount = duplicateDraftIds.length;

  const handleCleanup = () => {
    const ids = duplicateDraftIds;
    try {
      deleteManyConv(ids);
      syncActiveAfterDelete(new Set(ids));
      setCleanupConfirm(false);
    } catch {
      showToast('清理對話失敗');
    }
  };

  const confirmBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const deletedSet = new Set(ids);
    try {
      deleteManyConv(ids);
      syncActiveAfterDelete(deletedSet);
      cancelSelectionMode();
    } catch {
      showToast('刪除對話失敗');
    }
  };
  const applyBatch = (patch: Pick<Conversation, 'pinned' | 'archived'>) => {
    if (selectedIds.size === 0) return;
    updateManyConv([...selectedIds], patch);
    cancelSelectionMode();
  };

  const renderItem = (c: Conversation) => {
    const isActive = c.id === activeId;
    const isRenaming = renameId === c.id;
    const isConfirmingDelete = confirmDeleteId === c.id;
    const isSelected = selectedIds.has(c.id);
    const title = c.customTitle || c.title || '新對話';
    const hasUnread = (c.unread || 0) > 0;

    // WeChat-style compact layout
    if (compact) {
      return (
        <div
          key={c.id}
          className={`conv-card${isActive ? ' active' : ''}${hasUnread ? ' is-unread' : ''}${selectionMode ? ' is-selecting' : ''}${isSelected ? ' selected' : ''} compact`}
          role="button"
          tabIndex={0}
          onClick={() => !isRenaming && handleSelect(c.id)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isRenaming) {
              e.preventDefault();
              handleSelect(c.id);
            }
          }}
        >
          <div className="conv-card-row">
            {selectionMode && (
              <span className="conv-select-box" aria-hidden="true">
                <input type="checkbox" checked={isSelected} readOnly tabIndex={-1} />
              </span>
            )}
            <ConversationAvatar conversation={c} size={46} />
            <div className="conv-card-content">
              <div className="conv-card-top">
                <div className="conv-card-top-left">
                  {c.pinned && (
                    <svg className="conv-pin-icon" viewBox="0 0 24 24" width="10" height="10" fill="currentColor" stroke="none">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                    </svg>
                  )}
                  <span className="conv-card-title">{title}</span>
                  {isConfirmingDelete && <span className="conv-card-deleting">刪除中</span>}
                </div>
                <span className="conv-card-time">{relativeTime(c.lastMessageAt || c.updatedAt)}</span>
                {!selectionMode && <button
                  type="button"
                  className="conv-card-menu-btn conv-card-menu-btn--compact"
                  ref={menuId === c.id ? menuAnchorRef : null}
                  aria-label={`${title}的更多操作`}
                  aria-haspopup="menu"
                  aria-expanded={menuId === c.id}
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
                ><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg></button>}
              </div>
              <div className="conv-card-bottom">
                <span className="conv-card-preview">{lastMessagePreview(c)}</span>
                {c.muted && <span className="conv-muted-icon" aria-label="已靜音"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m19 9-6 6m0-6 6 6"/></svg></span>}
                {c.unread ? c.unread > 0 && <span className="conv-card-unread">{c.unread}</span> : null}
              </div>
            </div>
          </div>
          {!selectionMode && menuId === c.id && menuPos && createPortal(
            <div className="conv-context-menu-portal" role="menu" aria-label={`${title}的操作選單`} style={{ position: 'fixed', zIndex: 101, left: menuPos.left, top: menuPos.top, minWidth: 200 }} onClick={(event) => event.stopPropagation()}>
              <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => void shareConversation(c)}>分享</button>
              <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => startRename(c)}>重新命名</button>
              <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => { pinConv(c.id); setMenuId(null); }}>{c.pinned ? '取消釘選聊天' : '釘選聊天'}</button>
              <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => { archiveConv(c.id); setMenuId(null); }}>{c.archived ? '取消封存' : '封存'}</button>
              {enableProjects && <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => { setMoveConversationId(c.id); setMenuId(null); }}>移至專案</button>}
              <button type="button" className="conv-ctx-item danger" role="menuitem" onClick={() => { setConfirmDeleteId(c.id); setMenuId(null); }}>刪除</button>
            </div>, document.body,
          )}
        </div>
      );
    }

    // Desktop sidebar layout
    return (
      <div
        key={c.id}
        className={`conv-card${isActive ? ' active' : ''}${selectionMode ? ' is-selecting' : ''}${isSelected ? ' selected' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !isRenaming && handleSelect(c.id)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isRenaming) {
            e.preventDefault();
            handleSelect(c.id);
          }
        }}
      >
        {selectionMode && (
          <span className="conv-select-box" aria-hidden="true">
            <input type="checkbox" checked={isSelected} readOnly tabIndex={-1} />
          </span>
        )}
        <ConversationAvatar conversation={c} size={44} />
        <div className="conv-card-main">
          <div className="conv-card-title-row">
              {c.pinned && (
                <span className="conv-pin-icon">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                  </svg>
                </span>
              )}
              <span className="conv-card-title">{title}</span>
              {c.unread ? c.unread > 0 && <span className="conv-card-unread">{c.unread}</span> : null}
          </div>
          <div className="conv-card-preview">{lastMessagePreview(c)}</div>
        </div>
        {!isRenaming && !selectionMode && (
          <div className="conv-card-meta">
            <span className="conv-card-time">{relativeTime(c.lastMessageAt || c.updatedAt)}</span>
            <button
              type="button"
              className="conv-card-menu-btn"
              ref={menuId === c.id ? menuAnchorRef : null}
              aria-label="對話選項"
              aria-haspopup="menu"
              aria-expanded={menuId === c.id}
              onClick={(e) => {
                e.stopPropagation();
                setMenuId(menuId === c.id ? null : c.id);
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
              </svg>
            </button>
          </div>
        )}

        {!selectionMode && menuId === c.id && menuPos && createPortal(
          <div className="conv-context-menu-portal" role="menu" aria-label="對話選單" style={{ position: 'fixed', zIndex: 101, left: menuPos.left, top: menuPos.top, minWidth: 200, maxWidth: 240, maxHeight: `calc(100vh - ${menuPos.top}px - 12px)` }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => startRename(c)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              重新命名
            </button>
            <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => void shareConversation(c)}>分享</button>
            <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => { pinConv(c.id); setMenuId(null); }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="21 8 21 21 12 17 3 21 3 8 12 4 21 8" /></svg>
              {c.pinned ? '取消釘選' : '釘選'}
            </button>
            <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => { archiveConv(c.id); setMenuId(null); }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
                <path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7z" />
              </svg>
              {c.archived ? '取消封存' : '封存'}
            </button>
            {enableProjects && <button type="button" className="conv-ctx-item" role="menuitem" onClick={() => { setMoveConversationId(c.id); setMenuId(null); }}>移至專案</button>}
            <button
              type="button"
              className={`conv-ctx-item danger${isConfirmingDelete ? ' confirm' : ''}`}
              role="menuitem"
              onClick={() => { setConfirmDeleteId(c.id); setMenuId(null); }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              刪除
            </button>
          </div>,
          document.body,
        )}
      </div>
    );
  };

  const hasAny = sortedPinned.length > 0 || sortedRecent.length > 0;

  return (
    <>
    <div className="conv-list">
      {enableProjects && (
        <div className="conv-list-tabs" role="tablist" aria-label="聊天檢視">
          <button type="button" role="tab" aria-selected={listMode === 'recent'} className={listMode === 'recent' ? 'active' : ''} onClick={() => setListMode('recent')}>最近</button>
          <button type="button" role="tab" aria-selected={listMode === 'projects'} className={listMode === 'projects' ? 'active' : ''} onClick={() => setListMode('projects')}>專案</button>
        </div>
      )}
      {!compact && showToolbar && (
        <div className="conv-list-toolbar">
        <button type="button" className="conv-new-btn" onClick={handleNewChat}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新聊天</span>
        </button>
        {emptyCount > 0 && (
          <button type="button" className="conv-cleanup-btn" onClick={() => setCleanupConfirm(true)}>
            清理空對話 ({emptyCount})
          </button>
        )}
        {archived.length > 0 && (
          <button type="button" className="conv-archived-toolbar-btn" onClick={() => setShowArchived(true)}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
              <path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7z" />
            </svg>
            <span>封存 ({archived.length})</span>
          </button>
        )}
      </div>
      )}

      <div className="conv-search-row">
        <div className="conv-search-wrap">
          <svg className="conv-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
          </svg>
          <input
            type="text"
            className="conv-search-input"
            placeholder="搜尋聊天"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`conv-manage-btn${selectionMode ? ' active' : ''}`}
          onClick={selectionMode ? cancelSelectionMode : enterSelectionMode}
          aria-label={selectionMode ? '取消選取' : '管理對話'}
        >
          {selectionMode ? '取消' : '管理'}
        </button>
      </div>

      {selectionMode && <ConversationBatchToolbar selectedCount={selectedCount} allSelected={allVisibleSelected} hasVisible={visibleConversationIds.length > 0} onSelectAll={selectAllVisible} onPin={() => applyBatch({ pinned: true })} onArchive={() => applyBatch({ archived: true })} onDelete={() => setBatchDeleteConfirmOpen(true)} onCancel={cancelSelectionMode} />}

      <div className="conv-list-scroll">
        {enableProjects && listMode === 'projects' ? (
          <div className="chat-projects-view">
            <button type="button" className="chat-project-create" onClick={() => setCreateProjectOpen(true)}>＋ 建立專案</button>
            {sortedProjects.map((project) => {
              const expanded = expandedProjectIds.has(project.id);
              const projectConversations = projectConversationMap.get(project.id) || [];
              return <section key={project.id} className={`chat-project-group${project.archived ? ' is-archived' : ''}`} data-project-id={project.id}>
                <div className="chat-project-row">
                  <button type="button" className="chat-project-toggle" onClick={() => toggleProject(project.id)} aria-expanded={expanded} aria-label={`${expanded ? '收合' : '展開'}${project.name}`}>
                    <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                    <strong>{project.name}</strong>
                    <small>{projectConversations.length}</small>
                  </button>
                  <button type="button" className="chat-project-more" aria-label={`${project.name}的更多操作`} aria-expanded={projectMenuId === project.id} onClick={() => setProjectMenuId(projectMenuId === project.id ? null : project.id)}>•••</button>
                  {projectMenuId === project.id && <div className="chat-project-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setProjectName(project.name); setRenameProjectId(project.id); setProjectMenuId(null); }}>重新命名</button>
                    <button type="button" role="menuitem" onClick={() => { archiveProject(project.id); setProjectMenuId(null); }}>{project.archived ? '取消封存' : '封存'}</button>
                    <button type="button" role="menuitem" className="danger" onClick={() => { setDeleteProjectId(project.id); setProjectMenuId(null); }}>刪除專案</button>
                  </div>}
                </div>
                {expanded && <div className="chat-project-contents">
                  {projectConversations.map((conversation) => <div className="chat-project-conversation" key={conversation.id}>{renderItem(conversation)}</div>)}
                  {projectConversations.length === 0 && <p className="chat-project-empty">尚無聊天</p>}
                  {!project.archived && <button type="button" className="chat-project-new-chat" onClick={() => handleCreateProjectChat(project.id)}>＋ 新對話</button>}
                </div>}
              </section>;
            })}
            {sortedProjects.length === 0 && <div className="conv-list-empty"><p className="conv-empty-text">還沒有專案</p></div>}
            <section className="chat-project-group is-unassigned">
              <div className="chat-project-row"><button type="button" className="chat-project-toggle" onClick={() => toggleProject('__unassigned__')} aria-expanded={expandedProjectIds.has('__unassigned__')}><span aria-hidden="true">{expandedProjectIds.has('__unassigned__') ? '▾' : '▸'}</span><strong>未分類</strong><small>{unassignedConversations.length}</small></button></div>
              {expandedProjectIds.has('__unassigned__') && <div className="chat-project-contents">{unassignedConversations.length ? unassignedConversations.map((conversation) => <div className="chat-project-conversation" key={conversation.id}>{renderItem(conversation)}</div>) : <p className="chat-project-empty">沒有未分類聊天</p>}</div>}
            </section>
          </div>
        ) : showArchived ? (
          <>
            <div className="conv-section-label">
              <button type="button" className="conv-back-btn" onClick={() => setShowArchived(false)}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                回到最近
              </button>
            </div>
            {archived.length > 0 ? (
              archived.map(renderItem)
            ) : (
              <div className="conv-list-empty">
                <div className="conv-empty-icon">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
                    <path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7z" />
                  </svg>
                </div>
                <p className="conv-empty-text">沒有封存對話</p>
              </div>
            )}
          </>
        ) : (
          <>
            {sortedPinned.length > 0 && (
              <>
                <div className="conv-section-label">釘選</div>
                {sortedPinned.map(renderItem)}
              </>
            )}
            {sortedRecent.length > 0 && (
              <>
                {sortedPinned.length > 0 && <div className="conv-section-divider" />}
                <div className="conv-section-label">最近</div>
                {sortedRecent.map(renderItem)}
              </>
            )}
            {archived.length > 0 && (
              <button type="button" className="conv-archived-link" onClick={() => setShowArchived(true)}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
                  <path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7z" />
                </svg>
                <span>封存對話 ({archived.length})</span>
              </button>
            )}
            {compact && emptyCount > 0 && (
              <div className="conv-cleanup-row">
                <button type="button" className="conv-cleanup-link" onClick={() => setCleanupConfirm(true)}>
                  清理空對話 ({emptyCount})
                </button>
              </div>
            )}
            {!hasAny && !archived.length && (
              <div className="conv-list-empty">
                <div className="conv-empty-icon">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="conv-empty-text">{query ? '找不到相關對話' : '還沒有對話'}</p>
                {!query && (
                  <button type="button" className="conv-empty-btn" onClick={handleNewChat}>
                    開始新對話
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

    </div>

      {renameId && (() => { const conversation = conversations.find((item) => item.id === renameId); return <MobileShellOverlay variant="dialog" onClose={() => { setRenameId(null); setRenameValue(''); }} className="conversation-action-overlay"><form className="conversation-action-dialog" role="dialog" aria-modal="true" aria-labelledby="conversation-rename-title" onSubmit={(event) => { event.preventDefault(); commitRename(); }}><button type="button" className="conversation-action-close" aria-label="關閉" onClick={() => { setRenameId(null); setRenameValue(''); }}>×</button><h2 id="conversation-rename-title">重新命名聊天</h2><input ref={renameInputRef} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} aria-label="聊天名稱" maxLength={40}/><div><button type="button" onClick={() => { setRenameId(null); setRenameValue(''); }}>取消</button><button type="submit" disabled={!renameValue.trim()}>儲存</button></div><span className="sr-only">目前名稱：{conversation?.customTitle || conversation?.title}</span></form></MobileShellOverlay>; })()}

      {createProjectOpen && <MobileShellOverlay variant="dialog" onClose={() => { setCreateProjectOpen(false); setProjectName(''); }} className="conversation-action-overlay"><form className="conversation-action-dialog" role="dialog" aria-modal="true" aria-labelledby="project-create-title" onSubmit={(event) => { event.preventDefault(); handleCreateProject(); }}><h2 id="project-create-title">建立專案</h2><label className="conversation-action-field">專案名稱<input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={40}/></label><div><button type="button" onClick={() => { setCreateProjectOpen(false); setProjectName(''); }}>取消</button><button type="submit" disabled={!projectName.trim()}>建立專案</button></div></form></MobileShellOverlay>}

      {renameProjectId && <MobileShellOverlay variant="dialog" onClose={() => { setRenameProjectId(null); setProjectName(''); }} className="conversation-action-overlay"><form className="conversation-action-dialog" role="dialog" aria-modal="true" aria-labelledby="project-rename-title" onSubmit={(event) => { event.preventDefault(); renameProject(renameProjectId, projectName); setRenameProjectId(null); setProjectName(''); }}><h2 id="project-rename-title">重新命名專案</h2><input autoFocus aria-label="專案名稱" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={40}/><div><button type="button" onClick={() => { setRenameProjectId(null); setProjectName(''); }}>取消</button><button type="submit" disabled={!projectName.trim()}>儲存</button></div></form></MobileShellOverlay>}

      {deleteProjectId && (() => { const project = chatProjects.find((item) => item.id === deleteProjectId); return <MobileShellOverlay variant="dialog" onClose={() => setDeleteProjectId(null)} className="conversation-action-overlay"><section className="conversation-action-dialog" role="alertdialog" aria-modal="true" aria-labelledby="project-delete-title"><h2 id="project-delete-title">刪除「{project?.name || '專案'}」？</h2><p>刪除專案不會刪除其中的聊天。聊天會移回未分類。</p><div><button type="button" onClick={() => setDeleteProjectId(null)}>取消</button><button type="button" className="is-danger" onClick={() => { deleteProject(deleteProjectId); setDeleteProjectId(null); }}>刪除專案</button></div></section></MobileShellOverlay>; })()}

      {moveConversationId && <MobileShellOverlay variant="dialog" onClose={() => setMoveConversationId(null)} className="conversation-action-overlay"><section className="conversation-action-dialog project-move-dialog" role="dialog" aria-modal="true" aria-labelledby="project-move-title"><h2 id="project-move-title">移至專案</h2><div className="project-move-options"><button type="button" onClick={() => { assignToProject(moveConversationId, undefined); setMoveConversationId(null); }}>未分類</button>{sortedProjects.filter((project) => !project.archived).map((project) => <button type="button" key={project.id} onClick={() => { assignToProject(moveConversationId, project.id); setMoveConversationId(null); }}>{project.name}</button>)}</div><div><button type="button" onClick={() => setMoveConversationId(null)}>取消</button></div></section></MobileShellOverlay>}

      {confirmDeleteId && (() => { const conversation = conversations.find((item) => item.id === confirmDeleteId); const title = conversation?.customTitle || conversation?.title || '新對話'; return <MobileShellOverlay variant="dialog" onClose={() => setConfirmDeleteId(null)} className="conversation-action-overlay"><section className="conversation-action-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conversation-delete-title"><h2 id="conversation-delete-title">刪除「{title}」？</h2><p>此操作將刪除這段聊天記錄。</p><div><button type="button" onClick={() => setConfirmDeleteId(null)}>取消</button><button type="button" className="is-danger" onClick={() => handleDelete(confirmDeleteId)}>刪除</button></div></section></MobileShellOverlay>; })()}

      {batchDeleteConfirmOpen && createPortal(
        <div className="quick-sheet-overlay active" onClick={() => setBatchDeleteConfirmOpen(false)}>
          <div className="quick-sheet conv-delete-confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="quick-sheet-handle" />
            <div className="quick-sheet-head">
              <span className="quick-sheet-title">刪除 {selectedCount} 個聊天？</span>
            </div>
            <div className="quick-sheet-body conv-delete-confirm-body">
              聊天記錄將被移除，此操作無法復原。
            </div>
            <div className="quick-sheet-actions">
              <button type="button" className="btn-ghost" onClick={() => setBatchDeleteConfirmOpen(false)}>取消</button>
              <button type="button" className="btn-danger" disabled={selectedCount === 0} onClick={confirmBatchDelete}>刪除 {selectedCount} 個聊天</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {cleanupConfirm && createPortal(
        <div className="quick-sheet-overlay active" onClick={() => setCleanupConfirm(false)}>
          <div className="quick-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 320 }}>
            <div className="quick-sheet-handle" />
            <div className="quick-sheet-head">
              <span className="quick-sheet-title">清理空對話</span>
            </div>
            <div className="quick-sheet-body" style={{ textAlign: 'center', padding: '8px 16px', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
              這會刪除 {emptyCount} 個沒有任何訊息的對話。
            </div>
            <div className="quick-sheet-actions">
              <button type="button" className="btn-ghost" onClick={() => setCleanupConfirm(false)}>取消</button>
              <button type="button" className="btn-danger" onClick={handleCleanup}>確認清理</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function ConversationBatchToolbar({ selectedCount, allSelected, hasVisible, onSelectAll, onPin, onArchive, onDelete, onCancel }: { selectedCount: number; allSelected: boolean; hasVisible: boolean; onSelectAll: () => void; onPin: () => void; onArchive: () => void; onDelete: () => void; onCancel: () => void }) {
  const disabled = selectedCount === 0;
  return <div className="conv-selection-bar" role="toolbar" aria-label="批量管理聊天" data-pet-safe-zone>
    <div className="conv-selection-row conv-selection-row--summary">
      <button type="button" className="conv-selection-action" onClick={onCancel}>取消</button>
      <span className="conv-selection-count">已選 {selectedCount} 個</span>
      <button type="button" className="conv-selection-action" onClick={onSelectAll} disabled={!hasVisible}>{allSelected ? '取消全選' : '全選'}</button>
    </div>
    <div className="conv-selection-row conv-selection-row--actions">
      <button type="button" className="conv-selection-action" onClick={onPin} disabled={disabled}>釘選</button>
      <button type="button" className="conv-selection-action" onClick={onArchive} disabled={disabled}>封存</button>
      <button type="button" className="conv-selection-action danger" onClick={onDelete} disabled={disabled}>刪除 {selectedCount} 個</button>
    </div>
  </div>;
}
