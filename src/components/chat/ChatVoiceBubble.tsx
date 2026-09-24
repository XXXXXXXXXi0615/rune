import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatVoiceMessage } from '@/types';
import { getAsset } from '@/store/assets';
import { splitCaptionSegments } from '@/utils/scriptedVoice';
import { getVoiceMessageText } from '@/utils/voiceMessage';
import { runTtsPipeline } from '@/utils/ttsClient';
import { useVoiceTextStore } from '@/store/useVoiceTextStore';

/** Only one voice playback (audio element OR speech synthesis) at a time. */
let activeStop: (() => void) | null = null;

function claimPlayback(stop: () => void) {
  if (activeStop && activeStop !== stop) activeStop();
  activeStop = stop;
}

function releasePlayback(stop: () => void) {
  if (activeStop === stop) activeStop = null;
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Waveform({ waveform, progress }: { waveform: number[]; progress: number }) {
  return (
    <div className="chat-voice-bubble__wave" aria-hidden="true">
      {waveform.map((peak, index) => (
        <i
          key={index}
          className={waveform.length && index / waveform.length <= progress ? 'is-played' : ''}
          style={{ height: `${Math.max(3, peak * 26)}px` }}
        />
      ))}
    </div>
  );
}

/* ── Recorded / TTS-ready: real audio from IndexedDB ── */
function AudioVoiceBody({ message }: { message: ChatVoiceMessage }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState(1);
  const stopRef = useRef(() => { audioRef.current?.pause(); });

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    if (!message.audioAssetId) return undefined;
    void getAsset(message.audioAssetId).then((blob) => {
      if (!blob || disposed) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => undefined);
    const stop = stopRef.current;
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      releasePlayback(stop);
    };
  }, [message.audioAssetId]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.paused) {
      claimPlayback(stopRef.current);
      await audio.play();
    } else {
      audio.pause();
    }
  };

  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={(event) => setProgress(event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration : 0)}
      />
      <button type="button" className="chat-voice-bubble__play" onClick={toggle} aria-label={playing ? '暫停語音' : '播放語音'} disabled={!url}>
        {playing ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6z"/></svg>}
      </button>
      <div className="chat-voice-bubble__body">
        <Waveform waveform={message.waveform} progress={progress} />
        <span>{formatDuration(message.durationMs)}</span>
      </div>
      <button type="button" className="chat-voice-bubble__rate" onClick={cycleRate} aria-label="切換播放速度">{rate}×</button>
    </>
  );
}

/* ── Scripted: text performance via local SpeechSynthesis, caption fallback ── */
function ScriptedVoiceBody({ message }: { message: ChatVoiceMessage }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captionCount, setCaptionCount] = useState(0);
  const timerRef = useRef<number | undefined>(undefined);
  const startedAtRef = useRef(0);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const text = message.textSnapshot || message.transcript || '';
  const segments = splitCaptionSegments(text);
  const durationMs = Math.max(1000, message.durationMs || 1000);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    setPlaying(false);
    setProgress(0);
    setCaptionCount(0);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    releasePlayback(stop);
  }, [stop]);

  const beginProgressTimer = (withCaptions: boolean) => {
    startedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setProgress(Math.min(0.99, elapsed / durationMs));
      if (withCaptions) {
        setCaptionCount(Math.min(segments.length, Math.max(1, Math.ceil((elapsed / durationMs) * segments.length))));
      }
      if (elapsed >= durationMs * (supported ? 2.5 : 1)) {
        stop();
        releasePlayback(stop);
      }
    }, 120);
  };

  const play = () => {
    if (playing) {
      stop();
      releasePlayback(stop);
      return;
    }
    if (!text) return;
    claimPlayback(stop);
    setPlaying(true);
    setProgress(0);
    if (supported) {
      const utterance = new SpeechSynthesisUtterance(text);
      const snapshot = message.voiceSnapshot;
      if (snapshot?.rate) utterance.rate = snapshot.rate;
      if (snapshot?.pitch) utterance.pitch = snapshot.pitch;
      utterance.lang = snapshot?.lang || document.documentElement.lang || 'zh-TW';
      if (snapshot?.voiceUri) {
        const voice = window.speechSynthesis.getVoices().find((entry) => entry.voiceURI === snapshot.voiceUri);
        if (voice) utterance.voice = voice;
      }
      utterance.onend = () => { stop(); releasePlayback(stop); };
      utterance.onerror = () => { stop(); releasePlayback(stop); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      beginProgressTimer(false);
    } else {
      beginProgressTimer(true);
    }
  };

  const showFallbackCaptions = !supported && playing;
  const visibleSegments = segments.slice(0, captionCount);

  return (
    <>
      <button
        type="button"
        className="chat-voice-bubble__play"
        onClick={play}
        aria-label={playing ? '停止文字演繹語音' : '播放文字演繹語音'}
      >
        {playing ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6z"/></svg>}
      </button>
      <div className="chat-voice-bubble__body">
        <Waveform waveform={message.waveform} progress={progress} />
        <span>{formatDuration(message.durationMs)}</span>
      </div>
      {showFallbackCaptions && (
        <p className="chat-voice-bubble__transcript" data-testid="scripted-captions">
          {visibleSegments.map((segment, index) => <span key={index}>{segment}</span>)}
        </p>
      )}
    </>
  );
}

/* ── TTS pending / failed ── */
function TtsPendingBody({ message }: { message: ChatVoiceMessage }) {
  const failed = message.ttsStatus === 'failed';
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await runTtsPipeline({ id: message.id, textSnapshot: message.textSnapshot, voiceSnapshot: message.voiceSnapshot });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <>
      <span className={`chat-voice-bubble__tts-state${failed ? ' is-failed' : ''}`} role="status">
        {failed ? '語音生成失敗' : '語音生成中…'}
      </span>
      <div className="chat-voice-bubble__body">
        <Waveform waveform={message.waveform} progress={0} />
        <span>{formatDuration(message.durationMs)}</span>
      </div>
      {failed && (
        <button type="button" className="chat-voice-bubble__rate" onClick={() => void retry()} disabled={retrying} aria-label="重試語音生成">
          重試
        </button>
      )}
      {message.textSnapshot && <p className="chat-voice-bubble__transcript">{message.textSnapshot}</p>}
    </>
  );
}

/** Text available for 語音轉文本 — no real ASR, only existing snapshots. */

export function ChatVoiceBubble({ message, replyQuote }: { message: ChatVoiceMessage; replyQuote?: React.ReactNode }) {
  const source = message.source || 'recorded';
  const isScripted = source === 'scripted';
  const isTtsWithoutAudio = source === 'tts' && (!message.audioAssetId || message.ttsStatus === 'pending' || message.ttsStatus === 'failed');
  const textExpanded = useVoiceTextStore((s) => Boolean(s.expanded[message.id]));
  const collapseText = useVoiceTextStore((s) => s.collapse);
  const voiceText = getVoiceMessageText(message);
  const ariaLabel = isScripted
    ? `文字演繹語音（無音訊檔，由文字演出），長度 ${formatDuration(message.durationMs)}`
    : source === 'tts'
      ? `TTS 語音訊息，長度 ${formatDuration(message.durationMs)}`
      : `語音訊息，長度 ${formatDuration(message.durationMs)}`;

  return (
    <div className={`message-bubble chat-voice-bubble is-${source}`} aria-label={ariaLabel} data-voice-source={source}>
      {replyQuote}
      {source !== 'recorded' && (
        <span className="chat-voice-bubble__badge" aria-hidden="true">{isScripted ? '演繹' : 'TTS'}</span>
      )}
      {isScripted
        ? <ScriptedVoiceBody message={message} />
        : isTtsWithoutAudio
          ? <TtsPendingBody message={message} />
          : <AudioVoiceBody message={message} />}
      {textExpanded && voiceText && (
        <div className="chat-voice-bubble__totext" data-testid="voice-to-text">
          <div className="chat-voice-bubble__totext-head">
            <span>語音文本</span>
            <button type="button" onClick={() => collapseText(message.id)} aria-label="收起語音文本">收起</button>
          </div>
          <p>{voiceText}</p>
        </div>
      )}
    </div>
  );
}
