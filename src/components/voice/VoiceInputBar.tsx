import { MicIcon, PlusIcon, SendIcon } from './VoiceIcons';
import styles from './Voice.module.css';

interface VoiceInputBarProps {
  value: string;
  recording: boolean;
  onChange: (value: string) => void;
  onUpload: () => void;
  onRecord: () => void;
  onSendText: () => void;
}

export function VoiceInputBar({
  value,
  recording,
  onChange,
  onUpload,
  onRecord,
  onSendText,
}: VoiceInputBarProps) {
  return (
    <div className={styles.inputBar} aria-label="Undertone 輸入列">
      <button type="button" className={styles.inputIconButton} onClick={onUpload} aria-label="上傳音訊">
        <PlusIcon size={18} />
      </button>
      <input
        className={styles.textInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSendText();
          }
        }}
        placeholder="說不出口的，也可以先打一點。"
      />
      <button
        type="button"
        className={`${styles.inputIconButton} ${recording ? styles.inputIconButtonRecording : ''}`}
        onClick={onRecord}
        aria-label={recording ? '停止錄音' : '開始錄音'}
      >
        <span className={styles.micPulse} aria-hidden="true" />
        <MicIcon size={18} />
      </button>
      <button type="button" className={styles.sendButton} onClick={onSendText} aria-label="送出文字">
        <SendIcon size={18} />
      </button>
    </div>
  );
}
