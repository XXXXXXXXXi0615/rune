import { useMemo, useState } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import { IdentityAvatar } from '@/components/chat/ConversationAvatars';
import { useAppStore } from '@/store/useAppStore';
import { useIdentityStore } from '@/store/useIdentityStore';
import { putBlob } from '@/store/avatarBlobStorage';
import { getEffectiveGroupParticipant, getEffectiveGroupParticipants } from '@/features/groupChat/participants';
import { getOutgoingRelationships, getIncomingRelationships, formatRelationshipLabel } from '@/features/groupChat/relationships';
import { resolveGroupParticipantPresentation } from '@/features/groupChat/presentation';
import type { Conversation } from '@/types';

export function GroupMemberProfile({ conversation, identityId, onClose }: { conversation: Conversation; identityId: string; onClose: () => void }) {
  const identities = useIdentityStore((state) => state.identities);
  const updateMeta = useAppStore((state) => state.updateGroupParticipantMeta);
  const removeMember = useAppStore((state) => state.removeGroupParticipant);
  const member = useMemo(() => getEffectiveGroupParticipant(conversation, identities, identityId), [conversation, identities, identityId]);
  const allParticipants = useMemo(() => getEffectiveGroupParticipants(conversation, identities).filter((p) => p.identityId !== 'narrator' && !p.identity?.archived), [conversation, identities]);
  const outgoing = useMemo(() => getOutgoingRelationships(conversation, identityId), [conversation, identityId]);
  const incoming = useMemo(() => getIncomingRelationships(conversation, identityId), [conversation, identityId]);
  const [name, setName] = useState(member?.participant?.displayNameOverride || '');
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (!member) return null;
  const presentation = resolveGroupParticipantPresentation(member);

  const uploadAvatar = async (file?: File) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
    const assetId = `group-member-avatar-${crypto.randomUUID()}`;
    await putBlob(assetId, file);
    updateMeta(conversation.id, identityId, { customAvatarAssetId: assetId, customAvatarCrop: { x: 50, y: 50, zoom: 1 } });
  };

  return <MobileShellOverlay variant="sheet" onClose={onClose} className="gc-member-profile-overlay">
    <section className="gc-member-profile" role="dialog" aria-modal="true" aria-labelledby="gc-member-profile-caption gc-member-profile-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p id="gc-member-profile-caption">群成員資料</p><h2 id="gc-member-profile-title">{member.displayName}</h2></div><button type="button" onClick={onClose} aria-label="關閉">×</button></header>
      <div className="gc-member-profile-hero"><IdentityAvatar identityId={identityId} participant={member.participant} legacyParticipant={member.legacyParticipant} size={72}/><div><strong>{member.displayName} <em className={`gc-member-profile-kind is-${presentation.kind}`}>{presentation.secondaryLabel}</em></strong><small>全局身份：{member.identity?.displayName || member.legacyParticipant?.name || identityId}{presentation.handle ? ` · @${presentation.handle}` : ''}</small><small>角色：{member.role === 'admin' ? '管理員' : '成員'}</small></div></div>
      <label className="mc-field"><span>群內顯示名稱</span><input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => updateMeta(conversation.id, identityId, { displayNameOverride: name.trim() || undefined })}/></label>
      <div className="gc-inline-actions"><label className="gc-btn gc-btn-secondary">更換群內頭像<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadAvatar(event.target.files?.[0])}/></label>{member.participant?.customAvatarAssetId && <button type="button" className="gc-btn gc-btn-secondary" onClick={() => updateMeta(conversation.id, identityId, { customAvatarAssetId: undefined, customAvatarCrop: undefined })}>還原身份頭像</button>}</div>

      {(outgoing.length > 0 || incoming.length > 0) && (
        <div className="gc-field gc-member-relationships">
          <label className="gc-field-label">群內關係</label>
          {outgoing.length > 0 && (
            <div className="gc-relationship-section">
              <span className="gc-relationship-direction">對其他成員</span>
              {outgoing.map((rel) => {
                const target = allParticipants.find((p) => p.identityId === rel.toParticipantId);
                if (!target) return null;
                return <div key={rel.id} className="gc-relationship-item"><IdentityAvatar identityId={target.identityId} participant={target.participant} legacyParticipant={target.legacyParticipant} size={28} /><span>{target.displayName}</span><span className="gc-relationship-kind">{formatRelationshipLabel(rel)}</span></div>;
              })}
            </div>
          )}
          {incoming.length > 0 && (
            <div className="gc-relationship-section">
              <span className="gc-relationship-direction">其他成員對 {member.displayName}</span>
              {incoming.map((rel) => {
                const from = allParticipants.find((p) => p.identityId === rel.fromParticipantId);
                if (!from) return null;
                return <div key={rel.id} className="gc-relationship-item"><IdentityAvatar identityId={from.identityId} participant={from.participant} legacyParticipant={from.legacyParticipant} size={28} /><span>{from.displayName}</span><span className="gc-relationship-kind">{formatRelationshipLabel(rel)}</span></div>;
              })}
            </div>
          )}
        </div>
      )}

      {!member.isSelf && (!confirmRemove ? <button type="button" className="gc-btn gc-btn-danger" onClick={() => setConfirmRemove(true)}>移除成員</button> : <div className="gc-member-remove-confirm" role="alertdialog" aria-label={`確認移除 ${member.displayName}`}><p>確定從群聊移除 {member.displayName}？</p><button type="button" onClick={() => setConfirmRemove(false)}>取消</button><button type="button" className="gc-btn-danger" onClick={() => { removeMember(conversation.id, identityId); onClose(); }}>確認移除</button></div>)}
    </section>
  </MobileShellOverlay>;
}
