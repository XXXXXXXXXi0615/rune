import { ConversationAvatar, IdentityAvatar } from '@/components/chat/ConversationAvatars';
import type { ChatParticipant, Conversation, GroupParticipant } from '@/types';

/**
 * Group header quick-settings tray (Phase 1).
 *
 * A slide-down tray anchored directly under the group chat header. It is a
 * presentation/interaction shell only: it reads existing conversation data and
 * never owns group state. Everything that edits the group stays in the full
 * Group Settings surface, reached through the CTA below.
 *
 * Phase 1 content contract: member count, AI response mode, group status and the
 * 「編輯群聊資料」 CTA, plus an optional compact participant preview rail.
 * Explicitly NOT here: avatar crop sliders, announcement editor, relationship
 * editor, full member management.
 */

export interface TrayParticipant {
  identityId: string;
  label: string;
  participant?: GroupParticipant;
  legacyParticipant?: ChatParticipant;
}

interface GroupQuickTrayProps {
  open: boolean;
  conversation: Conversation;
  memberCount: number;
  aiModeLabel: string;
  statusLabel: string;
  participants: TrayParticipant[];
  /** Measured available height below the header, already clamped by the owner. */
  maxHeight: number;
  reducedMotion: boolean;
  onEditGroup: () => void;
}

const OPEN_MS = 220;

/**
 * Always mounted while the conversation is a group; visibility is owned by CSS
 * (`max-height`/`opacity`/`visibility`) so the open and close transitions are
 * symmetric without any mount-state bookkeeping.
 */
export function GroupQuickTray({
  open,
  conversation,
  memberCount,
  aiModeLabel,
  statusLabel,
  participants,
  maxHeight,
  reducedMotion,
  onEditGroup,
}: GroupQuickTrayProps) {
  const previewRail = participants.slice(0, 6);
  const hiddenCount = Math.max(0, memberCount - previewRail.length);

  return (
    <section
      id="cw-quick-tray"
      data-testid="group-quick-tray"
      className={`cw-quick-tray${open ? ' is-open' : ''}${reducedMotion ? ' is-reduced-motion' : ''}`}
      style={{ '--cw-quick-tray-max': `${maxHeight}px`, '--cw-quick-tray-open-ms': `${OPEN_MS}ms` } as React.CSSProperties}
      aria-label="群聊快速設定"
      aria-hidden={!open}
    >
      <div className="cw-quick-tray-inner">
        <dl className="cw-quick-tray-metrics">
          <div className="cw-quick-tray-metric">
            <dt>成員</dt>
            <dd>{memberCount} 位</dd>
          </div>
          <div className="cw-quick-tray-metric">
            <dt>AI 回應方式</dt>
            <dd>{aiModeLabel}</dd>
          </div>
          <div className="cw-quick-tray-metric">
            <dt>群聊狀態</dt>
            <dd>{statusLabel}</dd>
          </div>
        </dl>

        {previewRail.length > 0 && (
          <div className="cw-quick-tray-rail" role="group" aria-label="成員預覽">
            <ConversationAvatar conversation={conversation} size={30} />
            {previewRail.map((item) => (
              <IdentityAvatar
                key={item.identityId}
                identityId={item.identityId}
                participant={item.participant}
                legacyParticipant={item.legacyParticipant}
                size={30}
                label={item.label}
              />
            ))}
            {hiddenCount > 0 && <span className="cw-quick-tray-rail-more">+{hiddenCount}</span>}
          </div>
        )}

        <button type="button" className="cw-quick-tray-cta" data-testid="group-quick-settings-edit" onClick={onEditGroup}>
          <span>編輯群聊資料</span>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    </section>
  );
}
