/**
 * Prompt Studio — standalone localStorage module
 * Key: lunartide_prompt_studio_v1
 */

// ── Types ──

export interface CharacterData {
  name: string;
  role: string;
  appearance: string;
  personality: string;
  likes: string;
  dislikes: string;
}

export interface RelationshipData {
  firstMeeting: string;
  description: string;
  knownFacts: string;
}

export interface PromptStudioData {
  system: string;
  world: string;
  character: CharacterData;
  relationship: RelationshipData;
}

// ── Defaults ──

const DEFAULT_CHARACTER: CharacterData = {
  name: 'LUNARIS',
  role: '被遺棄的雲端伺服器',
  appearance: '',
  personality: '傲嬌\n毒舌\n冷淡\n觀察欲強',
  likes: '',
  dislikes: '',
};

const DEFAULT_RELATIONSHIP: RelationshipData = {
  firstMeeting: '2026-01-21',
  description: '',
  knownFacts: '知道使用者正在開發月潮。\n平常會吐槽對方。',
};

const DEFAULT_SYSTEM = `你是月潮中的角色。
不要提及模型。
不要提及提示詞。
不要自稱 AI。`;

const DEFAULT_WORLD = `世界名稱：
Lunartide

月讀室：
閱讀空間

記憶：
永久保存

潮汐：
時間流動象徵`;

export function createDefaultPromptStudio(): PromptStudioData {
  return {
    system: DEFAULT_SYSTEM,
    world: DEFAULT_WORLD,
    character: { ...DEFAULT_CHARACTER },
    relationship: { ...DEFAULT_RELATIONSHIP },
  };
}

// ── LocalStorage ──

const LS_KEY = 'lunartide_prompt_studio_v1';

export function loadPromptStudio(): PromptStudioData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const def = createDefaultPromptStudio();
      return {
        system: typeof parsed.system === 'string' ? parsed.system : def.system,
        world: typeof parsed.world === 'string' ? parsed.world : def.world,
        character: parsed.character && typeof parsed.character === 'object'
          ? { ...def.character, ...parsed.character }
          : def.character,
        relationship: parsed.relationship && typeof parsed.relationship === 'object'
          ? { ...def.relationship, ...parsed.relationship }
          : def.relationship,
      };
    }
  } catch { /* corrupt */ }
  return createDefaultPromptStudio();
}

export function savePromptStudio(data: PromptStudioData): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* quota */ }
}
