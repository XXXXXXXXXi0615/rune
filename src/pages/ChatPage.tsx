import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput, type ChatInputHandle } from '@/components/chat/ChatInput';
import { EmojiPanel } from '@/components/chat/EmojiPanel';
import { useDrawer } from '@/hooks/useDrawer';
import { useDrawerStore } from '@/store/useDrawerStore';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { t } from '@/i18n';
import { estimateAnxietyScore } from '@/ai/anxietyEstimator';
import { ChatBackgroundModal } from '@/components/chat/ChatBackgroundModal';
import { ChatStatusSheet } from '@/components/chat/ChatStatusSheet';
import type { ChatBackground } from '@/config/chatBackground';
import { loadBackground, buildBackgroundCSS } from '@/config/chatBackground';
import type { ChatPresenceStatus } from '@/types';
import { resolveLunaPresence } from '@/utils/lunaPresence';

import type { ThinkingOutput } from '@/ai/mockReplies';
import { detectIntent, generateIntentThinking, generateIntentReply, type Intent } from '@/ai/intent';
import { RuntimeLogTimeline } from '@/components/agent/RuntimeLogTimeline';
import type { AgentRuntimeLog, AgentRuntimeStep } from '@/types';

type AIState = 'idle' | 'thinking' | 'streaming' | 'error';

export function ChatPage() {
  const navigate = useNavigate();
  const messages = useAppStore((s) => s.messages);
  const partner = useAppStore((s) => s.partner);
  const sendText = useAppStore((s) => s.sendText);
  const petWidget = useAppStore((s) => s.petWidget);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const deleteMessage = useAppStore((s) => s.deleteMessage);
  const addMemoryEntry = useAppStore((s) => s.addMemoryEntry);
  const aiConfig = useAppStore((s) => s.aiConfig);
  const providers = useAppStore((s) => s.providers || []);
  const activeProvider = providers.find((p) => p.isDefault && p.enabled) || providers.find((p) => p.enabled) || null;
  const addUsagePoints = useAppStore((s) => s.addUsagePoints);
  const lunaContact = useAppStore((s) => s.chatContacts.find((contact) => contact.id === 'luna'));
  const setChatContactStatus = useAppStore((s) => s.setChatContactStatus);
  const attachDrawer = useDrawer('attachment');
  const openTodoDrawer = useDrawerStore((s) => s.openDrawer);
  const addTodo = useAppStore((s) => s.addTodo);
  const showToast = useToastStore((s) => s.showToast);

  const inputRef = useRef<ChatInputHandle>(null);
  const generatingRef = useRef(false);
  const replyFnRef = useRef<() => void>(() => {});
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingUserIds = useRef<Set<string>>(new Set());
  const lastRepliedId = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [aiPromptDismissed, setAiPromptDismissed] = useState(false);
  const [aiState, setAiState] = useState<AIState>('idle');
  const [streamingText, setStreamingText] = useState('');
  const [thinkingStep, setThinkingStep] = useState(0);
  const [showProcess, setShowProcess] = useState(false);
  const [lastChatLog, setLastChatLog] = useState<AgentRuntimeLog | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const addRuntimeLog = useAppStore((s) => s.addRuntimeLog);

  const hasAi = activeProvider !== null && !!activeProvider.model;
  const useMock = aiConfig.devMockEnabled && !hasAi;
  const showAiPrompt = !hasAi && !useMock && messages.length > 0 && !aiPromptDismissed;

  // Message action state
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [actionMsgContent, setActionMsgContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bgOpen, setBgOpen] = useState(false);
  const [chatBg, setChatBg] = useState<ChatBackground>(loadBackground);
  const actionMsg = messages.find((m) => m.id === actionMsgId);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const isBusy = aiState === 'thinking' || aiState === 'streaming';

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

  const savedPresence = lunaContact?.status || 'online';
  const headerPresence: ChatPresenceStatus = resolveLunaPresence(lunaContact, { enabled: hasAi, apiKey: hasAi ? 'configured' : '', devMockEnabled: aiConfig.devMockEnabled }, aiState);

  // ── Batch pending reply system ──

  /** Trigger Luna reply for all pending user messages. Called by idle timer / wake btn / question mark. */
  const triggerLunaReply = useCallback(() => {
    if (generatingRef.current) return;
    const msgs = useAppStore.getState().messages;

    // Collect pending user messages (new messages since last reply)
    const pendingIds = Array.from(pendingUserIds.current);
    if (pendingIds.length === 0) return;

    // Filter to only un-replied messages
    const unreplied = pendingIds.filter((id) => id !== lastRepliedId.current);
    if (unreplied.length === 0) return;

    // Find the actual message objects
    const pendingMsgs = msgs.filter((m) => unreplied.includes(m.id) && m.sender === 'me' && m.type === 'text');
    if (pendingMsgs.length === 0) return;

    // Merge all pending user messages into one context string
    const combinedText = pendingMsgs.map((m) => (m as { content: string }).content).join('\n');
    const lastPendingId = pendingMsgs[pendingMsgs.length - 1].id;

    // ── Intent detection (runs first — drives both thinking and reply) ──
    const intent: Intent = detectIntent(combinedText);
    const intentThinking = generateIntentThinking(intent, combinedText);

    // ── Generate replies: always intent-driven, never fallback to old mock ──
    const replies = generateIntentReply(intent, combinedText);

    console.log('[Lunartide Intent]', {
      message: combinedText.slice(0, 80),
      intent,
      replyPreview: replies[0]?.slice(0, 60),
    });

    // Generate thinking (intent-driven character monologue + runtime steps)
    const thinkingData: ThinkingOutput = {
      characterThought: intentThinking.characterThought,
      runtimeSteps: intentThinking.runtimeSteps,
    };

    // Clear pending
    pendingUserIds.current.clear();
    setPendingCount(0);
    lastRepliedId.current = lastPendingId;
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }

    generatingRef.current = true;
    const totalThinkMs = 800 + Math.random() * 1700;
    const stepMs = totalThinkMs / 3;
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const providerName = activeProvider?.name || 'mock';
    const providerModel = activeProvider?.model || 'luna-mock';

    // Build thinking log
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

    const t1 = setTimeout(() => setThinkingStep(1), stepMs);
    const t2 = setTimeout(() => setThinkingStep(2), stepMs * 2);

    // After thinking, stream all replies sequentially
    timerRef.current = setTimeout(() => {
      clearTimeout(t1); clearTimeout(t2);
      timerRef.current = null;
      setAiState('streaming');

      let replyIdx = 0;
      const allReplies: string[] = [...replies];
      const totalOutputLen = allReplies.reduce((s, r) => s + r.length, 0);

      function streamNextReply() {
        if (replyIdx >= allReplies.length) {
          // All done
          const finishedAt = Date.now();
          const inTokens = Math.ceil(combinedText.length / 3);
          const outTokens = Math.ceil(totalOutputLen / 3);
          const completedSteps: AgentRuntimeStep[] = [
            { id: 's1', label: 'read_context', status: 'done', detail: `已讀取 ${pendingMsgs.length} 則訊息` },
            { id: 's2', label: 'read_memory', status: 'done', detail: '搜尋近期月潮記憶 (mock)' },
            { id: 's3', label: 'read_book', status: 'skipped', detail: '無相關書籍內容' },
            { id: 's4', label: 'call_provider', status: 'done', detail: `${providerName} · ${providerModel}` },
            { id: 's5', label: 'generate_reply', status: 'done', detail: `${allReplies.length} 則回覆 · ${totalOutputLen} 字` },
            { id: 's6', label: 'complete', status: 'done' },
          ];
          const completedLog: AgentRuntimeLog = {
            ...roundLog, finishedAt, status: 'completed',
            visibleReasoningSummary: `Luna 回覆完成：${allReplies.length} 則訊息 · ${totalOutputLen} 字`,
            steps: completedSteps,
            tokenUsage: { input: inTokens, output: outTokens, total: inTokens + outTokens, estimated: true },
            costEstimate: inTokens * 0.000001 + outTokens * 0.000003,
          };
          setLastChatLog(completedLog);
          addRuntimeLog(completedLog);
          setStreamingText('');
          setAiState('idle');
          setThinkingStep(0);
          generatingRef.current = false;
          addUsagePoints(2);
          return;
        }

        const currentReply = allReplies[replyIdx];
        const streamDelay = Math.min(32, Math.max(16, Math.floor(900 / Math.max(currentReply.length, 1))));
        let charIdx = 0;
        const msgId = crypto.randomUUID();

        setStreamingText('');
        intervalRef.current = setInterval(() => {
          charIdx++;
          const partial = currentReply.slice(0, charIdx);
          setStreamingText(partial);
          if (charIdx >= currentReply.length) {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            const nowTs = Date.now();
            const lunaMsg = {
              id: msgId, sender: 'assistant' as const, type: 'text' as const,
              content: currentReply, time: new Date().toISOString(), status: 'sent' as const,
              // Attach thinking block only to the first message in the round
              ...(replyIdx === 0 ? {
                thinking: {
                  status: 'done' as const,
                  characterThought: thinkingData.characterThought,
                  runtimeSteps: thinkingData.runtimeSteps,
                  startedAt,
                  finishedAt: nowTs,
                },
              } : {}),
            };
            updateSettings({ messages: [...useAppStore.getState().messages, lunaMsg] });
            setStreamingText('');
            replyIdx++;

            // Delay before next reply (0.6-1.2s between messages)
            if (replyIdx < allReplies.length) {
              const interDelay = 600 + Math.random() * 600;
              setTimeout(() => streamNextReply(), interDelay);
            } else {
              streamNextReply(); // finalize
            }
          }
        }, streamDelay);
      }

      streamNextReply();
    }, totalThinkMs);
  }, [addUsagePoints, updateSettings, activeProvider, addRuntimeLog]);

  // Sync ref
  useEffect(() => { replyFnRef.current = triggerLunaReply; }, [triggerLunaReply]);

  // ── Idle timer: reset on each send, trigger after 1.8s ──
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      triggerLunaReply();
    }, 1800);
  }, [triggerLunaReply]);

  const handleSend = useCallback((text: string) => {
    sendText(text);
    setEmojiOpen(false);
    if (!hasAi && !useMock) return;

    // Get the newly added message ID (last message)
    const msgs = useAppStore.getState().messages;
    const newMsg = msgs[msgs.length - 1];
    if (newMsg && newMsg.sender === 'me') {
      pendingUserIds.current.add(newMsg.id);
      setPendingCount(pendingUserIds.current.size);
    }

    // Check for question mark → immediate trigger
    const hasQuestion = /[？?]|嗎$|呢$|怎么|為什麼|为何|怎能|怎麼辦/.test(text.trim());
    if (hasQuestion && !generatingRef.current) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      // Small delay so the user message renders first
      setTimeout(() => replyFnRef.current(), 200);
    } else {
      resetIdleTimer();
    }
  }, [sendText, hasAi, useMock, resetIdleTimer]);

  // --- Message Actions ---
  const openActionMenu = useCallback((msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    setActionMsgId(msgId);
    setActionMsgContent(msg.type === 'text' ? msg.content : '');
    setDeleteConfirmId(null);
  }, [messages]);

  const closeActionMenu = () => { setActionMsgId(null); setDeleteConfirmId(null); };

  const handleCopyMsg = () => {
    if (actionMsgContent) {
      navigator.clipboard.writeText(actionMsgContent).then(() => showToast(t('msg.copied'))).catch(() => {});
    }
    closeActionMenu();
  };

  const handleDeleteMsg = () => {
    if (!deleteConfirmId) { setDeleteConfirmId(actionMsgId); return; }
    deleteMessage(deleteConfirmId);
    closeActionMenu();
  };

  const handleRevokeMsg = () => {
    if (!actionMsgId) return;
    useAppStore.getState().revokeMessage(actionMsgId);
    showToast(t('msg.revokedNotice'));
    closeActionMenu();
  };

  const handleSaveMemory = () => {
    if (actionMsgContent) {
      const { score } = estimateAnxietyScore(actionMsgContent);
      const title = actionMsgContent.length <= 20
        ? actionMsgContent
        : actionMsgContent.slice(0, 20) + '…';
      const nextStepKey = score <= 3 ? 'memory.nextStepLow'
        : score <= 6 ? 'memory.nextStepMed' : 'memory.nextStepHigh';
      addMemoryEntry({
        scene: title,
        triggerText: '來自聊天',
        bodyThoughts: '',
        anxietyLevel: score,
        nextStep: t(nextStepKey),
      });
      showToast(t('msg.savedMemory'));
    }
    closeActionMenu();
  };

  const handleCreateTodo = () => {
    if (actionMsgContent) {
      const today = new Date().toISOString().slice(0, 10);
      addTodo({
        title: actionMsgContent.length <= 30 ? actionMsgContent : actionMsgContent.slice(0, 30) + '…',
        date: today,
        priority: 'medium',
        category: 'life',
        notes: '來自聊天訊息',
        repeat: 'none',
      });
      showToast(t('msg.todoCreated'));
    }
    closeActionMenu();
  };

  const handleRegenerate = () => {
    // Remove last Luna message
    const lastLunaIdx = [...messages].reverse().findIndex((m) => m.sender === 'assistant');
    if (lastLunaIdx === -1) { closeActionMenu(); return; }
    const realIdx = messages.length - 1 - lastLunaIdx;
    const newMsgs = messages.filter((_, i) => i !== realIdx);
    updateSettings({ messages: newMsgs });
    closeActionMenu();
    // Trigger new mock reply
    setTimeout(() => replyFnRef.current(), 300);
  };

  const isLastLunaMsg = actionMsg?.sender === 'assistant'
    && messages.filter((m) => m.sender === 'assistant').pop()?.id === actionMsgId;
  const isMyMsg = actionMsg?.sender === 'me';
  const isRevoked = actionMsg?.revoked === true;

  // --- Chat Management ---
  const handleClearChat = () => { updateSettings({ messages: [] }); setMoreOpen(false); setClearConfirm(false); };
  const handleExportChat = () => {
    if (messages.length === 0) { showToast(t('chat.noExport')); setMoreOpen(false); return; }
    const lines = messages.map((m) => {
      const d = new Date(m.time); const ts = d.toLocaleString();
      const sender = m.sender === 'me' ? (partner?.name || 'shuri') : 'LUNARIS';
      if (m.revoked) {
        return `[${ts}] ${sender}: [${t('msg.revokedNotice')}]`;
      }
      return `[${ts}] ${sender}: ${m.type === 'text' ? (m as { content: string }).content : `[${m.type}]`}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `lunartide_chat_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
    showToast(t('chat.exported')); setMoreOpen(false);
  };

  const closeMore = () => { setMoreOpen(false); setClearConfirm(false); };
  const closeStatusPicker = useCallback(() => setStatusPickerOpen(false), []);
  const handleStatusSelect = useCallback((status: ChatPresenceStatus) => {
    // Update status via store action (creates activity log)
    setChatContactStatus('luna', status);
    // Mark manual override for ALL manual selections (user explicitly chose this status)
    const updated = useAppStore.getState().chatContacts.map((c) =>
      c.id === 'luna' ? { ...c, manualStatusOverride: true } : c
    );
    updateSettings({ chatContacts: updated });
    setStatusPickerOpen(false);
  }, [setChatContactStatus, updateSettings]);
  const handleEmojiToggle = () => setEmojiOpen((v) => !v);
  const handleEmojiSelect = (emoji: string) => { inputRef.current?.insertEmoji(emoji); };
  const handleStickerSelect = (url: string, name?: string) => {
    const stickerMsg: import('@/types').StickerMessage = {
      id: crypto.randomUUID(), sender: 'me', type: 'sticker',
      stickerUrl: url, stickerName: name || '', time: new Date().toISOString(), status: 'sent',
    };
    const msgs = [...useAppStore.getState().messages, stickerMsg];
    updateSettings({ messages: msgs });
    setEmojiOpen(false);
  };

  return (
    <section id="chat-view" style={{ position: 'relative' }}>
      {/* Chat background layer */}
      <div className="chat-bg-layer" aria-hidden="true" style={{
        background: buildBackgroundCSS(chatBg),
        opacity: chatBg.opacity / 100,
        filter: chatBg.blur > 0 ? `blur(${chatBg.blur}px)` : undefined,
      }} />
      <div className="chat-bg-overlay" aria-hidden="true" style={{
        background: 'var(--bg-main)',
        opacity: 1 - (chatBg.opacity / 100) * 0.75,
      }} />

      <ChatHeader
        name={partner.name}
        status={headerPresence}
        statusDetail={activeProvider ? `${activeProvider.name} · ${activeProvider.model}` : undefined}
        avatarConfig={partner.avatarImage}
        fallbackInitial={partner.avatarInitial || 'L'}
        avatarColor={partner.avatarColor || 'char'}
        onBackground={() => setBgOpen(true)}
        onMore={() => { setEmojiOpen(false); setMoreOpen(true); }}
      />
      <MessageList
        messages={messages}
        aiState={aiState}
        streamingText={streamingText}
        thinkingStep={thinkingStep}
        onMessageAction={openActionMenu}
      />
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

      {/* Local mode banner */}
      {headerPresence === 'local' && !showAiPrompt && (
        <div className="ai-prompt-card">
          <p className="ai-prompt-text">{t('chat.localBanner')}</p>
          <div className="ai-prompt-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/settings')}
              style={{ fontSize: 13 }}>{t('chat.goToSettings')}</button>
          </div>
        </div>
      )}
      {/* AI Not Configured Prompt (shown after first message only) */}
      {showAiPrompt && (
        <div className="ai-prompt-card">
          <p className="ai-prompt-text">{t('chat.aiNotConfigured')}</p>
          <div className="ai-prompt-actions">
            <button type="button" className="btn-ghost" onClick={() => setAiPromptDismissed(true)}
              style={{ fontSize: 13 }}>{t('chat.setUpLater')}</button>
            <button type="button" className="btn-primary" onClick={() => navigate('/settings')}
              style={{ fontSize: 13 }}>{t('chat.goToSettings')}</button>
          </div>
        </div>
      )}
      {/* Empty state — when no messages or only revoked messages exist */}
      {messages.filter((m) => !m.revoked).length === 0 && !showAiPrompt && (
        <div className="chat-empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', gap: 16 }}>
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 44, height: 44, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.4 }}>
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
          </svg>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text)', fontFamily: 'var(--f-d)', fontSize: 18, fontWeight: 500, margin: '0 0 6px' }}>
              {t('chat.emptyTitle')}
            </p>
            <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {headerPresence === 'local' ? t('chat.emptyHint') : t('chat.lunaWelcomeHint')}
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 360 }}>
            <button type="button" className="liquid-btn liquid-btn--sm" onClick={() => openTodoDrawer('todo')}>
              {t('chat.emptyTodo')}
            </button>
            <button type="button" className="liquid-btn liquid-btn--sm" onClick={() => navigate('/memory?action=new')}>
              {t('chat.emptyRecord')}
            </button>
            <button type="button" className="liquid-btn liquid-btn--sm" onClick={() => navigate('/memory')}>
              {t('chat.emptyMemory')}
            </button>
          </div>
        </div>
      )}

      {/* ── Wake Luna button ── */}
      {pendingCount > 0 && !generatingRef.current && (
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
      {emojiOpen && <EmojiPanel onSelect={handleEmojiSelect} onSelectSticker={handleStickerSelect} />}
      <ChatInput ref={inputRef} onSend={handleSend}
        onToggleEmoji={handleEmojiToggle} onAttach={attachDrawer.open}
        emojiOpen={emojiOpen} isBusy={isBusy} />

      {/* More Menu */}
      {moreOpen && !clearConfirm && (
        <div className="quick-sheet-overlay active" onClick={closeMore}>
          <div className="quick-sheet" onClick={(e) => e.stopPropagation()} style={{ transform: 'translateY(0)' }}>
            <div className="quick-sheet-handle" /><div className="quick-sheet-head"><span className="quick-sheet-title">{t('chat.more')}</span></div>
            <div className="quick-sheet-body" style={{ gap: 2 }}>
              <button type="button" className="action-row" onClick={() => { setMoreOpen(false); setStatusPickerOpen(true); }}>
                <div className="action-row-icon chat-status-action-icon">
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M8.5 12h7" />
                    <path d="M12 8.5v7" />
                  </svg>
                </div>
                <div className="action-row-text">
                  <span className="action-row-label">{t('chat.changeStatus')}</span>
                  <span className="action-row-hint">{t(`chat.presence.${savedPresence}`)}</span>
                </div>
              </button>
              <button type="button" className="action-row" onClick={() => setClearConfirm(true)}>
                <div className="action-row-icon danger"><svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></div>
                <div className="action-row-text"><span className="action-row-label" style={{ color: 'var(--danger)' }}>{t('chat.clearHistory')}</span></div>
              </button>
              <button type="button" className="action-row" onClick={handleExportChat}>
                <div className="action-row-icon export"><svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg></div>
                <div className="action-row-text"><span className="action-row-label">{t('chat.exportChat')}</span></div>
              </button>
            </div>
            <div className="quick-sheet-actions"><button type="button" className="btn-ghost" onClick={closeMore}>{t('sheet.cancel')}</button></div>
          </div>
        </div>
      )}

      {/* Clear Confirm */}
      {clearConfirm && createPortal(
        <div className="confirm-sheet-overlay active" onClick={closeMore}>
          <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="quick-sheet-handle" /><div className="confirm-sheet-body"><p className="confirm-sheet-text">{t('chat.clearConfirm')}</p></div>
            <div className="confirm-sheet-actions">
              <button type="button" className="btn-ghost" onClick={closeMore}>{t('sheet.cancel')}</button>
              <button type="button" className="btn-primary" onClick={handleClearChat} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>{t('chat.confirmClear')}</button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Message Action Sheet */}
      {actionMsgId && !deleteConfirmId && createPortal(
        <div className="confirm-sheet-overlay active" onClick={closeActionMenu}>
          <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="quick-sheet-handle" />
            <div className="quick-sheet-body" style={{ gap: 2 }}>
              {/* Copy — only for text messages, not revoked */}
              {actionMsg?.type === 'text' && !isRevoked && (
                <button type="button" className="action-row" onClick={handleCopyMsg}>
                  <div className="action-row-icon export"><svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg></div>
                  <div className="action-row-text"><span className="action-row-label">{t('msg.copy')}</span></div>
                </button>
              )}
              {/* Revoke — only for user messages, not already revoked */}
              {isMyMsg && !isRevoked && (
                <button type="button" className="action-row" onClick={handleRevokeMsg}>
                  <div className="action-row-icon" style={{ background: 'rgba(232,165,90,0.12)', color: 'var(--amber)' }}>
                    <svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
                  </div>
                  <div className="action-row-text"><span className="action-row-label" style={{ color: 'var(--amber)' }}>{t('msg.revoke')}</span></div>
                </button>
              )}
              {/* Delete */}
              <button type="button" className="action-row" onClick={() => setDeleteConfirmId(actionMsgId)}>
                <div className="action-row-icon danger"><svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></div>
                <div className="action-row-text"><span className="action-row-label" style={{ color: 'var(--danger)' }}>{t('msg.delete')}</span></div>
              </button>
              {/* Save to memory — only for text, not revoked */}
              {actionMsg?.type === 'text' && !isRevoked && (
                <button type="button" className="action-row" onClick={handleSaveMemory}>
                  <div className="action-row-icon" style={{ background: 'rgba(194,149,216,0.12)', color: 'var(--journal)' }}>
                    <svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                  </div>
                  <div className="action-row-text"><span className="action-row-label">{t('msg.saveMemory')}</span></div>
                </button>
              )}
              {/* Create todo — only for text, not revoked */}
              {actionMsg?.type === 'text' && !isRevoked && (
                <button type="button" className="action-row" onClick={handleCreateTodo}>
                  <div className="action-row-icon" style={{ background: 'rgba(93,184,114,0.12)', color: 'var(--success)' }}>
                    <svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                  </div>
                  <div className="action-row-text"><span className="action-row-label">{t('msg.createTodo')}</span></div>
                </button>
              )}
              {/* Regenerate — only for last Luna message, not revoked */}
              {isLastLunaMsg && !isRevoked && (
                <button type="button" className="action-row" onClick={handleRegenerate}>
                  <div className="action-row-icon import"><svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg></div>
                  <div className="action-row-text"><span className="action-row-label">{t('msg.regenerate')}</span></div>
                </button>
              )}
            </div>
            <div className="quick-sheet-actions"><button type="button" className="btn-ghost" onClick={closeActionMenu}>{t('sheet.cancel')}</button></div>
          </div>
        </div>, document.body
      )}

      {/* Delete Confirm */}
      {deleteConfirmId && createPortal(
        <div className="confirm-sheet-overlay active" onClick={closeActionMenu}>
          <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="quick-sheet-handle" /><div className="confirm-sheet-body"><p className="confirm-sheet-text">{t('msg.deleteConfirm')}</p></div>
            <div className="confirm-sheet-actions">
              <button type="button" className="btn-ghost" onClick={closeActionMenu}>{t('sheet.cancel')}</button>
              <button type="button" className="btn-primary" onClick={handleDeleteMsg} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>{t('msg.confirmDelete')}</button>
            </div>
          </div>
        </div>, document.body
      )}
      {statusPickerOpen && (
        <ChatStatusSheet
          currentStatus={savedPresence}
          onSelect={handleStatusSelect}
          onClose={closeStatusPicker}
        />
      )}
      <ChatBackgroundModal open={bgOpen} onClose={() => setBgOpen(false)} onChange={setChatBg} />
    </section>
  );
}
