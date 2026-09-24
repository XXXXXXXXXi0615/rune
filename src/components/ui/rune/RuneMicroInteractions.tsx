import classNames from 'classnames';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { type AriaRole, type CSSProperties, type HTMLAttributes, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import './RunePrimitives.css';

export type RuneAnimatedNumberProps = Omit<HTMLAttributes<HTMLSpanElement>, 'prefix'> & {
  value: number;
  decimals?: number;
  separator?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

function formatRuneNumber(value: number, decimals: number, separator: string) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const places = Math.min(15, Math.max(0, Math.trunc(decimals)));
  const [whole, fraction] = safeValue.toFixed(places).split('.');
  const grouped = separator ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : whole;
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export function RuneAnimatedNumber({ value, decimals = 0, separator = ',', prefix, suffix, className, ...props }: RuneAnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const numeric = Number.isFinite(value) ? value : 0;
  const displayed = useMotionValue(numeric);
  const formatted = useTransform(displayed, (current) => formatRuneNumber(current, decimals, separator));
  const accessibleValue = useMemo(() => formatRuneNumber(numeric, decimals, separator), [decimals, numeric, separator]);

  useEffect(() => {
    if (reducedMotion) {
      displayed.set(numeric);
      return;
    }
    const controls = animate(displayed, numeric, {
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [displayed, numeric, reducedMotion]);

  return <span className={classNames('rune-animated-number', className)} data-rune-value={numeric} {...props}>
    <span className="sr-only">{prefix}{accessibleValue}{suffix}</span>
    <span className="rune-animated-number__visual" aria-hidden="true">
      {prefix}<motion.span className="rune-animated-number__digits">{formatted}</motion.span>{suffix}
    </span>
  </span>;
}

export function RuneInlineDelete({ label = '刪除', confirmLabel = '確認刪除', cancelLabel = '取消', onConfirm, onCancel, className, triggerRole }: {
  label?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
  triggerRole?: AriaRole;
}) {
  const [armed, setArmed] = useState(false);
  const [committing, setCommitting] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const committedRef = useRef(false);

  const cancel = () => {
    if (committing) return;
    setArmed(false);
    onCancel?.();
  };

  useEffect(() => {
    if (!armed) return;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [armed, committing]);

  const confirm = async () => {
    if (committedRef.current || committing) return;
    committedRef.current = true;
    setCommitting(true);
    try {
      await onConfirm();
      setArmed(false);
    } finally {
      setCommitting(false);
      committedRef.current = false;
    }
  };

  return <div className={classNames('rune-inline-delete', className)} data-state={armed ? 'confirm' : 'idle'}>
    {!armed ? <button type="button" role={triggerRole} className="rune-control rune-inline-delete__trigger" onClick={() => setArmed(true)} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg><span>{label}</span>
    </button> : <div className="rune-inline-delete__confirm" role="group" aria-label={`${label}確認`}>
      <button ref={confirmRef} type="button" className="rune-control rune-inline-delete__accept" onClick={() => void confirm()} disabled={committing}>{confirmLabel}</button>
      <button type="button" className="rune-control rune-inline-delete__cancel" onClick={cancel} disabled={committing}>{cancelLabel}</button>
    </div>}
  </div>;
}

export interface RuneSectionRailItem { id: string; label: string }

function useDesktopRail() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}

export function RuneSectionRail({ sections, activeId, onSelect, label = '章節導覽', className }: {
  sections: readonly RuneSectionRailItem[];
  activeId: string;
  onSelect: (id: string) => void;
  label?: string;
  className?: string;
}) {
  const desktop = useDesktopRail();
  const railRef = useRef<HTMLElement>(null);
  const [pointerY, setPointerY] = useState<number | null>(null);
  if (!desktop) return null;

  const selectAt = (index: number) => {
    const item = sections[index];
    if (!item) return;
    onSelect(item.id);
    railRef.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus();
  };

  return <nav ref={railRef} className={classNames('rune-section-rail', className)} aria-label={label}
    onPointerMove={(event) => setPointerY(event.clientY)} onPointerLeave={() => setPointerY(null)}>
    {sections.map((item, index) => {
      const rect = railRef.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.getBoundingClientRect();
      const distance = pointerY == null || !rect ? Infinity : Math.abs(pointerY - (rect.top + rect.height / 2));
      const proximity = Math.max(0, 1 - distance / 64);
      return <button key={item.id} type="button" aria-label={`前往${item.label}`} aria-current={item.id === activeId ? 'location' : undefined}
        style={{ '--rune-rail-proximity': proximity } as CSSProperties}
        onClick={() => onSelect(item.id)} onKeyDown={(event) => {
          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + sections.length) % sections.length;
          selectAt(next);
        }}><span aria-hidden="true" /><span className="sr-only">{item.label}</span></button>;
    })}
  </nav>;
}
