import type { FocusSessionStatus } from '@/store/useFocusSessionStore';
import type {
  PetAction,
  PetControlMode,
  PetEmotion,
  PetInteraction,
  PetResolvedState,
  PetUserMood,
} from '@/features/pet/types';

interface ResolvePetStateContext {
  userMood?: PetUserMood | null;
  tideboundStatus: FocusSessionStatus | 'break' | 'sleeping';
  tideboundResult?: 'completed' | 'interrupted' | 'abandoned' | null;
  interaction?: PetInteraction | null;
  interactionExpiresAt?: number;
  controlMode: PetControlMode;
  manualEmotion: PetEmotion;
  manualAction: PetAction;
  timeOfDay?: number;
}

const animationFor = (emotion: PetEmotion, action: PetAction) => {
  const exact = `${action}-${emotion}`;
  const supported = new Set([
    'idle-happy', 'idle-calm', 'idle-sad', 'idle-tired',
    'work-calm', 'work-happy', 'walk-calm', 'cheer-happy',
    'cry-sad', 'rest-calm', 'rest-tired', 'sleep-tired',
  ]);
  if (supported.has(exact)) return exact;
  if (action === 'cheer') return 'cheer-happy';
  if (action === 'cry') return 'cry-sad';
  if (action === 'sleep') return 'sleep-tired';
  if (action === 'rest') return emotion === 'tired' ? 'rest-tired' : 'rest-calm';
  if (action === 'work') return emotion === 'happy' ? 'work-happy' : 'work-calm';
  if (action === 'walk') return 'walk-calm';
  return `idle-${emotion}`;
};

function resolved(emotion: PetEmotion, action: PetAction, source: PetResolvedState['source'], expiresAt?: number): PetResolvedState {
  return { emotion, action, animationId: animationFor(emotion, action), source, expiresAt };
}

export function resolvePetState(context: ResolvePetStateContext): PetResolvedState {
  if (context.interaction) {
    if (context.interaction === 'encourage') return resolved('happy', 'cheer', 'interaction', context.interactionExpiresAt);
    if (context.interaction === 'rest') return resolved('tired', 'rest', 'interaction', context.interactionExpiresAt);
    return resolved('happy', 'idle', 'interaction', context.interactionExpiresAt);
  }

  if (context.tideboundStatus === 'sleeping') return resolved('tired', 'sleep', 'tidebound');
  if (context.tideboundStatus === 'break') return resolved('calm', 'rest', 'tidebound');
  if (context.tideboundStatus === 'running' || context.tideboundStatus === 'paused') {
    return context.tideboundStatus === 'paused'
      ? resolved('tired', 'rest', 'tidebound')
      : resolved('calm', 'work', 'tidebound');
  }
  if (context.tideboundResult === 'completed') return resolved('happy', 'cheer', 'tidebound');
  if (context.tideboundResult === 'interrupted') return resolved('tired', 'idle', 'tidebound');
  if (context.tideboundResult === 'abandoned') return resolved('sad', 'idle', 'tidebound');

  if (context.controlMode === 'manual') return resolved(context.manualEmotion, context.manualAction, 'manual');
  if (context.userMood === 'good') return resolved('happy', 'idle', 'mood');
  if (context.userMood === 'bad') return resolved('sad', 'idle', 'mood');
  if (context.userMood === 'neutral') return resolved('calm', 'idle', 'mood');
  if (typeof context.timeOfDay === 'number' && (context.timeOfDay >= 23 || context.timeOfDay < 6)) {
    return resolved('tired', 'sleep', 'idle');
  }
  return resolved('calm', 'idle', 'idle');
}

export function mapTodayMoodToPetMood(mood?: string | null): PetUserMood | null {
  if (mood === 'happy' || mood === 'calm') return mood === 'happy' ? 'good' : 'neutral';
  if (mood === 'anxiety' || mood === 'gloomy' || mood === 'angry' || mood === 'meltdown') return 'bad';
  return null;
}
