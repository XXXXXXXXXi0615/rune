import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AvatarAssetImage } from '@/components/chat/ConversationAvatars';
import { useCharacterStore } from '@/store/useCharacterStore';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';
import { resolveCharacterDisplayName } from '@/features/characters/legacyCharacterBranding';
import type { CharacterProfile } from '@/types';
import './PartnerOnboarding.css';

export interface PartnerPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (characterId: string) => void;
}

function partnerStatus(character: CharacterProfile): 'ai' | 'local' {
  // AI 角色若已連結特定 provider → 標示為已連結；否則仍屬可建立身份（尚未連接模型）。
  return character.modelMode === 'custom' && character.providerId ? 'ai' : 'local';
}

function statusLabel(character: CharacterProfile): string {
  const status = partnerStatus(character);
  if (status === 'ai') return 'AI 角色 · 已連結模型';
  if (character.isArchived) return '已封存';
  return character.isBuiltIn ? 'AI 角色 · 尚未連接模型' : '本地角色';
}

export function PartnerPickerDialog({ open, onClose, onPick }: PartnerPickerDialogProps) {
  const characters = useCharacterStore((state) => state.characters);
  const partner = useAppStore((state) => state.partner);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  const onPickRef = useRef(onPick);
  onCloseRef.current = onClose;
  onPickRef.current = onPick;

  const candidates = characters.filter((item) => !item.isArchived);
  const selected = candidates.find((item) => item.id === selectedId) || null;

  const reset = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = document.activeElement;
    setSelectedId(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // aria-labelledby target must be focusable to trap focus → move focus to panel.
  const handleConfirm = useCallback(() => {
    if (!selected) return;
    onPickRef.current(selected.id);
    reset();
    onCloseRef.current();
  }, [selected, reset]);

  const handleClose = useCallback(() => {
    reset();
    onCloseRef.current();
  }, [reset]);

  // Focus trap + Enter-to-confirm
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>('button');
    first?.focus();
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.hasAttribute('disabled'));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) { event.preventDefault(); lastEl.focus(); }
        else if (!event.shiftKey && document.activeElement === lastEl) { event.preventDefault(); firstEl.focus(); }
      } else if (event.key === 'Enter' && selectedId && document.activeElement?.closest('[data-partner-option]')) {
        event.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selectedId, handleConfirm]);

  // Return focus to the invoking CTA on close.
  useEffect(() => {
    if (!open) return undefined;
    return () => {
      const el = lastActiveRef.current instanceof HTMLElement ? lastActiveRef.current : null;
      if (el && el !== document.body && el.isConnected) { el.focus?.(); return; }
      // WebKit: pointer click does not focus buttons / activeElement stays <body>; fall back to the onboarding CTA.
      const cta = document.querySelector<HTMLElement>('.cw-primary-action');
      cta?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="po-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div
        className="po-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="po-picker-title"
        ref={panelRef}
      >
        <header className="po-header">
          <div>
            <p className="po-eyebrow">PARTNER</p>
            <h2 id="po-picker-title">選擇現有夥伴</h2>
          </div>
          <button type="button" className="po-close" onClick={handleClose} aria-label="關閉">×</button>
        </header>

        <p className="po-desc">選擇一個既有角色作為你的聊天夥伴。</p>

        <div className="po-list">
          {candidates.length === 0 && <p className="po-empty">尚無可用角色。請建立新夥伴。</p>}
          {candidates.map((character) => {
            const name = resolveCharacterDisplayName(character.id, character.name || selectPartnerDisplayName(partner));
            const isSelected = selectedId === character.id;
            return (
              <button
                key={character.id}
                type="button"
                data-partner-option
                className={`po-option${isSelected ? ' is-selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(character.id)}
              >
                <span className="po-option-avatar">
                  {character.avatarAssetId ? (
                    <AvatarAssetImage assetId={character.avatarAssetId} alt={name} className="po-option-avatar__img" />
                  ) : (
                    <span className="po-option-avatar__initial">{name.charAt(0)}</span>
                  )}
                </span>
                <span className="po-option-copy">
                  <strong>{name}</strong>
                  <small>{character.shortIdentity || character.subtitle || `建立於 ${new Date(character.createdAt).toLocaleDateString()}`}</small>
                </span>
                <span className={`po-option-badge is-${partnerStatus(character)}`}>{statusLabel(character)}</span>
              </button>
            );
          })}
        </div>

        <footer className="po-footer">
          <button type="button" className="po-btn po-btn-secondary" onClick={handleClose}>取消</button>
          <button type="button" className="po-btn po-btn-primary" onClick={handleConfirm} disabled={!selected}>選擇</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
