import type { ContextItem } from '@/ai/contextPreview';

export interface ContextBarProps {
  items: ContextItem[];
  onRemove: (id: string) => void;
}

const CATEGORY_BADGE_COLOR: Record<string, string> = {
  reference: 'var(--accent)',
  memory: 'var(--accent-amber)',
  auto: 'var(--accent-teal)',
};

export function ContextBar({ items, onRemove }: ContextBarProps) {
  if (items.length === 0) return null;

  return (
    <div className="context-bar">
      {items.map((item) => (
        <div key={item.id} className="context-chip">
          <span className="context-chip-badge" style={{ background: CATEGORY_BADGE_COLOR[item.category] || 'var(--accent)' }} />
          <span className="context-chip-icon" aria-hidden="true">{item.icon}</span>
          <div className="context-chip-body">
            <span className="context-chip-label">{item.label}</span>
            {item.detail && (
              <span className="context-chip-detail">{item.detail}</span>
            )}
          </div>
          <button
            type="button"
            className="context-chip-close"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            aria-label={`移除 ${item.label}`}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
