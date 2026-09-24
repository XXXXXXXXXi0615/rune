import type { CharacterProfile } from '@/types';

export type StudioTabId = 'basic' | 'personality' | 'relationships' | 'model-memory' | 'advanced' | 'voice';

export type PreviewMode = 'card' | 'dm' | 'group';

export type DraftStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

export const STUDIO_TABS: { id: StudioTabId; label: string }[] = [
  { id: 'basic', label: '基本資料' },
  { id: 'personality', label: '人格與語氣' },
  { id: 'relationships', label: '關係與背景' },
  { id: 'model-memory', label: '模型與記憶' },
  { id: 'voice', label: '語音' },
  { id: 'advanced', label: '進階' },
];

export const PREVIEW_MODES: { id: PreviewMode; label: string }[] = [
  { id: 'card', label: '角色卡' },
  { id: 'dm', label: '私聊' },
  { id: 'group', label: '群聊' },
];

/** Empty character draft for new characters */
export function blankDraft(): CharacterProfile {
  const now = Date.now();
  return {
    id: '',
    name: '',
    subtitle: '',
    description: '',
    greeting: '',
    personality: '',
    speakingStyle: '',
    relationship: '',
    scenario: '',
    folderId: 'temporary',
    tags: [],
    capabilities: ['chat'],
    systemPrompt: '',
    isBuiltIn: false,
    isFavorite: false,
    isArchived: false,
    createdAt: 0,
    updatedAt: now,
    modelMode: 'global',
  };
}

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  fill: Partial<CharacterProfile>;
}

export const CHARACTER_TEMPLATES: TemplateDef[] = [
  {
    id: 'companion',
    name: '普通陪伴者',
    description: '輕鬆、自然的陪伴角色',
    fill: {
      relationshipToUser: '陪伴者',
      toneStrength: 5,
      boundaries: '保持禮貌與尊重',
    },
  },
  {
    id: 'strict',
    name: '強勢管教者',
    description: '嚴格、直接的管教風格',
    fill: {
      relationshipToUser: '管教者',
      toneStrength: 8,
      speakingStyle: '直接、嚴厲、不拐彎抹角',
      boundaries: '嚴格糾正不良行為',
    },
  },
  {
    id: 'story',
    name: '故事角色',
    description: '世界觀豐富的敘事角色',
    fill: {
      relationshipToUser: '故事中的相遇者',
      toneStrength: 6,
      corePersonality: '幽默、喜愛說故事、富有想像力',
      speakingStyle: '敘事感強、善用比喻與畫面感',
    },
  },
  {
    id: 'assistant',
    name: '工作助手',
    description: '專業、高效的工作協作角色',
    fill: {
      relationshipToUser: '工作協作者',
      toneStrength: 3,
      speakingStyle: '簡潔、專業、條理清晰',
      commonTerms: '收到、處理中、已完成',
      boundaries: '不參與個人閒聊，僅限工作事務',
    },
  },
  {
    id: 'group-member',
    name: '群聊成員',
    description: '自然融入群聊的社交角色',
    fill: {
      relationshipToUser: '群聊中的一員',
      toneStrength: 4,
      speakingStyle: '輕鬆、好奇、反應敏捷',
      modelMode: 'global',
    },
  },
  {
    id: 'public-guest',
    name: '公開待客廳角色',
    description: '對外開放的安全接待角色',
    fill: {
      relationshipToUser: '訪客接待者',
      toneStrength: 4,
      speakingStyle: '禮貌、親切、有距離感',
      boundaries: '不透露個人資訊、不過度親密',
      publicPersonaSettings: { isPublic: true },
    },
  },
];

/** Map existing template fill to draft fields, preserving existing draft values */
export function applyTemplate(
  draft: CharacterProfile,
  template: TemplateDef,
): CharacterProfile {
  return { ...draft, ...template.fill };
}
