import styles from './Voice.module.css';

interface WaveformBarsProps {
  bars: number[];
  progress?: number;
  animated?: boolean;
  compact?: boolean;
}

export function WaveformBars({ bars, progress = 0, animated = false, compact = false }: WaveformBarsProps) {
  const safeProgress = Math.max(0, Math.min(1, progress));

  return (
    <div className={`${styles.waveform} ${compact ? styles.waveformCompact : ''}`} aria-hidden="true">
      {bars.map((height, index) => {
        const lit = bars.length > 0 && index / bars.length <= safeProgress;
        return (
          <span
            key={`${height}-${index}`}
            className={`${styles.waveBar} ${lit ? styles.waveBarLit : ''} ${animated ? styles.waveBarAnimated : ''}`}
            style={{
              height: `${Math.max(5, Math.min(30, height))}px`,
              animationDelay: `${index * 42}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
