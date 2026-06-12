import type { MemoryEntry } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { t } from '@/i18n';

interface MemoryDetailProps {
  entry: MemoryEntry;
  onBack: () => void;
}

function formatFull(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function buildPlainText(entry: MemoryEntry): string {
  return [
    `${t('memory.sceneLabel')}：${entry.scene || t('memory.notMarked')}`,
    `${t('memory.triggerLabel')}：${entry.triggerText === '來自聊天' ? t('memory.fromChat') : entry.triggerText || '—'}`,
    `${t('memory.bodyLabel')}：${entry.bodyThoughts || t('memory.notOrganized')}`,
    `${t('memory.anxietyLabel')}：${entry.anxietyLevel}/10`,
    `${t('memory.nextLabel')}：${entry.nextStep || '—'}`,
    `${t('memory.copied')}：${formatFull(entry.createdAt)}`,
  ].join('\n');
}

function anxietyColor(level: number): string {
  if (level <= 3) return 'var(--teal)';
  if (level <= 6) return 'var(--amber)';
  return 'var(--danger)';
}

export function MemoryDetail({ entry, onBack }: MemoryDetailProps) {
  const deleteMemoryEntry = useAppStore((s) => s.deleteMemoryEntry);
  const showToast = useToastStore((s) => s.showToast);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(buildPlainText(entry)); showToast(t('memory.copied')); }
    catch { showToast('複製失敗'); }
  };
  const handleDelete = () => { deleteMemoryEntry(entry.id); showToast(t('memory.deleted')); onBack(); };

  const anxietyPct = (entry.anxietyLevel / 10) * 100;

  return (
    <div>
      <div className="memory-detail-header">
        <button className="btn-icon" onClick={onBack} aria-label={t('memory.back')}>
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="memory-detail-date">{formatFull(entry.createdAt)}</span>
        <div className="memory-detail-actions">
          <button className="btn-icon" onClick={handleCopy} aria-label={t('memory.copy')}>
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button className="btn-icon" onClick={handleDelete} aria-label={t('memory.delete')} style={{ color: 'var(--danger)' }}>
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="memory-detail">
        <div className="memory-detail-field">
          <div className="memory-detail-field-label">{t('memory.sceneLabel')}</div>
          <div className="memory-detail-field-value">{entry.scene || t('memory.notMarked')}</div>
        </div>

        <div className="memory-detail-field">
          <div className="memory-detail-field-label">{t('memory.triggerLabel')}</div>
          <div className="memory-detail-field-value">
            {entry.triggerText === '來自聊天' ? t('memory.fromChat') : entry.triggerText || '—'}
          </div>
        </div>

        <div className="memory-detail-field">
          <div className="memory-detail-field-label">{t('memory.bodyLabel')}</div>
          <div className="memory-detail-field-value">{entry.bodyThoughts || t('memory.notOrganized')}</div>
        </div>

        <div className="memory-detail-field">
          <div className="memory-detail-field-label">{t('memory.anxietyLabel')}</div>
          <div className="memory-detail-anxiety">
            <div className="memory-detail-bar">
              <div className="memory-detail-bar-fill"
                style={{ width: `${anxietyPct}%`, background: anxietyColor(entry.anxietyLevel) }} />
            </div>
            <span className="memory-detail-anxiety-label" style={{ color: anxietyColor(entry.anxietyLevel) }}>
              {entry.anxietyLevel} / 10
            </span>
          </div>
        </div>

        <div className="memory-detail-field">
          <div className="memory-detail-field-label">{t('memory.nextLabel')}</div>
          <div className="memory-detail-field-value">{entry.nextStep || '—'}</div>
        </div>
      </div>
    </div>
  );
}
