import type { VoiceMessage } from '@/types';
import { ChevronIcon, ImageIcon, ImageOffIcon, MemoryIcon, MoonIcon, RefreshIcon, TrashIcon, UserVoiceIcon } from './VoiceIcons';
import { VoiceDisc } from './VoiceDisc';
import { WaveformBars } from './WaveformBars';
import styles from './Voice.module.css';

function formatDuration(ms?: number): string {
  const totalSeconds = Math.max(0, Math.round((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface VoiceBubbleProps {
  message: VoiceMessage;
  isPlaying: boolean;
  progress: number;
  transcriptOpen: boolean;
  onTogglePlay: (id: string) => void;
  onToggleTranscript: (id: string) => void;
  onCycleSpeed: (id: string) => void;
  onSaveMemory: (id: string) => void;
  onDelete: (id: string) => void;
  onRetranscribe: (id: string) => void;
  onChangeArtwork: (id: string) => void;
  onRemoveArtwork: (id: string) => void;
}

export function VoiceBubble({
  message,
  isPlaying,
  progress,
  transcriptOpen,
  onTogglePlay,
  onToggleTranscript,
  onCycleSpeed,
  onSaveMemory,
  onDelete,
  onRetranscribe,
  onChangeArtwork,
  onRemoveArtwork,
}: VoiceBubbleProps) {
  const isUser = message.role === 'user';
  const isVoice = Boolean(message.audioUrl) || message.source === 'recording' || message.source === 'upload';
  const transcriptLabel = transcriptOpen ? '收起文字轉錄' : '查看文字轉錄';
  const speed = message.speed || 1;
  const isSessionAudio = message.audioPersistence === 'session' || message.audioUrl?.startsWith('blob:');
  const isMockTranscript = message.transcriptSource === 'mock';
  const hasSavedMemory = Boolean(message.memoryEntryId || message.allowMemory);
  const canSaveTranscript = message.transcriptStatus === 'done' && Boolean((message.transcript || '').trim());

  return (
    <article className={`${styles.messageRow} ${isUser ? styles.messageRowUser : styles.messageRowAssistant}`}>
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarLunaris}`} aria-hidden="true">
        {isUser ? <UserVoiceIcon size={17} /> : <MoonIcon size={17} />}
      </div>

      <div className={styles.messageStack}>
        {message.text && !isVoice && (
          <div className={`${styles.textBubble} ${isUser ? styles.textBubbleUser : styles.textBubbleAssistant}`}>
            {message.text}
          </div>
        )}

        {isVoice && (
          <>
            <div className={`${styles.voiceBubble} ${isUser ? styles.voiceBubbleUser : styles.voiceBubbleAssistant}`}>
              <VoiceDisc
                artworkUrl={message.artworkUrl}
                playing={isPlaying}
                disabled={!message.audioUrl}
                onToggle={() => onTogglePlay(message.id)}
              />
              <WaveformBars bars={message.waveform || []} progress={isPlaying ? progress : 0} />
              <span className={styles.duration}>{formatDuration(message.durationMs)}</span>
              <button
                type="button"
                className={styles.speedChip}
                onClick={() => onCycleSpeed(message.id)}
                aria-label={`切換播放速度，目前 ${speed} 倍`}
              >
                {speed}x
              </button>
            </div>

            <div className={styles.voiceMeta}>
              {message.fileName && <span className={styles.fileName} title={message.fileName}>{message.fileName}</span>}
              {isSessionAudio && <span className={styles.sessionPill}>本次暫存</span>}
              {hasSavedMemory && <span className={styles.sessionPill}>已保存轉錄</span>}
              {hasSavedMemory && isSessionAudio && <span className={styles.sessionPill}>音訊原檔未保存</span>}
              <span>{formatTime(message.createdAt)}</span>
            </div>

            <button
              type="button"
              className={`${styles.transcriptToggle} ${transcriptOpen ? styles.transcriptToggleOpen : ''}`}
              onClick={() => onToggleTranscript(message.id)}
              aria-expanded={transcriptOpen}
            >
              <ChevronIcon size={14} />
              {transcriptLabel}
            </button>

            {transcriptOpen && (
              <div className={styles.transcriptBox}>
                {message.transcriptStatus === 'pending' && (
                  <span className={styles.transcriptMuted}>轉錄中。本版使用本地 mock 預覽，尚未連接 STT API。</span>
                )}
                {message.transcriptStatus === 'failed' && (
                  <span className={styles.transcriptError}>轉錄失敗，可重試。</span>
                )}
                {message.transcriptStatus === 'none' && (
                  <span className={styles.transcriptMuted}>尚未產生文字轉錄。</span>
                )}
                {message.transcriptStatus === 'done' && (
                  <>
                    <p>{message.transcript || '語音轉文字預覽，尚未接入真實 STT。'}</p>
                    {isMockTranscript && (
                      <p className={styles.mockNotice}>這是 mock 轉錄，保存前請先確認文字內容。</p>
                    )}
                  </>
                )}
              </div>
            )}

            {isUser && (
              <div className={styles.actionRow} aria-label="音訊操作">
                {hasSavedMemory && <span className={styles.savedPill}>已收錄</span>}
                <button
                  type="button"
                  className={`${styles.actionButton} ${hasSavedMemory ? styles.actionButtonSaved : ''}`}
                  onClick={() => onSaveMemory(message.id)}
                  disabled={!canSaveTranscript}
                >
                  <MemoryIcon size={15} />
                  {hasSavedMemory ? '更新記憶' : message.transcriptStatus === 'done' ? '保存轉錄到記憶' : '等待轉錄'}
                </button>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => onChangeArtwork(message.id)}
                >
                  <ImageIcon size={15} />
                  更換唱片封面
                </button>
                {message.artworkUrl && (
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => onRemoveArtwork(message.id)}
                  >
                    <ImageOffIcon size={15} />
                    移除唱片封面
                  </button>
                )}
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => onRetranscribe(message.id)}
                >
                  <RefreshIcon size={15} />
                  重新轉錄
                </button>
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                  onClick={() => onDelete(message.id)}
                >
                  <TrashIcon size={15} />
                  刪除音訊
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
