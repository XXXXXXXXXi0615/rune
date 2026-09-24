/**
 * TideActionOrb — Liquid Glass floating action orb in bottom dock.
 *
 * Phase 1: opens compact action menu with route-specific actions.
 * Visual: frosted glass circle, subtle glow, slightly raised.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './TideActionOrb.css';

interface OrbAction {
  label: string;
  /** Phase 1: label only. Phase 2+: actual action handler. */
  onClick?: () => void;
}

/* ── Route → actions mapping ── */
function getActionsForRoute(pathname: string): OrbAction[] {
  if (pathname === '/') return [
    { label: '記錄潮位' },
    { label: '寫備忘' },
    { label: '記一筆' },
    { label: '收進記憶' },
  ];
  if (pathname.startsWith('/chat')) return [
    /* ── Reserved: Dock hidden on Chat; actions mapped for future use ── */
    { label: '加入上下文' },
    { label: '上傳圖片' },
    { label: '選擇記憶' },
    { label: 'Prompt 模板' },
  ];
  if (pathname.startsWith('/calendar')) return [
    { label: '新增待辦' },
    { label: '新增時光' },
    { label: '新增事件' },
  ];
  if (pathname.startsWith('/ledger')) return [
    { label: '記支出' },
    { label: '記收入' },
    { label: '記錄訂閱' },
  ];
  if (pathname.startsWith('/objects')) return [
    { label: '加入物品' },
    { label: '查看檔案' },
  ];
  if (pathname.startsWith('/diary')) return [
    { label: '寫日誌' },
    { label: '新增長期記憶' },
  ];
  if (pathname.startsWith('/settings')) return [
    { label: '偏好設定' },
    { label: '管理 AI' },
  ];
  if (pathname.startsWith('/works')) return [
    { label: '新建作品' },
    { label: '匯入' },
  ];
  if (pathname.startsWith('/timeline')) return [
    { label: '新增節點' },
    { label: '篩選時間' },
  ];
  return [
    { label: '快速操作' },
  ];
}

export function TideActionOrb() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const orbRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const actions = getActionsForRoute(location.pathname);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  /* ── Close on outside click / touch ── */
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (orbRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [menuOpen, closeMenu]);

  /* ── ESC closes ── */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, closeMenu]);

  const handleAction = (action: OrbAction) => {
    closeMenu();
    if (action.onClick) {
      action.onClick();
      return;
    }
    // Phase 1: default navigation hints
    if (action.label === '加入物品' && location.pathname.startsWith('/objects')) {
      // Trigger editor via navigation — handled by parent
    }
    if (action.label === '查看檔案' && location.pathname.startsWith('/objects')) {
      navigate('/objects/archive');
    }
    if (action.label === '新增待辦') {
      navigate('/calendar?tab=todo');
    }
  };

  return (
    <div className="tide-orb-wrapper">
      <button
        ref={orbRef}
        type="button"
        className={`tide-orb${menuOpen ? ' tide-orb--active' : ''}`}
        onClick={toggleMenu}
        aria-label="快速操作"
        aria-expanded={menuOpen}
      >
        <svg className="tide-orb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {menuOpen && (
        <div ref={menuRef} className="tide-orb-menu" role="menu">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="tide-orb-menu-item"
              role="menuitem"
              onClick={() => handleAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
