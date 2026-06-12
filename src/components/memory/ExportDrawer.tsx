import type { MemoryEntry } from '@/types';
import { useToastStore } from '@/store/useToastStore';

interface ExportDrawerProps {
  entries: MemoryEntry[];
  onClose: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildTxt(entries: MemoryEntry[]): string {
  return entries
    .map(
      (e) =>
        [
          `=== ${formatDate(e.createdAt)} ===`,
          `場景：${e.scene || '—'}`,
          `觸發事件：${e.triggerText || '—'}`,
          `身體反應 / 自動想法：${e.bodyThoughts || '—'}`,
          `焦慮值：${e.anxietyLevel}/10`,
          `下一步：${e.nextStep || '—'}`,
          '',
        ].join('\n')
    )
    .join('\n');
}

function buildMarkdown(entries: MemoryEntry[]): string {
  return (
    `# 月潮雲匣 匯出\n\n` +
    entries
      .map(
        (e) =>
          [
            `## ${formatDate(e.createdAt)}`,
            '',
            `- **場景**：${e.scene || '—'}`,
            `- **觸發事件**：${e.triggerText || '—'}`,
            `- **身體反應 / 自動想法**：${e.bodyThoughts || '—'}`,
            `- **焦慮值**：${e.anxietyLevel}/10`,
            `- **下一步**：${e.nextStep || '—'}`,
            '',
          ].join('\n')
      )
      .join('\n')
  );
}

function buildJson(entries: MemoryEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function ExportDrawer({ entries, onClose }: ExportDrawerProps) {
  const showToast = useToastStore((s) => s.showToast);

  const handleExport = (format: 'txt' | 'md' | 'json') => {
    if (entries.length === 0) {
      showToast('尚無記錄可匯出');
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    switch (format) {
      case 'txt':
        download(buildTxt(entries), `memory-${now}.txt`, 'text/plain');
        break;
      case 'md':
        download(buildMarkdown(entries), `memory-${now}.md`, 'text/markdown');
        break;
      case 'json':
        download(buildJson(entries), `memory-${now}.json`, 'application/json');
        break;
    }
    showToast('匯出完成');
    onClose();
  };

  return (
    <div className="export-options">
      <button className="export-option" onClick={() => handleExport('txt')}>
        <div className="export-option-icon txt">TXT</div>
        <div className="export-option-info">
          <div className="export-option-label">匯出純文字</div>
          <div className="export-option-hint">.txt 格式，適合快速閱讀</div>
        </div>
      </button>

      <button className="export-option" onClick={() => handleExport('md')}>
        <div className="export-option-icon md">MD</div>
        <div className="export-option-info">
          <div className="export-option-label">匯出 Markdown</div>
          <div className="export-option-hint">.md 格式，適合筆記軟體</div>
        </div>
      </button>

      <button className="export-option" onClick={() => handleExport('json')}>
        <div className="export-option-icon json">JSON</div>
        <div className="export-option-info">
          <div className="export-option-label">匯出 JSON</div>
          <div className="export-option-hint">.json 格式，適合備份還原</div>
        </div>
      </button>
    </div>
  );
}
