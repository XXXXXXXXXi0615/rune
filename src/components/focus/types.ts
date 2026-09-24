export type TideboundMode = 'espresso' | 'flow' | 'deep_work' | 'night';
export type FocusRoomType = 'computer' | 'coffee' | 'toilet' | 'bed';
export type FocusRoomCategory = 'focus' | 'break' | 'rest';

export type TideboundPhase = 'idle' | 'active' | 'paused' | 'break' | 'settlement' | 'statistics';

export interface TideboundConfig {
  task: string;
  mode: TideboundMode | null;
  durationMinutes: number;
  breakMinutes: number;
  rounds: number;
  loopMode: boolean;
  witnessEnabled: boolean;
  allowRecall: boolean;
  autoMemory: boolean;
  reminderEnabled: boolean;
  soundEnabled: boolean;
}
