import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MessageList } from '@/components/chat/MessageList';
import { ArchiveModal } from '@/components/chat/ArchiveModal';
import { ChatInput, type ChatInputHandle } from '@/components/chat/ChatInput';
import { AttachmentSheet, type ReferenceChip } from '@/components/chat/AttachmentSheet';
import type { GachaContextPayload } from '@/components/chat/ChatGachaPanel';
import { GachaContextChipEditor, GachaContextChipMenu } from '@/components/chat/GachaContextChipMenu';
import { GroupProfileDrawer, PerspectiveSheet, SpeakerSheet } from '@/components/chat/GroupChatPanels';
import { IdentityAvatar, NarratorAvatar } from '@/components/chat/ConversationAvatars';
import { useAppStore, selectPartnerDisplayName, selectAgentDisplayName } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { useToiletRiskStore } from '@/store/useToiletRiskStore';
import { saveAsset } from '@/store/assets';
import type { RecordedVoice } from '@/hooks/useVoiceRecorder';
import { canSendVoiceDuration, getVoiceMessageText } from '@/utils/voiceMessage';
import { buildRecordedVoicePayload } from '@/utils/scriptedVoice';
import { runTtsPipeline } from '@/utils/ttsClient';
import { useCallStore } from '@/store/useCallStore';
import { useVoiceTextStore } from '@/store/useVoiceTextStore';
import type { VoiceMessagePayload } from '@/types';
import { t } from '@/i18n';
import { resolveConversationPerspective, resolvePerspectiveReplyLabel } from '@/features/groupChat/perspective';

import { ContextDrawer } from '@/components/chat/ContextDrawer';
import { useLunarisPersonality, computeEmotion, emotionBubbleCSS, type LunarisEmotionV3 } from '@/utils/lunarisPersonality';
import { updateFromAssistantReply, getCompanionState } from '@/utils/companionStateEngine';
import { createRunePostReplySnapshot, type RunePostReplySnapshot } from '@/features/chat/runePostReplyState';
import { resolveDirectChatCounterpartTitle } from '@/features/chat/headerIdentity';
import { useMemoryVault } from '@/store/useMemoryVault';
import { parseExpense, type ParsedExpense } from '@/utils/expenseParser';
import { ChatLedgerConfirmCard } from '@/components/chat/ChatLedgerConfirmCard';
import { ChatEngineDrawer } from '@/components/chat/ChatEngineDrawer';
import { ModelPopover } from '@/components/chat/ModelPopover';
import { useChatRuntimeStore, estimateTokens } from '@/store/useChatRuntimeStore';
import { buildChatRequest, calculateCost } from '@/ai/requestAdapter';
import { getModelCapabilities } from '@/ai/modelCapabilities';
import type { CompanionMode, InitiativeLevel } from '@/types';
import {
  buildReferenceItems,
  buildAutoPreviewItems,
  buildMemoryPreviewItems,
  computeContextBudget,
  buildContextTracePayload,
  type ContextSnapshot,
  type ContextTracePayload,
} from '@/ai/contextPreview';
import {
  ChatWorkspace,
  ChatWorkspaceEmptyActions,
  ChatWorkspaceHeader,
} from '@/pages/Chat/ChatWorkspace';
import { PartnerPickerDialog } from '@/components/chat/PartnerOnboarding/PartnerPickerDialog';
import { PartnerCreatorSheet } from '@/components/chat/PartnerOnboarding/PartnerCreatorSheet';
import type { ChatParticipant, ChatPresenceStatus, Message, TextMessage } from '@/types';
import { selectEffectiveChatBackground } from '@/config/chatBackground';
import { useChatBackgroundStore } from '@/store/useChatBackgroundStore';
import { ChatBackgroundModal } from '@/components/chat/ChatBackgroundModal';
import { ChatBackgroundLayer } from '@/components/chat/ChatBackgroundLayer';
import { ChatThemeStudio } from '@/components/chat/ChatThemeStudio';
import { readStashChatThemeNavigationState } from '@/features/stash/chatThemeDraftBridge';
import { chatThemeStyle, useChatThemeStore } from '@/store/useChatThemeStore';
import { DEFAULT_USER_PERSONA_ID, migrateConversationCharacterRefs, useCharacterStore } from '@/store/useCharacterStore';
import { streamWithMcpTools } from '@/ai/mcpToolMiddleware';
import { resolveProviderRequestConfig, resolveChatProvider } from '@/ai/providerRuntime';
import { estimateCost } from '@/ai/costCalculator';
import { buildSystemPrompt } from '@/ai/prompts';
import { buildMemoryContext } from '@/ai/memoryContext';
import { buildReferenceContext } from '@/ai/referenceContext';
import { retrieveRelevantMemories } from '@/ai/retrieveMemories';
import { retrieveRelevantContext } from '@/ai/retrieval';
import { buildCharacterRuntimeContext, assembleCharacterSystemPrompt, resolveCharacterProvider } from '@/features/characters/characterRuntimeContext';
import { buildConvMemoryBlock } from '@/ai/convMemory';

function canMemoryEnterAiContext(): boolean {
  return true;
}

import { RuntimeLogTimeline } from '@/components/agent/RuntimeLogTimeline';
import { type PipelineTraceStep } from '@/components/chat/LunaThinkingTrace';
import type { ChatMessage } from '@/ai/types';
import type { AgentRuntimeLog, AgentRuntimeStep } from '@/types';
import { MessageQueueEngine, calculateHumanDelay } from '@/ai/messageQueue';
import type { ContentPart } from '@/ai/types';
import { resolveVisionProvider } from '@/ai/providerRuntime';
import { getAsset } from '@/store/assets';
import type { QueuedMessage } from '@/ai/messageQueue';
import { publishLunarisPetState } from '@/config/lunarisPetStates';
import { adaptModelEmotion, runtimeEmotionSignal } from '@/features/desktopPet/ModelEmotionAdapter';
import { publishPetEmotion } from '@/store/usePetEmotionStore';
import { ChatEmotionEntry } from '@/components/chat/ChatEmotionEntry';
import { usePresenceStore } from '@/store/usePresenceStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { selectGroupResponders } from '@/utils/groupReplyPolicy';
import { createGomokuState } from '@/features/interactive/gomokuAdapter';
import { useInteractiveStore } from '@/store/useInteractiveStore';
import type { InteractiveAttachment } from '@/features/interactive/types';
import { InteractiveIcon } from '@/features/interactive/InteractiveToolRegistry';
import '@/styles/gomoku-card.css';
import '@/styles/link-preview.css';
import { emitAgentActivity } from '@/features/agentActivity/agentActivityState';
import { ChatCallHost } from '@/components/chat/call/ChatCallHost';
import { useChatCallStore } from '@/store/useChatCallStore';
import { useIdentityStore } from '@/store/useIdentityStore';
import { getEffectiveGroupParticipants, resolveSafeGroupSpeaker, toLegacyParticipantView } from '@/features/groupChat/participants';
import { getVisibleMessages, type MessageDeletionMode } from '@/features/chat/messageVisibility';
/** Split text into natural bursts for multi-message delivery. Returns 1-5 segments. */
function splitIntoBursts(content: string): string[] {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length < 60) return [trimmed];

  // Try paragraph breaks
  const paras = trimmed.split(/\n\n+/).filter((p) => p.trim().length > 15);
  if (paras.length >= 2 && paras.length <= 5) return paras.map((p) => p.trim());

  // Try sentence breaks — group into 2-5 bursts
  const sentences = trimmed.match(/[^。！？\n]+[。！？]?/g);
  if (sentences && sentences.length >= 3) {
    const maxBursts = Math.min(5, Math.ceil(sentences.length / 2));
    const perGroup = Math.ceil(sentences.length / maxBursts);
    const groups: string[] = [];
    for (let i = 0; i < sentences.length && groups.length < maxBursts; i += perGroup) {
      groups.push(sentences.slice(i, i + perGroup).join('').trim());
    }
    if (groups.length >= 2) return groups;
  }

  return [trimmed];
}

type AIState = 'idle' | 'thinking' | 'streaming' | 'error';

// ── MessageActionPopover — floating popover for message actions ──

function MessageActionPopover({
  messageId,
  messages,
  onClose,
  onDelete,
  onReply,
  onAddToTodo,
  onPin,
  onSaveToMemory,
}: {
  messageId: string;
  messages: Message[];
  onClose: () => void;
  onDelete: (msgId: string) => void;
  onReply: (msg: Message) => void;
  onAddToTodo: (text: string) => void;
  onPin: (msgId: string) => void;
  onSaveToMemory: (msgId: string) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const message = messages.find(m => m.id === messageId);

  // Anchor to the rendered bubble without entering message-list layout.
  // Prefer above, flip below when needed, and never cross the composer boundary.
  useLayoutEffect(() => {
    const row = document.getElementById(`msg-${messageId}`);
    const target = row?.querySelector<HTMLElement>('.message-bubble, .message-narrator-body') ?? row;
    const pop = popRef.current;
    if (!target || !pop) { onCloseRef.current(); return; }
    const t = target.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    const margin = 8;
    const gap = 8;
    const composerTop = document.querySelector<HTMLElement>('.chat-composer-shell')?.getBoundingClientRect().top ?? window.innerHeight;
    const availableBottom = Math.min(window.innerHeight - margin, composerTop - margin);

    let x = t.left + (t.width - p.width) / 2;
    x = Math.min(Math.max(x, margin), window.innerWidth - p.width - margin);

    let placement: 'above' | 'below' = 'above';
    let y = t.top - p.height - gap;
    if (y < margin) {
      placement = 'below';
      y = t.bottom + gap;
    }
    y = Math.min(Math.max(y, margin), Math.max(margin, availableBottom - p.height));

    setPos({ x, y, placement });
    requestAnimationFrame(() => pop.querySelector<HTMLButtonElement>('.msg-action-button:not([disabled])')?.focus());
  }, [messageId]);

  useEffect(() => {
    const row = document.getElementById(`msg-${messageId}`);
    row?.classList.add('message-row--action-selected');
    const getButtons = () => Array.from(popRef.current?.querySelectorAll<HTMLButtonElement>('.msg-action-button:not([disabled])') || [])
      .filter(button => button.offsetParent !== null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const buttons = getButtons();
      const index = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
      if (e.key === 'Home') buttons[0]?.focus();
      else if (e.key === 'End') buttons[buttons.length - 1]?.focus();
      else {
        const offset = e.key === 'ArrowRight' ? 1 : -1;
        buttons[(index + offset + buttons.length) % buttons.length]?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      row?.classList.remove('message-row--action-selected');
      row?.focus();
    };
  }, [messageId]);

  useEffect(() => {
    if (!moreOpen) return;
    requestAnimationFrame(() => popRef.current?.querySelector<HTMLButtonElement>('.msg-more-menu button')?.focus());
  }, [moreOpen]);

  if (!message || message.revoked) return null;

  const isText = message.type === 'text';
  const showToast = (msg: string) => {
    const { showToast: st } = useToastStore.getState();
    st(msg);
  };

  return createPortal(
    <div className="msg-popover-overlay" onClick={onClose}>
      <div
        ref={popRef}
        className="msg-popover msg-action-bar"
        role="menu"
        aria-label="訊息操作"
        data-placement={pos?.placement}
        style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, position: 'fixed', visibility: pos ? 'visible' : 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="msg-action-button" onClick={() => { onReply(message); onClose(); }} aria-label="回覆" title="回覆">
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 00-4-4H4" /></svg>
          <span>回覆</span>
        </button>
        {isText && (
          <button type="button" className="msg-action-button" onClick={() => { navigator.clipboard.writeText(message.content).then(() => showToast('已複製')).catch(() => {}); onClose(); }} aria-label="複製" title="複製">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            <span>複製</span>
          </button>
        )}
        <button type="button" className={`msg-action-button${message.pinned ? ' is-active' : ''}`} onClick={() => { onPin(messageId); onClose(); }} aria-label={message.pinned ? '取消釘選' : '釘選訊息'} title={message.pinned ? '取消釘選' : '釘選'}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3L9.5 9.5l-3.5 1 1 3L3 19l2 2 5.5-4 3 1 1-3.5L21 8V3z" /><line x1="9" y1="9.5" x2="12" y2="12.5" /></svg>
          <span>{message.pinned ? '取消釘選' : '釘選'}</span>
        </button>
        {isText && (
          <button type="button" className="msg-action-button" onClick={() => { onAddToTodo(message.content); onClose(); }} aria-label="加入待辦" title="加入待辦">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
            <span>待辦</span>
          </button>
        )}
        <button type="button" className="msg-action-button msg-action-memory" onClick={() => { onSaveToMemory(messageId); onClose(); }} aria-label="加入記憶庫" title="加入記憶庫">
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 5.5h11.8c1 0 1.8.8 1.8 1.8v10.2c0 1-.8 1.8-1.8 1.8H5.5c-1 0-1.8-.8-1.8-1.8V7.3c0-1 .8-1.8 1.8-1.8Z" /><path d="M8 10h8M8 13.5h5" /></svg>
          <span>記憶庫</span>
        </button>
        <button type="button" className="msg-action-button" aria-label="更多訊息操作" title="更多" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
          <span>更多</span>
        </button>
        {moreOpen && (
          <div className="msg-more-menu" role="menu" aria-label="更多訊息操作">
            <button type="button" className="msg-more-item msg-more-memory" onClick={() => { onSaveToMemory(messageId); onClose(); }} aria-label="加入記憶庫">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5h14v14H5z"/><path d="M8 10h8M8 14h5"/></svg><span>加入記憶庫</span>
            </button>
            {message.type === 'voice' && getVoiceMessageText(message) && (
              <button type="button" className="msg-more-item" onClick={() => { useVoiceTextStore.getState().toggle(messageId); onClose(); }} aria-label="語音轉文本">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 11h4M7 14.5h7M13.5 11H17"/></svg><span>轉文本</span>
              </button>
            )}
            <button type="button" className="msg-more-item is-danger" onClick={() => onDelete(messageId)} aria-label="刪除訊息">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg><span>刪除訊息</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [stashThemeBridge, setStashThemeBridge] = useState(() => readStashChatThemeNavigationState(location.state));
  const conversations = useAppStore((s) => s.conversations);
  const characters = useCharacterStore((s) => s.characters);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations],
  );
  // 「有對話」= 真的解析出一個 conversation；stale URL / 尚未選夥伴都視為 onboarding。
  const hasConversation = Boolean(activeConversation);
  const messages = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeConversationId);
    return conv?.messages || [];
  }, [conversations, activeConversationId]);
  const visibleMessages = useMemo(() => getVisibleMessages(messages).filter((m) => !m.archived), [messages]);
  const archivedMessages = useMemo(() => messages.filter((m) => m.archived), [messages]);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const clearConversationMessages = useAppStore((s) => s.clearConversationMessages);
  const deleteMessageForSelf = useAppStore((s) => s.deleteMessageForSelf);
  const deleteMessageForAll = useAppStore((s) => s.deleteMessageForAll);
  const revokeMessage = useAppStore((s) => s.revokeMessage);
  const pinMessage = useAppStore((s) => s.pinMessage);
  const unpinMessage = useAppStore((s) => s.unpinMessage);
  const archiveMessage = useAppStore((s) => s.archiveMessage);
  const archiveConversation = useAppStore((s) => s.archiveConversation);
  const restoreMessage = useAppStore((s) => s.restoreMessage);
  const addTodo = useAppStore((s) => s.addTodo);
  const createConversation = useAppStore((s) => s.createConversation);
  const appendAssistantMessages = useAppStore((s) => s.appendAssistantMessages);
  const appendAssistantMessage = useAppStore((s) => s.appendAssistantMessage);
  const sendText = useAppStore((s) => s.sendText);
  const sendStructuredText = useAppStore((s) => s.sendStructuredText);
  const sendGroupText = useAppStore((s) => s.sendGroupText);
  const setMessageDeliveryStatus = useAppStore((s) => s.setMessageDeliveryStatus);
  const markParticipantRead = useAppStore((s) => s.markParticipantRead);
  const petWidget = useAppStore((s) => s.petWidget);
  const transitionMessageState = useAppStore((s) => s.transitionMessageState);
  const cleanupExpired = useAppStore((s) => s.cleanupExpired);
  const aiConfig = useAppStore((s) => s.aiConfig);
  const providers = useAppStore((s) => s.providers || []);
  const aiRoles = useAppStore((s) => s.aiRoles);
  const chatSettings = useAppStore((s) => s.chatSettings);
  const continuousMessages = chatSettings?.continuousMessages ?? true;
  const burstDelay = chatSettings?.burstDelay ?? 4000;
  const providerState = resolveChatProvider(aiRoles, providers);
  const activeProvider = providerState.provider;
  // ── Phase 1.1: Character model override ──
  const activeConv = useAppStore((s) => s.conversations.find((c) => c.id === s.activeConversationId));
  const charCtx = useMemo(() => buildCharacterRuntimeContext(activeConv?.characterIds?.[0]), [activeConv?.characterIds?.[0]]);
  const charProvider = useMemo(() => resolveCharacterProvider(charCtx, providers, providerState.provider), [charCtx, providers, providerState.provider]);
  const effectiveProvider = charProvider?.provider ?? activeProvider;
  const modelSource = charProvider?.source ?? 'global';
  const profile = useAppStore((s) => s.profile);
  const partner = useAppStore((s) => s.partner);
  const addUsagePoints = useAppStore((s) => s.addUsagePoints);
  const lunaContact = useAppStore((s) => s.chatContacts.find((contact) => contact.id === 'luna'));
  const setChatContactStatus = useAppStore((s) => s.setChatContactStatus);
  const sendImage = useAppStore((s) => s.sendImage);
  const sendSticker = useAppStore((s) => s.sendSticker);
  const sendVoice = useAppStore((s) => s.sendVoice);
  const sleepReceipts = useAppStore((s) => s.sleepReceipts || []);
  const focusSessionLog = useAppStore((s) => s.focusSessionLog || []);
  const memoryEntries = useAppStore((s) => s.memoryEntries || []);
  const showToast = useToastStore((s) => s.showToast);
  const focusStatus = useFocusSessionStore((state) => state.status);
  const setTemporaryPresence = usePresenceStore((state) => state.setTemporaryPresence);
  const chatIdentities = useIdentityStore((state) => state.identities);
  const effectiveGroupParticipants = useMemo(
    () => getEffectiveGroupParticipants(activeConversation, chatIdentities),
    [activeConversation, chatIdentities],
  );
  const effectiveGroupSpeaker = useMemo(
    () => resolveSafeGroupSpeaker(activeConversation, chatIdentities),
    [activeConversation, chatIdentities],
  );
  const effectiveGroupPerspective = useMemo(
    () => resolveConversationPerspective(activeConversation, chatIdentities),
    [activeConversation, chatIdentities],
  );
  const setConversationPerspective = useAppStore((state) => state.setConversationPerspective);
  useEffect(() => {
    if (activeConversation?.kind !== 'group' || !effectiveGroupSpeaker || activeConversation.currentSpeakerParticipantId === effectiveGroupSpeaker.identityId) return;
    useAppStore.setState((state) => ({
      conversations: state.conversations.map((conversation) => conversation.id === activeConversation.id
        ? { ...conversation, currentSpeakerParticipantId: effectiveGroupSpeaker.identityId, updatedAt: Date.now() }
        : conversation),
    }));
  }, [activeConversation, effectiveGroupSpeaker]);
  useEffect(() => {
    if (activeConversation?.kind !== 'group' || !effectiveGroupPerspective || activeConversation.currentPerspectiveParticipantId === effectiveGroupPerspective.identityId) return;
    setConversationPerspective(activeConversation.id, effectiveGroupPerspective.identityId);
  }, [activeConversation, effectiveGroupPerspective, setConversationPerspective]);

  const inputRef = useRef<ChatInputHandle>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const generatingRef = useRef(false);
  const replyFnRef = useRef<() => void>(() => {});
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingUserIds = useRef<Set<string>>(new Set());
  const lastRepliedId = useRef<string | null>(null);
  const lastUserMsg = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const queueEngineRef = useRef<MessageQueueEngine | null>(null);
  const activeAgentRequestRef = useRef<string | null>(null);
  const pendingReferencesRef = useRef<ReferenceChip[]>([]);
  const [attachDataOpen, setAttachDataOpen] = useState(false);
  const [attachmentInitialTab, setAttachmentInitialTab] = useState<'image' | 'sticker' | 'gacha' | undefined>(undefined);
  const [references, setReferences] = useState<ReferenceChip[]>([]);
  const [gachaContexts, setGachaContexts] = useState<GachaContextPayload[]>([]);
  const [gachaReplaceIndex, setGachaReplaceIndex] = useState<number | null>(null);
  const [gachaEditIndex, setGachaEditIndex] = useState<number | null>(null);
  const [interactiveAttachment, setInteractiveAttachment] = useState<InteractiveAttachment | null>(null);
  const [aiState, setAiState] = useState<AIState>('idle');
  const [streamingText, setStreamingText] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

  // Chat call session status — drives composer suppression + header call-button state.
  const callStatus = useChatCallStore((s) => s.session?.status ?? 'idle');
  const callActive = callStatus === 'connecting' || callStatus === 'active' || callStatus === 'ending';
  const [thinkingStep, setThinkingStep] = useState(0);
  const [showProcess, setShowProcess] = useState(false);
  const [lastChatLog, setLastChatLog] = useState<AgentRuntimeLog | null>(null);
  const [pipelineTrace, setPipelineTrace] = useState<PipelineTraceStep[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [typingMessage, setTypingMessage] = useState<QueuedMessage | null>(null);
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const [speakerSheetOpen, setSpeakerSheetOpen] = useState(false);
  const [perspectiveSheetOpen, setPerspectiveSheetOpen] = useState(false);
  const [typingParticipantIds, setTypingParticipantIds] = useState<string[]>([]);
  const groupReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);
  const [partnerCreatorOpen, setPartnerCreatorOpen] = useState(false);
  const [partnerCreatorRole, setPartnerCreatorRole] = useState<'local' | 'ai' | null>(null);
  const [engineDrawerOpen, setEngineDrawerOpen] = useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [modelPopoverRect, setModelPopoverRect] = useState<DOMRect | null>(null);
  const [contextTraces, setContextTraces] = useState<Record<string, ContextTracePayload>>({});
  const [memoryPopupOpen, setMemoryPopupOpen] = useState(false);

  const chatBackgroundSettings = useChatBackgroundStore((state) => state.settings);
  const chatBgResolved = selectEffectiveChatBackground({ conversationId: activeConversationId, settings: chatBackgroundSettings });

  const [bgModalOpen, setBgModalOpen] = useState(false);
  const [themeStudioOpen, setThemeStudioOpen] = useState(false);
  const chatTheme = useChatThemeStore((state) => state.currentTheme);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  useEffect(() => {
    const bridge = readStashChatThemeNavigationState(location.state);
    if (!bridge) return;
    setStashThemeBridge(bridge);
    setThemeStudioOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);
  const closeThemeStudio = useCallback(() => {
    setThemeStudioOpen(false);
    if (!stashThemeBridge) return;
    const stashContext = stashThemeBridge.stashContext;
    setStashThemeBridge(null);
    navigate('/stash', { state: { stashContext } });
  }, [navigate, stashThemeBridge]);
  // Close the action popover when the message list scrolls (popover is fixed-positioned)
  const actionMsgIdRef = useRef(actionMsgId);
  actionMsgIdRef.current = actionMsgId;
  useEffect(() => {
    const el = messageListRef.current;
    if (!el) return;
    const onScroll = () => { if (actionMsgIdRef.current) setActionMsgId(null); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletionMode, setDeletionMode] = useState<MessageDeletionMode | null>(null);
  const [reactMsgId, setReactMsgId] = useState<string | null>(null);
  const deletionTarget = deleteConfirmId ? messages.find((message) => message.id === deleteConfirmId) : undefined;
  const canDeleteForAll = Boolean(deletionTarget && (
    deletionTarget.sender === 'me' || deletionTarget.controlSource === 'user'
  ));
  const deleteForAllLabel = activeConversation?.kind === 'group' ? '為所有人刪除' : '為雙方刪除';
  useEffect(() => {
    if (!deleteConfirmId) return;
    const dialog = document.querySelector<HTMLElement>('.message-delete-dialog');
    const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('input, button:not([disabled])') || []);
    focusable[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeActionMenu(); return; }
      if (event.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [deleteConfirmId]);
  const [isGenerating, setIsGenerating] = useState(false);
  const prevAiStateRef = useRef<AIState>('idle');

  const addRuntimeLog = useAppStore((s) => s.addRuntimeLog);

  const setGenerating = useCallback((next: boolean) => {
    generatingRef.current = next;
    setIsGenerating(next);
  }, []);

  const hasAi = providerState.configured;
  const visionModeRef = useRef(false);

  // Detect mobile viewport
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (focusStatus === 'running' || focusStatus === 'paused') {
      setTemporaryPresence('self', 'busy', focusStatus === 'paused' ? '暫時離開' : '專心中');
    } else {
      setTemporaryPresence('self', 'online');
    }
  }, [focusStatus, setTemporaryPresence]);

  const modelTag = effectiveProvider
    ? [effectiveProvider.name || effectiveProvider.type, effectiveProvider.model].filter(Boolean).join(' · ')
    : null;

  // ── Context Snapshot for UI ──
  const contextSnapshot: ContextSnapshot = useMemo(() => {
    const autoItems = buildAutoPreviewItems({ sleepReceipts, focusSessionLog });
    const aiSafeMemories = memoryEntries.filter(canMemoryEnterAiContext);
    const memPreview = buildMemoryPreviewItems(aiSafeMemories);
    const refItems = buildReferenceItems(references);
    const budget = computeContextBudget(
      references,
      aiSafeMemories.slice(0, 3),
      { sleepReceipts, focusSessionLog, memoryEntries: aiSafeMemories },
      '最近',
    );
    return {
      items: [...refItems, ...memPreview, ...autoItems],
      budget,
    };
  }, [references, sleepReceipts, focusSessionLog, memoryEntries]);

  const contextCount = contextSnapshot.items.length;

  // ── Conversation memory label for header ──
  const activeConvMemory = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeConversationId);
    return conv?.summary;
  }, [conversations, activeConversationId]);
  const memoryLabel = activeConvMemory?.topics?.length
    ? `本對話記憶（${activeConvMemory.topics.slice(0, 2).join('、')}）`
    : activeConvMemory
      ? '本對話記憶'
      : undefined;

  const activeConversationTitle = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeConversationId);
    const personaName = selectPartnerDisplayName(partner);
    if (!conv) return resolveDirectChatCounterpartTitle(null, characters, personaName);
    if (conv.customTitle?.trim()) return conv.customTitle.trim();
    if (conv.kind === 'group') return conv.title?.trim() || '群組對話';
    return resolveDirectChatCounterpartTitle(conv, characters, personaName);
  }, [conversations, activeConversationId, partner, characters]);
  const activeConversationArchived = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeConversationId);
    return conv?.archived === true;
  }, [conversations, activeConversationId]);

  const handleNewChat = useCallback(() => {
    const id = createConversation();
    navigate(`/chat/${id}`);
  }, [createConversation, navigate]);

  useEffect(() => {
    const migrated = migrateConversationCharacterRefs(useAppStore.getState().conversations);
    if (migrated.some((item, index) => item !== useAppStore.getState().conversations[index])) useAppStore.setState({ conversations: migrated });
  }, []);

  const handleStartCharacterChat = useCallback((characterId: string) => {
    const character = useCharacterStore.getState().characters.find((item) => item.id === characterId);
    const store = useAppStore.getState();
    const existing = store.conversations.find((c) => (
      c.kind !== 'group' && !c.archived && (c.characterIds || []).includes(characterId)
    ));
    const joinConversation = (convId: string) => {
      store.setActiveConversation(convId);
      navigate(`/chat/${convId}`);
    };
    if (existing) { joinConversation(existing.id); return; }
    const id = createConversation();
    useAppStore.setState((state) => ({ conversations: state.conversations.map((conversation) => conversation.id === id ? { ...conversation, title: character?.name || '新對話', autoTitle: true, userPersonaId: DEFAULT_USER_PERSONA_ID, characterIds: [characterId] } : conversation) }));
    if (character) useCharacterStore.getState().updateCharacter(character.id, { lastUsedAt: Date.now() });
    joinConversation(id);
  }, [createConversation, navigate]);

  const handleExportConversation = useCallback(() => {
    if (!activeConversation) return;
    const blob = new Blob([JSON.stringify(activeConversation, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lunartide-chat-${activeConversation.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [activeConversation]);

  const handleClearConversation = useCallback(() => {
    if (!activeConversationId || !window.confirm('確定清除這個對話中的所有訊息？')) return;
    clearConversationMessages(activeConversationId);
  }, [activeConversationId, clearConversationMessages]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      queueEngineRef.current?.clear();
      if (groupReplyTimerRef.current) clearTimeout(groupReplyTimerRef.current);
      if (activeAgentRequestRef.current) {
        emitAgentActivity({ type: 'request_aborted', requestId: activeAgentRequestRef.current });
        activeAgentRequestRef.current = null;
      }
      publishLunarisPetState('idle');
    };
  }, []);

  const isBusy = !activeConversationId || aiState === 'thinking' || aiState === 'streaming';
  const composerDisabled = isBusy;

  useEffect(() => {
    const previous = prevAiStateRef.current;
    let successTimer: ReturnType<typeof setTimeout> | null = null;

    if (aiState === 'thinking') { publishLunarisPetState('thinking'); publishPetEmotion(runtimeEmotionSignal('generating')); }
    else if (aiState === 'streaming') { publishLunarisPetState('typing'); publishPetEmotion(runtimeEmotionSignal('generating')); }
    else if (aiState === 'error') { publishLunarisPetState('error'); publishPetEmotion(runtimeEmotionSignal('error'), true); }
    else if (previous === 'thinking' || previous === 'streaming') {
      publishLunarisPetState('success'); publishPetEmotion(runtimeEmotionSignal('success'), true);
      successTimer = setTimeout(() => publishLunarisPetState('idle'), 1800);
    } else {
      publishLunarisPetState('idle');
    }

    prevAiStateRef.current = aiState;
    return () => {
      if (successTimer) clearTimeout(successTimer);
    };
  }, [aiState]);

  useEffect(() => {
    if (petWidget?.manualMoodOverride) return;
    const nextMood = aiState === 'error' ? 'error' : isBusy ? 'thinking' : 'idle';
    if (petWidget?.currentMood === nextMood) return;
    updateSettings({
      petWidget: {
        ...petWidget,
        visible: petWidget?.visible !== false,
        currentMood: nextMood,
        manualMoodOverride: false,
        moodImages: petWidget?.moodImages || {},
      },
    });
  }, [aiState, isBusy, petWidget, updateSettings]);

  useEffect(() => {
    if (aiState === 'idle' || aiState === 'error') {
      visionModeRef.current = false;
    }
  }, [aiState]);

  // ── Broadcast AI state for Dynamic Island ──
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('lunartide:ai-state', {
      detail: { state: aiState, step: thinkingStep },
    }));
  }, [aiState, thinkingStep]);
  useEffect(() => {
    if (conversationId && !(stashThemeBridge && conversationId === 'theme-studio')) {
      const state = useAppStore.getState();
      if (conversationId !== state.activeConversationId) {
        state.setActiveConversation(conversationId);
      }
    }
  }, [conversationId, stashThemeBridge]);

  /* Auto-mark active conversation as read on mount/switch */
  useEffect(() => {
    const store = useAppStore.getState();
    if (conversationId && store.activeConversationId === conversationId) {
      store.markConversationRead(conversationId);
    }
  }, [conversationId]);

  /* Read receipt: mark message as read when visible in viewport */
  const handleMessageVisible = useCallback((msgId: string) => {
    transitionMessageState(msgId, 'readByUser');
  }, [transitionMessageState]);

  /* Ephemeral message cleanup — runs every 30s */
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupExpired();
    }, 30000);
    return () => clearInterval(interval);
  }, [cleanupExpired]);

  const savedPresence = lunaContact?.status || 'online';

  const [compPrefs, setCompPrefs] = useState<{ companionMode: CompanionMode; initiativeLevel: InitiativeLevel; allowProactiveNudge: boolean; allowMoodFromChat: boolean }>(() => {
    try {
      const stored = localStorage.getItem('lunartide_companion_prefs');
      if (stored) return { ...JSON.parse(stored) };
    } catch {}
    return { companionMode: 'gentle' as CompanionMode, initiativeLevel: 'medium' as InitiativeLevel, allowProactiveNudge: true, allowMoodFromChat: true };
  });
  const updateCompPrefs = useCallback((patch: Partial<typeof compPrefs>) => {
    setCompPrefs(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem('lunartide_companion_prefs', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const [companionStateSnap, setCompanionStateSnap] = useState(() => getCompanionState());
  const [postReplySnapshot, setPostReplySnapshot] = useState<RunePostReplySnapshot | null>(null);
  const dismissPostReplySnapshot = useCallback(() => setPostReplySnapshot(null), []);
  const syncCompanionState = useCallback(() => {
    const next = getCompanionState();
    setCompanionStateSnap(next);
    return next;
  }, []);
  const completePostReplyPresentation = useCallback((messageId: string, replyText: string, userText: string) => {
    if (compPrefs.allowMoodFromChat) updateFromAssistantReply(replyText, userText);
    const currentState = syncCompanionState();
    setPostReplySnapshot(createRunePostReplySnapshot(messageId, currentState));
  }, [compPrefs.allowMoodFromChat, syncCompanionState]);

  useEffect(() => {
    setPostReplySnapshot(null);
  }, [activeConversationId]);

  /* ── Memory Vault ── */
  const vault = useMemoryVault();

  /* ── LUNARIS Personality System v3 ── */
  const { personality, drift } = useLunarisPersonality(messages);

  const emotionV3: LunarisEmotionV3 = useMemo(
    () => computeEmotion(personality, drift, aiState),
    [personality, drift, aiState],
  );

  const emotionCSS = useMemo(() => {
    return emotionBubbleCSS(emotionV3, personality.tone);
  }, [emotionV3, personality.tone]);

  // --- Message Actions ---
  const openActionMenu = useCallback((msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    setActionMsgId(msgId);
    setDeleteConfirmId(null);
  }, [messages]);

  const closeActionMenu = () => { setActionMsgId(null); setDeleteConfirmId(null); setDeletionMode(null); };

  const handleMenuDelete = useCallback((msgId: string) => {
    setActionMsgId(null);
    setDeleteConfirmId(msgId);
    setDeletionMode(null);
  }, []);

  const handleReactMsg = useCallback((msgId: string) => {
    setReactMsgId(msgId);
  }, []);

  const handleRevokeMsg = useCallback((msgId: string) => {
    revokeMessage(msgId);
    showToast('已撤回訊息');
  }, [revokeMessage, showToast]);

  const handleAddToTodo = useCallback((text: string) => {
    const today = new Date().toISOString().slice(0, 10);
    addTodo({ title: text, date: today, priority: 'medium', category: 'other', repeat: 'none' });
    showToast('已新增到待辦');
  }, [addTodo, showToast]);

  const handleDeleteMsg = () => {
    if (!deleteConfirmId || !deletionMode) return;
    if (deletionMode === 'all') deleteMessageForAll(deleteConfirmId, 'local-user');
    else deleteMessageForSelf(deleteConfirmId);
    showToast(deletionMode === 'all' ? '訊息已為所有適用的參與者刪除' : '訊息已從你的畫面移除');
    closeActionMenu();
  };

  // ── Batch pending reply system ──

  /** Trigger Luna reply for all pending user messages. Called by idle timer / wake btn / question mark. */
  const triggerLunaReply = useCallback(() => {
    if (generatingRef.current) return;
    const msgs = useAppStore.getState().getActiveMessages();

    // Collect pending user messages (new messages since last reply)
    const pendingIds = Array.from(pendingUserIds.current);
    if (pendingIds.length === 0) return;

    // Filter to only un-replied messages
    const unreplied = pendingIds.filter((id) => id !== lastRepliedId.current);
    if (unreplied.length === 0) return;

    // Find the actual message objects (text + image)
    const pendingMsgs = msgs.filter((m) => unreplied.includes(m.id) && m.sender === 'me' && (m.type === 'text' || m.type === 'image'));
    if (pendingMsgs.length === 0) {
      // All pending messages were deleted/revoked — clean up
      pendingUserIds.current.clear();
      setPendingCount(0);
      return;
    }

    // AI consumption: mark all consumed user messages as seen by AI
    for (const pm of pendingMsgs) {
      transitionMessageState(pm.id, 'consumedByAI');
    }

    // Merge all pending user text messages into one context string
    const pendingTextMsgs = pendingMsgs.filter((m): m is import('@/types').TextMessage & { type: 'text' } => m.type === 'text');
    const combinedText = pendingTextMsgs.map((m) => m.content).join('\n');
    const lastPendingId = pendingMsgs[pendingMsgs.length - 1].id;

    // Clear pending
    pendingUserIds.current.clear();
    setPendingCount(0);
    lastRepliedId.current = lastPendingId;
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }

    setGenerating(true);

    // Mark AI participant as having read the user's message (read receipt)
    if (activeConversationId) {
      const lastUserMsgId = pendingMsgs[pendingMsgs.length - 1].id;
      markParticipantRead(activeConversationId, 'luna', lastUserMsgId);
    }

    // ── No AI 模型 → single degradation message ──
    if (!hasAi || !effectiveProvider) {
      setAiState('error');
      setGenerating(false);
      showToast('請先在設定中啟用 AI 模型');
      return;
    }
    const totalThinkMs = 600;
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    activeAgentRequestRef.current = requestId;
    emitAgentActivity({ type: 'request_started', requestId });
    const providerName = hasAi && activeProvider ? activeProvider.name : 'local';
    const providerModel = hasAi && activeProvider ? activeProvider.model : 'luna-local';

    /* Build pipeline trace (terminal-style log) */
    const trace: PipelineTraceStep[] = [
      { id: 'memory', label: '記憶搜尋', status: 'pending' },
      { id: 'worldbook', label: '世界書匹配', status: 'pending' },
      { id: 'skill', label: '技能匹配', status: 'pending' },
      { id: 'context', label: '上下文構建', status: 'pending' },
      { id: 'provider', label: 'Provider', status: 'pending' },
      { id: 'generating', label: '生成回覆', status: 'pending' },
    ];
    // Step 1: Memory Search starts immediately
    trace[0].status = 'running';
    setPipelineTrace([...trace]);

    // Step 2-3: Worldbook + Skill — quick skip (not yet implemented)
    setTimeout(() => {
      trace[0].status = 'done';
      trace[0].detail = '搜尋相關記憶中…';
      trace[1].status = 'skipped';
      trace[1].detail = '未命中世界書';
      trace[2].status = 'skipped';
      trace[2].detail = '未套用技能';
      trace[3].status = 'running';
      setPipelineTrace([...trace]);
    }, 260);

    // Build thinking log (for post-hoc display)
    const initialSteps: AgentRuntimeStep[] = [
      { id: 's1', label: 'read_context', status: 'done', startedAt, finishedAt: startedAt + 40, detail: `讀取 ${pendingMsgs.length} 則待回覆訊息` },
      { id: 's2', label: 'read_memory', status: 'active', startedAt: startedAt + 40 },
      { id: 's3', label: 'read_book', status: 'pending' },
      { id: 's4', label: 'call_provider', status: 'pending' },
      { id: 's5', label: 'generate_reply', status: 'pending' },
      { id: 's6', label: 'complete', status: 'pending' },
    ];
    const roundLog: AgentRuntimeLog = {
      id: requestId, requestId, messageId: crypto.randomUUID(),
      presetId: 'chat', providerId: providerName, model: providerModel,
      startedAt, status: 'thinking',
      visibleReasoningSummary: `Luna 正在回覆 ${pendingMsgs.length} 則訊息（共 ${combinedText.length} 字）`,
      steps: initialSteps, toolCalls: [],
      tokenUsage: { input: 0, output: 0, total: 0, estimated: true },
      costEstimate: 0, source: 'chat',
    };
    setLastChatLog(roundLog);
    addRuntimeLog(roundLog);

    setAiState('thinking');
    setThinkingStep(0);
    setStreamingText('');

    // After brief thinking delay, start streaming
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setAiState('streaming');

      if (hasAi && activeProvider) {
        const streamProviderReply = async () => {
          const currentState = useAppStore.getState();
          const currentAiRoles = currentState.aiRoles;
          const currentProviders = currentState.providers || [];

          // ── Vision Runtime Router ──
          const hasImages = pendingMsgs.some((m) => m.type === 'image');
          visionModeRef.current = hasImages;
          const visionState = hasImages ? resolveVisionProvider(currentAiRoles, currentProviders) : null;
          const runtimeProvider = visionState?.provider || effectiveProvider;

          if (!runtimeProvider) {
            setAiState('error');
            setGenerating(false);
            showToast('請先在設定中啟用 AI 模型');
            return;
          }

          const aiEligibleMemories = (currentState.memoryEntries || []).filter(canMemoryEnterAiContext);
          emitAgentActivity({ type: 'memory_retrieval_started', requestId });
          const retrieval = aiConfig.memoryContextEnabled === false
            ? { entries: [], mode: 'skip' as const }
            : retrieveRelevantMemories({
                entries: aiEligibleMemories,
                currentMessage: combinedText,
              });
          const autoContext = retrieveRelevantContext(combinedText, {
            sleepReceipts: currentState.sleepReceipts || [],
            focusSessionLog: currentState.focusSessionLog || [],
            memoryEntries: aiEligibleMemories,
          });
          const activeConv = currentState.conversations.find((c: { id: string }) => c.id === currentState.activeConversationId);

          // ── Phase 1.1: Character Runtime Context ──
          const charCtx = buildCharacterRuntimeContext(activeConv?.characterIds?.[0]);
          const characterSystemPrompt = assembleCharacterSystemPrompt(
            charCtx,
            aiConfig.systemPrompt,   // conversation-specific instructions
            buildMemoryContext(retrieval.entries), // character memory
          );
          const convMemory = activeConv?.summary
            ? buildConvMemoryBlock(activeConv.summary)
            : '';
          const systemPrompt = characterSystemPrompt
            ? [
                characterSystemPrompt,
                buildReferenceContext(pendingReferencesRef.current),
                autoContext,
                convMemory,
              ].filter(Boolean).join('\n\n')
            : buildSystemPrompt(
                aiConfig.systemPrompt,
                buildMemoryContext(retrieval.entries),
                buildReferenceContext(pendingReferencesRef.current),
                autoContext,
                convMemory,
              );

          // ── Build context trace for this reply ──
          const replyTrace = buildContextTracePayload(
            pendingReferencesRef.current,
            retrieval.entries.length,
            autoContext,
          );
          pendingReferencesRef.current = [];

          const memoryCount = retrieval.entries.length;

          // ── Build chat messages: history (text-only) + current multimodal ──
          const chatMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

          // History: text messages only
          const windowSize = Math.max(1, runtimeProvider.contextMessageLimit);
          const contextMessages = currentState.getActiveMessages().slice(-windowSize);
          for (const message of contextMessages) {
            if (message.type !== 'text') continue;
            if (message.sender !== 'me' && message.sender !== 'assistant') continue;
            chatMessages.push({
              role: message.sender === 'me' ? 'user' : 'assistant',
              content: message.content,
            });
          }

          // Current multimodal message: text + images
          const pendingImages = pendingMsgs.filter((m) => m.type === 'image');
          const userContentParts: ContentPart[] = [];
          if (combinedText) {
            userContentParts.push({ type: 'text', text: combinedText });
          }
          for (const imgMsg of pendingImages) {
            const blob = await getAsset((imgMsg as import('@/types').ImageMessage).assetId).catch(() => null);
            if (blob) {
              const buf = await blob.arrayBuffer();
              const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
              const mime = (imgMsg as import('@/types').ImageMessage).fileType || 'image/png';
              userContentParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } });
            }
          }
          if (userContentParts.length > 0) {
            chatMessages.push({ role: 'user', content: userContentParts });
          }

          const providerName = runtimeProvider.name || 'AI';
          const providerModel = runtimeProvider.model || 'unknown';

          let fullContent = '';
          let streamUsage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; estimated: boolean } | null = null;
          try {
            /* Start generating */
            trace[4].status = 'done';
            trace[5].status = 'running';
            trace[5].detail = '等待回覆…';
            setPipelineTrace([...trace]);

            /* Update pipeline trace */
            trace[0].status = 'done';
            trace[0].detail = memoryCount > 0 ? `找到 ${memoryCount} 條相關記憶` : '未找到相關記憶';
            trace[3].status = 'done';
            trace[3].detail = `${contextMessages.length} 則上下文 · ${pendingMsgs.length} 則訊息`;
            trace[4].status = 'running';
            trace[4].detail = `${providerName} · ${providerModel}${hasImages ? ' (Vision)' : ''}`;
            setPipelineTrace([...trace]);

            const generator = streamWithMcpTools(
              chatMessages,
              await resolveProviderRequestConfig(runtimeProvider, systemPrompt),
              undefined,
              {
                onToolStart: (toolCall) => emitAgentActivity({
                  type: toolCall.function.name.includes('search') ? 'web_search_started' : 'tool_call_started',
                  requestId,
                  toolId: toolCall.id,
                }),
                onToolComplete: (toolCall) => emitAgentActivity({ type: 'tool_call_completed', requestId, toolId: toolCall.id }),
              },
            );
            let streamStarted = false;
            for await (const chunk of generator) {
              fullContent += chunk.content;
              setStreamingText(fullContent);
              if (chunk.usage) {
                streamUsage = chunk.usage;
              }
              if (!streamStarted && chunk.content) {
                streamStarted = true;
                emitAgentActivity({ type: 'response_stream_started', requestId });
                emitAgentActivity({ type: 'first_body_token', requestId });
                trace[5].detail = '接收資料流中…';
                setPipelineTrace([...trace]);
              }
            }
            if (!fullContent.trim()) throw new Error('AI 未回傳內容');
            const emotionResult = adaptModelEmotion({ content: fullContent });
            fullContent = emotionResult.cleanContent;
            publishPetEmotion(emotionResult.signal);
            setStreamingText('');

            // Split into segments and deliver
            const segments = splitIntoBursts(fullContent);
            const totalOutputLen = fullContent.length;
            const finishedAt = Date.now();
            const latencyMs = finishedAt - startedAt;

            const finalizeLog = (segCount: number, actualFinishedAt: number) => {
              const inTokens = streamUsage?.inputTokens
                ?? Math.ceil(chatMessages.reduce((sum, message) => sum + message.content.length, 0) / 3);
              const outTokens = streamUsage?.outputTokens
                ?? Math.ceil(totalOutputLen / 3);
              const realTokens = streamUsage !== null && !streamUsage.estimated;
              const cost = estimateCost(runtimeProvider.type, providerModel, inTokens, outTokens);
              const completedLog: AgentRuntimeLog = {
                ...roundLog,
                finishedAt: actualFinishedAt,
                status: 'completed',
                visibleReasoningSummary: `Luna 已透過 ${providerName} 完成回覆（${segCount} 則· ${latencyMs}ms）`,
                steps: [
                  { id: 's1', label: 'read_context', status: 'done', detail: `使用最近 ${contextMessages.length} 則上下文訊息` },
                  { id: 's2', label: 'read_memory', status: 'done', detail: `帶入 ${retrieval.entries.length} 則相關記憶` },
                  { id: 's3', label: 'read_book', status: 'skipped', detail: '此回合未帶入作品庫內容' },
                  { id: 's4', label: 'call_provider', status: 'done', detail: `${providerName} · ${providerModel} · ${latencyMs}ms` },
                  { id: 's5', label: 'generate_reply', status: 'done', detail: `${segCount} 則回覆 · ${totalOutputLen} 字 · ${inTokens}+${outTokens} tokens` },
                  { id: 's6', label: 'complete', status: 'done' },
                ],
                tokenUsage: { input: inTokens, output: outTokens, total: inTokens + outTokens, estimated: !realTokens },
                costEstimate: cost,
              };
              setLastChatLog(completedLog);
              addRuntimeLog(completedLog);
                addUsagePoints(2);
                setAiState('idle');
                emitAgentActivity({ type: 'request_completed', requestId });
                activeAgentRequestRef.current = null;
                // Record in chat runtime store for diagnostics
                if (activeConversationId) {
                  useChatRuntimeStore.getState().recordRequest(activeConversationId, {
                    id: crypto.randomUUID(),
                    provider: providerName,
                    model: providerModel,
                    inputTokens: inTokens,
                    outputTokens: outTokens,
                    cachedInputTokens: streamUsage?.cachedInputTokens,
                    latencyMs,
                    estimatedCost: cost,
                    usedSummary: false,
                    rawRoundsUsed: contextMessages.length,
                    longTermMemoriesUsed: memoryCount,
                    timestamp: Date.now(),
                  });
                }
                /* Mark generating step done */
                trace[5].status = 'done';
                trace[5].detail = `${latencyMs}ms · ${outTokens} tokens`;
                setPipelineTrace([...trace]);
            };

            const appendLunaMessages = () => {
              const msgs = segments.map((content) => ({
                id: crypto.randomUUID(),
                sender: 'assistant' as const,
                type: 'text' as const,
                content,
                time: new Date().toISOString(),
                status: 'sent' as const,
                memoryContextUsed: retrieval.entries.length > 0,
                memoryContextMode: retrieval.mode,
                memoryContextCount: retrieval.entries.length,
              }));
              appendAssistantMessages(msgs as TextMessage[]);
              // Store context trace for each segment
              setContextTraces((prev) => {
                const next = { ...prev };
                msgs.forEach((m) => { next[m.id] = replyTrace; });
                return next;
              });
              return msgs[msgs.length - 1].id;
            };

            if (continuousMessages && segments.length > 1) {
              // Use queue engine for human-like segmented delivery
              const queued: QueuedMessage[] = segments.map((content) => ({
                id: crypto.randomUUID(),
                type: 'text',
                content,
                delayMs: calculateHumanDelay(content),
                metadata: {
                  memoryContextUsed: retrieval.entries.length > 0,
                  memoryContextMode: retrieval.mode,
                  memoryContextCount: retrieval.entries.length,
                },
              }));

              const engine = new MessageQueueEngine({
                onTypingStart: (msg) => setTypingMessage(msg),
                onTypingEnd: () => setTypingMessage(null),
                onDeliver: (msg) => {
                  appendAssistantMessage({
                    id: msg.id,
                    sender: 'assistant' as const,
                    type: 'text' as const,
                    content: msg.content,
                    time: new Date().toISOString(),
                    status: 'sent' as const,
                    memoryContextUsed: !!msg.metadata?.memoryContextUsed,
                    memoryContextMode: msg.metadata?.memoryContextMode as 'keyword' | 'trigger' | 'skip' | undefined,
                    memoryContextCount: msg.metadata?.memoryContextCount as number | undefined,
                  } as TextMessage);
                  // Store context trace
                  setContextTraces((prev) => ({ ...prev, [msg.id]: replyTrace }));
                },
                onQueueFinish: () => {
                  setTypingMessage(null);
                  finalizeLog(segments.length, Date.now());
                  setGenerating(false);
                  completePostReplyPresentation(queued[queued.length - 1].id, segments.join(' '), lastUserMsg.current || '');
                },
                onInterrupted: () => {
                  setTypingMessage(null);
                  setAiState('idle');
                  setGenerating(false);
                  emitAgentActivity({ type: 'request_aborted', requestId });
                  activeAgentRequestRef.current = null;
                },
              });

              queueEngineRef.current = engine;
              engine.enqueue(queued);
            } else {
              const finalMessageId = appendLunaMessages();
              finalizeLog(segments.length, finishedAt);
              setGenerating(false);
              completePostReplyPresentation(finalMessageId, segments.join(' '), lastUserMsg.current || '');
            }
          } catch (error) {
            /* Update pipeline trace on error */
            trace[4].status = trace[4].status === 'running' ? 'done' : trace[4].status;
            trace[5].status = 'done';
            trace[5].detail = '連線失敗';
            setPipelineTrace([...trace]);

            const message = error instanceof Error ? error.message : 'AI 請求失敗';
            const failedAt = Date.now();
            const failedLog: AgentRuntimeLog = {
              ...roundLog,
              finishedAt: failedAt,
              status: 'failed',
              error: message,
              visibleReasoningSummary: `${providerName} 連線失敗`,
              steps: initialSteps.map((step) => (
                step.id === 's4'
                  ? { ...step, status: 'error' as const, finishedAt: failedAt, detail: message }
                  : step.status === 'pending' || step.status === 'active'
                    ? { ...step, status: 'skipped' as const }
                    : step
              )),
            };
            setLastChatLog(failedLog);
            addRuntimeLog(failedLog);
            setAiState('error');
            emitAgentActivity({ type: 'request_failed', requestId });
            activeAgentRequestRef.current = null;
            showToast(message);
            setTimeout(() => setAiState('idle'), 1800);
          } finally {
            setStreamingText('');
            setThinkingStep(0);
            if (!queueEngineRef.current?.isRunning) {
              setGenerating(false);
            }
          }
        };
        void streamProviderReply();
        return;
      }

    }, totalThinkMs);
  }, [addUsagePoints, updateSettings, transitionMessageState, activeProvider, hasAi, addRuntimeLog, aiConfig.memoryContextEnabled, aiConfig.systemPrompt, showToast, appendAssistantMessage, appendAssistantMessages, continuousMessages, setGenerating, completePostReplyPresentation]);

  // Sync ref
  useEffect(() => { replyFnRef.current = triggerLunaReply; }, [triggerLunaReply]);

  // ── Idle / continuous message timer: reset on each send, trigger after delay ──
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const delay = continuousMessages ? burstDelay : 1800;
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      triggerLunaReply();
    }, delay);
  }, [triggerLunaReply, continuousMessages, burstDelay]);

  const [pendingCards, setPendingCards] = useState<Array<{ id: string; expense: ParsedExpense; confirmed?: boolean }>>([]);
  const addLedgerEntry = useAppStore((s) => s.addLedgerEntry);

  const handleSend = useCallback((text: string) => {
    // Local, privacy-bounded hook: only explicit outgoing wording is inspected.
    useToiletRiskStore.getState().inferFromText(text);
    if (activeConversation?.kind === 'group') {
      const effectiveParticipants = getEffectiveGroupParticipants(activeConversation, chatIdentities);
      const participants = effectiveParticipants.map(toLegacyParticipantView);
      const effectiveSpeaker = resolveSafeGroupSpeaker(activeConversation, chatIdentities);
      const speaker = effectiveSpeaker ? toLegacyParticipantView(effectiveSpeaker) : undefined;
      if (!speaker) return;
      const replyToData = replyTarget ? {
        id: replyTarget.id,
        senderName: effectiveParticipants.find((participant) => participant.identityId === replyTarget.senderParticipantId)?.displayName || replyTarget.senderSnapshot?.displayName || (replyTarget.sender === 'me' ? '我' : '未知成員'),
        textPreview: (replyTarget.type === 'text' ? replyTarget.content : `[ ${replyTarget.type} ]`).slice(0, 60),
      } : undefined;
      const roundId = crypto.randomUUID();
      const sentId = sendGroupText(text, speaker.id, speaker.id === 'narrator' ? 'system' : 'user', replyToData, roundId);
      if (interactiveAttachment) {
        useAppStore.getState().updateMessage(sentId, { interactive: interactiveAttachment });
        setInteractiveAttachment(null);
      }
      setReplyTarget(null);
      setAttachDataOpen(false);
      setMessageDeliveryStatus(sentId, 'sent', [speaker.id]);

      const policy = activeConversation.replyPolicy || 'mention';
      const responders = selectGroupResponders({
        conversation: activeConversation,
        identities: chatIdentities,
        participants,
        speakerParticipantId: speaker.id,
        text,
        policy,
        messageCount: activeConversation.messages.length,
        presenceByParticipantId: Object.fromEntries(participants.map((participant) => [participant.id, usePresenceStore.getState().getPresence(participant.id).visiblePresenceStatus])),
      });
      if (responders.length === 0) {
        setMessageDeliveryStatus(sentId, 'delivered', participants.map((participant) => participant.id));
        return;
      }
      setTypingParticipantIds(responders.map((participant) => participant.id));
      setMessageDeliveryStatus(sentId, 'delivered', participants.map((participant) => participant.id));
      if (groupReplyTimerRef.current) clearTimeout(groupReplyTimerRef.current);
      groupReplyTimerRef.current = setTimeout(() => {
        const concise = text.replace(/@\S+/g, '').trim().slice(0, 46);
        const replies: Record<string, string> = {
          lunaris: `我有在聽。「${concise || '這件事'}」先不急著下結論，我們把最重要的那一點找出來。`,
          clawd: `我先把「${concise || '這件事'}」拆成可以繼續的下一步。`,
          mira: `我想從另一個角度看「${concise || '這件事'}」：你現在最在意的是哪個部分？`,
        };
        responders.forEach((responder) => {
          markParticipantRead(activeConversationId!, responder.id, sentId);
          sendGroupText(replies[responder.id] || `我看到了。關於「${concise || '這件事'}」，我們繼續。`, responder.id, 'ai', undefined, roundId);
        });
        setMessageDeliveryStatus(sentId, 'read', participants.map((participant) => participant.id));
        setTypingParticipantIds([]);
        groupReplyTimerRef.current = null;
      }, 900);
      return;
    }
    // Interrupt: if queue engine is running (Luna is sending segmented messages), cancel it
    if (queueEngineRef.current?.isRunning) {
      queueEngineRef.current.clear();
      queueEngineRef.current = null;
      setTypingMessage(null);
      setGenerating(false);
    }

    const replyToData = replyTarget ? {
      id: replyTarget.id,
      senderName: replyTarget.sender === 'me' ? '我' : 'Luna',
      textPreview: (replyTarget.type === 'text' ? replyTarget.content : `[${replyTarget.type}]`).slice(0, 60),
    } : undefined;

    // Store references for later injection into AI context (not prepended to user message)
    pendingReferencesRef.current = [...references];

    const gachaText = gachaContexts.length > 0
      ? gachaContexts.map((gc) => `[扭蛋: ${gc.context.titleSnapshot} (${gc.context.poolNameSnapshot})]`).join('\n') + '\n'
      : '';
    const finalText = gachaText + text;

    if (interactiveAttachment) sendStructuredText(finalText, { interactive: interactiveAttachment }, replyToData);
    else sendText(finalText, replyToData);
    lastUserMsg.current = text;
    setReferences([]);
    setGachaContexts([]);
    setInteractiveAttachment(null);
    setReplyTarget(null);
    setAttachDataOpen(false);

    if (!hasAi || !effectiveProvider) {
      publishLunarisPetState('idle');
      showToast(`訊息已保存；連接模型後可要求 ${selectAgentDisplayName(partner)} 回覆。`);
      return;
    }
    publishLunarisPetState('thinking');

    // Expense detection is opt-in. Ordinary role chat should not silently become accounting.
    const expense = parseExpense(text);
    if (expense) {
      const cardId = crypto.randomUUID();
      const replyLines: Record<string, string> = {
        '必要': `記下來了。${expense.amount} 元，${expense.title}，${expense.category}。這種必要消耗不算亂花，但你今天開始看見錢流向了，這很好。`,
        '衝動': `嗯，${expense.amount} 元買${expense.title}。先幫你記著，不急著下定論，但有察覺就是第一步。`,
        '安慰': `這筆比較像安慰性消費。我先幫你記下來，不急著罵你，但也別裝作沒發生。`,
        '後悔': `記下來了。${expense.title}，${expense.amount} 元。下次猶豫五分鐘，也許就不一樣了。`,
        '開心': `${expense.title}？聽起來讓你很開心。${expense.amount} 元花得值得，我記下了。`,
        '普通': `記下來了。${expense.amount} 元，${expense.title}，${expense.category}。幫你確認一下再入帳。`,
      };
      const reply = replyLines[expense.mood] || replyLines['普通'];
      appendAssistantMessage({
        id: crypto.randomUUID(), sender: 'assistant', type: 'text', content: reply,
        time: new Date().toISOString(), status: 'sent',
      } as any);
      setPendingCards((prev) => [...prev, { id: cardId, expense }]);
      // Still trigger idle timer for potential follow-up
      resetIdleTimer();
      return;
    }

    // Get the newly added message ID (last message)
    const msgs = useAppStore.getState().getActiveMessages();
    const newMsg = msgs[msgs.length - 1];
    if (newMsg && newMsg.sender === 'me') {
      pendingUserIds.current.add(newMsg.id);
      setPendingCount(pendingUserIds.current.size);
    }

    // Question mark triggers immediate reply only when continuous mode is off
    const hasQuestion = /[？?]|嗎$|呢$|怎么|為什麼|为何|怎能|怎麼辦/.test(text.trim());
    if (hasQuestion && !generatingRef.current && !continuousMessages) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      // Small delay so the user message renders first
      setTimeout(() => replyFnRef.current(), 200);
    } else {
      resetIdleTimer();
    }
  }, [activeConversation, activeConversationId, chatIdentities, sendGroupText, setMessageDeliveryStatus, sendText, sendStructuredText, replyTarget, resetIdleTimer, continuousMessages, references, setGenerating, appendAssistantMessage, interactiveAttachment, hasAi, activeProvider, showToast, gachaContexts, markParticipantRead]);

  const handleExpenseConfirm = useCallback((cardId: string, expense: ParsedExpense) => {
    addLedgerEntry({
      type: 'expense', amount: expense.amount, currency: 'TWD', title: expense.title,
      category: expense.category, source: 'chat', date: expense.date || new Date().toISOString().slice(0, 10),
      note: expense.note, mood: expense.mood, allowAiRecall: false,
    });
    setPendingCards((prev) => prev.map((c) => c.id === cardId ? { ...c, confirmed: true } : c));
    // Auto-dismiss confirmed card after 2s
    setTimeout(() => {
      setPendingCards((prev) => prev.filter((c) => c.id !== cardId));
    }, 2000);
  }, [addLedgerEntry]);

  const handleExpenseDismiss = useCallback((cardId: string) => {
    setPendingCards((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  // --- Chat Management ---
  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id));
  };
  const handleReply = useCallback((msg: Message) => {
    setReplyTarget(msg);
  }, []);
  const handlePin = useCallback((id: string) => {
    const found = messages.find((m) => m.id === id);
    if (found?.pinned) unpinMessage(id); else pinMessage(id);
  }, [messages, pinMessage, unpinMessage]);
  const handleArchive = useCallback((id: string) => {
    archiveMessage(id);
  }, [archiveMessage]);
  const handleRestore = useCallback((id: string) => {
    restoreMessage(id);
  }, [restoreMessage]);
  const handleSaveToMemory = useCallback((msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const preview = msg.type === 'text' ? msg.content.replace(/<[^>]*>/g, '').trim().slice(0, 80) : `[${msg.type}]`;
    vault.addMemory({
      title: `聊天片段 · ${preview}`,
      content: msg.type === 'text' ? msg.content : preview,
      owner: 'user',
      createdBy: 'user',
      source: 'chat',
      type: 'chat-summary',
      allowAiRecall: true,
      localOnly: true,
      sensitive: false,
    });
  }, [messages, vault]);
  const scrollToMessage = useCallback((msgId: string) => {
    const msgs = useAppStore.getState().getActiveMessages();
    if (!msgs.some((m) => m.id === msgId)) return;
    const el = document.getElementById(`msg-${msgId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  const handleGachaResult = useCallback((payload: GachaContextPayload) => {
    setGachaContexts((prev) => {
      if (gachaReplaceIndex !== null && gachaReplaceIndex < prev.length) {
        const next = [...prev];
        next[gachaReplaceIndex] = payload;
        return next;
      }
      return [...prev, payload];
    });
    if (gachaReplaceIndex !== null) {
      setGachaReplaceIndex(null);
      setAttachDataOpen(false);
      showToast('已替換上下文素材。');
    } else {
      showToast('已加入上下文，可繼續選擇或關閉面板。');
    }
  }, [gachaReplaceIndex, showToast]);

  const handleRemoveGachaContext = useCallback((index: number) => {
    setGachaContexts((prev) => prev.filter((_, i) => i !== index));
    setGachaReplaceIndex((current) => {
      if (current === null) return current;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  }, []);

  const handleUpdateGachaContext = useCallback((index: number, patch: { titleSnapshot: string; contentSnapshot?: string }) => {
    setGachaContexts((prev) => prev.map((gc, i) => (i === index ? { context: { ...gc.context, ...patch } } : gc)));
  }, []);

  const handleReselectGachaContext = useCallback((index: number) => {
    setGachaReplaceIndex(index);
    setAttachmentInitialTab('gacha');
    setAttachDataOpen(true);
  }, []);

  const closeAttachmentSheet = useCallback(() => {
    setAttachDataOpen(false);
    setAttachmentInitialTab(undefined);
    setGachaReplaceIndex(null);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-testid="composer-utility-trigger"]')?.focus();
    });
  }, []);

  const handleImagePick = async (file: File) => {
    try {
      const assetId = await saveAsset(file, file.type || 'image/png');
      sendImage(assetId, file.type || 'image/png', {
        fileName: file.name,
        fileSize: file.size,
      });
      const msgs = useAppStore.getState().getActiveMessages();
      const newMsg = msgs[msgs.length - 1];
      if (newMsg && newMsg.sender === 'me') {
        pendingUserIds.current.add(newMsg.id);
        setPendingCount(pendingUserIds.current.size);
      }
      resetIdleTimer();
    } catch {
      showToast('圖片儲存失敗');
    }
  };

  const handleVoiceSend = useCallback(async (voice: RecordedVoice) => {
    if (!canSendVoiceDuration(voice.durationMs)) {
      showToast('錄音時間太短，至少需要 0.6 秒。');
      return;
    }
    try {
      const audioAssetId = await saveAsset(voice.blob, voice.mimeType);
      sendVoice(buildRecordedVoicePayload({ audioAssetId, durationMs: voice.durationMs, waveform: voice.waveform, mimeType: voice.mimeType }));
      resetIdleTimer();
    } catch {
      showToast('語音儲存失敗，請再試一次。');
    }
  }, [sendVoice, showToast, resetIdleTimer]);

  const handleScriptedVoice = useCallback((payload: VoiceMessagePayload) => {
    const messageId = sendVoice(payload);
    if (payload.source === 'tts') {
      void runTtsPipeline({ id: messageId, textSnapshot: payload.textSnapshot, voiceSnapshot: payload.voiceSnapshot });
    }
    resetIdleTimer();
  }, [sendVoice, resetIdleTimer]);

  const handleStartCall = useCallback((kind: 'voice' | 'video') => {
    if (!activeConversationId) {
      showToast('請先選擇一個對話。');
      return;
    }
    const callId = useChatCallStore.getState().initiateOutgoingCall({
      conversationId: activeConversationId,
      mode: kind,
    });
    if (!callId) {
      showToast('已經有一通進行中的通話。');
      return;
    }
    // The ChatCallHost will render the active call view inline
  }, [activeConversationId, showToast]);

  const handleSendQuickReply = useCallback((text: string) => {
    if (!activeConversationId) return;
    useAppStore.getState().sendText(text, undefined);
  }, [activeConversationId]);

  const handleSendGameInvite = useCallback((gameId: string) => {
    if (!activeConversationId) return;
    const identityName = selectAgentDisplayName(useAppStore.getState().partner);
    if (gameId === 'gomoku') {
      const gameUuid = crypto.randomUUID();
      const msgId = crypto.randomUUID();
      const state = createGomokuState(
        { kind: 'human', participantId: 'me', displayName: '我' },
        { kind: 'ai', participantId: 'lunaris', displayName: identityName },
      );
      useInteractiveStore.getState().addGame({
        id: gameUuid,
        kind: 'gomoku',
        state,
        conversationId: activeConversationId,
        messageId: msgId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      sendText(`五子棋回合開始 |game:gomoku:${gameUuid}|`, undefined);
    }
  }, [activeConversationId, sendText]);

  return (
    <section id="chat-view" data-clawd-anchor="chat" data-has-chat-bg={chatBgResolved.source === 'custom' ? 'true' : undefined} data-chat-theme-active={chatTheme.runeDefault ? undefined : 'true'} style={{
      position: 'relative',
      ...emotionCSS,
      ...chatThemeStyle(chatTheme),
    } as React.CSSProperties}>
      <ChatEmotionEntry />

      <ChatWorkspace
        collapsed
        drawerOpen={false}
        onCloseDrawer={() => {}}
        sidebar={null}
        header={(
          <ChatWorkspaceHeader
            title={hasConversation ? activeConversationTitle : '聊天'}
            providerLabel={modelTag ? `${modelTag}${modelSource === 'character' ? ' · 角色模型' : ''}` : null}
            modelStatus={!navigator.onLine ? 'offline' : !hasAi || !effectiveProvider ? 'unconfigured' : effectiveProvider.connectionStatus === 'failed' ? 'error' : 'ready'}
            aiState={aiState}
            statusText={companionStateSnap.statusText}
            isArchived={activeConversationArchived}
            onUnarchive={() => { if (activeConversationId) archiveConversation(activeConversationId); }}
            drawerOpen={false}
            sidebarCollapsed
            onToggleSidebar={() => navigate('/chat')}
            onNewChat={handleNewChat}
            onModel={(e: React.MouseEvent) => {
              const pill = (e.currentTarget as HTMLElement);
              setModelPopoverRect(pill.getBoundingClientRect());
              setModelPopoverOpen(true);
            }}
            onGameInvite={() => handleSendGameInvite('gomoku')}
            onBackground={() => setBgModalOpen(true)}
            onTheme={() => setThemeStudioOpen(true)}
            onArchive={() => { if (activeConversationId) archiveConversation(activeConversationId); }}
            onExport={handleExportConversation}
            onClear={handleClearConversation}
            onStartCharacterChat={handleStartCharacterChat}
            showHeaderNewChat={true}
            isGroup={activeConversation?.kind === 'group'}
            memberCount={effectiveGroupParticipants.length || undefined}
            conversation={activeConversation}
            onMore={activeConversation?.kind === 'group' ? () => setGroupProfileOpen(true) : undefined}
            onPerspective={activeConversation?.kind === 'group' ? () => setPerspectiveSheetOpen(true) : undefined}
            perspectiveLabel={activeConversation?.kind === 'group' && effectiveGroupPerspective && !effectiveGroupPerspective.isSelf ? effectiveGroupPerspective.displayName : undefined}
          />
        )}
        composer={hasConversation ? (
          <div
            className={`chat-composer-shell${callActive ? ' is-suppressed' : ''}`}
            data-pet-safe-region="interactive"
            data-composer-exclusion-zone="true"
          >
            {gachaContexts.length > 0 && (
              <div className="chat-composer-context">
                {gachaContexts.map((gc, idx) => (
                  <span key={idx} className="gc-context-chip">
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="7" r="5" />
                      <circle cx="5" cy="13" r="2" />
                      <path d="M8 10v5" />
                    </svg>
                    {gc.context.titleSnapshot}
                    <GachaContextChipMenu
                      title={gc.context.titleSnapshot}
                      onEdit={() => setGachaEditIndex(idx)}
                      onReselect={() => handleReselectGachaContext(idx)}
                      onRemove={() => handleRemoveGachaContext(idx)}
                    />
                    <button
                      className="gc-context-chip-remove"
                      onClick={() => handleRemoveGachaContext(idx)}
                      aria-label="移除"
                    >&#x2715;</button>
                  </span>
                ))}
              </div>
            )}
            {interactiveAttachment && (
              <div className="composer-payload-preview" data-testid="interactive-composer-preview">
                <InteractiveIcon type={interactiveAttachment.kind} />
                <span>{interactiveAttachment.kind === 'gomoku' ? '五子棋' : interactiveAttachment.kind === 'poll' ? '投票' : interactiveAttachment.kind === 'dice' ? '骰子' : '計時器'}</span>
                <button type="button" onClick={() => setInteractiveAttachment(null)} aria-label="移除互動內容">×</button>
              </div>
            )}
            {!hasConversation && (
              <div className="chat-composer-notice" role="status">選擇夥伴後即可開始聊天。</div>
            )}
            <div className="chat-composer-main">
              {activeConversation?.kind === 'group' && (() => {
                const speaker = effectiveGroupSpeaker;
                if (!speaker) return null;
                const speakerName = speaker.displayName;
                return (
                  <button
                    type="button"
                    className="current-speaker-trigger"
                    onClick={() => setSpeakerSheetOpen(true)}
                    aria-label={`目前以 ${speakerName} 身分發言，點擊切換`}
                    title={`目前以 ${speakerName} 身分發言，點擊切換`}
                  >
                    {speaker.identityId === 'narrator'
                      ? <NarratorAvatar size={28} />
                      : <IdentityAvatar identityId={speaker.identityId} participant={speaker.participant} legacyParticipant={speaker.legacyParticipant} size={28} label={speakerName} />}
                    <span className="current-speaker-name">{speakerName}</span>
                    <svg className="current-speaker-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
                  </button>
                );
              })()}
              <ChatInput
                ref={inputRef}
                onSend={handleSend}
                onAttach={(target) => {
                  setAttachmentInitialTab(target);
                  setAttachDataOpen(true);
                }}
                isBusy={composerDisabled}
                hasPayload={Boolean(interactiveAttachment || gachaContexts.length)}
                onVoiceSend={handleVoiceSend}
                onVoiceError={showToast}
                onScriptedVoice={handleScriptedVoice}
                onStartCall={handleStartCall}
                aiState={aiState}
                hasConversation={Boolean(activeConversationId)}
                agentAvailable={Boolean(hasAi && effectiveProvider && navigator.onLine)}
                replyName={replyTarget ? resolvePerspectiveReplyLabel(replyTarget, effectiveGroupPerspective?.identityId, replyTarget.sender === 'me' ? '自己' : 'Luna') : undefined}
                placeholder={activeConversation?.kind === 'group' ? '在群聊中說點什麼…' : undefined}
                onNarrate={activeConversation?.kind === 'group' ? (text: string) => {
                  if (!text) return;
                  const sentId = sendGroupText(text, 'narrator', 'system');
                  setMessageDeliveryStatus(sentId, 'sent', ['narrator']);
                  setReplyTarget(null);
                  setAttachDataOpen(false);
                } : undefined}
              />
            </div>
          </div>
        ) : null}
        background={<ChatBackgroundLayer config={chatBgResolved} />}
      >
      <MessageList
        messages={visibleMessages}
        aiState={aiState}
        streamingText={streamingText}
        thinkingStep={thinkingStep}
        isTyping={typingMessage !== null}
        pipelineTrace={pipelineTrace}
        onReply={handleReply}
          onMessageAction={openActionMenu}
          onScrollToMsg={scrollToMessage}
        onMessageVisible={handleMessageVisible}
        contextTraces={contextTraces}
        scrollRef={messageListRef}
        isGroup={activeConversation?.kind === 'group'}
        groupConversation={activeConversation}
        groupIdentities={chatIdentities}
        participants={effectiveGroupParticipants.map(toLegacyParticipantView)}
        perspectiveParticipant={activeConversation?.kind === 'group' ? effectiveGroupPerspective : undefined}
        typingParticipantIds={typingParticipantIds}
        postReplySnapshot={postReplySnapshot}
        onDismissPostReplySnapshot={dismissPostReplySnapshot}
        emptyTitle={hasConversation ? "今天想聊什麼？" : "還沒有連接對話夥伴"}
        emptyHint={hasConversation ? "寫下問題、想法，或讓我幫你整理一段混亂。" : "選擇一個角色，或建立新的聊天夥伴後，Rune 就能開始陪你聊天。"}
        emptyActions={!hasConversation ? (
          <ChatWorkspaceEmptyActions
            onPickPartner={() => setPartnerPickerOpen(true)}
            onCreatePartner={() => {
              setPartnerCreatorRole('local');
              setPartnerCreatorOpen(true);
            }}
          />
        ) : undefined}
      />
      {/* Chat Call Host */}
      {activeConversationId && (
        <ChatCallHost
          conversationId={activeConversationId}
          isMobile={isMobile}
          isAiStreaming={aiState === 'streaming'}
          streamingText={streamingText}
          onSendQuickReply={handleSendQuickReply}
          onCallEvent={(text) => {
            sendText(text);
          }}
          micPermState={'granted'}
        />
      )}
      {activeConversation?.kind === 'group' && <>
        <SpeakerSheet conversation={activeConversation} open={speakerSheetOpen} onClose={() => setSpeakerSheetOpen(false)} />
        <PerspectiveSheet conversation={activeConversation} open={perspectiveSheetOpen} onClose={() => setPerspectiveSheetOpen(false)} />
        <GroupProfileDrawer conversation={activeConversation} open={groupProfileOpen} onClose={() => setGroupProfileOpen(false)} />
      </>}
      {archivedMessages.length > 0 && (
        <div className="archived-trigger-row">
          <button type="button" className="archived-trigger-btn" onClick={() => setArchiveModalOpen(true)}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
              <path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7z" />
            </svg>
            <span>檢視封存 ({archivedMessages.length})</span>
          </button>
        </div>
      )}
      {/* ── Runtime process button ── */}
      {lastChatLog && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <button
            type="button"
            onClick={() => setShowProcess((v) => !v)}
            style={{
              background: showProcess ? 'var(--accent)' : 'var(--surface-2)',
              border: 'none', borderRadius: 14, cursor: 'pointer',
              padding: '5px 14px', fontSize: 12, fontWeight: 500,
              color: showProcess ? '#fff' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.15s',
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            過程
          </button>
        </div>
      )}

      {/* ── Runtime timeline drawer ── */}
      {showProcess && lastChatLog && (
        <div style={{
          background: 'var(--surface-1)', borderTop: '1px solid var(--surface-2)',
          padding: '12px 16px 16px', maxHeight: '45vh', overflowY: 'auto',
          animation: 'moonread-slideUp 0.25s ease-out',
        }}>
          <RuntimeLogTimeline log={lastChatLog} />
        </div>
      )}

      {/* ── Wake Luna button ── */}
      {pendingCount > 0 && !isGenerating && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 0' }}>
          <button
            type="button"
            onClick={() => {
              if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
              replyFnRef.current();
            }}
            style={{
              background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 14,
              cursor: 'pointer', padding: '4px 14px', fontSize: 12, fontWeight: 500,
              color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            喚醒 Luna
          </button>
        </div>
      )}
      {/* ── Expense confirm cards ── */}
      {pendingCards.map((card) => (
        <div key={card.id} style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
          {card.confirmed ? (
            <div className="ledger-confirmed-msg">✓ 已記入 Rune 帳簿</div>
          ) : (
            <ChatLedgerConfirmCard
              expense={card.expense}
              onConfirm={(e) => handleExpenseConfirm(card.id, e)}
              onDismiss={() => handleExpenseDismiss(card.id)}
            />
          )}
        </div>
      ))}
      {/* ── Reply preview bar ── */}
      {replyTarget && (
        <div className="reply-bar">
          <div className="reply-bar-content">
            <div className="reply-bar-label">回覆 {resolvePerspectiveReplyLabel(replyTarget, effectiveGroupPerspective?.identityId, replyTarget.sender === 'me' ? '自己' : 'Luna')}</div>
            <div className="reply-bar-preview">
              {replyTarget.type === 'text'
                ? replyTarget.content.slice(0, 60) + (replyTarget.content.length > 60 ? '…' : '')
                : `[${replyTarget.type}]`}
            </div>
          </div>
          <button
            type="button"
            className="reply-bar-close"
            onClick={() => setReplyTarget(null)}
            aria-label="取消回覆"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Conversation Memory Popup ── */}
      {memoryPopupOpen && activeConvMemory && (
        <div className="quick-sheet-overlay active ctx-drawer-overlay" onClick={() => setMemoryPopupOpen(false)}>
          <div className="quick-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 'min(60dvh, 400px)' }}>
            <div className="quick-sheet-handle" />
            <div className="quick-sheet-head">
              <span className="quick-sheet-title">本對話記憶</span>
            </div>
            <div className="quick-sheet-body" style={{ padding: '12px 16px', fontSize: '13px', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>摘要</div>
                <div style={{ color: 'var(--text)' }}>{activeConvMemory.summary}</div>
              </div>
              {activeConvMemory.topics.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>話題</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {activeConvMemory.topics.map((t) => (
                      <span key={t} style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-2)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>訊息數</div>
                <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{activeConvMemory.messageCount} 則</div>
              </div>
            </div>
          </div>
        </div>
      )}

      </ChatWorkspace>

      <PartnerPickerDialog
        open={partnerPickerOpen}
        onClose={() => setPartnerPickerOpen(false)}
        onPick={handleStartCharacterChat}
      />
      <PartnerCreatorSheet
        open={partnerCreatorOpen}
        roleSource={partnerCreatorRole}
        onClose={() => setPartnerCreatorOpen(false)}
        onCreate={handleStartCharacterChat}
      />

      <AttachmentSheet
        isOpen={attachDataOpen}
        onClose={closeAttachmentSheet}
        onImagePick={handleImagePick}
        onStickerPick={(opts) => sendSticker(opts)}
        onGachaResult={handleGachaResult}
        gachaContexts={gachaContexts}
        onRemoveGachaContext={handleRemoveGachaContext}
        replaceTarget={gachaReplaceIndex !== null && gachaContexts[gachaReplaceIndex]
          ? { index: gachaReplaceIndex, title: gachaContexts[gachaReplaceIndex].context.titleSnapshot }
          : null}
        initialTab={gachaReplaceIndex !== null ? 'gacha' : attachmentInitialTab}
        currentCreatorIdentityId={activeConversation?.kind === 'group'
          ? (activeConversation.currentSpeakerParticipantId || activeConversation.participants?.find((participant) => participant.isSelf)?.id || 'me')
          : 'me'}
        onInteractivePick={setInteractiveAttachment}
      />

      {gachaEditIndex !== null && gachaContexts[gachaEditIndex] && (
        <GachaContextChipEditor
          payload={gachaContexts[gachaEditIndex]}
          onClose={() => setGachaEditIndex(null)}
          onSave={(patch) => {
            handleUpdateGachaContext(gachaEditIndex, patch);
            setGachaEditIndex(null);
            showToast('素材已更新。');
          }}
        />
      )}

      {/* Message Action Sheet */}
      {/* Message Action Popover */}
      {actionMsgId && createPortal(
        <MessageActionPopover
          messageId={actionMsgId}
          messages={messages}
          onClose={closeActionMenu}
          onDelete={handleMenuDelete}
          onReply={handleReply}
          onAddToTodo={handleAddToTodo}
          onPin={handlePin}
          onSaveToMemory={handleSaveToMemory}
        />,
        document.body,
      )}

      {/* Delete Confirm */}
      {deleteConfirmId && createPortal(
        <div className="msg-delete-overlay active" onClick={closeActionMenu}>
          <div className="msg-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="message-delete-title" aria-describedby="message-delete-desc" onClick={(e) => e.stopPropagation()}>
            <div className="msg-delete-header">
              <h2 id="message-delete-title">刪除訊息</h2>
              <button type="button" className="msg-delete-close" onClick={closeActionMenu} aria-label="關閉">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <p id="message-delete-desc" className="msg-delete-desc">從哪裡移除這則訊息？</p>
            <div className="msg-delete-options" role="radiogroup" aria-label="刪除範圍">
              {canDeleteForAll && (
                <label className="msg-delete-option">
                  <span className="msg-delete-radio">
                    <input type="radio" name="message-deletion-mode" value="all" checked={deletionMode === 'all'} onChange={() => setDeletionMode('all')} aria-label={deleteForAllLabel} />
                    <span className="msg-delete-radio-visual" aria-hidden="true" />
                  </span>
                  <span className="msg-delete-option-text">
                    <strong>{deleteForAllLabel}</strong>
                    <small>{activeConversation?.kind === 'group' ? '從這段群聊的所有參與者視圖中移除。' : '從這段對話的雙方視圖中移除。'}</small>
                  </span>
                </label>
              )}
              <label className="msg-delete-option">
                <span className="msg-delete-radio">
                  <input type="radio" name="message-deletion-mode" value="self" checked={deletionMode === 'self'} onChange={() => setDeletionMode('self')} aria-label="僅為我刪除" />
                  <span className="msg-delete-radio-visual" aria-hidden="true" />
                </span>
                <span className="msg-delete-option-text">
                  <strong>僅為我刪除</strong>
                  <small>只從我的聊天畫面中移除。</small>
                </span>
              </label>
            </div>
            <div className="msg-delete-footer">
              <button type="button" className="msg-delete-cancel" onClick={closeActionMenu}>{t('sheet.cancel')}</button>
              <button type="button" className="msg-delete-submit" onClick={handleDeleteMsg} disabled={!deletionMode}>刪除</button>
            </div>
          </div>
        </div>, document.body
      )}

      <ContextDrawer
        isOpen={contextDrawerOpen}
        onClose={() => setContextDrawerOpen(false)}
        snapshot={contextSnapshot}
      />

      <ArchiveModal
        open={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        archivedItems={archivedMessages}
        onUnarchive={handleRestore}
        onScrollTo={scrollToMessage}
      />
      <ModelPopover
        open={modelPopoverOpen}
        conversationId={activeConversationId}
        anchorRect={modelPopoverRect}
        onClose={() => setModelPopoverOpen(false)}
        onOpenEngine={() => { setModelPopoverOpen(false); setEngineDrawerOpen(true); }}
      />
      <ChatEngineDrawer
        open={engineDrawerOpen}
        conversationId={activeConversationId}
        onClose={() => setEngineDrawerOpen(false)}
      />
      <ChatBackgroundModal
        open={bgModalOpen}
        onClose={() => setBgModalOpen(false)}
        conversationId={activeConversationId}
      />
      <ChatThemeStudio open={themeStudioOpen} onClose={closeThemeStudio} seed={stashThemeBridge?.chatThemeDraftSeed} openPaletteMapping={stashThemeBridge?.openPaletteMapping} />
    </section>
  );
}
