import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { AvatarAssetImage, ConversationAvatar, GroupAvatarCollage, IdentityAvatar } from '@/components/chat/ConversationAvatars';
import { useAppStore } from '@/store/useAppStore';
import { RelationshipSheet } from '@/components/chat/RelationshipSheet';
import { useIdentityStore } from '@/store/useIdentityStore';
import { useCompanionPetStore } from '@/store/useCompanionPetStore';
import { PRESENCE_LABELS, usePresenceStore } from '@/store/usePresenceStore';
import { resolveParticipantPresence } from '@/utils/messageIdentity';
import { putBlob } from '@/store/avatarBlobStorage';
import { createIdentityAndJoinGroup, type CreateAndJoinIdentityResult } from '@/utils/groupIdentityTransaction';
import type { ChatIdentity, ChatParticipant, Conversation, GroupAiParticipationMode, GroupParticipant, IdentityKind, PresenceStatus } from '@/types';
import { GROUP_PARTICIPANT_LIMIT, getEffectiveGroupParticipants, legacyReplyPolicyFromGroupAiMode } from '@/features/groupChat/participants';
import { buildGroupLibraryIdentities } from '@/features/groupChat/identityLibrary';
import { resolveConversationPerspective } from '@/features/groupChat/perspective';
import { resolveGroupParticipantPresentation, participantNeedsDisambiguation } from '@/features/groupChat/presentation';
import { GroupMemberProfile } from '@/components/chat/GroupMemberProfile';
import '@/styles/mooncast.css';
import '@/styles/group-chat.css';

const PRESENCE_OPTIONS: PresenceStatus[] = ['online', 'invisible', 'busy', 'offline'];

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

/* Reentrant global companion-pet suppression for blocking group overlays.
   Nested overlays (builder → identity editor) keep the pet hidden until the
   last blocking surface closes. Uses the canonical transientHidden seam —
   persisted pet preferences are never touched. */
let _groupOverlayPetSuppressCount = 0;
function suppressCompanionPetForGroupOverlay() {
  if (++_groupOverlayPetSuppressCount === 1) useCompanionPetStore.getState().setTransientHidden(true);
}
function releaseCompanionPetForGroupOverlay() {
  if (--_groupOverlayPetSuppressCount <= 0) {
    _groupOverlayPetSuppressCount = 0;
    useCompanionPetStore.getState().setTransientHidden(false);
  }
}
function useCompanionPetSuppressed(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    suppressCompanionPetForGroupOverlay();
    return releaseCompanionPetForGroupOverlay;
  }, [active]);
}

export function PresenceDot({ status, label }: { status: PresenceStatus; label?: string }) {
  return <span className={`mc-presence-dot is-${status}`} role="img" aria-label={label || PRESENCE_LABELS[status]} />;
}

export function PresenceStatusSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const presence = usePresenceStore((state) => state.getPresence('self'));
  const setPresence = usePresenceStore((state) => state.setPresence);
  const setCustomText = usePresenceStore((state) => state.setCustomText);
  const [customText, setCustomTextDraft] = useState(presence.customText || '');

  useEffect(() => {
    if (open) setCustomTextDraft(presence.customText || '');
  }, [open, presence.customText]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="mc-overlay" onMouseDown={onClose}>
      <section className="mc-sheet mc-presence-sheet" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="mc-presence-title">
        <header className="mc-sheet-header">
          <div><p className="mc-eyebrow">在線狀態</p><h2 id="mc-presence-title">讓大家知道你現在的節奏</h2></div>
          <button type="button" className="mc-icon-button" onClick={onClose} aria-label="關閉"><CloseIcon /></button>
        </header>
        <div className="mc-presence-options">
          {PRESENCE_OPTIONS.map((status) => (
            <button key={status} type="button" className={`mc-presence-option${presence.visiblePresenceStatus === status ? ' is-active' : ''}`} onClick={() => setPresence('self', status)}>
              <PresenceDot status={status} />
              <span>{PRESENCE_LABELS[status]}</span>
            </button>
          ))}
        </div>
        <label className="mc-field">
          <span>狀態文字</span>
          <input value={customText} maxLength={36} placeholder="例如：正在整理今天的潮汐" onChange={(event) => setCustomTextDraft(event.target.value)} />
        </label>
        <div className="mc-preset-row">
          {['專心中', '稍後回覆', '正在休息'].map((text) => <button key={text} type="button" onClick={() => setCustomTextDraft(text)}>{text}</button>)}
        </div>
        <footer className="mc-sheet-footer">
          <button type="button" className="mc-button is-secondary" onClick={onClose}>取消</button>
          <button type="button" className="mc-button is-primary" onClick={() => { setCustomText('self', customText.trim()); onClose(); }}>保存</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function identityAvatarColor(kind: IdentityKind): string {
  return kind === 'user' ? 'user' : kind === 'ai' ? 'char' : 'lavender';
}

function identityDisplayName(identity: ChatIdentity | undefined, fallback: string): string {
  return identity?.displayName || fallback;
}

function useGroupParticipants(conversation: Conversation) {
  const identities = useIdentityStore((s) => s.identities);
  return useMemo(() => {
    type GroupMemberInfo = {
      gp: GroupParticipant | undefined;
      identity: ChatIdentity | undefined;
      displayName: string;
      color: string;
      id: string;
      isSelf: boolean;
      controlMode: string;
    };
    if (conversation.groupParticipants) {
      return conversation.groupParticipants.map((gp) => {
        const identity = identities.find((i) => i.id === gp.identityId);
        const displayName = gp.displayNameOverride || identity?.displayName || gp.identityId;
        return {
          gp, identity, displayName,
          color: identityAvatarColor(identity?.kind || 'ai'),
          id: gp.identityId,
          isSelf: identity?.kind === 'user',
          controlMode: 'auto',
        } satisfies GroupMemberInfo;
      });
    }
    return (conversation.participants || []).map((p) => ({
      gp: undefined as GroupParticipant | undefined,
      identity: undefined as ChatIdentity | undefined,
      displayName: p.groupNickname || p.name,
      color: p.avatarColor || 'char',
      id: p.id,
      isSelf: p.isSelf === true,
      controlMode: p.controlMode || 'auto',
    }));
  }, [conversation.groupParticipants, conversation.participants, identities]);
}

function ChatIdentityEditor({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (identity: ChatIdentity) => CreateAndJoinIdentityResult }) {
  useCompanionPetSuppressed(open);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [aliases, setAliases] = useState('');
  const [avatarAssetId, setAvatarAssetId] = useState<string>();
  const [error, setError] = useState('');
  const [pendingIdentity, setPendingIdentity] = useState<ChatIdentity>();

  useEffect(() => {
    if (!open) return;
    setDisplayName(''); setBio(''); setAliases('');
    setAvatarAssetId(undefined); setError(''); setPendingIdentity(undefined);
  }, [open]);

  const uploadAvatar = async (file?: File) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError('請選擇 JPG、PNG 或 WebP 圖片。');
      return;
    }
    const assetId = `identity-avatar-${crypto.randomUUID()}`;
    await putBlob(assetId, file);
    setAvatarAssetId(assetId);
    setError('');
  };

  const submit = () => {
    const name = displayName.trim();
    if (!name) { setError('請先填寫角色名稱。'); return; }
    const now = Date.now();
    const variantId = avatarAssetId ? `avatar-${crypto.randomUUID()}` : '';
    const identity: ChatIdentity = pendingIdentity || {
      id: `role-${crypto.randomUUID()}`,
      kind: 'user',
      displayName: name,
      avatarVariants: avatarAssetId ? [{ id: variantId, label: '預設頭像', assetId: avatarAssetId, cropX: 50, cropY: 50, zoom: 1 }] : [],
      defaultAvatarVariantId: variantId,
      bio: bio.trim(),
      personaPrompt: '',
      mentionAliases: aliases.split(',').map((item) => item.trim()).filter(Boolean),
      allowManualSpeaking: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const result = onCreated(identity);
    if (!result.ok) {
      setPendingIdentity(identity);
      setError(result.error);
    }
  };

  if (!open) return null;
  return createPortal(
    <div className="mc-overlay gc-identity-editor-overlay" onMouseDown={onClose}>
      <section className="mc-sheet gc-identity-editor" role="dialog" aria-modal="true" aria-labelledby="gc-identity-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="mc-sheet-header">
          <div><p className="mc-eyebrow">角色庫</p><h2 id="gc-identity-editor-title">建立角色</h2></div>
          <button type="button" className="mc-icon-button" onClick={onClose} aria-label="關閉"><CloseIcon /></button>
        </header>
        <div className="gc-identity-editor-body">
          <div className="gc-identity-avatar-editor">
            {avatarAssetId ? <AvatarAssetImage assetId={avatarAssetId} crop={{ x: 50, y: 50, zoom: 1 }} alt={displayName || '新角色頭像'} className="gc-identity-avatar-preview" fallback={<span className="identity-avatar-fallback gc-identity-avatar-fallback-empty">?</span>} /> : <span className="identity-avatar-fallback gc-identity-avatar-fallback-empty">?</span>}
            <div>
              <label className="gc-btn gc-btn-secondary gc-btn-sm">更換頭像<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadAvatar(event.target.files?.[0])} /></label>
              {avatarAssetId && <button type="button" className="gc-btn gc-btn-secondary gc-btn-sm" onClick={() => setAvatarAssetId(undefined)}>移除</button>}
            </div>
          </div>
          <label className="mc-field"><span>顯示名稱</span><input autoFocus value={displayName} maxLength={48} placeholder="這位角色叫什麼？" onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="mc-field"><span>簡介</span><textarea rows={2} value={bio} placeholder="一句話介紹這個角色" onChange={(event) => setBio(event.target.value)} /></label>
          <label className="mc-field"><span>稱呼／別名</span><input value={aliases} placeholder="以逗號分隔" onChange={(event) => setAliases(event.target.value)} /></label>
          {error && <p className="gc-identity-error" role="alert">{error}</p>}
        </div>
        <footer className="mc-sheet-footer gc-identity-editor-footer"><button type="button" className="mc-button is-secondary" onClick={onClose}>取消</button><button type="button" className="mc-button is-primary" onClick={submit}>建立角色</button></footer>
      </section>
    </div>, document.body,
  );
}


export function CreateGroupSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  useCompanionPetSuppressed(open);
  const createGroupConversation = useAppStore((state) => state.createGroupConversation);
  const identities = useIdentityStore((s) => s.identities);
  const addIdentity = useIdentityStore((s) => s.addIdentity);
  const conversations = useAppStore((state) => state.conversations || []);
  const profile = useAppStore((state) => state.profile);
  const userName = useAppStore((state) => state.userName || '我');
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [identityEditorOpen, setIdentityEditorOpen] = useState(false);
  const [avatarAssetId, setAvatarAssetId] = useState<string | undefined>();
  const [avatarCrop, setAvatarCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const [overrides, setOverrides] = useState<Record<string, Partial<GroupParticipant>>>({});
  const [defaultSpeakerIdentityId, setDefaultSpeakerIdentityId] = useState('');
  const [muted, setMuted] = useState(false);
  const [statusMode, setStatusMode] = useState<'auto' | 'custom'>('auto');
  const [statusText, setStatusText] = useState('');
  const [manualSpeakerSwitchingEnabled, setManualSpeakerSwitchingEnabled] = useState(true);
  const groupAvatarInput = useRef<HTMLInputElement>(null);

  const libraryIdentities = useMemo(
    () => buildGroupLibraryIdentities(identities, conversations),
    [identities, conversations],
  );
  const selfIdentity = useMemo<ChatIdentity>(() => {
    const now = Date.now();
    return { id: 'self', kind: 'user', displayName: profile.displayName || userName, avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '', mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: now, updatedAt: now };
  }, [profile.displayName, userName]);
  const available = useMemo(
    () => [selfIdentity, ...libraryIdentities.filter((i) => i.id !== 'self')],
    [libraryIdentities, selfIdentity],
  );
  const emptyLibrary = libraryIdentities.length === 0;
  const memberCount = selected.length + 1;
  const previewConversation = useMemo<Conversation>(() => ({
    id: 'group-preview', title: name.trim() || '群聊預覽', kind: 'group', type: 'group', messages: [], createdAt: 0, updatedAt: 0,
    avatarAssetId, avatarCrop,
    groupParticipants: selected.map((identityId, order) => ({ identityId, order, joinedAt: 0, role: 'member', replyPolicy: 'smart', ...overrides[identityId] })),
  }), [avatarAssetId, avatarCrop, name, overrides, selected]);

  useEffect(() => {
    if (open) { setSelected([]); setName(''); setStep(1); setQuery(''); setAvatarAssetId(undefined); setOverrides({}); setDefaultSpeakerIdentityId(''); setMuted(false); setStatusMode('auto'); setStatusText(''); setManualSpeakerSwitchingEnabled(true); setIdentityEditorOpen(false); }
  }, [open]);

  if (!open) return null;

  const create = () => {
    if (memberCount < 2) return;
    const selectedIdentities = available.filter((i) => selected.includes(i.id));
    const id = createGroupConversation({
      title: name.trim() || [selfIdentity.displayName, ...selectedIdentities.map((i) => i.displayName)].join('、'),
      identityIds: ['self', ...selected],
      avatarAssetId,
      avatarCrop: avatarAssetId ? avatarCrop : undefined,
      defaultSpeakerIdentityId: defaultSpeakerIdentityId || 'self',
      muted,
      manualSpeakerSwitchingEnabled,
      statusConfig: { mode: statusMode, customText: statusMode === 'custom' ? statusText.trim() || undefined : undefined, updatedAt: Date.now() },
      groupParticipants: ['self', ...selected].map((identityId, order) => ({
        identityId,
        order,
        joinedAt: Date.now(),
        role: available.find((identity) => identity.id === identityId)?.kind === 'user' ? 'admin' : 'member',
        replyPolicy: legacyReplyPolicyFromGroupAiMode((overrides[identityId]?.aiParticipationMode as GroupAiParticipationMode | undefined) || (available.find((identity) => identity.id === identityId)?.kind === 'ai' ? 'mention-only' : 'off')),
        aiParticipationMode: (overrides[identityId]?.aiParticipationMode as GroupAiParticipationMode | undefined) || (available.find((identity) => identity.id === identityId)?.kind === 'ai' ? 'mention-only' : 'off'),
        ...overrides[identityId],
      })),
    });
    if (!id) return;
    onCreated(id);
    onClose();
  };

  const toggleIdentity = (identityId: string) => setSelected((items) => {
    if (items.includes(identityId)) return items.filter((id) => id !== identityId);
    return items.length >= 11 ? items : [...items, identityId];
  });

  const createInBuilder = (identity: ChatIdentity): CreateAndJoinIdentityResult => {
    if (selected.length >= 11) return { ok: false, error: '群聊最多包含 12 人。' };
    addIdentity(identity);
    setSelected((items) => items.length >= 11 ? items : [...items, identity.id]);
    setIdentityEditorOpen(false);
    return { ok: true, identityId: identity.id };
  };
  const setOverride = (identityId: string, patch: Partial<GroupParticipant>) => setOverrides((items) => ({ ...items, [identityId]: { ...items[identityId], ...patch } }));
  const uploadGroupAvatar = async (file?: File) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
    const id = `group-avatar-${crypto.randomUUID()}`;
    await putBlob(id, file);
    setAvatarAssetId(id);
  };
  const moveMember = (identityId: string, direction: -1 | 1) => setSelected((items) => {
    const index = items.indexOf(identityId); const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return items;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });

  return createPortal(
    <div className="gc-sheet-overlay" onMouseDown={onClose}>
      <section className="gc-sheet" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="gc-create-title">
        <div className="gc-sheet-top">
          <header className="gc-sheet-header">
            <h2 id="gc-create-title" className="gc-sheet-title">建立群聊</h2>
            <button type="button" className="gc-sheet-close" onClick={onClose} aria-label="關閉">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </header>
          <div className="gc-builder-steps" aria-label={`建立群聊第 ${step} 步`}><span className={step >= 1 ? 'is-current' : ''}><b>1</b>選擇成員</span><span className={step >= 2 ? 'is-current' : ''}><b>2</b>群聊資料</span><span className={step >= 3 ? 'is-current' : ''}><b>3</b>群聊規則</span></div>
        </div>
        <div className="gc-sheet-body gc-builder-body">
          {step === 2 && <>
            <div className="gc-field"><label className="gc-field-label">群聊名稱</label><input className="gc-input" value={name} maxLength={40} placeholder="替這個群聊取個名字" onChange={(event) => setName(event.target.value)} /></div>
            <div className="gc-field"><label className="gc-field-label">群聊頭像</label><div className="gc-group-preview"><ConversationAvatar conversation={previewConversation} size={64} /><div><strong>{avatarAssetId ? '自訂圖片' : '自動拼貼'}</strong><small>成員變動時，自動拼貼會同步更新。</small></div></div><input ref={groupAvatarInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadGroupAvatar(event.target.files?.[0])} /><div className="gc-inline-actions"><button type="button" className="gc-btn gc-btn-secondary" onClick={() => groupAvatarInput.current?.click()}>上傳自訂圖片</button>{avatarAssetId && <button type="button" className="gc-btn gc-btn-secondary" onClick={() => setAvatarAssetId(undefined)}>恢復自動拼貼</button>}</div></div>
          </>}
          {step === 1 && <>
            <div className="gc-field">
              <label className="gc-field-label">選擇成員</label>
              <p className="gc-builder-count">已選擇 {selected.length} 位角色，加上你共 {memberCount} 人。群聊至少需要 2 人，最多 12 人。</p>
            </div>
            <div className="gc-library-self" data-testid="gc-library-self">
              <IdentityAvatar identityId="self" size={40} label={selfIdentity.displayName} />
              <div className="gc-library-self-copy">
                <span className="gc-library-self-label">你</span>
                <span className="gc-library-self-name">{selfIdentity.displayName}</span>
              </div>
              <span className="gc-library-self-hint">已自動加入</span>
            </div>
            <div className="gc-field">
              <label className="gc-field-label">你的角色</label>
              <div className="gc-library-grid">
                {available.filter((identity) => identity.id !== 'self' && identity.displayName.toLowerCase().includes(query.toLowerCase())).map((identity) => {
                  const checked = selected.includes(identity.id);
                  return <button key={identity.id} type="button" className={`gc-library-card${checked ? ' is-selected' : ''}`} onClick={() => toggleIdentity(identity.id)}>
                    <IdentityAvatar identityId={identity.id} size={36} />
                    <span className="gc-identity-name">{identity.displayName}</span>
                    <span className="gc-identity-kind-badge">{identity.kind === 'ai' ? 'AI' : '角色'}</span>
                    {checked && <span className="gc-library-check" aria-hidden="true">✓</span>}
                  </button>;
                })}
              </div>
            </div>
            {emptyLibrary ? (
              <div className="gc-library-empty" data-testid="gc-library-empty">
                <p className="gc-library-empty-title">你的角色</p>
                <p className="gc-library-empty-copy">還沒有建立其他角色。建立一個角色，就能一起加入群聊。</p>
                <button type="button" className="gc-btn gc-btn-primary gc-btn-sm" onClick={() => setIdentityEditorOpen(true)}>＋ 建立新角色</button>
              </div>
            ) : (
              <div className="gc-library-actions">
                <button type="button" className="gc-btn gc-btn-secondary gc-btn-sm" onClick={() => setIdentityEditorOpen(true)}>＋ 建立新角色</button>
              </div>
            )}
          </>}
          {step === 3 && <>
            <div className="gc-group-preview"><GroupAvatarCollage conversation={previewConversation} size={56} /><span>{name.trim() || '群聊預覽'}</span></div>
            <p className="gc-builder-count">群內設定只影響這個群聊，不會改變角色原始資料。</p>
            <div className="gc-builder-rules">
              <label className="mc-field"><span>預設發言身份</span><select value={defaultSpeakerIdentityId} onChange={(event) => setDefaultSpeakerIdentityId(event.target.value)}><option value="">自動選擇安全身份</option>{selected.map((identityId) => { const identity = available.find((item) => item.id === identityId); if (!identity || identity.archived || (identity.kind === 'ai' && !identity.allowManualSpeaking)) return null; return <option key={identityId} value={identityId}>{identity.displayName}</option>; })}</select></label>
              <label className="gc-switch"><input type="checkbox" checked={manualSpeakerSwitchingEnabled} onChange={(event) => setManualSpeakerSwitchingEnabled(event.target.checked)} /><span className="gc-switch-track"/><span className="gc-switch-label">允許手動切換發言身份</span></label>
              <label className="gc-switch"><input type="checkbox" checked={muted} onChange={(event) => setMuted(event.target.checked)} /><span className="gc-switch-track"/><span className="gc-switch-label">建立後將通知設為靜音</span></label>
              <label className="mc-field"><span>群聊狀態</span><select value={statusMode} onChange={(event) => setStatusMode(event.target.value as 'auto' | 'custom')}><option value="auto">依真實狀態自動顯示</option><option value="custom">自訂狀態</option></select></label>
              {statusMode === 'custom' && <label className="mc-field"><span>自訂狀態文字</span><input value={statusText} maxLength={36} onChange={(event) => setStatusText(event.target.value)} /></label>}
              <div className="gc-field"><span className="gc-field-label">AI 參與方式</span>{selected.map((identityId) => { const identity = available.find((item) => item.id === identityId); if (identity?.kind !== 'ai') return null; const mode = (overrides[identityId]?.aiParticipationMode as GroupAiParticipationMode | undefined) || 'mention-only'; return <label key={identityId} className="gc-ai-participation-row"><span>{identity.displayName}</span><select value={mode} aria-label={`設定 ${identity.displayName} 的 AI 參與方式`} onChange={(event) => { const next = event.target.value as GroupAiParticipationMode; setOverride(identityId, { aiParticipationMode: next, replyPolicy: legacyReplyPolicyFromGroupAiMode(next) }); }}><option value="off">關閉</option><option value="mention-only">被提及才回</option><option value="automatic">自動參與</option></select></label>; })}</div>
            </div>
            <div className="gc-builder-members">{selected.map((identityId, order) => { const identity = available.find((item) => item.id === identityId); const override = overrides[identityId] || {}; const uploadMemberAvatar = async (file?: File) => { if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return; const assetId = `group-member-avatar-${crypto.randomUUID()}`; await putBlob(assetId, file); setOverride(identityId, { customAvatarAssetId: assetId, customAvatarCrop: { x: 50, y: 50, zoom: 1 } }); }; return <article key={identityId} className="gc-builder-member" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', identityId)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const source = event.dataTransfer.getData('text/plain'); if (source && source !== identityId) setSelected((items) => { const next = items.filter((id) => id !== source); next.splice(next.indexOf(identityId), 0, source); return next; }); }}><IdentityAvatar identityId={identityId} participant={{ identityId, order, joinedAt: 0, role: 'member', replyPolicy: 'smart', ...override }} size={42} /><div className="gc-builder-member-fields"><input className="gc-input" value={override.displayNameOverride ?? identity?.displayName ?? identityId} aria-label="群內顯示名稱" onChange={(event) => setOverride(identityId, { displayNameOverride: event.target.value })} /><select value={override.avatarVariantOverrideId || ''} aria-label="群內頭像版本" onChange={(event) => setOverride(identityId, { avatarVariantOverrideId: event.target.value || undefined })}><option value="">預設頭像</option>{identity?.avatarVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name || '頭像版本'}</option>)}</select><select value={override.replyPolicy || 'smart'} aria-label="成員回應政策" onChange={(event) => setOverride(identityId, { replyPolicy: event.target.value as GroupParticipant['replyPolicy'] })}><option value="smart">智慧參與</option><option value="mention">被提及才回</option><option value="roundtable">每輪參與</option><option value="director">暫停發言</option></select><label className="gc-member-avatar-upload">群內自訂頭像<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadMemberAvatar(event.target.files?.[0])} /></label>{override.customAvatarAssetId && <button type="button" className="gc-member-avatar-reset" onClick={() => setOverride(identityId, { customAvatarAssetId: undefined, customAvatarCrop: undefined })}>移除自訂頭像</button>}</div><div className="gc-order-actions"><button type="button" onClick={() => moveMember(identityId, -1)} aria-label="往前排序">↑</button><button type="button" onClick={() => moveMember(identityId, 1)} aria-label="往後排序">↓</button></div></article>; })}</div>
          </>}
        </div>
        <div className="gc-sheet-footer">
          {step > 1 ? <button type="button" className="gc-btn gc-btn-secondary" onClick={() => setStep((value) => value - 1)}>上一步</button> : <span />}
          {step < 3 ? <button type="button" className="gc-btn gc-btn-primary" disabled={step === 1 && memberCount < 2} onClick={() => setStep((value) => value + 1)}>下一步</button> : <button type="button" className="gc-btn gc-btn-primary" disabled={memberCount < 2} onClick={create}>建立群聊</button>}
        </div>
        <ChatIdentityEditor open={identityEditorOpen} onClose={() => setIdentityEditorOpen(false)} onCreated={createInBuilder} />
      </section>
    </div>, document.body,
  );
}

type SpeakerOption = { id: string; name: string; color: string; label: string; kind: Exclude<IdentityKind, 'narrator'>; disambiguator?: string };

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="mc-speaker-card-check-icon"><path d="m5 13 4.5 4.5L19 7" /></svg>;
}

/**
 * Compact horizontal speaker selector ("這句話由誰說").
 * No wrapping grid: with many members it scrolls horizontally instead of
 * growing into a huge multi-column block.
 */
function SpeakerSheetContent({ speakers, currentSpeakerId, onPick }: { speakers: SpeakerOption[]; currentSpeakerId?: string; onPick: (id: string) => void }) {
  return (
    <div className="mc-speaker-grid mc-speaker-rail" role="group" aria-label="發言身份">
      {speakers.map((s) => {
        const selected = currentSpeakerId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            aria-selected={selected}
            aria-pressed={selected}
            data-selected={selected ? 'true' : 'false'}
            aria-label={`以 ${s.name}${s.disambiguator ? ` ${s.disambiguator}` : ''} 身分發言（${s.label}）`}
            className={`mc-speaker-card${selected ? ' is-active is-selected' : ''}`}
            onClick={() => onPick(s.id)}
          >
            <span className="mc-speaker-card-avatar">
              <IdentityAvatar identityId={s.id} size={36} label={s.name} />
            </span>
            <span className="mc-speaker-card-copy">
              <strong>{s.name}</strong>
              {s.disambiguator && <small className="mc-speaker-card-handle">{s.disambiguator}</small>}
              <small className="mc-speaker-card-role">{s.label}</small>
            </span>
            {selected && <span className="mc-speaker-card-check" data-testid="speaker-selected-check"><CheckIcon /></span>}
          </button>
        );
      })}
    </div>
  );
}

function SpeakerSheetEmptyState() {
  return (
    <div className="mc-speaker-empty">
      <h3>沒有可用的發言身份</h3>
      <p>群內身份可能已封存，或不允許手動發言。</p>
    </div>
  );
}

export function SpeakerSheet({ conversation, open, onClose }: { conversation: Conversation; open: boolean; onClose: () => void }) {
  const setCurrentSpeaker = useAppStore((state) => state.setCurrentSpeaker);
  const identities = useIdentityStore((s) => s.identities);

  const speakers = useMemo(() => {
    const participants = getEffectiveGroupParticipants(conversation, identities)
      .filter((participant) => !participant.identity?.archived && participant.allowManualSpeaking && participant.identityId !== 'narrator');
    const presentations = participants.map(resolveGroupParticipantPresentation);
    const seen = new Set<string>();
    return participants
      // One row per canonical identity — the same participant can never appear twice.
      .filter((participant) => {
        if (seen.has(participant.identityId)) return false;
        seen.add(participant.identityId);
        return true;
      })
      .map((participant, index) => {
        const presentation = resolveGroupParticipantPresentation(participant);
        const ambiguous = participantNeedsDisambiguation(presentation, presentations);
        return {
          id: participant.identityId,
          name: participant.displayName,
          color: identityAvatarColor(participant.kind),
          label: presentation.secondaryLabel,
          kind: participant.kind === 'silent' ? 'silent' : participant.kind === 'user' ? 'user' : 'ai',
          // Duplicate display names must stay identifiable even without a handle.
          disambiguator: ambiguous ? (presentation.handle ? `@${presentation.handle}` : `#${index + 1}`) : undefined,
        } satisfies SpeakerOption;
      });
  }, [conversation, identities]);

  if (!open) return null;

  return createPortal(
    <div className="mc-overlay is-light" onMouseDown={onClose}>
      <section className="mc-sheet mc-speaker-sheet" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="選擇發言身份">
        {/* The heading is the label: no redundant eyebrow above it. */}
        <header className="mc-sheet-header mc-sheet-header--compact"><div><h2>這句話由誰說</h2></div><button type="button" className="mc-icon-button" onClick={onClose} aria-label="關閉"><CloseIcon /></button></header>
        {conversation.manualSpeakerSwitchingEnabled === false ? <div className="mc-speaker-empty"><h3>此群聊已關閉手動身份切換</h3><p>可在群聊規則中重新開啟。</p></div> : speakers.length ? (
          <SpeakerSheetContent
            speakers={speakers}
            currentSpeakerId={conversation.currentSpeakerParticipantId}
            onPick={(id) => { setCurrentSpeaker(conversation.id, id); onClose(); }}
          />
        ) : (
          <SpeakerSheetEmptyState />
        )}
      </section>
    </div>, document.body,
  );
}

export function PerspectiveSheet({ conversation, open, onClose }: { conversation: Conversation; open: boolean; onClose: () => void }) {
  const identities = useIdentityStore((state) => state.identities);
  const setPerspective = useAppStore((state) => state.setConversationPerspective);
  const participants = useMemo(
    () => getEffectiveGroupParticipants(conversation, identities)
      .filter((participant) => participant.identityId !== 'narrator' && !participant.identity?.archived),
    [conversation, identities],
  );
  const current = resolveConversationPerspective(conversation, identities);
  if (!open) return null;
  return createPortal(
    <div className="mc-overlay is-light" onMouseDown={onClose}>
      <section className="mc-sheet mc-perspective-sheet" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="閱讀視角">
        <header className="mc-sheet-header"><div><p className="mc-eyebrow">閱讀視角</p><h2>以誰的視角閱讀</h2></div><button type="button" className="mc-icon-button" onClick={onClose} aria-label="關閉"><CloseIcon /></button></header>
        <div className="mc-perspective-list">
          {participants.map((participant) => {
            const presentation = resolveGroupParticipantPresentation(participant);
            const ambiguous = participantNeedsDisambiguation(presentation, participants.map(resolveGroupParticipantPresentation));
            return (
              <button key={participant.identityId} type="button" className={current?.identityId === participant.identityId ? 'is-active' : ''} onClick={() => { setPerspective(conversation.id, participant.identityId); onClose(); }}>
                <IdentityAvatar identityId={participant.identityId} participant={participant.participant} legacyParticipant={participant.legacyParticipant} size={38} label={participant.displayName} />
                <span className="mc-perspective-copy">
                  <span>{presentation.displayName}{ambiguous && <small className="mc-participant-handle">@{presentation.handle}</small>}</span>
                  <small className="mc-participant-kind">{presentation.secondaryLabel}</small>
                </span>
                <span aria-hidden="true">{current?.identityId === participant.identityId ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>, document.body,
  );
}

export function GroupProfileDrawer({ conversation, open, onClose }: { conversation: Conversation; open: boolean; onClose: () => void }) {
  const updateGroupConversation = useAppStore((state) => state.updateGroupConversation);
  const updateGroupParticipant = useAppStore((state) => state.updateGroupParticipant);
  const updateGroupParticipantMeta = useAppStore((state) => state.updateGroupParticipantMeta);
  const addGroupParticipant = useAppStore((state) => state.addGroupParticipant);
  const clearConversationMessages = useAppStore((state) => state.clearConversationMessages);
  const identities = useIdentityStore((s) => s.identities);
  const allConversations = useAppStore((s) => s.conversations || []);
  const getPresence = usePresenceStore((state) => state.getPresence);
  const [query, setQuery] = useState('');
  const [name, setName] = useState(conversation.customTitle || conversation.title);
  const [announcement, setAnnouncement] = useState(conversation.announcement || '');
  const [avatarCrop, setAvatarCrop] = useState(conversation.avatarCrop || { x: 50, y: 50, zoom: 1 });
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [statusText, setStatusText] = useState(conversation.statusConfig?.customText || '');
  const [profileIdentityId, setProfileIdentityId] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [relationshipSheetOpen, setRelationshipSheetOpen] = useState(false);
  // Crop is a subview: the settings main view never carries position/scale sliders.
  const [cropEditorOpen, setCropEditorOpen] = useState(false);

  const members = useMemo(() => getEffectiveGroupParticipants(conversation, identities).map((member) => ({
    id: member.identityId,
    displayName: member.displayName,
    color: identityAvatarColor(member.kind),
    isSelf: member.isSelf,
    controlMode: member.legacyParticipant?.controlMode || 'auto',
    participant: member.participant,
    legacyParticipant: member.legacyParticipant,
    secondaryLabel: resolveGroupParticipantPresentation(member).secondaryLabel,
  })), [conversation, identities]);
  const onlineCount = useMemo(() => members.filter((m) => resolveParticipantPresence(m.participant, getPresence(m.id)).state === 'online').length, [members, getPresence]);

  const availableIdentities = useMemo(() => {
    const existingIds = new Set(
      conversation.groupParticipants
        ? conversation.groupParticipants.map((gp) => gp.identityId)
        : (conversation.participants || []).map((p) => p.id),
    );
    const normalizedQuery = query.trim().toLowerCase();
    return buildGroupLibraryIdentities(identities, allConversations).filter((identity) =>
      !existingIds.has(identity.id)
      && (!normalizedQuery || identity.displayName.toLowerCase().includes(normalizedQuery) || identity.mentionAliases.some((alias) => alias.toLowerCase().includes(normalizedQuery))),
    );
  }, [identities, allConversations, conversation, query]);

  useEffect(() => {
    if (open) {
      setName(conversation.customTitle || conversation.title);
      setAnnouncement(conversation.announcement || '');
      setQuery('');
      setAvatarCrop(conversation.avatarCrop || { x: 50, y: 50, zoom: 1 });
      setMemberMenuId(null);
      setRoleEditorOpen(false);
      setRoleError('');
      setConfirmClearHistory(false);
      setStatusText(conversation.statusConfig?.customText || '');
      setCropEditorOpen(false);
    }
  }, [conversation, open]);

  useEffect(() => {
    if (open) setProfileIdentityId(null);
  }, [conversation.id, open]);

  // Same keyboard dismissal contract as the sibling group panels.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleAvatar = async (file?: File) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
    const assetId = `group-avatar-${crypto.randomUUID()}`;
    await putBlob(assetId, file);
    const crop = { x: 50, y: 50, zoom: 1 };
    setAvatarCrop(crop);
    updateGroupConversation(conversation.id, { avatarAssetId: assetId, avatarCrop: crop, avatarUrl: undefined });
  };
  const handleMemberAvatar = async (participantId: string, file?: File) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
    const assetId = `group-member-avatar-${crypto.randomUUID()}`;
    await putBlob(assetId, file);
    updateGroupParticipantMeta(conversation.id, participantId, { customAvatarAssetId: assetId, customAvatarCrop: { x: 50, y: 50, zoom: 1 } });
  };

  const addIdentityToGroup = (identity: ChatIdentity): CreateAndJoinIdentityResult => {
    const result = createIdentityAndJoinGroup(conversation.id, identity);
    if (result.ok) {
      setRoleEditorOpen(false);
      setRoleError('');
    } else {
      setRoleError(result.error);
    }
    return result;
  };

  if (!open) return null;

  return createPortal(
    <div className={`mc-drawer-overlay${profileIdentityId ? ' is-member-profile-open' : ''}`} onMouseDown={onClose}>
      <aside className="mc-group-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label="群聊資料">
        <header className="mc-sheet-header mc-group-drawer-header">
          <div><p className="mc-eyebrow">群聊資料</p><h2>{conversation.customTitle || conversation.title}</h2></div>
          <button type="button" className="mc-icon-button" onClick={onClose} aria-label="關閉"><CloseIcon /></button>
        </header>

        <div className="mc-group-drawer-body">
        {cropEditorOpen && conversation.avatarAssetId ? (
          <section className="gc-avatar-crop-panel" aria-label="調整群頭像裁切">
            {/* Preview is the production group-avatar component: same radius,
                aspect ratio, object-fit and crop transform. Only scale differs. */}
            <div className="gc-avatar-crop-preview"><ConversationAvatar conversation={{ ...conversation, avatarCrop }} size={112} /></div>
            <div className="gc-avatar-crop-controls" aria-label="群頭像裁切">
              <label>水平位置<input type="range" min="0" max="100" value={avatarCrop.x} onChange={(event) => setAvatarCrop({ ...avatarCrop, x: Number(event.target.value) })} /></label>
              <label>垂直位置<input type="range" min="0" max="100" value={avatarCrop.y} onChange={(event) => setAvatarCrop({ ...avatarCrop, y: Number(event.target.value) })} /></label>
              <label>縮放<input type="range" min="1" max="2.5" step="0.05" value={avatarCrop.zoom} onChange={(event) => setAvatarCrop({ ...avatarCrop, zoom: Number(event.target.value) })} /></label>
            </div>
            <div className="gc-avatar-crop-actions">
              <button type="button" className="gc-btn gc-btn-secondary gc-btn-sm" onClick={() => { setAvatarCrop(conversation.avatarCrop || { x: 50, y: 50, zoom: 1 }); setCropEditorOpen(false); }}>取消</button>
              <button type="button" className="gc-btn gc-btn-primary gc-btn-sm" onClick={() => { updateGroupConversation(conversation.id, { avatarCrop }); setCropEditorOpen(false); }}>儲存裁切</button>
            </div>
          </section>
        ) : (
          <>
            {/* [ avatar ] group name / N 位成員 / 更換圖片 > — a summary row, not floating CTAs. */}
            <div className="mc-group-hero">
              <div className="mc-group-avatar-editor">
                <ConversationAvatar conversation={conversation} size={56} />
                <div className="mc-group-hero-copy">
                  <strong className="mc-group-hero-name">{conversation.customTitle || conversation.title}</strong>
                  <span className="mc-group-hero-count">{members.length} 位成員</span>
                  <label className="mc-group-avatar-change" title="更換群聊頭像">
                    <span>更換圖片</span>
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                    <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleAvatar(event.target.files?.[0])} />
                  </label>
                </div>
                {(conversation.avatarAssetId || conversation.avatarUrl) && (
                  <button type="button" className="mc-group-avatar-remove" onClick={() => updateGroupConversation(conversation.id, { avatarAssetId: undefined, avatarCrop: undefined, avatarUrl: undefined })}>移除自訂圖片</button>
                )}
              </div>
            </div>

            {conversation.avatarAssetId && (
              <div className="gc-avatar-crop-entry">
                <button type="button" className="gc-avatar-crop-entry-btn" onClick={() => setCropEditorOpen(true)} aria-label="調整裁切">
                  <span>調整裁切</span>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            )}
          </>
        )}

        <label className="mc-field">
          <span>群聊名稱</span>
          <input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => updateGroupConversation(conversation.id, { customTitle: name.trim() || conversation.title })} />
        </label>

        <label className="mc-field">
          <span>群公告</span>
          <textarea value={announcement} rows={3} placeholder="寫一段大家都看得到的話" onChange={(event) => setAnnouncement(event.target.value)} onBlur={() => updateGroupConversation(conversation.id, { announcement: announcement.trim() })} />
        </label>

        {/* The per-group default AI reply mode is no longer editable here. `replyPolicy`
            stays a schema/runtime compatibility carrier (storage migration, participant
            mode resolution, reply policy engine) — only this presentation is retired. */}

        <div className="gc-field">
          <label className="gc-field-label">群聊狀態</label>
          <div className="gc-select-wrapper">
            <select value={conversation.statusConfig?.mode || 'auto'} onChange={(event) => updateGroupConversation(conversation.id, { statusConfig: { mode: event.target.value as 'auto' | 'custom', customText: statusText.trim() || undefined, updatedAt: Date.now() } })}>
              <option value="auto">自動（{onlineCount} 人在線）</option><option value="custom">自訂</option>
            </select><svg className="gc-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
          </div>
          {conversation.statusConfig?.mode === 'custom' && <><input className="gc-input" value={statusText} placeholder="狀態文字" onChange={(event) => setStatusText(event.target.value)} onBlur={() => updateGroupConversation(conversation.id, { statusConfig: { ...(conversation.statusConfig || { mode: 'custom' }), mode: 'custom', customText: statusText.trim() || undefined, updatedAt: Date.now() } })} /><div className="gc-status-expiry"><button type="button" onClick={() => updateGroupConversation(conversation.id, { statusConfig: { mode: 'custom', customText: statusText.trim(), updatedAt: Date.now() } })}>永久</button><button type="button" onClick={() => updateGroupConversation(conversation.id, { statusConfig: { mode: 'custom', customText: statusText.trim(), expiresAt: Date.now() + 3600000, updatedAt: Date.now() } })}>1 小時</button><button type="button" onClick={() => { const end = new Date(); end.setHours(23, 59, 59, 999); updateGroupConversation(conversation.id, { statusConfig: { mode: 'custom', customText: statusText.trim(), expiresAt: end.getTime(), updatedAt: Date.now() } }); }}>今天結束</button></div></>}
        </div>

        <div className="gc-field">
          <button type="button" className="gc-relationship-entry" onClick={() => setRelationshipSheetOpen(true)} aria-label="管理角色關係">
            <span className="gc-field-label">角色關係</span>
            <span className="gc-relationship-entry-count">{(conversation.groupRelationships || []).length ? `${(conversation.groupRelationships || []).length} 段關係` : '未設定'}</span>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>

        <div className="gc-members-heading">
          <span>成員</span>
        </div>
        {/* One compact line: separate labelled metrics, never a slash-joined value. */}
        <div className="gc-members-stats">
          <span className="gc-members-stat">成員 <strong>{members.length} 位</strong></span>
          <span className="gc-members-stat-sep" aria-hidden="true">·</span>
          <span className="gc-members-stat">可加入 <strong>{Math.max(0, GROUP_PARTICIPANT_LIMIT - members.length)} 位</strong></span>
          <span className="gc-members-stat-sep" aria-hidden="true">·</span>
          <span className="gc-members-stat">上限 <strong>{GROUP_PARTICIPANT_LIMIT} 位</strong></span>
        </div>
        <div className="gc-field">
          <label className="gc-field-label" htmlFor="gc-member-search">搜尋角色庫</label>
          <input id="gc-member-search" className="gc-input" value={query} placeholder="搜尋角色庫……" onChange={(event) => setQuery(event.target.value)} />
          <div className="gc-member-library-actions">
            <button type="button" className="gc-btn gc-btn-primary" onClick={() => setRoleEditorOpen(true)} disabled={members.length >= 12}>＋ 建立角色</button>
            <span className="gc-member-library-hint">從角色庫加入</span>
          </div>
        </div>

        {members.length === 1 && <div className="gc-one-member-guide">
          <strong>目前只有你在這個群聊裡</strong>
          <p>加入至少一位角色後，才會開始群聊互動。</p>
          <div><button type="button" className="gc-btn gc-btn-primary gc-btn-sm" onClick={() => setRoleEditorOpen(true)}>建立角色</button><button type="button" className="gc-btn gc-btn-secondary gc-btn-sm" onClick={() => document.getElementById('gc-member-search')?.focus()}>從角色庫加入</button></div>
        </div>}

        <div className="gc-member-list">
          {members.map((m) => {
            const presence = getPresence(m.id);
            const resolvedPresence = resolveParticipantPresence(m.participant, presence);
            const presenceStatus: PresenceStatus = resolvedPresence.state;

            return (
              <div key={m.id} className="gc-member-row">
                <button type="button" className="gc-member-profile-trigger" onClick={() => setProfileIdentityId(m.id)} aria-label={`查看 ${m.displayName} 的群成員資料`}><IdentityAvatar identityId={m.id} participant={m.participant} legacyParticipant={m.legacyParticipant} size={40} /></button>
                <div className="gc-member-info">
                  <span className="gc-member-name">{m.displayName}</span>
                  <span className="gc-member-meta">
                    <PresenceDot status={presenceStatus} /> {PRESENCE_LABELS[presenceStatus]}
                    <span className="gc-member-participant-kind">{m.secondaryLabel}</span>
                  </span>
                  {m.participant && (
                    <input
                      className="gc-member-name-input"
                      value={m.participant.displayNameOverride ?? ''}
                      placeholder="群內顯示名稱"
                      aria-label={`設定 ${m.displayName} 的群內名稱`}
                      onChange={(event) => updateGroupParticipantMeta(conversation.id, m.id, { displayNameOverride: event.target.value || undefined })}
                    />
                  )}
                </div>
                {!m.isSelf && (
                  <div className="gc-member-actions">
                    <div className="gc-select-wrapper" style={{ width: 118 }}>
                      <select
                        aria-label={`設定 ${m.displayName} 的回應方式`}
                        value={m.participant?.aiParticipationMode || (m.participant?.replyPolicy === 'director' ? 'off' : m.participant?.replyPolicy === 'mention' ? 'mention-only' : 'automatic') || m.controlMode}
                        onChange={(event) => {
                          if (m.participant) {
                            const mode = event.target.value as GroupAiParticipationMode;
                            updateGroupParticipantMeta(conversation.id, m.id, { aiParticipationMode: mode, replyPolicy: legacyReplyPolicyFromGroupAiMode(mode) });
                          }
                          else updateGroupParticipant(conversation.id, m.id, { controlMode: event.target.value as ChatParticipant['controlMode'] });
                        }}
                      >
                        {m.participant ? <>
                          <option value="automatic">自動參與</option>
                          <option value="mention-only">被提及才回</option>
                          <option value="off">關閉</option>
                        </> : <>
                          <option value="auto">智慧參與</option>
                          <option value="user">被提及才回</option>
                          <option value="paused">暫停發言</option>
                        </>}
                      </select>
                      <svg className="gc-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                    {m.participant && (() => {
                      const identity = identities.find((item) => item.id === m.id);
                      const variants = identity?.avatarVariants || [];
                      if (!variants.length) return null;
                      return <div className="gc-select-wrapper gc-member-variant-select"><select aria-label={`設定 ${m.displayName} 的群內頭像版本`} value={m.participant.avatarVariantOverrideId || identity?.defaultAvatarVariantId || ''} onChange={(event) => updateGroupParticipantMeta(conversation.id, m.id, { avatarVariantOverrideId: event.target.value || undefined })}>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label || variant.name || '頭像'}</option>)}</select><svg className="gc-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg></div>;
                    })()}
                    {m.participant && <label className="gc-member-avatar-upload" title="更換群內頭像">頭像<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleMemberAvatar(m.id, event.target.files?.[0])} /></label>}
                    {m.participant?.customAvatarAssetId && <button type="button" className="gc-member-avatar-reset" onClick={() => updateGroupParticipantMeta(conversation.id, m.id, { customAvatarAssetId: undefined, customAvatarCrop: undefined })}>還原</button>}
                    <button type="button" className="gc-member-more-btn" onClick={() => setMemberMenuId(memberMenuId === m.id ? null : m.id)} aria-label="更多成員操作">
                      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
                    </button>
                    {memberMenuId === m.id && <div className="gc-member-presence-menu"><label>狀態<select value={m.participant?.presenceOverride?.state || 'offline'} onChange={(event) => updateGroupParticipantMeta(conversation.id, m.id, { presenceOverride: { mode: 'manual', state: event.target.value as PresenceStatus } })}><option value="online">在線</option><option value="away">離開</option><option value="busy">忙碌</option><option value="offline">離線</option><option value="invisible">隱身</option></select></label><button type="button" onClick={() => updateGroupParticipantMeta(conversation.id, m.id, { presenceOverride: { mode: 'auto' } })}>恢復自動</button><button type="button" onClick={() => { setProfileIdentityId(m.id); setMemberMenuId(null); }}>管理／移除成員</button></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {availableIdentities.length > 0 && (
          <div className="gc-field">
            <label className="gc-field-label">可加入的角色</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {availableIdentities.map((identity) => (
                <button
                  key={identity.id}
                  type="button"
                  className="gc-btn gc-btn-secondary gc-btn-sm"
                  onClick={() => addGroupParticipant(conversation.id, {
                    id: identity.id,
                    name: identity.displayName,
                    avatarInitial: identity.displayName.charAt(0),
                    avatarColor: identityAvatarColor(identity.kind),
                    controlMode: 'auto',
                    isSelf: identity.id === 'self',
                  })}
                >
                  + {identity.displayName}
                </button>
              ))}
            </div>
          </div>
        )}
        {query && availableIdentities.length === 0 && <p className="gc-member-search-empty">找不到可加入的角色。</p>}
        {roleError && <p className="gc-identity-error" role="alert">{roleError}</p>}

        <div className="gc-field">
          <div className="gc-field-label">設定</div>
          <label className="gc-switch">
            <input type="checkbox" checked={conversation.muted === true} onChange={(event) => updateGroupConversation(conversation.id, { muted: event.target.checked })} />
            <span className="gc-switch-track" />
            <span className="gc-switch-label">訊息靜音</span>
          </label>
          <label className="gc-switch">
            <input type="checkbox" checked={conversation.pinned === true} onChange={(event) => updateGroupConversation(conversation.id, { pinned: event.target.checked })} />
            <span className="gc-switch-track" />
            <span className="gc-switch-label">釘選群聊</span>
          </label>
        </div>

        <div className="gc-danger-zone">
          <div className="gc-danger-zone-title">危險區域</div>
          <button type="button" className="gc-btn gc-btn-danger gc-focus-ring" onClick={() => setConfirmClearHistory(true)}>
            清除聊天記錄
          </button>
          {confirmClearHistory && <div className="gc-danger-confirm" role="alertdialog" aria-label="確認清除聊天記錄"><p>這會清除目前群聊的所有訊息，確定繼續？</p><button type="button" onClick={() => setConfirmClearHistory(false)}>取消</button><button type="button" className="gc-btn-danger" onClick={() => { clearConversationMessages(conversation.id); setConfirmClearHistory(false); }}>確認清除</button></div>}
        </div>
        </div>
      </aside>
      <ChatIdentityEditor open={roleEditorOpen} onClose={() => setRoleEditorOpen(false)} onCreated={addIdentityToGroup} />
      {profileIdentityId && <GroupMemberProfile conversation={conversation} identityId={profileIdentityId} onClose={() => setProfileIdentityId(null)} />}
      <RelationshipSheet conversation={conversation} open={relationshipSheetOpen} onClose={() => setRelationshipSheetOpen(false)} />
    </div>, document.body,
  );
}

export function ParticipantAvatar({ participant, size = 30 }: { participant: ChatParticipant; size?: number }) {
  if (participant.avatarUrl) return <img className="mc-participant-image" src={participant.avatarUrl} alt={participant.name} style={{ width: size, height: size }} />;
  return <AvatarImage fallbackInitial={participant.avatarInitial || participant.name.charAt(0)} initial={participant.avatarInitial || participant.name.charAt(0)} color={participant.avatarColor || 'char'} size={size} label={participant.name} />;
}
