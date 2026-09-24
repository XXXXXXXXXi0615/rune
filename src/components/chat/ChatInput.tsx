import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { t } from '@/i18n';
import { useAppStore, selectAgentDisplayName } from '@/store/useAppStore';
import { useVoiceRecorder, type RecordedVoice } from '@/hooks/useVoiceRecorder';
import { ScriptedVoiceEditor } from '@/components/chat/ScriptedVoiceEditor';
import { WAVEFORM_PEAK_COUNT } from '@/utils/voiceMessage';
import type { VoiceMessagePayload } from '@/types';
import { LunartideThinkingOrb } from '@/features/agentActivity/LunartideThinkingOrb';
import { emitAgentActivity, resetAgentActivity } from '@/features/agentActivity/agentActivityState';
import { ChatPerch, type ChatPerchState } from '@/components/chat/ChatPerch';

export interface ChatInputHandle {
  insertEmoji: (emoji: string) => void;
  insertText: (text: string) => void;
}

interface ChatInputProps {
  onSend: (text: string) => void;
  onAttach: (target: 'image' | 'sticker') => void;
  isBusy: boolean;
  placeholder?: string;
  onVoiceSend?: (voice: RecordedVoice) => void;
  onVoiceError?: (message: string) => void;
  onScriptedVoice?: (payload: VoiceMessagePayload) => void;
  onStartCall?: (kind: 'voice' | 'video') => void;
  hasPayload?: boolean;
  onPastedUrl?: (url: string) => void;
  aiState?: 'idle' | 'thinking' | 'streaming' | 'error';
  hasConversation?: boolean;
  agentAvailable?: boolean;
  replyName?: string;
  /** When provided, shows a narration button that sends text as narrator (旁白). */
  onNarrate?: (text: string) => void;
}

const AGENT_PLACEHOLDERS = [
  '輸入訊息…',
  '寫下你的想法…',
];

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput({ onSend, onAttach, isBusy, placeholder: placeholderOverride, onVoiceSend, onVoiceError, onScriptedVoice, onStartCall, hasPayload = false, onPastedUrl, aiState = 'idle', hasConversation = true, agentAvailable = true, replyName, onNarrate }, ref) {
    const [text, setText] = useState('');
    const [utilityTrayOpen, setUtilityTrayOpen] = useState(false);
    const [modeSheetOpen, setModeSheetOpen] = useState(false);
    const [callSheetOpen, setCallSheetOpen] = useState(false);
    const [scriptedOpen, setScriptedOpen] = useState(false);
    const [placeholder] = useState(() => {
      const agentName = selectAgentDisplayName(useAppStore.getState().partner);
      const pool = [`問 ${agentName} 任何事`, ...AGENT_PLACEHOLDERS];
      return pool[Math.floor(Math.random() * pool.length)];
    });
    const inputAreaRef = useRef<HTMLDivElement>(null);
    const utilityTriggerRef = useRef<HTMLButtonElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const handsFreeRef = useRef(false);
    const handleVoiceComplete = useCallback((voice: RecordedVoice) => onVoiceSend?.(voice), [onVoiceSend]);
    const handleVoiceError = useCallback((message: string) => onVoiceError?.(message), [onVoiceError]);
    const recorder = useVoiceRecorder(handleVoiceComplete, handleVoiceError);
    const status = recorder.status;
    const isRecording = recorder.isBusy;
    const voiceActivityIdRef = useRef(`voice:${crypto.randomUUID()}`);
    const composingRef = useRef(false);
    const [focused, setFocused] = useState(false);
    const [draftPaused, setDraftPaused] = useState(false);
    const [sending, setSending] = useState(false);
    const [received, setReceived] = useState(false);
    const [sleepy, setSleepy] = useState(false);
    const previousAiState = useRef(aiState);
    const activityTimer = useRef<number | undefined>(undefined);

    const markActive = useCallback(() => {
      setSleepy(false);
      if (activityTimer.current) window.clearTimeout(activityTimer.current);
      activityTimer.current = window.setTimeout(() => setSleepy(true), 180_000);
    }, []);

    useEffect(() => {
      markActive();
      return () => { if (activityTimer.current) window.clearTimeout(activityTimer.current); };
    }, [markActive]);

    useEffect(() => {
      if (!text) { setDraftPaused(false); return; }
      setDraftPaused(false);
      markActive();
      const timer = window.setTimeout(() => setDraftPaused(true), 1_200);
      return () => window.clearTimeout(timer);
    }, [markActive, text]);

    useEffect(() => {
      const previous = previousAiState.current;
      previousAiState.current = aiState;
      if ((previous === 'thinking' || previous === 'streaming') && aiState === 'idle') {
        setReceived(true);
        const timer = window.setTimeout(() => setReceived(false), 1_800);
        return () => window.clearTimeout(timer);
      }
    }, [aiState]);

    useEffect(() => {
      if (status === 'requesting-permission' || status === 'recording' || status === 'lock-ready' || status === 'locked' || status === 'paused') {
        emitAgentActivity({ type: 'voice_listening', requestId: voiceActivityIdRef.current });
      } else {
        resetAgentActivity(voiceActivityIdRef.current);
        if (status === 'idle') voiceActivityIdRef.current = `voice:${crypto.randomUUID()}`;
      }
    }, [status]);

    useEffect(() => () => resetAgentActivity(voiceActivityIdRef.current), []);

    useEffect(() => {
      if (!isBusy && !isRecording) textareaRef.current?.focus();
    }, [isBusy, isRecording]);

    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = '0px';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [text]);

    useEffect(() => {
      if (handsFreeRef.current && status === 'recording') {
        handsFreeRef.current = false;
        recorder.commitLock();
      }
    }, [status, recorder]);

    useEffect(() => {
      if (!utilityTrayOpen && !modeSheetOpen && !callSheetOpen) return;
      const closePanels = (restoreFocus = false) => {
        setUtilityTrayOpen(false);
        setModeSheetOpen(false);
        setCallSheetOpen(false);
        if (restoreFocus) requestAnimationFrame(() => utilityTriggerRef.current?.focus());
      };
      const onPointerDown = (event: PointerEvent) => {
        if (!inputAreaRef.current?.contains(event.target as Node)) closePanels();
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closePanels(true);
      };
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
      return () => {
        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('keydown', onKeyDown);
      };
    }, [callSheetOpen, modeSheetOpen, utilityTrayOpen]);

    useImperativeHandle(ref, () => ({
      insertEmoji: (emoji: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? text.length;
        const end = el.selectionEnd ?? text.length;
        const newText = text.slice(0, start) + emoji + text.slice(end);
        setText(newText);
        setTimeout(() => {
          el.focus();
          el.selectionStart = el.selectionEnd = start + emoji.length;
        }, 0);
      },
      insertText: (t: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? text.length;
        const end = el.selectionEnd ?? text.length;
        const newText = text.slice(0, start) + t + text.slice(end);
        setText(newText);
        setTimeout(() => {
          el.focus();
          el.selectionStart = el.selectionEnd = start + t.length;
        }, 0);
      },
    }), [text]);

    const handleSend = () => {
      const trimmed = text.trim();
      if ((!trimmed && !hasPayload) || isBusy) return;
      onSend(trimmed);
      setText('');
      setSending(true);
      markActive();
      window.setTimeout(() => setSending(false), 650);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !composingRef.current) {
        e.preventDefault();
        handleSend();
      }
    };

    const canSend = (text.trim().length > 0 || hasPayload) && !isBusy;
    const perchState: ChatPerchState = sending ? 'sending'
      : aiState === 'thinking' || aiState === 'streaming' ? 'waiting'
        : received ? 'received'
          : text.length > 0 ? (draftPaused ? 'paused' : 'typing')
            : focused ? 'focused'
              : sleepy ? 'sleepy'
                : 'idle';
    const contextualPlaceholder = replyName ? `回覆 ${replyName}……`
      : !hasConversation ? '選擇夥伴後即可開始聊天。'
        : !agentAvailable ? '先留下來，連上後再回覆。'
          : aiState === 'thinking' || aiState === 'streaming' ? '它正在整理要說的話……'
            : draftPaused ? '繼續，我還在。'
              : focused ? '我在聽。'
                : '想說什麼就說。';

    const startHandsFreeRecording = () => {
      setModeSheetOpen(false);
      handsFreeRef.current = true;
      void recorder.start();
    };

    const openScriptedEditor = () => {
      setUtilityTrayOpen(false);
      setModeSheetOpen(false);
      setScriptedOpen(true);
    };

    const recordingState = status === 'cancel-ready' ? 'cancelling' : status;
    const showLockedActions = status === 'locked' || status === 'paused';

    return (
      <div className="chat-input-area" ref={inputAreaRef}>
        <div className={`chat-composer tg-composer${isRecording ? ' is-recording' : ''}`}>
          <ChatPerch state={perchState} />
          {isRecording ? (
            <div
              className={`chat-voice-recording${status === 'cancel-ready' ? ' is-cancelling' : ''}`}
              role="status"
              aria-live="polite"
              data-recording-state={recordingState}
            >
              <LunartideThinkingOrb activity="listening" decorative />
              <span className="chat-voice-recording__time">{formatElapsed(recorder.elapsedMs)}</span>
              <span className="chat-voice-recording__wave" aria-hidden="true">
                {Array.from({ length: WAVEFORM_PEAK_COUNT }, (_, index) => (
                  <i key={index} style={{ height: `${Math.max(3, (recorder.liveWaveform.at(index - WAVEFORM_PEAK_COUNT) || 0.06) * 28)}px` }} />
                ))}
              </span>
              {showLockedActions ? (
                <span className="chat-voice-recording__actions">
                  <button type="button" onClick={recorder.cancel}>取消</button>
                  <button type="button" onClick={status === 'paused' ? recorder.resume : recorder.pause}>{status === 'paused' ? '繼續' : '暫停'}</button>
                  <button type="button" className="is-primary" onClick={recorder.send}>發送</button>
                </span>
              ) : (
                <span className="chat-voice-recording__hint">
                  {status === 'cancel-ready' ? '放開取消' : status === 'lock-ready' ? '放開鎖定' : status === 'finalizing' ? '處理中…' : status === 'requesting-permission' ? '請允許麥克風…' : '左滑取消 · 上滑鎖定'}
                </span>
              )}
            </div>
          ) : (
            <>
              <button
                ref={utilityTriggerRef}
                type="button"
                className="tg-btn tg-btn-attach chat-utility-trigger"
                onClick={() => {
                  setModeSheetOpen(false);
                  setCallSheetOpen(false);
                  setUtilityTrayOpen((open) => !open);
                }}
                aria-label={utilityTrayOpen ? '關閉工具' : '開啟工具'}
                aria-expanded={utilityTrayOpen}
                aria-controls="chat-utility-tray"
                data-testid="composer-utility-trigger"
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="6" height="6" rx="2" />
                  <rect x="14" y="4" width="6" height="6" rx="2" />
                  <rect x="4" y="14" width="6" height="6" rx="2" />
                  <rect x="14" y="14" width="6" height="6" rx="2" />
                </svg>
              </button>

              <div className="tg-input-capsule">
                <textarea
                  ref={textareaRef}
                  value={text}
                  disabled={!hasConversation}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => { setFocused(true); markActive(); }}
                  onBlur={() => setFocused(false)}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData('text').trim();
                    if (/^https?:\/\/\S+$/i.test(pasted)) onPastedUrl?.(pasted);
                  }}
                  placeholder={placeholderOverride || contextualPlaceholder || placeholder}
                  aria-label={t('chat.inputLabel')}
                  rows={1}
                  className="tg-textarea"
                />
              </div>
            </>
          )}

          {!isRecording && (
            <>
              {onNarrate && canSend && (
                <button type="button" className="tg-btn tg-btn-narrate" onClick={() => { onNarrate(text.trim()); setText(''); }} aria-label="旁白" disabled={isBusy} data-testid="composer-narrate" title="以旁白身分發送">
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                </button>
              )}
              <button type="button" className="tg-btn tg-btn-send" onClick={handleSend} aria-label={t('chat.send')} disabled={!canSend} data-testid="composer-send">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </>
          )}
        </div>

        {utilityTrayOpen && !isRecording && (
          <div id="chat-utility-tray" className="chat-utility-tray" role="menu" aria-label="聊天工具" data-testid="composer-utility-tray" data-pet-safe-region="interactive">
            <button type="button" role="menuitem" onClick={() => { setUtilityTrayOpen(false); onAttach('image'); }}>
              <span className="chat-utility-tray__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="8" cy="9" r="1.5"/><path d="m21 15-5-5-8 8"/></svg></span>
              <span>圖片</span>
            </button>
            <button type="button" role="menuitem" onClick={() => { setUtilityTrayOpen(false); onAttach('sticker'); }}>
              <span className="chat-utility-tray__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v9a7 7 0 0 1-7 7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 21v-5a2 2 0 0 1 2-2h5"/><path d="M8 9h.01M16 9h.01M8 13c1.2 1.2 2.5 1.8 4 1.8s2.8-.6 4-1.8"/></svg></span>
              <span>貼圖</span>
            </button>
            <button type="button" role="menuitem" className="tg-btn-voice" onClick={() => { setUtilityTrayOpen(false); setModeSheetOpen(true); }}>
              <span className="chat-utility-tray__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg></span>
              <span>語音</span>
            </button>
            <button type="button" role="menuitem" className="tg-btn-call" onClick={() => { setUtilityTrayOpen(false); setModeSheetOpen(false); setCallSheetOpen(true); }}>
              <span className="chat-utility-tray__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7.2 3.8 9.7 7a2 2 0 0 1-.1 2.5l-1.3 1.4a15.5 15.5 0 0 0 4.8 4.8l1.4-1.3a2 2 0 0 1 2.5-.1l3.2 2.5a2 2 0 0 1 .4 2.7l-.8 1.1a3 3 0 0 1-2.8 1.2C9.4 20.7 3.3 14.6 2.2 7a3 3 0 0 1 1.2-2.8l1.1-.8a2 2 0 0 1 2.7.4Z"/></svg></span>
              <span>通話</span>
            </button>
          </div>
        )}

        {modeSheetOpen && !isRecording && (
          <div className="chat-voice-mode" role="menu" aria-label="語音訊息模式" data-testid="voice-mode-sheet" data-pet-safe-region="interactive">
            <button type="button" role="menuitem" onClick={startHandsFreeRecording}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>
              <span>真實錄音</span>
              <small>用麥克風錄一段語音</small>
            </button>
            <button type="button" role="menuitem" onClick={openScriptedEditor}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>
              <span>文字演繹</span>
              <small>寫一段文字，用聲音演出來</small>
            </button>
          </div>
        )}

        {callSheetOpen && !isRecording && (
          <div className="chat-voice-mode chat-call-mode" role="menu" aria-label="即時通話模式" data-testid="call-mode-sheet" data-pet-safe-region="interactive">
            <button type="button" role="menuitem" onClick={() => { setCallSheetOpen(false); onStartCall?.('voice'); }}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.2 3.8 9.7 7a2 2 0 0 1-.1 2.5l-1.3 1.4a15.5 15.5 0 0 0 4.8 4.8l1.4-1.3a2 2 0 0 1 2.5-.1l3.2 2.5a2 2 0 0 1 .4 2.7l-.8 1.1a3 3 0 0 1-2.8 1.2C9.4 20.7 3.3 14.6 2.2 7a3 3 0 0 1 1.2-2.8l1.1-.8a2 2 0 0 1 2.7.4Z"/></svg>
              <span>語音通話</span>
              <small>開始即時語音通話</small>
            </button>
            <button type="button" role="menuitem" onClick={() => { setCallSheetOpen(false); onStartCall?.('video'); }}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3Z"/></svg>
              <span>視訊通話</span>
              <small>開始即時視訊通話</small>
            </button>
          </div>
        )}

        {scriptedOpen && (
          <ScriptedVoiceEditor
            onClose={() => setScriptedOpen(false)}
            onSubmit={(payload) => {
              setScriptedOpen(false);
              onScriptedVoice?.(payload);
            }}
          />
        )}
      </div>
    );
  }
);
