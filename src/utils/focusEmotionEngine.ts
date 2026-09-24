// ================================================================
// Focus Emotion Engine v3.1
//
// Inputs:  duration, elapsed, interruptions, completionRate, phase
// Outputs: emotion state + intensity (0–100)
//
// States:  focused | calm | drifting | fatigued
// ================================================================

export type FocusEmotion = 'focused' | 'calm' | 'drifting' | 'fatigued';

export interface EmotionInput {
  durationMinutes: number;     // planned focus duration
  elapsedSeconds: number;      // seconds elapsed in current phase
  interruptions: number;       // interruption count
  completionRate: number;      // 0–1 fraction of rounds completed
  phase: 'focus' | 'break';
  isRunning: boolean;
}

export interface EmotionOutput {
  emotion: FocusEmotion;
  intensity: number;           // 0–100, how strongly the emotion is expressed
  glowColor: string;           // CSS color for ring glow
  bgModifier: number;          // 0–1 background brightness modifier
  waveformSpeed: number;       // 0.5–3.0 multiplier for ECG speed
}

/** Classify focus duration into intensity tiers */
function durationIntensity(minutes: number): 'light' | 'medium' | 'deep' {
  if (minutes <= 25) return 'light';
  if (minutes <= 60) return 'medium';
  return 'deep';
}

/** Core emotion computation */
export function computeEmotion(input: EmotionInput): EmotionOutput {
  const { durationMinutes, elapsedSeconds, interruptions, completionRate, phase, isRunning } = input;

  if (!isRunning) {
    return {
      emotion: 'calm',
      intensity: 0,
      glowColor: '#9a8e85',
      bgModifier: 1,
      waveformSpeed: 0.5,
    };
  }

  // Elapsed fraction of current phase
  const totalPhaseSec = phase === 'focus' ? durationMinutes * 60 : (durationMinutes * 0.2) * 60;
  const elapsedFraction = totalPhaseSec > 0 ? Math.min(1, elapsedSeconds / totalPhaseSec) : 0;

  const tier = durationIntensity(durationMinutes);

  let emotion: FocusEmotion;
  let intensity: number;
  let glowColor: string;
  let bgModifier: number;
  let waveformSpeed: number;

  if (phase === 'break') {
    emotion = 'calm';
    intensity = 30;
    glowColor = '#7a8e95';
    bgModifier = 0.85;
    waveformSpeed = 0.8;
  } else if (interruptions >= 3) {
    // Highly interrupted → fatigued
    emotion = 'fatigued';
    intensity = 65 + Math.min(30, interruptions * 5);
    glowColor = '#9a7a82';
    bgModifier = 0.6;
    waveformSpeed = 0.5;
  } else if (elapsedFraction > 0.75 && interruptions > 0) {
    // Late stage with interruptions → drifting
    emotion = 'drifting';
    intensity = 45 + elapsedFraction * 30;
    glowColor = '#b8957a';
    bgModifier = 0.75;
    waveformSpeed = 1.2 + Math.random() * 0.6;
  } else if (elapsedFraction > 0.6 && tier === 'deep') {
    // Long focus, late stage → check if stable
    emotion = interruptions === 0 ? 'focused' : 'drifting';
    intensity = interruptions === 0 ? 80 : 55;
    glowColor = interruptions === 0 ? '#cc785c' : '#b8957a';
    bgModifier = interruptions === 0 ? 0.9 : 0.75;
    waveformSpeed = interruptions === 0 ? 1.8 : 1.4;
  } else if (tier === 'deep' && elapsedFraction < 0.3) {
    // Deep focus, early stage → ramping up
    emotion = 'focused';
    intensity = 50 + elapsedFraction * 60;
    glowColor = '#cc785c';
    bgModifier = 1;
    waveformSpeed = 1.0 + elapsedFraction;
  } else if (tier === 'light') {
    // Light focus → calm
    emotion = 'calm';
    intensity = 20 + elapsedFraction * 20;
    glowColor = '#8ea0b8';
    bgModifier = 0.95;
    waveformSpeed = 0.7;
  } else {
    // Default mid-range → focused
    emotion = 'focused';
    intensity = 40 + elapsedFraction * 30;
    glowColor = '#cc785c';
    bgModifier = 1;
    waveformSpeed = 1.0 + elapsedFraction * 0.5;
  }

  // Completion boost: high completion rate elevates the emotion
  if (completionRate > 0.5 && emotion !== 'fatigued') {
    intensity = Math.min(100, intensity + 10);
    glowColor = '#cc785c';
    bgModifier = Math.min(1, bgModifier + 0.05);
  }

  return {
    emotion,
    intensity: Math.round(intensity),
    glowColor,
    bgModifier: Math.round(bgModifier * 100) / 100,
    waveformSpeed: Math.round(waveformSpeed * 10) / 10,
  };
}
