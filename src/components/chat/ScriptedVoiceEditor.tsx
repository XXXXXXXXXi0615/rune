import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VoiceMessagePayload } from '@/types';
import { buildScriptedVoicePayload, estimateScriptedDurationMs } from '@/utils/scriptedVoice';
import { getTtsEndpoint } from '@/utils/ttsClient';
import { usePetRecede } from '@/hooks/usePetRecede';

interface ScriptedVoiceEditorProps {
  onClose: () => void;
  onSubmit: (payload: VoiceMessagePayload) => void;
}

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
}

/** Compact in-chat tool for composing a text-performed (scripted) voice message. */
export function ScriptedVoiceEditor({ onClose, onSubmit }: ScriptedVoiceEditorProps) {
  const [text, setText] = useState('');
  const [rate, setRate] = useState(1);
  const [voiceUri, setVoiceUri] = useState('');
  const [useTts, setUseTts] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const previewUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const ttsAvailable = Boolean(getTtsEndpoint());
  usePetRecede(true);

  useEffect(() => {
    if (!supported) return undefined;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const sorted = [...all].sort((a, b) => {
        const aZh = a.lang.startsWith('zh') ? 0 : 1;
        const bZh = b.lang.startsWith('zh') ? 0 : 1;
        return aZh - bZh || a.name.localeCompare(b.name);
      });
      setVoices(sorted);
    };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const selectedVoice = voices.find((voice) => voice.voiceURI === voiceUri);
  const estimatedMs = useMemo(() => estimateScriptedDurationMs(text, rate), [text, rate]);
  const canSubmit = text.trim().length > 0;

  const stopPreview = () => {
    if (supported) window.speechSynthesis.cancel();
    previewUtteranceRef.current = null;
    setPreviewing(false);
  };

  const handlePreview = () => {
    if (!supported || !canSubmit) return;
    if (previewing) {
      stopPreview();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = rate;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = selectedVoice?.lang || document.documentElement.lang || 'zh-TW';
    utterance.onend = () => setPreviewing(false);
    utterance.onerror = () => setPreviewing(false);
    previewUtteranceRef.current = utterance;
    setPreviewing(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    stopPreview();
    const payload = buildScriptedVoicePayload({
      text,
      rate,
      voiceName: selectedVoice?.name,
      voiceUri: selectedVoice?.voiceURI,
      lang: selectedVoice?.lang || 'zh-TW',
    });
    if (useTts && ttsAvailable) {
      onSubmit({ ...payload, source: 'tts', ttsStatus: 'pending' });
    } else {
      onSubmit(payload);
    }
  };

  return createPortal(
    <div className="scripted-voice-backdrop" onClick={onClose}>
      <div
        className="scripted-voice-editor"
        role="dialog"
        aria-modal="true"
        aria-label="文字演繹語音編輯器"
        data-testid="scripted-voice-editor"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="scripted-voice-editor__head">
          <span className="scripted-voice-editor__title">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>
            文字演繹語音
          </span>
          <button type="button" className="scripted-voice-editor__close" onClick={onClose} aria-label="關閉文字演繹編輯器">
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <textarea
          className="scripted-voice-editor__text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="寫下想用聲音演出來的話…"
          aria-label="演繹文字"
          rows={3}
          autoFocus
          data-testid="scripted-voice-text"
        />

        <div className="scripted-voice-editor__controls">
          <label className="scripted-voice-editor__control">
            <span>語速</span>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              aria-label="語速"
            />
            <em>{rate.toFixed(2)}×</em>
          </label>
          <label className="scripted-voice-editor__control">
            <span>聲音</span>
            <select value={voiceUri} onChange={(event) => setVoiceUri(event.target.value)} aria-label="角色聲音">
              <option value="">預設聲音</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}（{voice.lang}）</option>
              ))}
            </select>
          </label>
        </div>

        {!supported && <p className="scripted-voice-editor__warn">此裝置不支援語音合成，播放時將顯示逐字字幕。</p>}

        {ttsAvailable && (
          <label className="scripted-voice-editor__tts">
            <input type="checkbox" checked={useTts} onChange={(event) => setUseTts(event.target.checked)} />
            <span>升級為 TTS 真實音訊（由後端生成並存入本機）</span>
          </label>
        )}

        <footer className="scripted-voice-editor__actions">
          <span className="scripted-voice-editor__duration" data-testid="scripted-voice-duration">
            {canSubmit ? `預估 ${formatDuration(estimatedMs)}` : '預估時間 —'}
          </span>
          <button type="button" onClick={handlePreview} disabled={!supported || !canSubmit} aria-pressed={previewing}>
            {previewing ? '停止試聽' : '試聽'}
          </button>
          <button type="button" className="is-primary" onClick={handleSubmit} disabled={!canSubmit} data-testid="scripted-voice-send">
            送出
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
