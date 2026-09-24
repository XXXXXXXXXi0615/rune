import { useEffect, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { resolveChatProvider } from '@/ai/providerRuntime';
import { getModelCapabilities, GENERATION_STYLES } from '@/ai/modelCapabilities';
import {
  useChatRuntimeStore,
  type ConversationRuntimeSettings,
} from '@/store/useChatRuntimeStore';
import { estimateTokens } from '@/store/useChatRuntimeStore';

interface ModelPopoverProps {
  open: boolean;
  conversationId: string | null;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onOpenEngine: () => void;
}

export function ModelPopover({ open, conversationId, anchorRect, onClose, onOpenEngine }: ModelPopoverProps) {
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !anchorRect || !conversationId) return null;

  const { providers, aiRoles } = useAppStore.getState();
  const { provider, configured, reason } = resolveChatProvider(aiRoles, providers || []);
  const settings = useChatRuntimeStore.getState().getSettings(conversationId);
  const sessionUsage = useChatRuntimeStore.getState().getSessionUsage(conversationId);
  const caps = provider ? getModelCapabilities(provider.model) : getModelCapabilities('');
  const styleLabel = GENERATION_STYLES.find((s) => s.value === settings.generationStyle)?.label || settings.generationStyle;

  const maxContext = (provider as { contextMessageLimit?: number } | null)?.contextMessageLimit ||
    caps.maxOutputTokens * 4 || 16000;
  const ctxPct = maxContext > 0 ? Math.min(99, Math.round((sessionUsage.totalInputTokens / maxContext) * 100)) : 0;

  // Position popover near the anchor
  const popWidth = 280;
  let left = Math.min(anchorRect.left - 10, window.innerWidth - popWidth - 16);
  left = Math.max(16, left);
  const top = anchorRect.bottom + 8;

  return createPortal(
    <>
      <div className="cw-model-popover-overlay" onClick={onClose} />
      <div
        className="cw-model-popover"
        ref={popRef}
        role="dialog"
        aria-label="模型資訊"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cw-model-popover-item">
          <span className="cw-model-popover-label">Provider</span>
          <span className="cw-model-popover-value">{provider?.name || provider?.type || '—'}</span>
        </div>
        <div className="cw-model-popover-item">
          <span className="cw-model-popover-label">目前模型</span>
          <span className="cw-model-popover-value">{provider?.model || '—'}</span>
        </div>
        <div className="cw-model-popover-item">
          <span className="cw-model-popover-label">連線狀態</span>
          <span className={`ce-status-dot${configured ? ' is-ready' : ' is-off'}`}>
            {configured ? '已連線' : reason === 'missing-api-key' ? '缺少金鑰' : '未配置'}
          </span>
        </div>
        <div className="cw-model-popover-item">
          <span className="cw-model-popover-label">生成風格</span>
          <span className="cw-model-popover-value">{styleLabel}</span>
        </div>
        <div className="cw-model-popover-item">
          <span className="cw-model-popover-label">上下文用量</span>
          <span className="cw-model-popover-value">{ctxPct}%</span>
        </div>
        <button type="button" className="cw-model-popover-btn" onClick={onOpenEngine}>
          會話引擎設定
        </button>
      </div>
    </>,
    document.body,
  );
}
