import { useState, useCallback } from 'react';
import type { CharacterProfile, ProviderConfig } from '@/types';
import { CHARACTER_TEMPLATES, applyTemplate, type DraftStatus } from './types';

interface CharacterStudioFooterProps {
  draft: CharacterProfile;
  draftStatus: DraftStatus;
  isEdit: boolean;
  onSave: () => void;
  onCancel: () => void;
  onApplyTemplate: (draft: CharacterProfile) => void;
  providers?: ProviderConfig[];
}

export function CharacterStudioFooter({
  draft,
  draftStatus,
  isEdit,
  onSave,
  onCancel,
  onApplyTemplate,
  providers,
}: CharacterStudioFooterProps) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const hasModel = providers && providers.length > 0;
  const canSave = (draft.name || '').trim().length > 0;

  const statusLabels: Record<DraftStatus, string> = {
    clean: isEdit ? '未修改' : '新角色',
    dirty: '尚未儲存',
    saving: '儲存中…',
    saved: '已儲存',
    error: '儲存失敗',
  };

  const statusClass = `cs-footer__status is-${draftStatus}`;

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      const tpl = CHARACTER_TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      const updated = applyTemplate(draft, tpl);
      onApplyTemplate(updated);
      setTemplateOpen(false);
    },
    [draft, onApplyTemplate],
  );

  return (
    <footer className="cs-footer">
      <div className="cs-footer__left">
        {/* Template selector */}
        <div className="cs-template-popover">
          <button
            type="button"
            className="cs-footer__template-btn"
            onClick={() => setTemplateOpen(!templateOpen)}
            onBlur={() => setTimeout(() => setTemplateOpen(false), 150)}
          >
            模板
          </button>
          {templateOpen && (
            <div className="cs-template-list" role="listbox" aria-label="角色模板">
              {CHARACTER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  role="option"
                  className="cs-template-item"
                  onClick={() => handleTemplateSelect(tpl.id)}
                >
                  <span className="cs-template-item__name">{tpl.name}</span>
                  <span className="cs-template-item__desc">{tpl.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI assist button */}
        {!isEdit && hasModel && (
          <button type="button" className="cs-footer__btn" disabled>
            AI 輔助填充
          </button>
        )}

        {/* Status */}
        <span className={statusClass}>{statusLabels[draftStatus]}</span>
      </div>

      <div className="cs-footer__right">
        <button type="button" className="cs-footer__btn" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="cs-footer__btn cs-footer__btn--primary"
          onClick={onSave}
          disabled={!canSave || draftStatus === 'saving'}
        >
          {draftStatus === 'saving' ? '儲存中…' : '保存角色'}
        </button>
      </div>
    </footer>
  );
}
