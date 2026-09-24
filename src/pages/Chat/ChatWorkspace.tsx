import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AvatarAssetImage, ConversationAvatar, IdentityAvatar } from '@/components/chat/ConversationAvatars';
import { CharacterLibrary } from '@/components/chat/CharacterLibrary';
import { GroupQuickTray, type TrayParticipant } from '@/components/chat/GroupQuickTray';
import { BUILTIN_LUNARIS_ID, useCharacterStore } from '@/store/useCharacterStore';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';
import { usePresenceStore } from '@/store/usePresenceStore';
import { groupAiModeFromLegacy } from '@/features/groupChat/participants';
import { resolveGroupStatus, resolveParticipantPresence } from '@/utils/messageIdentity';
import type { ChatParticipant, GroupAiParticipationMode, GroupParticipant } from '@/types';
import { resolveCharacterDisplayName } from '@/features/characters/legacyCharacterBranding';
import { resolveDirectChatCounterpartTitle } from '@/features/chat/headerIdentity';
import type { Conversation } from '@/types';
import './ChatWorkspace.css';
import './ChatEngine.css';

type AiState = 'idle' | 'thinking' | 'streaming' | 'error';

interface ChatWorkspaceProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  composer: ReactNode;
  background?: ReactNode;
  collapsed: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

interface ChatWorkspaceHeaderProps {
  title: string;
  providerLabel?: string | null;
  modelStatus: 'unconfigured' | 'ready' | 'offline' | 'error';
  aiState: AiState;
  isArchived?: boolean;
  onUnarchive?: () => void;
  statusText?: string;
  drawerOpen: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onModel: (e: React.MouseEvent) => void;
  onMore?: () => void;
  onPerspective?: () => void;
  perspectiveLabel?: string;
  onBackground?: () => void;
  onTheme?: () => void;
  onArchive?: () => void;
  onExport?: () => void;
  onClear?: () => void;
  onGameInvite?: () => void;
  showHeaderNewChat: boolean;
  isGroup?: boolean;
  memberCount?: number;
  conversation?: Conversation;
  onStartCharacterChat?: (characterId: string) => void;
}

interface ChatWorkspaceEmptyActionsProps {
  onPickPartner: () => void;
  onCreatePartner: () => void;
}

function Icon({ name }: { name: 'menu' | 'plus' | 'search' | 'memory' | 'book' | 'user' | 'prompt' | 'model' | 'tools' | 'music' | 'settings' | 'theme' | 'more' | 'spark' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (name === 'menu') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
  if (name === 'plus') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
  if (name === 'search') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === 'memory') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M6 4h10l2 2v14H6z" /><path d="M9 9h6" /><path d="M9 13h4" /><path d="M16 4v4h4" /></svg>;
  if (name === 'book') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4z" /><path d="M5 4v12" /></svg>;
  if (name === 'user') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
  if (name === 'prompt') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M4 5h16v14H4z" /><path d="m8 9 3 3-3 3" /><path d="M13 15h4" /></svg>;
  if (name === 'model') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M12 3 4 7v10l8 4 8-4V7z" /><path d="M12 12 4 7" /><path d="m12 12 8-5" /><path d="M12 12v9" /></svg>;
  if (name === 'tools') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M14.7 6.3a4 4 0 0 0 4.9 4.9L11 19.8 6.2 15z" /><path d="M7 8 4 5" /></svg>;
  if (name === 'music') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>;
  if (name === 'settings') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-3v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4v-3h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v3h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
  if (name === 'theme') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M12 3a9 9 0 1 0 9 9 5.5 5.5 0 0 1-9-9Z" /></svg>;
  if (name === 'more') return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m12 3 1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>;
}

export function ChatWorkspace({ sidebar, header, children, composer, background, collapsed, drawerOpen, onCloseDrawer }: ChatWorkspaceProps) {
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, onCloseDrawer]);

  return (
    <div className={`chat-workspace${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}${composer ? '' : ' cw-no-composer'}`}>
      <div className="cw-drawer-backdrop" onClick={onCloseDrawer} aria-hidden="true" />
      {sidebar}
      <main className="cw-main" aria-label="聊天工作區">
        {header}
        <div className="cw-message-canvas">
          {background}
          <div className="cw-message-content">{children}</div>
        </div>
        {composer}
      </main>
    </div>
  );
}

/** Presentation labels for the conversation-level AI response mode. */
const GROUP_AI_MODE_LABELS: Record<GroupAiParticipationMode, string> = {
  automatic: '自動回應',
  'mention-only': '僅在被提及時回應',
  off: '關閉',
};

const QUICK_TRAY_MAX_HEIGHT = 320;

/**
 * Single participant-preview derivation for the group header: normalised tiles
 * for `groupParticipants` (canonical) or legacy `participants`. Read-only.
 */
function toTrayParticipants(
  groupParticipants: GroupParticipant[],
  legacyParticipants: ChatParticipant[],
): TrayParticipant[] {
  const rows = groupParticipants.length ? groupParticipants : legacyParticipants;
  return rows.slice(0, 6).map((row) => {
    if ('identityId' in row) {
      return { identityId: row.identityId, label: row.displayNameOverride?.trim() || row.identityId, participant: row, legacyParticipant: undefined };
    }
    return { identityId: row.id, label: row.groupNickname || row.name || row.id, participant: undefined, legacyParticipant: row };
  });
}

const MODEL_DOT_CLASS: Record<string, string> = {
  unconfigured: 'is-disabled',
  ready: 'is-ready',
  error: 'is-error',
  offline: 'is-disabled',
};

export function ChatWorkspaceHeader({
  title,
  providerLabel,
  modelStatus,
  aiState,
  isArchived,
  onUnarchive,
  sidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  onModel,
  onMore,
  onPerspective,
  perspectiveLabel,
  onBackground,
  onTheme,
  onArchive,
  onExport,
  onClear,
  onGameInvite,
  showHeaderNewChat,
  isGroup,
  memberCount,
  conversation,
  onStartCharacterChat = () => {},
}: ChatWorkspaceHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const presences = usePresenceStore((state) => state.presences);
  const profile = useAppStore((state) => state.profile);
  const partner = useAppStore((state) => state.partner);
  const [statusClock, setStatusClock] = useState(() => Date.now());
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [quickTrayOpen, setQuickTrayOpen] = useState(false);
  const [quickTrayMaxHeight, setQuickTrayMaxHeight] = useState(QUICK_TRAY_MAX_HEIGHT);
  const [infoPanel, setInfoPanel] = useState<'user' | 'partner' | 'conversation' | null>(null);
  const [characterLibraryOpen, setCharacterLibraryOpen] = useState(false);
  const characters = useCharacterStore((state) => state.characters);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const headerRef = useRef<HTMLElement>(null);
  const quickTrayAnchorRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const quickTrayTriggerRef = useRef<HTMLButtonElement>(null);
  const quickTrayOpenRef = useRef(false);
  useLayoutEffect(() => { quickTrayOpenRef.current = quickTrayOpen; }, [quickTrayOpen]);

  // Single owner for every quick-tray dismissal so focus and state can never drift.
  const closeQuickTray = useCallback((returnFocus = false) => {
    if (!quickTrayOpenRef.current) return;
    setQuickTrayOpen(false);
    if (returnFocus) quickTrayTriggerRef.current?.focus();
  }, []);

  const toggleQuickTray = useCallback(() => {
    setPlusMenuOpen(false);
    setMoreMenuOpen(false);
    setInfoPanel(null);
    setQuickTrayOpen((open) => !open);
  }, []);

  /** Opens the full Group Settings surface; only one header utility layer at a time. */
  const openFullGroupSettings = useCallback(() => {
    setQuickTrayOpen(false);
    setPlusMenuOpen(false);
    setMoreMenuOpen(false);
    onMore?.();
  }, [onMore]);

  useEffect(() => {
    if (!plusMenuOpen && !moreMenuOpen && !quickTrayOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) setPlusMenuOpen(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) setMoreMenuOpen(false);
      // The tray is the header's anchored sibling layer, so a click in either is not "outside".
      const insideTray = quickTrayAnchorRef.current?.contains(event.target as Node);
      if (headerRef.current && !insideTray && !headerRef.current.contains(event.target as Node)) closeQuickTray(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlusMenuOpen(false);
        setMoreMenuOpen(false);
        setInfoPanel(null);
        closeQuickTray(true);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [plusMenuOpen, moreMenuOpen, quickTrayOpen, closeQuickTray]);

  // Route change dismisses the tray (no navigation is ever triggered by it).
  useEffect(() => { closeQuickTray(false); }, [pathname, closeQuickTray]);

  // Keep the tray inside the visible viewport (includes the mobile keyboard).
  useLayoutEffect(() => {
    if (!quickTrayOpen) return undefined;
    const measure = () => {
      const rect = headerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      setQuickTrayMaxHeight(Math.max(148, Math.min(QUICK_TRAY_MAX_HEIGHT, Math.round(viewportHeight - rect.bottom - 12))));
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [quickTrayOpen]);
  useEffect(() => {
    const expiresAt = conversation?.statusConfig?.expiresAt;
    if (!expiresAt || expiresAt <= Date.now()) return undefined;
    const timeout = window.setTimeout(() => setStatusClock(Date.now()), expiresAt - Date.now() + 20);
    return () => window.clearTimeout(timeout);
  }, [conversation?.statusConfig?.expiresAt]);
  const groupStatus = conversation ? resolveGroupStatus(conversation, statusClock) : { mode: 'auto' as const };
  const onlineCount = conversation?.groupParticipants?.filter((participant) => resolveParticipantPresence(participant, presences[participant.identityId]).state === 'online').length || 0;
  const isGenerating = aiState === 'thinking' || aiState === 'streaming';
  const stateLabel = isGenerating
    ? '正在思考'
    : aiState === 'error' || modelStatus === 'error'
      ? '連線異常'
      : modelStatus === 'offline'
        ? '目前離線'
        : modelStatus === 'unconfigured'
          ? '尚未連結模型'
          : (providerLabel || '模型已連結');

  const modelPillLabel = modelStatus === 'unconfigured'
    ? ''
    : modelStatus === 'error'
      ? '連線異常'
      : (providerLabel || '選擇模型');

  const showModelPill = modelStatus !== 'unconfigured';
  const userName = profile.displayName?.trim() || '使用者';
  const partnerName = selectPartnerDisplayName(partner);
  const activeCharacter = characters.find((item) => item.id === conversation?.characterIds?.[0]) || characters.find((item) => item.id === BUILTIN_LUNARIS_ID);
  const displayPartnerName = resolveCharacterDisplayName(activeCharacter?.id, activeCharacter?.name || partnerName);
  const participants = conversation?.groupParticipants || [];
  const legacyParticipants = conversation?.participants || [];
  const groupCount = memberCount || participants.length || legacyParticipants.length;
  const conversationTitle = conversation && !isGroup ? resolveDirectChatCounterpartTitle(conversation, characters, partnerName) : title;

  /* One derivation of the participant preview, shared by the header stack and the
     quick tray — no second participant source. */
  const previewParticipants = toTrayParticipants(participants, legacyParticipants);

  const aiModeLabel = GROUP_AI_MODE_LABELS[groupAiModeFromLegacy(conversation?.replyPolicy)];
  const trayStatusLabel = !conversation
    ? ''
    : groupStatus.mode === 'custom'
      ? groupStatus.text
      : `${onlineCount} 人在線`;

  return (
    <>
    <header className={`cw-pill-header${quickTrayOpen ? ' is-quick-tray-open' : ''}`} ref={headerRef}>
      <button type="button" className="cw-pill-button cw-pill-button--menu" data-pet-safe-region="interactive" onClick={onToggleSidebar} aria-label="返回聊天列表">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div className={`cw-pill-title${isGroup ? ' is-group' : ' is-paired'}`} data-pet-safe-region="interactive">
        {conversation && !isGroup && (
          <button type="button" className="cw-conversation-avatar-button" onClick={() => setInfoPanel('partner')} aria-label={`查看角色：${displayPartnerName}`}>
            <ConversationAvatar conversation={conversation} size={44} />
          </button>
        )}
        {conversation && isGroup && (
          <button type="button" className="cw-group-avatar-stack" onClick={openFullGroupSettings} aria-label="查看群聊成員">
            {conversation.avatarAssetId || conversation.avatarUrl
              ? <ConversationAvatar conversation={conversation} size={44} />
              : <>
                {previewParticipants.slice(0, 4).map((item) => (
                  <IdentityAvatar key={item.identityId} identityId={item.identityId} participant={item.participant} legacyParticipant={item.legacyParticipant} size={36} label={item.label} />
                ))}
                {groupCount > 4 && <span className="cw-group-avatar-more">+{groupCount - 4}</span>}
              </>}
          </button>
        )}
        <div className="cw-pill-title-copy">
          <button type="button" className="cw-conversation-title-button" onClick={() => isGroup ? openFullGroupSettings() : setInfoPanel('conversation')} aria-label={`查看對話詳情：${conversationTitle}`}>
            {conversationTitle}
            {isArchived && (
              <span className="cw-archived-badge" title="此對話已封存">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
                  <path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7z" />
                </svg>
                已封存
              </span>
            )}
          </button>
          <small>{!conversation ? '選擇你的對話夥伴' : (isGroup ? <>{groupCount} 位成員 · {groupStatus.mode === 'custom' ? groupStatus.text : `${onlineCount} 人在線`}{perspectiveLabel && <span className="cw-perspective-indicator"> · 以 {perspectiveLabel} 視角</span>}</> : modelStatus === 'unconfigured' ? (
            <button
              type="button"
              className="cw-status-link"
              onClick={() => navigate('/settings/advanced/providers')}
              aria-label="尚未連結模型，前往設定連接模型"
              data-testid="header-model-status-link"
            >
              尚未連結模型
            </button>
          ) : stateLabel)}</small>
        </div>
      </div>
      {!conversation && showModelPill && (
        <button type="button" className={`cw-model-pill ${MODEL_DOT_CLASS[modelStatus] || ''}`} onClick={onModel}>
          <Icon name="model" />
          <span>{modelPillLabel}</span>
        </button>
      )}
      <div className="cw-pill-actions" data-pet-safe-region="interactive">
        {!conversation && showHeaderNewChat && (
          <div className="cw-plus-menu-wrap" ref={plusMenuRef}>
            <button
              type="button"
              className="cw-pill-button"
              onClick={() => { setQuickTrayOpen(false); setPlusMenuOpen((open) => !open); }}
              aria-label="新增對話"
              aria-haspopup="menu"
              aria-expanded={plusMenuOpen}
            >
              <Icon name="plus" />
            </button>
            {plusMenuOpen && (
              <div className="cw-plus-menu" role="menu" aria-label="新增與通話" data-pet-safe-region="interactive">
                <button type="button" role="menuitem" onClick={() => { setPlusMenuOpen(false); onNewChat(); }}>
                  <Icon name="plus" />
                  <span>新對話</span>
                </button>
                {onGameInvite && (
                  <button type="button" role="menuitem" onClick={() => { setPlusMenuOpen(false); onGameInvite(); }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M7 9h10a4 4 0 0 1 4 4v4a2 2 0 0 1-3.4 1.4L15 16H9l-2.6 2.4A2 2 0 0 1 3 17v-4a4 4 0 0 1 4-4Z"/><path d="M8 12v3M6.5 13.5h3M16 13h.01M18 15h.01"/></svg>
                    <span>邀请一起玩</span>
                  </button>
                )}
                {onBackground && (
                  <button type="button" role="menuitem" onClick={() => { setPlusMenuOpen(false); onBackground(); }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                    <span>更換聊天背景</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {isGroup && onMore && (
          <button
            type="button"
            ref={quickTrayTriggerRef}
            className="cw-pill-button cw-quick-tray-trigger"
            data-testid="group-quick-settings-trigger"
            onClick={toggleQuickTray}
            aria-label="群聊快速設定"
            aria-haspopup="true"
            aria-expanded={quickTrayOpen}
            aria-controls="cw-quick-tray"
          >
            <Icon name="settings" />
          </button>
        )}
        <div className="cw-plus-menu-wrap" ref={moreMenuRef}>
          <button type="button" className="cw-pill-button" onClick={() => { setQuickTrayOpen(false); setMoreMenuOpen((open) => !open); }} aria-label="更多對話操作" aria-haspopup="menu" aria-expanded={moreMenuOpen}><Icon name="more" /></button>
          {moreMenuOpen && <div className="cw-plus-menu" role="menu" aria-label="對話操作" data-pet-safe-region="interactive">
            {isGroup && onMore && <button type="button" role="menuitem" onClick={openFullGroupSettings}><Icon name="user"/><span>群聊資料</span></button>}
            {isGroup && onPerspective && <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onPerspective(); }}><Icon name="book"/><span>閱讀視角</span></button>}
            {onBackground && <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onBackground(); }}><Icon name="theme"/><span>聊天背景</span></button>}
            {onTheme && <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onTheme(); }}><Icon name="spark"/><span>Chat Theme Studio</span></button>}
            {onArchive && <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onArchive(); }}><Icon name="book"/><span>{isArchived ? '取消封存' : '封存對話'}</span></button>}
            {onExport && <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onExport(); }}><Icon name="memory"/><span>匯出對話</span></button>}
            {onClear && <button type="button" className="is-danger" role="menuitem" onClick={() => { setMoreMenuOpen(false); onClear(); }}><Icon name="more"/><span>清除訊息</span></button>}
          </div>}
        </div>
      </div>
      {infoPanel === 'partner' && createPortal(<aside className="cw-character-quick-card" role="dialog" aria-label="角色 Quick Card" data-pet-safe-region="interactive">
        <button type="button" className="cw-header-info-close" onClick={() => setInfoPanel(null)} aria-label="關閉">×</button>
        <div className="cw-character-quick-avatar">{activeCharacter?.avatarAssetId ? <AvatarAssetImage assetId={activeCharacter.avatarAssetId} crop={activeCharacter.avatarCrop} alt={displayPartnerName}/> : <IdentityAvatar identityId="lunaris" size={62} label={displayPartnerName}/>}</div>
        <div><p className="cw-header-info-kicker">{activeCharacter?.folderId === 'core' ? '核心陪伴' : '角色'}</p><h2>{displayPartnerName}</h2><p>{activeCharacter?.subtitle || 'Rune 角色'}</p><small>{stateLabel}{providerLabel ? ` · ${providerLabel}` : ''}</small></div>
        <div className="cw-character-quick-actions"><button type="button" onClick={() => { setInfoPanel(null); setCharacterLibraryOpen(true); }}>查看角色卡</button><button type="button" onClick={() => { setInfoPanel(null); setCharacterLibraryOpen(true); }}>編輯</button><button type="button" onClick={onModel}>模型狀態</button><button type="button" onClick={() => activeCharacter && onStartCharacterChat(activeCharacter.id)}>開始新對話</button></div>
      </aside>, document.body)}
      {infoPanel && infoPanel !== 'partner' && <div className="cw-header-info-backdrop" role="presentation" onClick={() => setInfoPanel(null)}>
        <section className="cw-header-info" role="dialog" aria-modal="true" aria-label={infoPanel === 'user' ? '目前發言身份' : '對話詳情'} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="cw-header-info-close" onClick={() => setInfoPanel(null)} aria-label="關閉">×</button>
          <p className="cw-header-info-kicker">{infoPanel === 'user' ? '目前發言身份' : 'Conversation Details'}</p>
          <h2>{infoPanel === 'user' ? userName : title}</h2>
          <p>{infoPanel === 'user' ? (profile.bio || profile.signature || '使用你的個人身份發言。') : `${conversation?.messages.length || 0} 則訊息 · ${userName} × ${displayPartnerName}`}</p>
        </section>
      </div>}
      <CharacterLibrary open={characterLibraryOpen} onClose={() => setCharacterLibraryOpen(false)} onStartChat={(id) => { setCharacterLibraryOpen(false); onStartCharacterChat(id); }}/>
    </header>
    {/* The tray is anchored as a zero-height sibling of the header instead of a child:
        .cw-pill-header carries its own backdrop-filter, which makes it the backdrop
        root for its descendants — a nested backdrop-filter there could only sample
        the header itself and would never diffuse the messages behind the tray. */}
    {isGroup && conversation && onMore && (
      <div className="cw-quick-tray-anchor" ref={quickTrayAnchorRef}>
        <GroupQuickTray
          open={quickTrayOpen}
          conversation={conversation}
          memberCount={groupCount}
          aiModeLabel={aiModeLabel}
          statusLabel={trayStatusLabel}
          participants={previewParticipants}
          maxHeight={quickTrayMaxHeight}
          reducedMotion={reducedMotion}
          onEditGroup={openFullGroupSettings}
        />
      </div>
    )}
    </>
  );
}

export function ChatWorkspaceEmptyActions({ onPickPartner, onCreatePartner }: ChatWorkspaceEmptyActionsProps) {
  return (
    <div className="cw-empty-state">
      <div className="cw-empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="32" r="28" opacity="0.15" />
          <circle cx="32" cy="26" r="10" />
          <path d="M18 52c0-8 6-14 14-14s14 6 14 14" />
          <path d="M42 22a10 10 0 0 0 10-10M52 12l4-4" opacity="0.5" />
        </svg>
      </div>
      <h2 className="cw-empty-state-title sr-only">還沒有連接對話夥伴</h2>
      <p className="cw-empty-state-desc">
        選擇一位已有角色，<br />或建立新的聊天夥伴。
      </p>
      <div className="cw-empty-state-actions">
        <button type="button" className="cw-primary-action" onClick={onPickPartner}>
          <Icon name="user" />
          <span>選擇現有夥伴</span>
        </button>
        <button type="button" className="cw-empty-secondary-btn" onClick={onCreatePartner}>
          <Icon name="plus" />
          <span>建立新夥伴</span>
        </button>
      </div>
    </div>
  );
}
