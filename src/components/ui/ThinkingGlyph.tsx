/**
 * ThinkingGlyph — subtle loading indicator for AI thinking state.
 *
 * Three dots with staggered bounce animation.
 * Supports reduced motion via prefers-reduced-motion.
 *
 * Props:
 *   variant  — "dots" (default), "orbit" (circular sweep), "starburst" (radial)
 *   size     — icon size in px (default 16)
 *   active   — whether animation runs (default true)
 *   label    — status text below glyph (default undefined)
 */
import './ThinkingGlyph.css';

interface ThinkingGlyphProps {
  variant?: 'dots' | 'orbit' | 'starburst';
  size?: number;
  active?: boolean;
  label?: string;
}

export function ThinkingGlyph({ variant = 'dots', size = 16, active = true, label }: ThinkingGlyphProps) {
  return (
    <div className={`tg-glyph tg-glyph--${variant}${active ? ' is-active' : ''}`} style={{ '--tg-size': `${size}px` } as React.CSSProperties} aria-label={label || '思考中'} role="status">
      {variant === 'dots' && (
        <div className="tg-glyph-dots">
          <span className="tg-glyph-dot" />
          <span className="tg-glyph-dot" />
          <span className="tg-glyph-dot" />
        </div>
      )}
      {variant === 'orbit' && (
        <svg className="tg-glyph-svg" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 44" />
        </svg>
      )}
      {variant === 'starburst' && (
        <svg className="tg-glyph-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {label && <span className="tg-glyph-label">{label}</span>}
    </div>
  );
}
