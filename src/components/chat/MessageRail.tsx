import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Message } from '@/types';

interface MessageRailProps {
  messages: Message[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onScrollToMsg?: (msgId: string) => void;
}

interface TickPoint {
  id: string;
  ratio: number;
  type: 'text' | 'image' | 'file' | 'sticker' | 'voice';
  sender: 'me' | 'friend' | 'assistant';
  pinned: boolean;
  label: string;
}

function previewLabel(msg: Message): string {
  if (msg.type === 'text') {
    const clean = msg.content.replace(/<[^>]*>/g, '').trim();
    return clean.length > 28 ? `${clean.slice(0, 28)}…` : clean;
  }
  if (msg.type === 'image') return msg.caption || '📷 圖片';
  if (msg.type === 'file') return msg.fileName || '📄 檔案';
  if (msg.type === 'sticker') return msg.stickerName || '✨ 貼圖';
  if (msg.type === 'voice') return `語音 ${Math.round(msg.durationMs / 1000)} 秒`;
  return '';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function MessageRail({ messages, scrollContainerRef, onScrollToMsg }: MessageRailProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewport, setViewport] = useState({ start: 0, end: 1 });
  const [hovered, setHovered] = useState<TickPoint | null>(null);
  const [ticks, setTicks] = useState<TickPoint[]>([]);
  const railRef = useRef<HTMLDivElement>(null);
  const animFrame = useRef(0);
  const handleLongPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeTicks = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollHeight = container.scrollHeight;
    if (scrollHeight <= 0) return;
    const points: TickPoint[] = [];
    for (const msg of messages) {
      const el = document.getElementById(`msg-${msg.id}`);
      if (!el) continue;
      const top = el.offsetTop;
      const ratio = Math.min(Math.max(top / scrollHeight, 0), 1);
      points.push({
        id: msg.id,
        ratio,
        type: msg.type,
        sender: msg.sender,
        pinned: !!msg.pinned,
        label: previewLabel(msg),
      });
    }
    setTicks(points);
  }, [messages, scrollContainerRef]);

  const updateViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, clientHeight, scrollHeight } = container;
    if (scrollHeight <= clientHeight) {
      setViewport({ start: 0, end: 1 });
      return;
    }
    const start = scrollTop / scrollHeight;
    const end = (scrollTop + clientHeight) / scrollHeight;
    setViewport({ start, end });
  }, [scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(updateViewport);
    };
    container.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      computeTicks();
      updateViewport();
    });
    ro.observe(container);

    computeTicks();
    updateViewport();

    return () => {
      container.removeEventListener('scroll', onScroll);
      ro.disconnect();
      cancelAnimationFrame(animFrame.current);
    };
  }, [computeTicks, updateViewport, scrollContainerRef]);

  useEffect(() => {
    computeTicks();
    updateViewport();
  }, [messages, computeTicks, updateViewport]);

  const handleTickClick = useCallback((point: TickPoint) => {
    onScrollToMsg?.(point.id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`msg-${point.id}`);
        if (el) {
          el.classList.add('msg-flash');
          setTimeout(() => el.classList.remove('msg-flash'), 1200);
        }
      });
    });
  }, [onScrollToMsg]);

  const handleTickPointerDown = useCallback((point: TickPoint) => {
    setHovered(point);
    handleLongPress.current = setTimeout(() => {
      setHovered(point);
    }, 320);
  }, []);

  const handleTickPointerUp = useCallback(() => {
    if (handleLongPress.current) {
      clearTimeout(handleLongPress.current);
      handleLongPress.current = null;
    }
  }, []);

  const handleTickPointerLeave = useCallback(() => {
    if (handleLongPress.current) {
      clearTimeout(handleLongPress.current);
      handleLongPress.current = null;
    }
    setHovered(null);
  }, []);

  const viewTop = `${Math.round(viewport.start * 100)}%`;
  const viewHeight = `${Math.round((viewport.end - viewport.start) * 100)}%`;

  return (
    <>
      <div
        ref={railRef}
        className={`msg-rail${expanded ? ' msg-rail--expanded' : ''}`}
      >
        <div className="msg-rail-track">
          <div
            className="msg-rail-viewport"
            style={{ top: viewTop, height: viewHeight }}
          />
          {ticks.map((tick) => {
            const len = tick.type === 'text' ? 'short' : tick.type === 'image' ? 'mid' : 'long';
            return (
              <button
                key={tick.id}
                type="button"
                className={`msg-rail-tick msg-rail-tick--${len} msg-rail-tick--${tick.sender === 'me' ? 'me' : 'friend'}${tick.pinned ? ' msg-rail-tick--pinned' : ''}`}
                style={{ top: `${Math.round(tick.ratio * 100)}%` }}
                onClick={() => handleTickClick(tick)}
                onMouseEnter={() => setHovered(tick)}
                onMouseLeave={handleTickPointerLeave}
                onPointerDown={() => handleTickPointerDown(tick)}
                onPointerUp={handleTickPointerUp}
                onPointerLeave={handleTickPointerLeave}
                aria-label={tick.label}
                title={tick.label}
              />
            );
          })}
        </div>

        <button
          type="button"
          className="msg-rail-handle"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? '收合訊息軌道' : '展開訊息軌道'}
          title={expanded ? '收合訊息軌道' : '展開訊息軌道'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {expanded
              ? <path d="m8 16 4-4 4 4M8 14l4-4 4 4" />
              : <path d="m8 12h8M12 8v8" />
            }
          </svg>
        </button>

        {/* Tooltip / preview popup */}
        {hovered && expanded && (
          <div
            className="msg-rail-tooltip"
            style={{ top: `${Math.round(hovered.ratio * 100)}%` }}
          >
            <span className="msg-rail-tooltip-time">{formatTime(messages.find(m => m.id === hovered.id)?.time || '')}</span>
            <span className="msg-rail-tooltip-label">{hovered.label}</span>
          </div>
        )}
      </div>
    </>
  );
}
