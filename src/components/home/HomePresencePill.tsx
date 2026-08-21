import { useRef, useState, useCallback, useEffect } from 'react';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { useAppStore, selectAgentAvatar, selectAgentDisplayName } from '@/store/useAppStore';
import { usePresencePillStore, type PresencePillAnchor, type SafeRegion } from '@/features/home/usePresencePillStore';
import { AgentQuickEditor } from '@/components/agent/AgentQuickEditor';

interface HomePresencePillProps {
  editMode?: boolean;
  safeRegions?: SafeRegion;
}

function useBreakpoint(): 'desktop' | 'tablet' | 'mobile' {
  const [bp, setBp] = useState<'desktop' | 'tablet' | 'mobile'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w < 640) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  });
  useEffect(() => {
    const r = () => { const w = window.innerWidth; setBp(w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'); };
    window.addEventListener('resize', r, { passive: true });
    return () => window.removeEventListener('resize', r);
  }, []);
  return bp;
}

const ANCHORS: PresencePillAnchor[] = ['left', 'center', 'right'];

export function HomePresencePill({ editMode, safeRegions }: HomePresencePillProps) {
  const bp = useBreakpoint();
  const pillRef = useRef<HTMLDivElement>(null);
  const agentButtonRef = useRef<HTMLButtonElement>(null);

  const profile = useAppStore((s) => s.profile);
  const userName = useAppStore((s) => s.userName);
  const partner = useAppStore((s) => s.partner);
  const placement = usePresencePillStore((s) => s[bp]);
  const setPlacement = usePresencePillStore((s) => s.setPlacement);
  const setHidden = usePresencePillStore((s) => s.setHidden);

  // ── Agent Quick Editor (desktop anchored / mobile bottom sheet) ──
  const [agentEditorOpen, setAgentEditorOpen] = useState(false);
  const [agentEditorAnchor, setAgentEditorAnchor] = useState<DOMRect | null>(null);

  const openAgentEditor = useCallback(() => {
    setAgentEditorAnchor(agentButtonRef.current?.getBoundingClientRect() ?? null);
    setAgentEditorOpen(true);
  }, []);

  const closeAgentEditor = useCallback(() => {
    setAgentEditorOpen(false);
    setAgentEditorAnchor(null);
    window.requestAnimationFrame(() => agentButtonRef.current?.focus());
  }, []);

  const displayName = profile.displayName || userName || '理';
  const userInitial = (profile.avatarInitial || displayName || '理').charAt(0).toUpperCase();
  const lunaName = selectAgentDisplayName(partner);
  const lunaAvatar = selectAgentAvatar(partner);
  const lunaInitial = (partner.avatarInitial || lunaName || '智').charAt(0).toUpperCase();

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number; origXRatio: number; origY: number } | null>(null);

  const startDrag = useCallback((e: React.PointerEvent) => {
    if (!editMode || !e.isPrimary) return;
    e.preventDefault();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origXRatio: placement.xRatio,
      origY: placement.y,
    };
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
  }, [editMode, placement]);

  const moveDrag = useCallback((e: PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
  }, []);

  const endDrag = useCallback(() => {
    if (!dragStartRef.current || !pillRef.current) {
      setIsDragging(false);
      dragStartRef.current = null;
      return;
    }

    const rect = pillRef.current.getBoundingClientRect();
    const parentEl = pillRef.current.parentElement;
    if (!parentEl) { setIsDragging(false); dragStartRef.current = null; return; }

    const parentRect = parentEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 + dragOffset.x;
    const newXRatio = (cx - parentRect.left) / parentRect.width;
    const clampedRatio = Math.max(0.05, Math.min(0.95, newXRatio));

    // Determine anchor
    let anchor: PresencePillAnchor = 'center';
    if (clampedRatio < 0.3) anchor = 'left';
    else if (clampedRatio > 0.7) anchor = 'right';

    // Check safe regions
    const newRect = {
      left: parentRect.left + clampedRatio * parentRect.width - rect.width / 2,
      top: rect.top + dragOffset.y,
      width: rect.width,
      height: rect.height,
    };
    let newY = placement.y + dragOffset.y;

    // Avoid collisions
    if (safeRegions) {
      const check = (region: DOMRect | null) => {
        if (!region) return false;
        return !(
          newRect.left + newRect.width < region.left ||
          newRect.left > region.right ||
          newRect.top + newRect.height < region.top ||
          newRect.top > region.bottom
        );
      };
      if (check(safeRegions.clock) || check(safeRegions.topIsland) || check(safeRegions.widgetToolbar)) {
        // Push below the colliding element's bottom
        const maxCollisionBottom = Math.max(
          safeRegions.clock?.bottom ?? 0,
          safeRegions.topIsland?.bottom ?? 0,
          safeRegions.widgetToolbar?.bottom ?? 0,
        );
        if (newY < maxCollisionBottom - parentRect.top + 8) {
          newY = maxCollisionBottom - parentRect.top + 8;
        }
      }
    }

    setPlacement(bp, { xRatio: clampedRatio, y: Math.max(0, newY), anchor });
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    dragStartRef.current = null;
  }, [bp, placement, safeRegions, setPlacement]);

  // Global pointer listeners for drag
  useEffect(() => {
    if (!isDragging) return;
    const up = () => endDrag();
    const move = (e: PointerEvent) => moveDrag(e);
    const cancel = () => { setIsDragging(false); dragStartRef.current = null; };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [isDragging, endDrag, moveDrag]);

  // Escape
  useEffect(() => {
    if (!editMode) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragStartRef.current) {
        setIsDragging(false);
        dragStartRef.current = null;
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [editMode]);

  // Keyboard navigation
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!editMode) return;
    const step = e.shiftKey ? 0.1 : 0.05;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setPlacement(bp, { xRatio: Math.max(0.05, placement.xRatio - step), anchor: placement.xRatio - step < 0.3 ? 'left' : placement.xRatio - step < 0.7 ? 'center' : 'right' });
        break;
      case 'ArrowRight':
        e.preventDefault();
        setPlacement(bp, { xRatio: Math.min(0.95, placement.xRatio + step), anchor: placement.xRatio + step < 0.3 ? 'left' : placement.xRatio + step < 0.7 ? 'center' : 'right' });
        break;
      case 'Enter':
        e.preventDefault();
        // Cycle anchor
        const idx = ANCHORS.indexOf(placement.anchor);
        const next = ANCHORS[(idx + 1) % ANCHORS.length];
        const ratio = next === 'left' ? 0.15 : next === 'right' ? 0.85 : 0.5;
        setPlacement(bp, { xRatio: ratio, anchor: next });
        break;
    }
  }, [editMode, bp, placement, setPlacement]);

  if (placement.hidden) return null;

  const pillStyle: React.CSSProperties = {
    '--pp-x-ratio': placement.xRatio,
    '--pp-y': `${placement.y}px`,
    '--pp-dx': `${dragOffset.x}px`,
    '--pp-dy': `${dragOffset.y}px`,
  } as React.CSSProperties;

  return (
    <div
      className={`home-presence-pill-zone${editMode ? ' home-presence-pill-zone--edit' : ''}`}
      data-home-presence-pill
      data-presence-anchor={placement.anchor}
      style={pillStyle}
      ref={pillRef}
    >
      <div
        className={`home-presence-pill${isDragging ? ' home-presence-pill--dragging' : ''}`}
        onPointerDown={editMode ? startDrag : undefined}
        onKeyDown={editMode ? onKeyDown : undefined}
        tabIndex={editMode ? 0 : undefined}
        role={editMode ? 'button' : undefined}
        aria-label={`歡迎回來，${displayName}${editMode ? ' - 可拖動移動' : ''}`}
        data-testid="home-presence-pill"
        style={editMode ? { cursor: 'grab', touchAction: 'none' } : undefined}
      >
        <button
          ref={agentButtonRef}
          type="button"
          className="home-presence-pill-agent-btn"
          data-testid="agent-avatar-button"
          data-pet-safe-region="interactive"
          aria-label="編輯智能體"
          title={`編輯目前智能體：${lunaName}`}
          onClick={(e) => { e.stopPropagation(); openAgentEditor(); }}
          onPointerDown={(e) => { if (editMode) e.stopPropagation(); }}
        >
          <AvatarImage
            avatarConfig={lunaAvatar}
            fallbackInitial={lunaInitial}
            initial={lunaInitial}
            color={partner.avatarColor || 'char'}
            size={25}
            label={lunaName}
          />
        </button>
        <span aria-hidden="true" className="home-presence-pill-sep">≋</span>
        <span data-testid="user-avatar">
          <AvatarImage
            avatarConfig={profile.avatarImage}
            fallbackInitial={userInitial}
            initial={userInitial}
            color={profile.avatarColor || 'user'}
            size={25}
            label={displayName}
          />
        </span>
        <span className="home-presence-pill-text">歡迎回來 <strong>{displayName}</strong></span>
      </div>
      {editMode && (
        <div className="home-presence-pill-controls" data-no-widget-drag>
          <button
            type="button"
            className="home-presence-pill-snap-btn"
            onClick={() => setHidden(bp, !placement.hidden)}
            aria-label={placement.hidden ? '顯示' : '隱藏'}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              {placement.hidden
                ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                : <><path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8s3.06-5.94 5.06-5.94M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8s-2.16 3.19-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>}
            </svg>
          </button>
        </div>
      )}
      <AgentQuickEditor
        open={agentEditorOpen}
        variant={bp === 'mobile' ? 'sheet' : 'popover'}
        anchor={agentEditorAnchor}
        onClose={closeAgentEditor}
      />
    </div>
  );
}
