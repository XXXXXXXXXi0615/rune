import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { getPetImage } from '@/store/petImages';
import { resolveLunaPresence } from '@/utils/lunaPresence';
import { t } from '@/i18n';
import type { PetImageFrame, PetMood } from '@/types';

const SIZE_LS_KEY = 'lunartide_clawd_size_v1';
function getClawdSize(): number { try { const r = localStorage.getItem(SIZE_LS_KEY); if (r) { const n = parseInt(r, 10); if (n >= 25 && n <= 150) return n; } } catch {} return 100; }
const EDGE_SNAP = 60;
const LONG_PRESS_MS = 500;
const BUBBLE_DURATION = 4000;

const STATUS_TO_MOOD: Record<string, PetMood> = {
  online: 'happy', invisible: 'shy', busy: 'annoyed',
  syncing: 'thinking', offline: 'sleepy', local: 'idle', quiet: 'idle',
};

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function isLateNight(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 6;
}

/* ── Mood animation class mapping ── */
const MOOD_ANIM_CLASS: Record<PetMood, string> = {
  idle: 'clawd-float',
  happy: 'clawd-bounce',
  thinking: 'clawd-sway',
  sleepy: 'clawd-breathe',
  anxious: 'clawd-shake',
  shy: 'clawd-shrink',
  annoyed: 'clawd-shake',
  error: 'clawd-blink',
};

/* ── Clawd SVG Pet ── */
function ClawdPet({ size, mood = 'idle' as PetMood }: { size?: number; mood?: PetMood }) {
  const s = size || 80;
  const animClass = MOOD_ANIM_CLASS[mood] || '';
  return (
    <svg className={`clawd-pet ${animClass}`} width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
      style={{ display: 'block', color: 'var(--accent, #d4773c)', filter: 'drop-shadow(0 2px 6px rgba(212,119,60,0.3))' }}>
      <title>Clawd</title>
      <path d="M4.5 6h15v5H22v2h-2.5v3h-1v2H17v-2h-1v2h-1.5v-2h-5v2H8v-2H7v2H5.5v-2h-1v-3H2v-2h2.5ZM7 8v3h1V8Zm9 0v3h1V8Z" />
    </svg>
  );
}

/* ── Build contextual bubble message ── */
function buildBubble(
  activityLogs: { title: string; type: string; createdAt: number }[],
  memoryCount: number,
  todoCount: number,
): string | null {
  const now = Date.now();
  const recent = activityLogs.filter((a) => now - a.createdAt < 30000);
  if (recent.length === 0) return null;
  const latest = recent[0];
  if (latest.type === 'memory') return `記錄了一筆新記憶 ✦`;
  if (latest.type === 'todo' && latest.title.includes('完成')) return `完成了一項待辦 ✦`;
  if (latest.type === 'todo' && latest.title.includes('新增')) return `新增了一項待辦 ✦`;
  if (latest.type === 'system' && latest.title.includes('塔羅')) return `抽了一張塔羅牌 ✦`;
  if (latest.type === 'health') return `匯入了睡眠記錄 ✦`;
  return null;
}

/* ── Mood preview (menu sub-component) ── */
/* ══════════════════════════════════════════════ */
export function PetWidget() {
  const petWidget = useAppStore((s) => s.petWidget);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const aiTyping = useAppStore((s) => s.aiTyping);
  const lunaContact = useAppStore((s) => s.chatContacts.find((c) => c.id === 'luna'));
  const aiConfig = useAppStore((s) => s.aiConfig);
  const activityLogs = useAppStore((s) => s.activityLogs || []);
  const memoryEntries = useAppStore((s) => s.memoryEntries);
  const todos = useAppStore((s) => s.todos);

  const lunaStatus = resolveLunaPresence(lunaContact, aiConfig);
  const currentMood = (petWidget?.currentMood || 'idle') as PetMood;
  const moodImages = useMemo(() => petWidget?.moodImages || {}, [petWidget?.moodImages]);
  const manualMoodOverride = petWidget?.manualMoodOverride === true;
  const activeSlot = moodImages[currentMood] || moodImages.idle;
  const activeFrames = useMemo(() => activeSlot?.frames || [], [activeSlot?.frames]);
  const frameDurationMs = activeSlot?.frameDurationMs || 350;
  const shouldLoop = activeSlot?.loop !== false;

  // Dynamic Clawd size
  const [clawdSize, setClawdSize] = useState(getClawdSize);
  useEffect(() => {
    const handler = (e: Event) => setClawdSize((e as CustomEvent).detail);
    window.addEventListener('clawd:sizeChange', handler);
    return () => window.removeEventListener('clawd:sizeChange', handler);
  }, []);

  // Position with edge snapping
  const petSize = clawdSize;
  const defaultX = window.innerWidth - petSize - 18;
  const defaultY = window.innerHeight - 160 - petSize;
  const [pos, setPos] = useState(() => ({
    x: petWidget?.x ?? defaultX, y: petWidget?.y ?? defaultY,
  }));

  const [frameUrls, setFrameUrls] = useState<string[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const moved = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActivityLen = useRef(activityLogs.length);

  /* ── Status → mood sync ── */
  useEffect(() => {
    if (manualMoodOverride) return;
    if (aiTyping) return;
    let targetMood = STATUS_TO_MOOD[lunaStatus] || 'idle';
    // Late night → sleepy
    if (isLateNight() && lunaStatus === 'local') targetMood = 'sleepy';
    if (currentMood === targetMood) return;
    updateSettings({ petWidget: { ...petWidget, visible: petWidget?.visible !== false, currentMood: targetMood, manualMoodOverride: false, moodImages, x: pos.x, y: pos.y } });
  }, [lunaStatus, manualMoodOverride, aiTyping]);

  /* ── AI typing → thinking ── */
  useEffect(() => {
    if (manualMoodOverride) return;
    if (!aiTyping || currentMood === 'thinking') return;
    updateSettings({ petWidget: { ...petWidget, visible: petWidget?.visible !== false, currentMood: 'thinking', manualMoodOverride: false, moodImages, x: pos.x, y: pos.y } });
  }, [aiTyping, manualMoodOverride]);

  /* ── System integration: bubble on new activity ── */
  useEffect(() => {
    if (activityLogs.length > prevActivityLen.current) {
      const msg = buildBubble(activityLogs, memoryEntries.length, todos.filter((t) => !t.completed).length);
      if (msg) {
        setBubble(msg);
        if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
        bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_DURATION);
      }
    }
    prevActivityLen.current = activityLogs.length;
  }, [activityLogs.length]);

  /* ── Frame loading ── */
  useEffect(() => {
    const objectUrls: string[] = []; let cancelled = false;
    setFrameIndex(0); setImageFailed(false);
    if (activeFrames.length === 0) { setFrameUrls([]); return; }
    Promise.all(activeFrames.map((f) => getPetImage(f.key))).then((blobs) => {
      if (cancelled) return;
      blobs.forEach((b) => { if (b) objectUrls.push(URL.createObjectURL(b)); });
      setFrameUrls(objectUrls);
      if (objectUrls.length === 0) setImageFailed(true);
    }).catch(() => {});
    return () => { cancelled = true; objectUrls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [activeFrames]);

  useEffect(() => { setFrameIndex(0); }, [currentMood]);
  useEffect(() => {
    if (!shouldLoop || frameUrls.length <= 1) return;
    const id = window.setInterval(() => setFrameIndex((i) => (i + 1) % frameUrls.length), frameDurationMs);
    return () => window.clearInterval(id);
  }, [frameDurationMs, frameUrls.length, shouldLoop]);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false);  } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [menuOpen]);

  useEffect(() => {
    const h = () => setPos((p) => ({ x: clamp(p.x, 8, window.innerWidth - petSize - 8), y: clamp(p.y, 8, window.innerHeight - petSize - 80) }));
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  /* ── Edge snapping ── */
  const snapToEdge = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - petSize;
    const maxY = window.innerHeight - petSize - 70;
    let sx = clamp(x, 8, maxX);
    let sy = clamp(y, 8, maxY);
    // Snap to left or right edge
    if (sx < EDGE_SNAP) sx = 8;
    else if (sx > maxX - EDGE_SNAP) sx = maxX - 8;
    return { x: sx, y: sy };
  }, []);

  const savePos = useCallback((x: number, y: number) => {
    const snapped = snapToEdge(x, y);
    setPos(snapped);
    updateSettings({ petWidget: { ...petWidget, visible: true, currentMood, moodImages, x: snapped.x, y: snapped.y } });
  }, [petWidget, updateSettings, currentMood, moodImages, snapToEdge]);

  /* ── Reset position ── */
  const resetPosition = useCallback(() => {
    setPos({ x: defaultX, y: defaultY });
    updateSettings({ petWidget: { ...petWidget, visible: true, currentMood, moodImages, x: defaultX, y: defaultY } });
    setMenuOpen(false);
  }, [defaultX, defaultY, petWidget, updateSettings, currentMood, moodImages]);

  /* ── Pointer handlers ── */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    moved.current = false;
    setDragging(true);
    // Start long-press timer
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      if (!moved.current) { setMenuOpen((v) => !v);  }
    }, LONG_PRESS_MS);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      moved.current = true;
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
    setPos({
      x: clamp(dragStart.current.px + dx, 8, window.innerWidth - petSize - 8),
      y: clamp(dragStart.current.py + dy, 8, window.innerHeight - petSize - 80),
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    savePos(pos.x, pos.y);
    // If didn't move AND didn't long-press → single click bubble
    if (!moved.current && !menuOpen) {
      const msg = buildBubble(activityLogs, memoryEntries.length, todos.filter((t) => !t.completed).length);
      if (msg) {
        setBubble(msg);
        if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
        bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_DURATION);
      }
    }
  }, [pos, savePos, menuOpen, activityLogs, memoryEntries, todos]);

  /* ── Menu actions ── */
  const hidePet = () => {
    updateSettings({ petWidget: { ...petWidget, visible: false, currentMood, moodImages, x: pos.x, y: pos.y } });
    setMenuOpen(false); 
  };

  /* ── Render guards ── */
  if (!petWidget?.visible) return null;

  const hasCustomFrames = activeFrames.length > 0;
  const currentFrameUrl = hasCustomFrames && !imageFailed ? (frameUrls[frameIndex] || frameUrls[0] || null) : null;
  const menuLeft = clamp(pos.x, 8, window.innerWidth - 188);
  const menuPos = pos.y > window.innerHeight / 2
    ? { left: menuLeft, bottom: window.innerHeight - pos.y + 8 }
    : { left: menuLeft, top: pos.y + petSize + 8 };

  return (
    <>
      {/* Speech bubble */}
      {bubble && (
        <div style={{
          position: 'fixed', zIndex: 111, left: pos.x - 10, top: pos.y - 42, maxWidth: 200,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '6px 12px', fontSize: 12, color: 'var(--text)', lineHeight: 1.5,
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)', whiteSpace: 'nowrap',
          pointerEvents: 'none', animation: 'petBubbleIn 0.25s ease-out',
        }}>
          {bubble}
        </div>
      )}

      {/* Pet button */}
      <button
        data-pet-widget="true"
        className={`pet-widget ${dragging ? 'dragging' : ''}`}
        style={{ left: pos.x, top: pos.y, position: 'fixed', zIndex: 110 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label={t('pet.ariaLabel')}
      >
        <ClawdPet size={petSize} mood={currentMood} />
        {currentFrameUrl && (
          <img className="pet-widget-img" src={currentFrameUrl} alt={t('pet.ariaLabel')}
            draggable={false} onError={() => setImageFailed(true)}
            style={{ position: 'absolute', inset: 0 }} />
        )}
      </button>

      {/* Menu portal */}
      {menuOpen && createPortal(
        <>
          <div className="pet-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="pet-menu" style={menuPos}>
            <button type="button" className="action-row" onClick={resetPosition}>
              <div className="action-row-text"><span className="action-row-label">重置位置</span></div>
            </button>
            <button type="button" className="action-row" onClick={hidePet}>
              <div className="action-row-text"><span className="action-row-label" style={{ color: 'var(--text-3)' }}>{t('pet.hide')}</span></div>
            </button>
          </div>
        </>, document.body)}
    </>
  );
}
