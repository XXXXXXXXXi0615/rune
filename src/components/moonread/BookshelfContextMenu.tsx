/**
 * BookshelfContextMenu — Desktop popover and Mobile bottom sheet
 * for book actions on the MoonRead bookshelf
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MoonReadBook } from '@/features/moonread/types';

export interface BookshelfContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
}

interface BookshelfContextMenuProps {
  book: MoonReadBook;
  open: boolean;
  anchorRect: DOMRect | null;
  isMobile: boolean;
  onClose: () => void;
  onAction: (actionId: string) => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

const MENU_ACTIONS: BookshelfContextMenuAction[] = [
  { id: 'continue', label: '繼續閱讀' },
  { id: 'restart', label: '從頭開始' },
  { id: 'divider-1', label: '', icon: 'divider' },
  { id: 'wantlist', label: '加入想讀清單' },
  { id: 'favorite', label: '加入收藏' },
  { id: 'mark-read', label: '標示為已讀完' },
  { id: 'divider-2', label: '', icon: 'divider' },
  { id: 'edit', label: '編輯書籍資料…' },
  { id: 'cover', label: '更換封面…' },
  { id: 'reparse', label: '重新解析書籍…' },
  { id: 'divider-3', label: '', icon: 'divider' },
  { id: 'remove', label: '從書架移除…', destructive: true },
];

export function BookshelfContextMenu({
  book,
  open,
  anchorRect,
  isMobile,
  onClose,
  onAction,
  returnFocusRef,
}: BookshelfContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Get active actions (not dividers)
  const activeActions = MENU_ACTIONS.filter(a => a.icon !== 'divider');

  // Focus management
  useEffect(() => {
    if (open) {
      setFocusedIndex(0);
      // Focus first item after render
      requestAnimationFrame(() => {
        itemRefs.current[0]?.focus();
      });
    }
  }, [open]);

  // Dynamic labels based on book state
  const getActionLabel = useCallback((actionId: string): string => {
    switch (actionId) {
      case 'continue':
        return book.progress >= 1 ? '' : book.progress > 0 ? '繼續閱讀' : '開始閱讀';
      case 'wantlist':
        return book.tags.includes('wantlist') ? '從想讀清單移除' : '加入想讀清單';
      case 'favorite':
        return book.tags.includes('favorite') ? '從收藏移除' : '加入收藏';
      case 'mark-read':
        return book.progress >= 1 ? '標示為未讀' : '標示為已讀完';
      default:
        return MENU_ACTIONS.find(a => a.id === actionId)?.label || '';
    }
  }, [book]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = (prev + 1) % activeActions.length;
          itemRefs.current[next]?.focus();
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = (prev - 1 + activeActions.length) % activeActions.length;
          itemRefs.current[next]?.focus();
          return next;
        });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onAction(activeActions[focusedIndex].id);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        itemRefs.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        const last = activeActions.length - 1;
        setFocusedIndex(last);
        itemRefs.current[last]?.focus();
        break;
    }
  }, [activeActions, focusedIndex, onAction, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  // Return focus on close
  useEffect(() => {
    if (!open && returnFocusRef.current) {
      returnFocusRef.current.focus();
    }
  }, [open, returnFocusRef]);

  if (!open) return null;

  const content = (
    <div
      ref={menuRef}
      className="bookshelf-context-menu"
      role="menu"
      aria-label="書籍操作"
      onKeyDown={handleKeyDown}
    >
      {MENU_ACTIONS.map((action, index) => {
        if (action.icon === 'divider') {
          return <div key={action.id} className="bookshelf-context-divider" role="separator" />;
        }

        const isActive = activeActions.findIndex(a => a.id === action.id);
        const label = getActionLabel(action.id);
        if (!label) return null;

        return (
          <button
            key={action.id}
            ref={el => { itemRefs.current[isActive] = el; }}
            type="button"
            role="menuitem"
            className={`bookshelf-context-item${action.destructive ? ' is-destructive' : ''}`}
            onClick={() => onAction(action.id)}
            tabIndex={isActive === focusedIndex ? 0 : -1}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div className="bookshelf-context-backdrop" onClick={onClose}>
        <div
          className="bookshelf-context-sheet"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-label="書籍操作"
        >
          <div className="bookshelf-context-handle" />
          <div className="bookshelf-context-header">
            <span className="bookshelf-context-title">{book.title}</span>
            <span className="bookshelf-context-author">{book.author}</span>
          </div>
          {content}
        </div>
      </div>,
      document.body,
    );
  }

  // Desktop popover positioning
  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = 'fixed';
    style.left = anchorRect.right;
    style.top = anchorRect.top;
    style.zIndex = 130;

    // Viewport clamping
    if (typeof window !== 'undefined') {
      const menuWidth = 220;
      const menuHeight = 400;
      if (anchorRect.right + menuWidth > window.innerWidth) {
        style.left = anchorRect.left - menuWidth;
      }
      if (anchorRect.top + menuHeight > window.innerHeight) {
        style.top = window.innerHeight - menuHeight - 8;
      }
    }
  }

  return createPortal(
    <div className="bookshelf-context-popover" style={style}>
      {content}
    </div>,
    document.body,
  );
}
