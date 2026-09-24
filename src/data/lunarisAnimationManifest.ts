import idleSrc from '@/assets/lunaris/clawd-idle.gif.gif';
import thinkingSrc from '@/assets/lunaris/clawd-thinking.gif.gif';
import typingSrc from '@/assets/lunaris/clawd-typing.gif.gif';
import grooveSrc from '@/assets/lunaris/clawd-headphones-groove.gif.gif';
import toolUseSrc from '@/assets/lunaris/clawd-building.gif.gif';
import carryingSrc from '@/assets/lunaris/clawd-carrying.gif.gif';
import notificationSrc from '@/assets/lunaris/clawd-notification.gif.gif';
import errorSrc from '@/assets/lunaris/clawd-error.gif.gif';
import successSrc from '@/assets/lunaris/clawd-happy.gif.gif';
import cleaningSrc from '@/assets/lunaris/clawd-sweeping.gif.gif';
import happySrc from '@/assets/lunaris/clawd-happy.gif';
import sweepingSrc from '@/assets/lunaris/clawd-sweeping.gif';
import randomSrc from '@/assets/lunaris/clawd-juggling.gif.gif';
import weldingSrc from '@/assets/lunaris/welding_work.gif';
import buildingSrc from '@/assets/lunaris/working_hardhat.gif';
import permissionSrc from '@/assets/lunaris/permission_prompt.gif';
import celebratingSrc from '@/assets/lunaris/celebrate_bunny.gif';
import bubbleIdleSrc from '@/assets/lunaris/idle_bubble.gif';
import miniAlertSrc from '@/assets/lunaris/clawd-mini-alert.gif';
import miniHappySrc from '@/assets/lunaris/clawd-mini-happy.gif';
import miniIdleSrc from '@/assets/lunaris/clawd-mini-idle.gif';
import miniPeekSrc from '@/assets/lunaris/clawd-mini-peek.gif';
import sleepingSrc from '@/assets/lunaris/animations/clawd-sleeping.gif';
import readingSrc from '@/assets/lunaris/animations/clawd-reading.gif';
import photoSrc from '@/assets/lunaris/animations/clawd-photo.gif';
import paintingSrc from '@/assets/lunaris/animations/clawd-painting.gif';
import listeningSrc from '@/assets/lunaris/animations/clawd-listening.gif';
import guitarSrc from '@/assets/lunaris/animations/clawd-guitar.gif';
import exerciseSrc from '@/assets/lunaris/animations/clawd-exercise.gif';
import eatingSrc from '@/assets/lunaris/animations/clawd-eating.gif';
import dragonBoatSrc from '@/assets/lunaris/animations/clawd-dragon-boat.gif';
import birthdaySrc from '@/assets/lunaris/animations/clawd-birthday.gif';

export type LunarisAnimationCategory =
  | 'common'
  | 'rest'
  | 'creative'
  | 'activity'
  | 'celebration'
  | 'system';

export type LunarisAnimationKind =
  | 'behavior'
  | 'reaction'
  | 'seasonal'
  | 'system';

export type LunarisAnimationAsset = {
  id: string;
  label: string;
  src: string;
  mode: string;
  variant?: string;
  category: LunarisAnimationCategory;
  kind: LunarisAnimationKind;
  keywords: string[];
  allowManual: boolean;
  allowJournalReaction: boolean;
  allowAutoEvent: boolean;
  loop?: boolean;
};

export const LUNARIS_ANIMATION_CATEGORY_LABELS: Record<LunarisAnimationCategory, string> = {
  common: '常用',
  rest: '休息陪伴',
  creative: '創作工作',
  activity: '娛樂活動',
  celebration: '慶祝節日',
  system: '系統狀態',
};

export const LUNARIS_ANIMATION_MANIFEST: readonly LunarisAnimationAsset[] = [
  { id: 'clawd-idle', label: '待機', src: idleSrc, mode: 'idle', category: 'common', kind: 'behavior', keywords: ['待機', '陪伴', '安靜', 'idle'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-thinking', label: '思考', src: thinkingSrc, mode: 'thinking', category: 'common', kind: 'behavior', keywords: ['思考', '想', 'thinking'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-typing', label: '聊天', src: typingSrc, mode: 'chatting', category: 'common', kind: 'behavior', keywords: ['聊天', '打字', 'typing'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-groove', label: '並行工作', src: grooveSrc, mode: 'focus', variant: 'groove', category: 'creative', kind: 'behavior', keywords: ['並行', '耳機', 'groove'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-tool-use', label: '專注', src: toolUseSrc, mode: 'focus', category: 'creative', kind: 'behavior', keywords: ['專注', '工具', '工作', 'focus'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-carrying', label: '散步', src: carryingSrc, mode: 'walking', category: 'activity', kind: 'behavior', keywords: ['散步', '搬運', 'walking'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-notification', label: '提醒', src: notificationSrc, mode: 'notification', category: 'system', kind: 'system', keywords: ['提醒', '通知', 'notification'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-error', label: '錯誤', src: errorSrc, mode: 'error', category: 'system', kind: 'system', keywords: ['錯誤', '異常', 'error'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-success', label: '完成', src: successSrc, mode: 'success', category: 'system', kind: 'reaction', keywords: ['完成', '成功', 'success'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-cleaning-system', label: '整理', src: cleaningSrc, mode: 'cleaning', category: 'system', kind: 'system', keywords: ['整理', '清理', 'cleaning'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-happy', label: '開心', src: happySrc, mode: 'happy', category: 'common', kind: 'reaction', keywords: ['開心', '快樂', 'happy'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-sweeping', label: '打掃', src: sweepingSrc, mode: 'sweeping', category: 'activity', kind: 'behavior', keywords: ['打掃', '清潔', 'sweeping'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-random', label: '情緒反應', src: randomSrc, mode: 'emotion', category: 'common', kind: 'reaction', keywords: ['玩耍', '情緒', 'juggling'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-welding', label: '焊接', src: weldingSrc, mode: 'welding', category: 'creative', kind: 'behavior', keywords: ['焊接', '修理', 'welding'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-building', label: '施工', src: buildingSrc, mode: 'building', category: 'creative', kind: 'behavior', keywords: ['施工', '建造', 'building'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-permission', label: '請求許可', src: permissionSrc, mode: 'permission', category: 'system', kind: 'system', keywords: ['許可', '確認', 'permission'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-celebrating', label: '慶祝', src: celebratingSrc, mode: 'celebrating', category: 'celebration', kind: 'reaction', keywords: ['慶祝', '祝賀', 'celebrating'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-bubble-idle', label: '發呆', src: bubbleIdleSrc, mode: 'bubbleIdle', category: 'rest', kind: 'behavior', keywords: ['發呆', '安靜', '陪伴', 'idle'], allowManual: true, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-sleeping', label: '睡覺', src: sleepingSrc, mode: 'sleepy', category: 'rest', kind: 'behavior', keywords: ['睡', '睡覺', '休息', 'sleeping'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-reading', label: '閱讀', src: readingSrc, mode: 'reading', category: 'rest', kind: 'behavior', keywords: ['閱讀', '讀書', 'reading'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-photo', label: '拍照', src: photoSrc, mode: 'photo', category: 'activity', kind: 'reaction', keywords: ['拍照', '照片', '攝影', 'photo'], allowManual: true, allowJournalReaction: true, allowAutoEvent: false, loop: true },
  { id: 'clawd-painting', label: '畫畫', src: paintingSrc, mode: 'painting', category: 'creative', kind: 'behavior', keywords: ['畫畫', '繪畫', '創作', 'painting'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-listening', label: '聽歌', src: listeningSrc, mode: 'music', category: 'activity', kind: 'behavior', keywords: ['聽歌', '音樂', '傾聽', 'listening', 'music'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-guitar', label: '吉他', src: guitarSrc, mode: 'guitar', category: 'creative', kind: 'behavior', keywords: ['吉他', '彈奏', '音樂', 'guitar'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-exercise', label: '運動', src: exerciseSrc, mode: 'exercise', category: 'activity', kind: 'behavior', keywords: ['運動', '鍛鍊', 'exercise'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-eating', label: '吃東西', src: eatingSrc, mode: 'eating', category: 'activity', kind: 'behavior', keywords: ['吃', '飲食', '吃東西', 'eating'], allowManual: true, allowJournalReaction: true, allowAutoEvent: true, loop: true },
  { id: 'clawd-dragon-boat', label: '端午龍舟', src: dragonBoatSrc, mode: 'dragonBoat', category: 'celebration', kind: 'seasonal', keywords: ['端午', '龍舟', '節日', 'dragon boat'], allowManual: true, allowJournalReaction: false, allowAutoEvent: false, loop: true },
  { id: 'clawd-birthday', label: '生日', src: birthdaySrc, mode: 'birthday', category: 'celebration', kind: 'seasonal', keywords: ['生日', '蛋糕', '慶生', 'birthday'], allowManual: true, allowJournalReaction: true, allowAutoEvent: false, loop: true },
  { id: 'clawd-mini-idle', label: '側邊待機', src: miniIdleSrc, mode: 'miniIdle', category: 'system', kind: 'system', keywords: ['側邊', '待機', 'mini'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-mini-peek', label: '側邊探頭', src: miniPeekSrc, mode: 'miniPeek', category: 'system', kind: 'system', keywords: ['側邊', '探頭', 'mini'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-mini-alert', label: '側邊提醒', src: miniAlertSrc, mode: 'miniAlert', category: 'system', kind: 'system', keywords: ['側邊', '提醒', 'mini'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
  { id: 'clawd-mini-happy', label: '側邊開心', src: miniHappySrc, mode: 'miniHappy', category: 'system', kind: 'system', keywords: ['側邊', '開心', 'mini'], allowManual: false, allowJournalReaction: false, allowAutoEvent: true, loop: true },
];

const ANIMATION_BY_ID = new Map(LUNARIS_ANIMATION_MANIFEST.map((asset) => [asset.id, asset]));

export function getLunarisAnimationAsset(id?: string): LunarisAnimationAsset | undefined {
  return id ? ANIMATION_BY_ID.get(id) : undefined;
}

export function getManualLunarisAnimations(): readonly LunarisAnimationAsset[] {
  return LUNARIS_ANIMATION_MANIFEST.filter((asset) => asset.allowManual);
}

export function getJournalReactionAnimations(): readonly LunarisAnimationAsset[] {
  return LUNARIS_ANIMATION_MANIFEST.filter((asset) => asset.allowJournalReaction);
}

export function findManualAnimationByMode(mode: string): LunarisAnimationAsset | undefined {
  return LUNARIS_ANIMATION_MANIFEST.find((asset) => asset.allowManual && asset.mode === mode);
}
