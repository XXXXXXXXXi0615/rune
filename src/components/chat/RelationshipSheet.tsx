import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { IdentityAvatar } from '@/components/chat/ConversationAvatars';
import { useAppStore } from '@/store/useAppStore';
import { useIdentityStore } from '@/store/useIdentityStore';
import { getEffectiveGroupParticipants } from '@/features/groupChat/participants';
import { getGroupRelationships, getOutgoingRelationships, getIncomingRelationships, formatRelationshipLabel, RELATIONSHIP_KIND_LABELS } from '@/features/groupChat/relationships';
import { resolveGroupParticipantPresentation } from '@/features/groupChat/presentation';
import type { Conversation, GroupRelationship, GroupRelationshipKind } from '@/types';

const KIND_OPTIONS: GroupRelationshipKind[] = ['close', 'friend', 'family', 'rival', 'protective', 'dependent', 'formal', 'custom'];

export function RelationshipSheet({ conversation, open, onClose }: { conversation: Conversation; open: boolean; onClose: () => void }) {
  const identities = useIdentityStore((state) => state.identities);
  const addRelationship = useAppStore((state) => state.addGroupRelationship);
  const updateRelationship = useAppStore((state) => state.updateGroupRelationship);
  const removeRelationship = useAppStore((state) => state.removeGroupRelationship);

  const participants = useMemo(
    () => getEffectiveGroupParticipants(conversation, identities)
      .filter((p) => p.identityId !== 'narrator' && !p.identity?.archived),
    [conversation, identities],
  );

  const [sourceId, setSourceId] = useState(() => participants[0]?.identityId || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const relationships = useMemo(() => getGroupRelationships(conversation), [conversation]);
  const outgoing = useMemo(() => getOutgoingRelationships(conversation, sourceId), [conversation, sourceId]);

  const otherParticipants = useMemo(
    () => participants.filter((p) => p.identityId !== sourceId),
    [participants, sourceId],
  );

  if (!open) return null;

  return createPortal(
    <div className="mc-overlay is-light" onMouseDown={onClose}>
      <section className="mc-sheet mc-relationship-sheet" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="角色關係">
        <header className="mc-sheet-header">
          <div><p className="mc-eyebrow">角色關係</p><h2>以誰的視角</h2></div>
          <button type="button" className="mc-icon-button" onClick={onClose} aria-label="關閉">×</button>
        </header>

        <div className="mc-field">
          <label className="gc-field-label">關係來源</label>
          <div className="gc-select-wrapper">
            <select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setEditingId(null); setEditorOpen(false); }}>
              {participants.map((p) => <option key={p.identityId} value={p.identityId}>{p.displayName}</option>)}
            </select>
            <svg className="gc-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
          </div>
        </div>

        <div className="gc-field">
          <label className="gc-field-label">對其他成員</label>
          <div className="mc-relationship-list">
            {otherParticipants.map((target) => {
              const rel = outgoing.find((r) => r.toParticipantId === target.identityId);
              return (
                <button
                  key={target.identityId}
                  type="button"
                  className="mc-relationship-row"
                  onClick={() => { setEditingId(target.identityId); setEditorOpen(true); }}
                  aria-label={`${target.displayName} ${rel ? formatRelationshipLabel(rel) : '未設定'}`}
                >
                  <IdentityAvatar identityId={target.identityId} participant={target.participant} legacyParticipant={target.legacyParticipant} size={36} label={target.displayName} />
                  <div className="mc-relationship-row-copy">
                    <span className="mc-relationship-row-name">{target.displayName}</span>
                    <span className="mc-relationship-row-label">{rel ? formatRelationshipLabel(rel) : '未設定'}</span>
                    {rel?.note && <span className="mc-relationship-row-note">{rel.note}</span>}
                  </div>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              );
            })}
          </div>
        </div>

        {relationships.length > 0 && (
          <div className="gc-field">
            <label className="gc-field-label">其他成員對 {participants.find((p) => p.identityId === sourceId)?.displayName || sourceId}</label>
            <div className="mc-relationship-list">
              {getIncomingRelationships(conversation, sourceId).map((rel) => {
                const from = participants.find((p) => p.identityId === rel.fromParticipantId);
                if (!from) return null;
                return (
                  <div key={rel.id} className="mc-relationship-row is-readonly">
                    <IdentityAvatar identityId={from.identityId} participant={from.participant} legacyParticipant={from.legacyParticipant} size={36} label={from.displayName} />
                    <div className="mc-relationship-row-copy">
                      <span className="mc-relationship-row-name">{from.displayName}<small className="mc-participant-kind">{resolveGroupParticipantPresentation(from).secondaryLabel}</small></span>
                      <span className="mc-relationship-row-label">{formatRelationshipLabel(rel)}</span>
                      {rel.note && <span className="mc-relationship-row-note">{rel.note}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {editorOpen && editingId && (
        <RelationshipEditor
          conversation={conversation}
          sourceId={sourceId}
          targetId={editingId}
          existing={outgoing.find((r) => r.toParticipantId === editingId)}
          onSave={(kind, customLabel, note) => {
            const existing = outgoing.find((r) => r.toParticipantId === editingId);
            if (existing) {
              updateRelationship(conversation.id, existing.id, { kind, customLabel, note });
            } else {
              addRelationship(conversation.id, sourceId, editingId, kind, customLabel, note);
            }
            setEditorOpen(false);
            setEditingId(null);
          }}
          onRemove={() => {
            const existing = outgoing.find((r) => r.toParticipantId === editingId);
            if (existing) removeRelationship(conversation.id, existing.id);
            setEditorOpen(false);
            setEditingId(null);
          }}
          onClose={() => { setEditorOpen(false); setEditingId(null); }}
        />
      )}
    </div>, document.body,
  );
}

function RelationshipEditor({
  conversation,
  sourceId,
  targetId,
  existing,
  onSave,
  onRemove,
  onClose,
}: {
  conversation: Conversation;
  sourceId: string;
  targetId: string;
  existing?: GroupRelationship;
  onSave: (kind: GroupRelationshipKind, customLabel?: string, note?: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const identities = useIdentityStore((state) => state.identities);
  const participants = useMemo(() => getEffectiveGroupParticipants(conversation, identities), [conversation, identities]);
  const source = participants.find((p) => p.identityId === sourceId);
  const target = participants.find((p) => p.identityId === targetId);

  const [kind, setKind] = useState<GroupRelationshipKind>(existing?.kind || 'friend');
  const [customLabel, setCustomLabel] = useState(existing?.customLabel || '');
  const [note, setNote] = useState(existing?.note || '');
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!source || !target) return null;

  return createPortal(
    <div className="mc-overlay" onMouseDown={onClose}>
      <section className="mc-sheet mc-relationship-editor" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="編輯關係">
        <header className="mc-sheet-header">
          <div><p className="mc-eyebrow">編輯關係</p><h2>{source.displayName} → {target.displayName}</h2></div>
          <button type="button" className="mc-icon-button" onClick={onClose} aria-label="關閉">×</button>
        </header>

        <div className="mc-field">
          <label className="gc-field-label">關係類型</label>
          <div className="gc-select-wrapper">
            <select value={kind} onChange={(event) => setKind(event.target.value as GroupRelationshipKind)}>
              {KIND_OPTIONS.map((k) => <option key={k} value={k}>{RELATIONSHIP_KIND_LABELS[k]}</option>)}
            </select>
            <svg className="gc-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
          </div>
        </div>

        {kind === 'custom' && (
          <label className="mc-field">
            <span>自訂名稱</span>
            <input value={customLabel} maxLength={20} placeholder="例如：死黨" onChange={(event) => setCustomLabel(event.target.value)} />
          </label>
        )}

        <label className="mc-field">
          <span>備註</span>
          <textarea value={note} maxLength={100} rows={3} placeholder="可選：補充說明" onChange={(event) => setNote(event.target.value)} />
        </label>

        <footer className="mc-sheet-footer">
          {existing && !confirmRemove && <button type="button" className="gc-btn gc-btn-danger" onClick={() => setConfirmRemove(true)}>移除</button>}
          {existing && confirmRemove && <div className="gc-member-remove-confirm" role="alertdialog" aria-label="確認移除關係"><p>確定移除這段關係？</p><button type="button" onClick={() => setConfirmRemove(false)}>取消</button><button type="button" className="gc-btn-danger" onClick={onRemove}>確認移除</button></div>}
          <button type="button" className="mc-btn is-secondary" onClick={onClose}>取消</button>
          <button type="button" className="mc-btn is-primary" onClick={() => onSave(kind, kind === 'custom' ? customLabel : undefined, note || undefined)}>儲存</button>
        </footer>
      </section>
    </div>, document.body,
  );
}
