import { useEffect, useRef, useState } from 'react';
import styles from './FocusVitals.module.css';
import type { EmotionOutput } from '@/utils/focusEmotionEngine';

interface FocusVitalsProps {
  isRunning: boolean;
  emotion?: EmotionOutput;
}

/**
 * Parse a CSS color string (hex, rgb, or named) into {r, g, b}.
 * Falls back to accent coral if parsing fails.
 */
function parseAccentRgb(color: string): { r: number; g: number; b: number } {
  // hex
  const hex = color.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
  if (hex) {
    return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16) };
  }
  // rgb(r, g, b)
  const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgb) {
    return { r: parseInt(rgb[1], 10), g: parseInt(rgb[2], 10), b: parseInt(rgb[3], 10) };
  }
  // fallback: lunartide coral
  return { r: 204, g: 120, b: 92 };
}

export default function FocusVitals({ isRunning, emotion }: FocusVitalsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offsetRef = useRef(0);
  const valueRef = useRef(72);
  const valueTargetRef = useRef(72);
  const rafRef = useRef<number>(0);
  const [valueDisplay, setValueDisplay] = useState(72);

  // ECG waveform calculation
  function ecgY(x: number): number {
    const period = 120;
    const t = ((x % period) + period) % period;
    if (t < 10) return 0;
    if (t < 14) return -(t - 10) * 5;
    if (t < 18) return (t - 14) * 5 - 20;
    if (t < 20) return 0;
    if (t < 22) return -(t - 20) * 18;
    if (t < 25) return (t - 22) * 24 - 36 + 18;
    if (t < 28) return (t - 25) * 7;
    if (t < 32) return 21 - (t - 28) * 5;
    if (t < 36) return 0;
    if (t < 46) return -Math.sin(((t - 36) / 10) * Math.PI) * 10;
    return 0;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = canvas!.offsetWidth * dpr;
      canvas!.height = canvas!.offsetHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Read accent colour from the live theme
    function getAccent(): { r: number; g: number; b: number } {
      const style = getComputedStyle(document.documentElement);
      return parseAccentRgb(style.getPropertyValue('--accent').trim());
    }

    function draw() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      ctx!.clearRect(0, 0, w, h);

      const accent = getAccent();
      // Use emotion glow color when available, fall back to accent
      const glowHex = (emotion?.glowColor && emotion.intensity > 10) ? emotion.glowColor : null;
      const { r, g, b } = glowHex ? parseAccentRgb(glowHex) : accent;

      // Grid lines — very faint, theme-aware
      ctx!.strokeStyle = `rgba(${r},${g},${b},0.06)`;
      ctx!.lineWidth = 0.5;
      for (let x = 0; x < w; x += 20) {
        ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, h); ctx!.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke();
      }

      // Waveform
      const midY = h / 2;
      ctx!.beginPath();
      for (let px = 0; px <= w; px++) {
        const y = midY + ecgY(px + offsetRef.current);
        px === 0 ? ctx!.moveTo(px, y) : ctx!.lineTo(px, y);
      }

      const grad = ctx!.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0,    `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.25, `rgba(${r},${g},${b},0.7)`);
      grad.addColorStop(0.8,  `rgba(${Math.min(255, r + 51)},${Math.max(0, g - 13)},${Math.max(0, b - 15)},0.9)`);
      grad.addColorStop(1,    `rgba(${Math.min(255, r + 51)},${Math.max(0, g - 13)},${Math.max(0, b - 15)},0.1)`);
      ctx!.strokeStyle = grad;
      ctx!.lineWidth = 1.8;
      ctx!.shadowColor = `rgba(${r},${g},${b},0.45)`;
      ctx!.shadowBlur = 6;
      ctx!.stroke();
      ctx!.shadowBlur = 0;

      // Cursor dot
      const curX = w * 0.82;
      const curY = midY + ecgY(curX + offsetRef.current);
      ctx!.beginPath();
      ctx!.arc(curX, curY, 3, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${Math.min(255, r + 28)},${Math.min(255, g + 15)},${Math.min(255, b + 10)},0.9)`;
      ctx!.shadowColor = `rgba(${r},${g},${b},0.55)`;
      ctx!.shadowBlur = 12;
      ctx!.fill();
      ctx!.shadowBlur = 0;

      // Advance waveform at emotion-driven speed
      if (isRunning) {
        offsetRef.current += emotion?.waveformSpeed ?? 1.2;
      }

      // Value drift (lerp) — only drift while running
      if (isRunning && Math.random() < 0.008) {
        valueTargetRef.current = 65 + Math.floor(Math.random() * 22);
      }
      valueRef.current += (valueTargetRef.current - valueRef.current) * 0.03;

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    // Display update — once per second to avoid excessive setState
    const valueInterval = setInterval(() => {
      setValueDisplay(Math.round(valueRef.current));
    }, 1000);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(valueInterval);
      window.removeEventListener('resize', resize);
    };
  }, [isRunning]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>FOCUS INDEX</span>
        <span className={styles.value}>
          {valueDisplay}
          <span className={styles.unit}> 專注值</span>
        </span>
      </div>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.canvasGlow} />
      </div>
    </div>
  );
}
