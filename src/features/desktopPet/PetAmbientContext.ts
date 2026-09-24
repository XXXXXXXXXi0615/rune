export type PetDayPart = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'lateNight';
export type PetContextSource = 'time' | 'tidebound' | 'music' | 'chat' | 'weather';

export interface PetAmbientContext {
  observedAt: number;
  time: { timezone: string; dayPart: PetDayPart };
  tidebound: { state: 'idle' | 'preparing' | 'focusing' | 'breaking' | 'settling'; remainingMs?: number; witnessEnabled: boolean };
  music: { state: 'stopped' | 'playing' | 'paused'; trackId?: string };
  chat: { state: 'idle' | 'userTyping' | 'sending' | 'aiThinking' | 'streaming' | 'error'; conversationId?: string };
  weather?: { condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog' | 'unknown'; temperatureBand: 'cold' | 'mild' | 'warm' | 'hot'; observedAt: number; stale: boolean };
}

export type PetContextEventType =
  | 'time.dayPartChanged'
  | 'tidebound.started' | 'tidebound.lastMinute' | 'tidebound.completed' | 'tidebound.abandoned' | 'tidebound.breakStarted' | 'tidebound.ended'
  | 'music.started' | 'music.paused' | 'music.resumed' | 'music.stopped' | 'music.trackChanged'
  | 'chat.userTyping' | 'chat.sending' | 'chat.aiThinking' | 'chat.streaming' | 'chat.completed' | 'chat.failed'
  | 'weather.updated' | 'weather.becameStale';

export interface PetContextEvent { type: PetContextEventType; at: number; dedupeKey: string; }

export interface PetContextSettings { time: boolean; tidebound: boolean; music: boolean; chat: boolean; weather: boolean; }
export const DEFAULT_PET_CONTEXT_SETTINGS: PetContextSettings = { time: true, tidebound: true, music: true, chat: true, weather: false };

export function selectPetDayPart(date: Date): PetDayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'lateNight';
}

export function selectWeatherContext(input: PetAmbientContext['weather'], authorized: boolean) {
  return authorized && input && !input.stale ? input : undefined;
}

export function selectPrivateChatContext(state: PetAmbientContext['chat']['state'], conversationId?: string): PetAmbientContext['chat'] {
  return conversationId ? { state, conversationId } : { state };
}
