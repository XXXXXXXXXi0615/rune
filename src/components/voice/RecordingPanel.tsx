import { MicIcon, SendIcon } from './VoiceIcons';
import { WaveformBars } from './WaveformBars';
import styles from './Voice.module.css';

function formatRecordingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

interface RecordingPanelProps {
  visible: boolean;
  elapsedSeconds: number;
  waveform: number[];
  isFallback: boolean;
  onCancel: () => void;
  onSend: () => void;
}

export function RecordingPanel({
  visible,
  elapsedSeconds,
  waveform,
  isFallback,
  onCancel,
  onSend,
}: RecordingPanelProps) {
  if (!visible) return null;

  return (
    <section className={styles.recordingPanel} aria-label="錄音面板">
      <div className={styles.recordingTop}>
        <div className={styles.recordingStatus}>
          <span className={styles.recordingDot} />
          <span>{isFallback ? '錄音預覽模式' : '正在錄音'}</span>
        </div>
        <span className={styles.recordingTimer}>{formatRecordingTime(elapsedSeconds)}</span>
      </div>

      <div className={styles.recordingWave}>
        <MicIcon size={18} />
        <WaveformBars bars={waveform} animated compact />
      </div>

      <div className={styles.sttPreview}>
        <span className={styles.sttPreviewLabel}>語音轉文字預覽</span>
        <p>語音轉文字預覽，尚未接入真實 STT。</p>
      </div>

      <div className={styles.recordingActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          取消
        </button>
        <button type="button" className={styles.primaryButton} onClick={onSend}>
          <SendIcon size={16} />
          傳送
        </button>
      </div>
    </section>
  );
}
