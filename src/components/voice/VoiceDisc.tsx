import { PauseIcon, PlayIcon } from './VoiceIcons';
import styles from './Voice.module.css';

interface VoiceDiscProps {
  artworkUrl?: string;
  playing: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function VoiceDisc({ artworkUrl, playing, disabled = false, onToggle }: VoiceDiscProps) {
  return (
    <button
      type="button"
      className={`${styles.voiceDisc} ${artworkUrl ? styles.voiceDiscWithArtwork : styles.voiceDiscFallback} ${playing ? styles.voiceDiscPlaying : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-label={playing ? '暫停語音' : '播放語音'}
    >
      {artworkUrl && (
        <span
          className={styles.voiceDiscArtwork}
          style={{ backgroundImage: `url("${artworkUrl}")` }}
          aria-hidden="true"
        />
      )}
      <span className={styles.voiceDiscGroove} aria-hidden="true" />
      <span className={styles.voiceDiscHole} aria-hidden="true" />
      <span className={styles.voiceDiscIcon} aria-hidden="true">
        {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
      </span>
    </button>
  );
}
