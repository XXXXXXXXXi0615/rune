import { motion } from 'framer-motion';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { TodoItem } from '@/types';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { playPrinterStart, playPrinterFeed, playPrinterTear } from '@/utils/sounds';

export interface PrinterTodoData {
  title: string;
  date: string;
  time?: string;
  priority: TodoItem['priority'];
  category: TodoItem['category'];
  createdAt: number;
}

interface TicketPrinterProps {
  todo: PrinterTodoData;
  onPrinted: () => void;
}

function formatCreatedAt(value: number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('zh-TW', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function barcodeBars(seed: number) {
  return Array.from({ length: 24 }, (_, i) => {
    const code = (i * 17 + seed) % 256;
    return { w: code % 4 === 0 ? 3 : code % 3 === 0 ? 2 : 1, h: 9 + (code % 16) };
  });
}

const CAT_LABEL: Record<TodoItem['category'], string> = {
  life: '生活', work: '工作', study: '學習',
  lunartide: '開發', health: '健康', shopping: '購物', other: '其他',
};

const PRIORITY_LABEL: Record<TodoItem['priority'], string> = {
  high: '優先', medium: '一般', low: '稍後',
};

function PaperContent({ todo, bars, deadlineStr }: {
  todo: PrinterTodoData;
  bars: { w: number; h: number }[];
  deadlineStr: string;
}) {
  return (
    <>
      <div className="printer-paper-band">
        <span className="printer-paper-cat">{CAT_LABEL[todo.category] || '其他'}</span>
        <span className="printer-paper-series">LUNARTIDE PASS</span>
      </div>
      <span className="printer-paper-hole printer-paper-hole--l" />
      <span className="printer-paper-hole printer-paper-hole--r" />
      <div className="printer-paper-body">
        <div className="printer-paper-id-row">
          <span>票據</span>
          <span className="printer-paper-id">{String(todo.title.length * 7 + 1).padStart(3, '0')}</span>
        </div>
        <h3 className="printer-paper-title">{todo.title}</h3>
        <div className="printer-paper-facts">
          <div className="printer-paper-fact">
            <span className="printer-paper-label">DEADLINE</span>
            <strong>{deadlineStr}</strong>
          </div>
          <div className="printer-paper-fact">
            <span className="printer-paper-label">優先序</span>
            <strong className={`printer-paper-${todo.priority}`}>{PRIORITY_LABEL[todo.priority]}</strong>
          </div>
          <div className="printer-paper-fact">
            <span className="printer-paper-label">建立時間</span>
            <strong>{formatCreatedAt(todo.createdAt)}</strong>
          </div>
        </div>
      </div>
      <div className="printer-paper-barcode" aria-hidden="true">
        <div className="printer-paper-bars">
          {bars.map((bar, i) => (
            <span key={i} style={{ width: `${bar.w}px`, height: `${bar.h}px` }} />
          ))}
        </div>
      </div>
    </>
  );
}

export function TicketPrinter({ todo, onPrinted }: TicketPrinterProps) {
  const [phase, setPhase] = useState<'idle' | 'printing' | 'printed' | 'flying'>('idle');
  const paperRef = useRef<HTMLDivElement>(null);
  const [paperH, setPaperH] = useState(0);
  const [flyRect, setFlyRect] = useState<DOMRect | null>(null);
  const [done, setDone] = useState(false);

  const bars = useMemo(() => barcodeBars(todo.title.length * 7 + 1), [todo.title]);
  const deadlineStr = todo.date
    ? `${todo.date}${todo.time ? ` ${todo.time}` : ''}`
    : '未設定';

  useEffect(() => {
    if (paperRef.current) setPaperH(paperRef.current.scrollHeight);
  }, []);

  const handleFly = useCallback(() => {
    if (paperRef.current && !flyRect) {
      const rect = paperRef.current.getBoundingClientRect();
      setFlyRect(rect);
      hapticMedium();
      playPrinterTear();
    }
  }, [flyRect]);

  useEffect(() => {
    const t0 = setTimeout(() => {
      setPhase('printing');
      hapticLight();
      playPrinterStart();
    }, 400);
    const t1 = setTimeout(() => {
      setPhase('printed');
    }, 1800);
    const t2 = setTimeout(() => {
      setPhase('flying');
      handleFly();
    }, 2200);
    const t3 = setTimeout(() => {
      setDone(true);
      onPrinted();
    }, 2750);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onPrinted, handleFly]);

  useEffect(() => {
    if (phase === 'printing') {
      const interval = setInterval(playPrinterFeed, 250);
      setTimeout(() => clearInterval(interval), 1100);
      return () => clearInterval(interval);
    }
  }, [phase]);

  if (done) return null;

  return (
    <motion.div
      className="printer-wrapper"
      initial={{ opacity: 0, y: -24, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, height: 0, y: -16 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Printer machine */}
      <div className={`printer-device${phase === 'idle' ? ' is-standby' : ''}`}>
        <div className="printer-device-top">
          <svg className="printer-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M6 9V4a1 1 0 011-1h10a1 1 0 011 1v5" />
            <rect x="3" y="9" width="18" height="10" rx="1" />
            <line x1="6" y1="13" x2="6" y2="14" />
            <line x1="9" y1="13" x2="9" y2="14" />
            <line x1="12" y1="13" x2="12" y2="14" />
          </svg>
          <span className="printer-brand">LUNA TICKET</span>
          <span className="printer-badge">v2</span>
        </div>
        <div className="printer-led-row">
          <span className={`printer-led printer-led--power${phase !== 'idle' ? ' is-active' : ''}`} />
          <span className={`printer-led printer-led--ready${phase === 'printing' ? ' is-active' : ''}`} />
          <span className={`printer-led printer-led--paper${phase === 'printing' ? ' is-active' : ''}`} />
        </div>
        <div className="printer-paper-slot" />
        {phase === 'idle' && (
          <motion.div
            className="printer-standby-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="printer-standby-dot" />
            待機中
          </motion.div>
        )}
      </div>

      {/* Paper */}
      {(phase === 'printing' || phase === 'printed') && (
        <div className="printer-paper-wrap" ref={flyRect ? undefined : undefined}>
          <motion.div
            ref={paperRef}
            className={`printer-paper${phase === 'printed' ? ' is-printed' : ''}`}
            initial={{ height: 0, opacity: 0 }}
            animate={
              phase === 'printing'
                ? { height: paperH || 185, opacity: 1, transition: { duration: 1.3, ease: [0.25, 0.1, 0.25, 1] } }
                : { height: paperH || 185, opacity: 1 }
            }
          >
            <PaperContent todo={todo} bars={bars} deadlineStr={deadlineStr} />
          </motion.div>
        </div>
      )}

      {/* Flying paper — FLIP animation */}
      {phase === 'flying' && flyRect && (
        <motion.div
          className="printer-paper is-flying"
          style={{
            position: 'fixed',
            top: flyRect.top,
            left: flyRect.left,
            width: flyRect.width,
            zIndex: 999,
          }}
          initial={false}
          animate={{
            top: flyRect.top + 80,
            left: flyRect.left + flyRect.width / 4,
            width: flyRect.width * 0.35,
            opacity: 0,
          }}
          transition={{ duration: 0.5, ease: 'easeIn' }}
        >
          <PaperContent todo={todo} bars={bars} deadlineStr={deadlineStr} />
        </motion.div>
      )}

      {/* Printing status text */}
      {phase === 'printing' && (
        <motion.div
          className="printer-status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="printer-status-dot" />
          列印中...
        </motion.div>
      )}
    </motion.div>
  );
}
