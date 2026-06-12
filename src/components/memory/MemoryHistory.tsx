import type { MemoryEntry } from '@/types';

interface MemoryHistoryProps {
  entries: MemoryEntry[];
  onSelect: (id: string) => void;
  onBack: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeLabel(level: number): string {
  if (level <= 3) return '低焦慮';
  if (level <= 6) return '中焦慮';
  return '高焦慮';
}

export function MemoryHistory({ entries, onSelect, onBack }: MemoryHistoryProps) {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <div className="memory-subheader">
        <button className="btn-icon" onClick={onBack} aria-label="Back">
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="memory-subheader-title">過往回顧</span>
      </div>

      {sorted.length === 0 ? (
        <div className="memory-empty">
          <div className="memory-empty-icon">
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 40, height: 40, stroke: 'currentColor', strokeWidth: 1 }}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="memory-empty-text">尚無記錄</div>
          <div className="memory-empty-sub">記錄今日心緒，開始建立你的雲匣</div>
        </div>
      ) : (
        <div className="memory-list">
          {sorted.map((entry) => (
            <button
              key={entry.id}
              className="memory-card"
              onClick={() => onSelect(entry.id)}
              style={{ border: 'none', width: '100%', fontFamily: 'inherit' }}
            >
              <div className="memory-card-top">
                <span className="memory-card-scene">
                  {entry.scene || '未指定場景'}
                </span>
                <span className="badge memory-card-badge">
                  {badgeLabel(entry.anxietyLevel)} {entry.anxietyLevel}/10
                </span>
              </div>
              <div className="memory-card-bottom">
                <span className="memory-card-date">{formatDate(entry.createdAt)}</span>
                <svg className="icon memory-card-chevron" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
