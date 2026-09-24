/**
 * RemoveBookDialog — Confirmation dialog for removing a book
 * Distinguishes between removing from shelf vs permanent deletion
 */

import { useState } from 'react';
import type { MoonReadBook } from '@/features/moonread/types';

interface RemoveBookDialogProps {
  book: MoonReadBook;
  open: boolean;
  onClose: () => void;
  onConfirm: (keepData: boolean) => void;
}

export function RemoveBookDialog({ book, open, onClose, onConfirm }: RemoveBookDialogProps) {
  const [keepData, setKeepData] = useState(true);
  const [confirmPermanent, setConfirmPermanent] = useState(false);

  if (!open) return null;

  return (
    <div className="moonread-dialog-backdrop" onClick={onClose}>
      <div
        className="moonread-dialog"
        role="dialog"
        aria-label="移除書籍"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <div className="moonread-dialog-header">
          <h3 className="moonread-dialog-title">移除書籍</h3>
          <button
            type="button"
            className="moonread-dialog-close"
            onClick={onClose}
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        <div className="moonread-dialog-body">
          <p className="moonread-dialog-message">
            {confirmPermanent ? `再次確認永久刪除「${book.title}」` : `確定要將「${book.title}」從書架移除嗎？`}
          </p>
          {confirmPermanent && <p className="moonread-delete-warning">將刪除來源檔、封面、閱讀進度、所有歷史 sessions、批註與書籤；此操作無法復原。</p>}

          <div className="moonread-dialog-options">
            <label className="moonread-dialog-option">
              <input
                type="radio"
                name="remove-mode"
                checked={keepData}
                onChange={() => setKeepData(true)}
              />
              <div className="moonread-dialog-option-content">
                <span className="moonread-dialog-option-label">從書架移除</span>
                <span className="moonread-dialog-option-desc">
                  保留筆記與閱讀進度
                </span>
              </div>
            </label>

            <label className="moonread-dialog-option">
              <input
                type="radio"
                name="remove-mode"
                checked={!keepData}
                onChange={() => setKeepData(false)}
              />
              <div className="moonread-dialog-option-content">
                <span className="moonread-dialog-option-label moonread-dialog-option-label--danger">
                  永久刪除
                </span>
                <span className="moonread-dialog-option-desc">
                  刪除書籍檔案、筆記與所有相關資料
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="moonread-dialog-footer">
          <button
            type="button"
            className="moonread-dialog-btn moonread-dialog-btn--cancel"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className={`moonread-dialog-btn moonread-dialog-btn--confirm${!keepData ? ' moonread-dialog-btn--danger' : ''}`}
            onClick={() => { if (!keepData && !confirmPermanent) { setConfirmPermanent(true); return; } onConfirm(keepData); }}
          >
            {keepData ? '移除' : confirmPermanent ? '確認永久刪除' : '永久刪除'}
          </button>
        </div>
      </div>
    </div>
  );
}
