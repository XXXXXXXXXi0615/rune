import { useState, useRef, useCallback, useEffect } from 'react';
import { parseBulkInput, buildBulkPreview, type BulkPreview, type DuplicateMode } from '@/algorithm/gachaBulkParser';
import type { GachaItem } from '@/types';

interface Props {
  existingItems: readonly GachaItem[];
  onConfirm: (preview: BulkPreview, duplicateMode: DuplicateMode) => void;
  onClose: () => void;
}

export function GachaBulkImportDialog({ existingItems, onConfirm, onClose }: Props) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleParse = useCallback(() => {
    const parsed = parseBulkInput(input);
    if (parsed.length === 0) {
      setError('沒有有效的候選項目');
      setPreview(null);
      return;
    }
    const result = buildBulkPreview(parsed, existingItems);
    setPreview(result);
    setError(null);
  }, [input, existingItems]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (preview) onConfirm(preview, duplicateMode);
      else handleParse();
    }
  }, [preview, duplicateMode, onConfirm, onClose, handleParse]);

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    onConfirm(preview, duplicateMode);
  }, [preview, duplicateMode, onConfirm]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setPreview(null);
    setError(null);
  }, []);

  return (
    <div className="gc-confirm-overlay" onClick={onClose}>
      <div className="gc-confirm-box gc-bulk-dialog" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown} role="dialog" aria-label="批量加入候選項目">
        <div className="gc-confirm-title">批量加入</div>
        <div className="gc-confirm-text" style={{ fontSize: 11 }}>
          每行一個選項。支援格式：純文字、<code>選項 | 權重</code>、或試算表貼上（Tab 分隔）。
        </div>
        <textarea
          ref={textareaRef}
          className="gc-editor-input gc-editor-textarea gc-bulk-textarea"
          value={input}
          onChange={handleTextareaChange}
          placeholder={'今天吃火鍋\n今天吃拉麵 | 3\n今天吃咖哩\t2'}
          rows={8}
          aria-label="批量輸入候選項目"
        />
        {error && <div className="gc-bulk-error" role="alert" aria-live="assertive">{error}</div>}

        {!preview && (
          <div className="gc-confirm-actions">
            <button className="gc-confirm-btn" onClick={onClose}>取消</button>
            <button className="gc-confirm-btn gc-confirm-btn--primary" onClick={handleParse} disabled={!input.trim()}>
              預覽
            </button>
          </div>
        )}

        {preview && (
          <>
            <div className="gc-bulk-summary">
              <span>將新增 <strong>{preview.newCount}</strong> 項</span>
              {preview.duplicateCount > 0 && <span className="gc-bulk-summary-dup">重複 {preview.duplicateCount} 項</span>}
              {preview.correctedCount > 0 && <span className="gc-bulk-summary-fix">修正權重 {preview.correctedCount} 項</span>}
              {preview.invalidCount > 0 && <span className="gc-bulk-summary-invalid">無效 {preview.invalidCount} 行</span>}
            </div>

            {preview.duplicateCount > 0 && (
              <div className="gc-bulk-dup-mode">
                <label className="gc-editor-label">重複處理</label>
                <div className="gc-editor-toggle" style={{ fontSize: 11 }}>
                  <button className={`gc-editor-toggle-btn${duplicateMode === 'skip' ? ' gc-editor-toggle-btn--active' : ''}`} onClick={() => setDuplicateMode('skip')}>跳過重複</button>
                  <button className={`gc-editor-toggle-btn${duplicateMode === 'add' ? ' gc-editor-toggle-btn--active' : ''}`} onClick={() => setDuplicateMode('add')}>仍然加入</button>
                  <button className={`gc-editor-toggle-btn${duplicateMode === 'merge' ? ' gc-editor-toggle-btn--active' : ''}`} onClick={() => setDuplicateMode('merge')}>合併權重</button>
                </div>
              </div>
            )}

            <div className="gc-bulk-preview-list" role="list" aria-label="預覽列表">
              {preview.lines.map((line, idx) => (
                <div key={idx} className={`gc-bulk-preview-item gc-bulk-preview-item--${line.status}`} role="listitem">
                  <span className="gc-bulk-preview-title">{line.title}</span>
                  <span className="gc-bulk-preview-weight">w{line.weight}</span>
                  <span className="gc-bulk-preview-status">
                    {line.status === 'new' && '新增'}
                    {line.status === 'duplicate' && '重複'}
                    {line.status === 'weight-corrected' && '已修正'}
                  </span>
                </div>
              ))}
            </div>

            <div className="gc-confirm-actions">
              <button className="gc-confirm-btn" onClick={() => setPreview(null)}>返回修改</button>
              <button className="gc-confirm-btn" onClick={onClose}>取消</button>
              <button className="gc-confirm-btn gc-confirm-btn--primary" onClick={handleConfirm}>
                確認加入 {preview.newCount > 0 && `(${preview.newCount})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
