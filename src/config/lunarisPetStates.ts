import {
  findManualAnimationByMode,
  getLunarisAnimationAsset,
  getManualLunarisAnimations,
} from '@/data/lunarisAnimationManifest';

function animationSrc(id: string): string {
  return getLunarisAnimationAsset(id)?.src ?? '';
}

export type LunarisPetState =
  | 'idle'
  | 'thinking'
  | 'typing'
  | 'toolUse'
  | 'success'
  | 'error'
  | 'music'
  | 'reading'
  | 'sleepy'
  | 'notification'
  | 'carrying'
  | 'cleaning'
  | 'happy'
  | 'sweeping'
  | 'random'
  | 'welding'
  | 'building'
  | 'permission'
  | 'celebrating'
  | 'bubbleIdle'
  | 'photo'
  | 'painting'
  | 'guitar'
  | 'exercise'
  | 'eating'
  | 'dragonBoat'
  | 'birthday';

export interface LunarisPetStateConfig {
  label: string;
  mood: string;
  src: string;
  fallbackText: string;
  type?: 'desktop' | 'side';
}

export const LUNARIS_PET_STATES: Record<LunarisPetState, LunarisPetStateConfig> = {
  idle: {
    label: '待機', mood: 'calm', src: animationSrc('clawd-idle'), fallbackText: 'LUNARIS 正安靜陪著你', type: 'desktop',
  },
  thinking: {
    label: '思考', mood: 'focused', src: animationSrc('clawd-thinking'), fallbackText: 'LUNARIS 正在思考', type: 'desktop',
  },
  typing: {
    label: '打字', mood: 'focused', src: animationSrc('clawd-typing'), fallbackText: 'LUNARIS 正在組織回覆', type: 'desktop',
  },
  toolUse: {
    label: '工具', mood: 'focused', src: animationSrc('clawd-tool-use'), fallbackText: 'LUNARIS 正在使用工具', type: 'desktop',
  },
  success: {
    label: '開心', mood: 'happy', src: animationSrc('clawd-success'), fallbackText: 'LUNARIS 完成了', type: 'desktop',
  },
  error: {
    label: '錯誤', mood: 'concerned', src: animationSrc('clawd-error'), fallbackText: 'LUNARIS 遇到了一點問題', type: 'desktop',
  },
  music: {
    label: '聽歌', mood: 'happy', src: animationSrc('clawd-listening'), fallbackText: 'LUNARIS 正跟著旋律搖擺', type: 'desktop',
  },
  reading: {
    label: '閱讀', mood: 'calm', src: animationSrc('clawd-reading'), fallbackText: 'LUNARIS 正安靜閱讀', type: 'desktop',
  },
  sleepy: {
    label: '睡覺', mood: 'sleepy', src: animationSrc('clawd-sleeping'), fallbackText: 'LUNARIS 有點睏了', type: 'desktop',
  },
  notification: {
    label: '提醒', mood: 'alert', src: animationSrc('clawd-notification'), fallbackText: 'LUNARIS 有件事想提醒你', type: 'desktop',
  },
  carrying: {
    label: '搬運', mood: 'busy', src: animationSrc('clawd-carrying'), fallbackText: 'LUNARIS 正在搬運資料', type: 'desktop',
  },
  cleaning: {
    label: '整理', mood: 'focused', src: animationSrc('clawd-cleaning-system'), fallbackText: 'LUNARIS 正在整理空間', type: 'desktop',
  },
  happy: {
    label: '開心', mood: 'happy', src: animationSrc('clawd-happy'), fallbackText: 'LUNARIS 心情很好', type: 'desktop',
  },
  sweeping: {
    label: '打掃', mood: 'focused', src: animationSrc('clawd-sweeping'), fallbackText: 'LUNARIS 正在打掃', type: 'desktop',
  },
  random: {
    label: '玩耍', mood: 'playful', src: animationSrc('clawd-random'), fallbackText: 'LUNARIS 正在玩耍', type: 'desktop',
  },
  welding: {
    label: '焊接', mood: 'focused', src: animationSrc('clawd-welding'), fallbackText: 'LUNARIS 正在修東西', type: 'desktop',
  },
  building: {
    label: '施工', mood: 'focused', src: animationSrc('clawd-building'), fallbackText: 'LUNARIS 戴安全帽工作中', type: 'desktop',
  },
  permission: {
    label: '請求許可', mood: 'curious', src: animationSrc('clawd-permission'), fallbackText: 'LUNARIS 在等你確認', type: 'desktop',
  },
  celebrating: {
    label: '慶祝', mood: 'happy', src: animationSrc('clawd-celebrating'), fallbackText: 'LUNARIS 正在慶祝', type: 'desktop',
  },
  bubbleIdle: {
    label: '發呆', mood: 'calm', src: animationSrc('clawd-bubble-idle'), fallbackText: 'LUNARIS 正在冒泡待機', type: 'desktop',
  },
  photo: { label: '拍照', mood: 'happy', src: animationSrc('clawd-photo'), fallbackText: 'LUNARIS 正在替這一刻拍照', type: 'desktop' },
  painting: { label: '畫畫', mood: 'focused', src: animationSrc('clawd-painting'), fallbackText: 'LUNARIS 正在畫畫', type: 'desktop' },
  guitar: { label: '吉他', mood: 'happy', src: animationSrc('clawd-guitar'), fallbackText: 'LUNARIS 正在彈吉他', type: 'desktop' },
  exercise: { label: '運動', mood: 'busy', src: animationSrc('clawd-exercise'), fallbackText: 'LUNARIS 正在運動', type: 'desktop' },
  eating: { label: '吃東西', mood: 'happy', src: animationSrc('clawd-eating'), fallbackText: 'LUNARIS 正在吃東西', type: 'desktop' },
  dragonBoat: { label: '端午龍舟', mood: 'happy', src: animationSrc('clawd-dragon-boat'), fallbackText: 'LUNARIS 正在划龍舟', type: 'desktop' },
  birthday: { label: '生日', mood: 'happy', src: animationSrc('clawd-birthday'), fallbackText: 'LUNARIS 正在替你慶生', type: 'desktop' },
};

export type LunarisSidePetState =
  | 'miniIdle'
  | 'miniPeek'
  | 'miniAlert'
  | 'miniHappy';

export interface LunarisSidePetStateConfig {
  label: string;
  mood: string;
  src: string;
  fallbackText: string;
  type: 'side';
}

export const LUNARIS_SIDE_PET_STATES: Record<LunarisSidePetState, LunarisSidePetStateConfig> = {
  miniIdle: {
    label: '側邊待機',
    mood: 'calm',
    src: animationSrc('clawd-mini-idle'),
    fallbackText: 'LUNARIS 在旁邊安靜等著',
    type: 'side',
  },
  miniPeek: {
    label: '探頭',
    mood: 'curious',
    src: animationSrc('clawd-mini-peek'),
    fallbackText: 'LUNARIS 從旁邊探出頭',
    type: 'side',
  },
  miniAlert: {
    label: '提醒',
    mood: 'alert',
    src: animationSrc('clawd-mini-alert'),
    fallbackText: 'LUNARIS 注意到需要處理的事情',
    type: 'side',
  },
  miniHappy: {
    label: '開心',
    mood: 'happy',
    src: animationSrc('clawd-mini-happy'),
    fallbackText: 'LUNARIS 很開心',
    type: 'side',
  },
};

export type LunarisPetMode =
  | 'auto'
  | 'idle'
  | 'reading'
  | 'sleepy'
  | 'thinking'
  | 'chatting'
  | 'focus'
  | 'music'
  | 'emotion'
  | 'walking'
  | 'happy'
  | 'sweeping'
  | 'welding'
  | 'building'
  | 'permission'
  | 'celebrating'
  | 'bubbleIdle'
  | 'photo'
  | 'painting'
  | 'guitar'
  | 'exercise'
  | 'eating'
  | 'dragonBoat'
  | 'birthday';

export const LUNARIS_PET_MODE_KEY = 'lunartide_lunaris_pet_mode_v1';
export const LUNARIS_PET_MODE_EVENT = 'lunartide:pet-mode-change';
export const LUNARIS_PET_RUNTIME_EVENT = 'lunartide:pet-runtime-state';
export const LUNARIS_SIDE_PET_ENABLED_KEY = 'lunartide_side_pet_enabled_v1';
export const LUNARIS_SIDE_PET_ENABLED_EVENT = 'lunartide:side-pet-enabled-change';
export const LUNARIS_SIDE_PET_EVENT = 'lunartide:side-pet-state';

/** Map user-facing behavior modes to internal animation states */
export const MODE_TO_STATE: Record<Exclude<LunarisPetMode, 'auto'>, LunarisPetState> = {
  idle: 'idle',
  reading: 'reading',
  sleepy: 'sleepy',
  thinking: 'thinking',
  chatting: 'typing',
  focus: 'toolUse',
  music: 'music',
  emotion: 'random',
  walking: 'carrying',
  happy: 'happy',
  sweeping: 'sweeping',
  welding: 'welding',
  building: 'building',
  permission: 'permission',
  celebrating: 'celebrating',
  bubbleIdle: 'bubbleIdle',
  photo: 'photo',
  painting: 'painting',
  guitar: 'guitar',
  exercise: 'exercise',
  eating: 'eating',
  dragonBoat: 'dragonBoat',
  birthday: 'birthday',
};

const MODE_ICON: Record<string, string> = {
  idle: 'idle', reading: 'reading', sleepy: 'sleepy', bubbleIdle: 'idle', thinking: 'thinking',
  chatting: 'chatting', focus: 'focus', music: 'music', emotion: 'emotion', walking: 'walking',
  happy: 'happy', celebrating: 'happy', permission: 'thinking', sweeping: 'sweeping', welding: 'focus',
  building: 'focus', photo: 'photo', painting: 'painting', guitar: 'music', exercise: 'walking',
  eating: 'eating', dragonBoat: 'walking', birthday: 'happy',
};

export const LUNARIS_PET_MODE_OPTIONS: ReadonlyArray<{ value: LunarisPetMode; label: string; icon: string }> =
  getManualLunarisAnimations().map((asset) => ({
    value: asset.mode as LunarisPetMode,
    label: asset.label,
    icon: MODE_ICON[asset.mode] || 'idle',
  }));

const VALID_MODES = new Set<LunarisPetMode>(['auto', ...LUNARIS_PET_MODE_OPTIONS.map((option) => option.value)]);

export function getLunarisAnimationForMode(mode: LunarisPetMode) {
  return mode === 'auto' ? undefined : findManualAnimationByMode(mode);
}

export function loadLunarisPetMode(): LunarisPetMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const value = localStorage.getItem(LUNARIS_PET_MODE_KEY) as LunarisPetMode | null;
    return value && VALID_MODES.has(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveLunarisPetMode(mode: LunarisPetMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LUNARIS_PET_MODE_KEY, mode);
  } catch {
    // The current tab still receives the event when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<LunarisPetMode>(LUNARIS_PET_MODE_EVENT, { detail: mode }));
}

export function publishLunarisPetState(state: LunarisPetState) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LunarisPetState>(LUNARIS_PET_RUNTIME_EVENT, { detail: state }));
}

export const LUNARIS_PET_POSITION_KEY = 'lunartide_clawd_pos';
export const LUNARIS_PET_POSITION_RESET_EVENT = 'lunartide:pet-position-reset';

export function resetLunarisPetPosition() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LUNARIS_PET_POSITION_KEY);
  } catch {
    // The active widget still receives the reset event when storage is unavailable.
  }
  window.dispatchEvent(new Event(LUNARIS_PET_POSITION_RESET_EVENT));
}

export function loadLunarisSidePetEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(LUNARIS_SIDE_PET_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveLunarisSidePetEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LUNARIS_SIDE_PET_ENABLED_KEY, String(enabled));
  } catch {
    // The current tab still receives the event when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<boolean>(LUNARIS_SIDE_PET_ENABLED_EVENT, { detail: enabled }));
}

export function publishLunarisSidePetState(state: LunarisSidePetState) {
  if (typeof window === 'undefined') return;
  if (!(state in LUNARIS_SIDE_PET_STATES)) return;
  window.dispatchEvent(new CustomEvent<LunarisSidePetState>(LUNARIS_SIDE_PET_EVENT, { detail: state }));
}
