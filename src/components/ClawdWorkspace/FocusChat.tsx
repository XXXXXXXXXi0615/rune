import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { sendChatMessage } from '@/ai/client';
import { resolveProviderRequestConfig, resolveActiveProvider } from '@/ai/providerRuntime';
import { buildSystemPrompt } from '@/ai/prompts';
import type { ChatMessage } from '@/ai/types';

/* ════════════════════════════════════════
   Focus Chat — mini Luna chat inside Focus timer
   ════════════════════════════════════════ */
/* ════════════════════════════════════════
   Focus Chat — mini Luna chat inside Focus timer
   ════════════════════════════════════════ */

interface FocusContext {
  focusMinutes: number;
  breakMinutes: number;
  rounds: number;
  currentRound: number;
  isRunning: boolean;
  isPaused: boolean;
  phase: 'focus' | 'break';
  remainingSeconds: number;
  completedRounds: number;
}

function buildFocusContextPrompt(ctx: FocusContext): string {
  const r = ctx.remainingSeconds;
  const rm = Math.floor(r / 60);
  const rs = r % 60;
  const timeLeft = `${rm}分${rs}秒`;

  return [
    `[專注模式資訊]`,
    `- 狀態：${ctx.isRunning ? ctx.phase === 'focus' ? '正在專注中' : '休息中' : ctx.isPaused ? '已暫停' : '未開始'}`,
    `- 本輪設定：${ctx.focusMinutes} 分鐘專注 / ${ctx.breakMinutes} 分鐘休息`,
    `- 目前第 ${ctx.currentRound} 輪${ctx.rounds > 0 ? `（目標 ${ctx.rounds} 輪）` : ''}`,
    `- 剩餘時間：${timeLeft}`,
    `- 已完成 ${ctx.completedRounds} 輪`,
    `- 使用者正在專注，回覆必須簡短、不引人分心、以鼓勵與陪伴為主。不要開啟長篇對話。句長控制在 1-2 句。`,
    ctx.phase === 'break' ? '- 使用者正在休息。可以稍微多聊，但以提醒喝水、伸展、休息為優先。' : '',
    ctx.isPaused ? '- 使用者已暫停專注。可以簡短確認是否需要調整。' : '',
  ].filter(Boolean).join('\n');
}

export function FocusChat({ focusContext, isOpen, onClose, onToggle }: {
  focusContext: FocusContext;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  const providers = useAppStore((s) => s.providers || []);
  const aiConfig = useAppStore((s) => s.aiConfig);
  const providerState = resolveActiveProvider(providers);
  const activeProvider = providerState.provider;
  const hasAi = providerState.configured;
  const isLocalMode = !aiConfig.apiKey && !hasAi;

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }
  }, [isOpen, messages.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || generating) return;
    setInput('');
    setGenerating(true);
    setStreamingText('');

    const userMsg = { role: 'user' as const, content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      if (isLocalMode || !activeProvider) {
        const localReply = '請先在設定中啟用 AI 模型，Luna 才能在專注時陪伴你。';
        setMessages([...newMessages, { role: 'assistant', content: localReply }]);
        setGenerating(false);
        return;
      }

      const focusPrompt = buildFocusContextPrompt(focusContext);
      const systemPrompt = buildSystemPrompt(aiConfig.systemPrompt, focusPrompt);
      const chatMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ];
      const config = await resolveProviderRequestConfig(activeProvider, systemPrompt);

      let fullContent = '';
      const generator = sendChatMessage(chatMessages, config);
      for await (const chunk of generator) {
        fullContent += chunk.content;
        setStreamingText(fullContent);
      }
      setStreamingText('');
      const reply = fullContent.trim() || '嗯，我在這裡。';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失敗';
      setMessages([...newMessages, { role: 'assistant', content: msg }]);
      setStreamingText('');
    } finally {
      setGenerating(false);
    }
  }, [input, messages, generating, focusContext, isLocalMode, activeProvider, aiConfig]);

  const providerStatus = isLocalMode ? 'local' : activeProvider ? 'online' : 'offline';

  if (!isOpen) {
    return (
      <button type="button" className="fc-toggle-btn" onClick={onToggle} aria-label="Luna Chat" title="和 Luna 說一句">
        <svg className="fc-toggle-icon" viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className={`fc-toggle-dot fc-dot-${providerStatus}`} />
      </button>
    );
  }

  const hasMessages = messages.length > 0 || streamingText;

  return (
    <>
      {/* Mobile backdrop */}
      <div className="fc-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="fc-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fc-header">
          <span className="fc-header-title">Luna Chat</span>
          <div className="fc-header-actions">
            <button type="button" className="fc-header-btn" onClick={onToggle} aria-label="最小化">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <button type="button" className="fc-header-btn" onClick={onClose} aria-label="關閉">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="fc-messages" ref={scrollRef}>
          {!hasMessages ? (
            <div className="fc-empty">
              <p className="fc-empty-title">和 Luna 說一句</p>
              <p className="fc-empty-sub">
                {focusContext.isRunning
                  ? focusContext.phase === 'focus'
                    ? `正在專注中，還剩 ${Math.floor(focusContext.remainingSeconds / 60)} 分鐘。需要打氣嗎？`
                    : '休息中，需要提醒喝水嗎？'
                  : '我可以陪著你，一起專注。'}
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`fc-msg${m.role === 'user' ? ' fc-msg--user' : ''}`}>
                <div className="fc-msg-bubble">{m.content}</div>
              </div>
            ))
          )}
          {streamingText && (
            <div className="fc-msg">
              <div className="fc-msg-bubble fc-streaming">
                {streamingText}
                <span className="fc-stream-cursor" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="fc-input-row">
          <input
            ref={inputRef}
            className="fc-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={generating ? '等待回覆…' : '說一句…'}
            disabled={generating}
          />
          <button type="button" className="fc-send-btn" onClick={handleSend} disabled={generating || !input.trim()} aria-label="發送">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
