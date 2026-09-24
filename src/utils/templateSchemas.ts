// ================================================================
// Template Schemas — structured field definitions
//
// Each schema defines fields. Edit → serialize to content string.
// Storage remains flat (InspirationItem.content = serialized markdown).
// ================================================================

import type { InspirationType } from './inspirationStorage';

export type FieldType = 'text' | 'textarea' | 'textList' | 'select';

export interface TemplateField {
  key: string;
  label: string;
  hint: string;
  type: FieldType;
  placeholder?: string;
  /** For select fields */
  options?: string[];
  /** For textList fields */
  addLabel?: string;
  removeLabel?: string;
}

export interface TemplateSchema {
  id: string;
  type: InspirationType;
  title: string;
  description: string;
  fields: TemplateField[];
}

export const TEMPLATE_SCHEMAS: TemplateSchema[] = [
  /* ── Worldbook ── */
  {
    id: 'tpl-worldbook',
    type: 'worldbook',
    title: '世界觀',
    description: '建立一個新世界的基礎設定',
    fields: [
      { key: 'name', label: '世界名稱', hint: '為你的世界命名 — 它叫什麼？', type: 'text', placeholder: '例如：月汐之國' },
      { key: 'worldType', label: '世界類型', hint: '這個世界的基礎類型', type: 'select', options: ['奇幻', '科幻', '現代', '古風', '末日', '異世界', '其他'] },
      { key: 'style', label: '風格基調', hint: '世界的整體氛圍', type: 'select', options: ['黑暗', '溫暖', '史詩', '輕鬆', '神秘', '寫實'] },
      { key: 'location', label: '地理位置', hint: '描述這個世界的地理與空間結構', type: 'textarea', placeholder: '山川、城市、氣候…' },
      { key: 'rules', label: '核心規則', hint: '力量體系、魔法規則、物理法則…', type: 'textList', placeholder: '新增一條規則', addLabel: '+ 規則', removeLabel: '移除' },
      { key: 'characters', label: '主要角色', hint: '列出世界中的重要角色', type: 'textList', placeholder: '角色名稱與簡介', addLabel: '+ 角色', removeLabel: '移除' },
    ],
  },
  /* ── Character ── */
  {
    id: 'tpl-character',
    type: 'character',
    title: '角色卡',
    description: '建立一個角色的完整檔案',
    fields: [
      { key: 'name', label: '名稱', hint: '角色的名字 — 也可以加上暱稱或稱號', type: 'text', placeholder: '例如：月汐·林' },
      { key: 'age', label: '年齡 / 性別', hint: '角色的基本人口資訊', type: 'text', placeholder: '例如：23 歲 / 女' },
      { key: 'identity', label: '身份', hint: '職業、社會地位、在世界中的角色定位', type: 'text', placeholder: '例如：流浪劍士 / 月之祭司' },
      { key: 'traits', label: '性格特質', hint: '用關鍵詞描述角色的性格', type: 'textList', placeholder: '新增一個特質', addLabel: '+ 特質', removeLabel: '移除' },
      { key: 'appearance', label: '外貌', hint: '髮色、瞳色、身高、穿著風格、特殊標記', type: 'textarea', placeholder: '描述角色的外觀…' },
      { key: 'background', label: '背景故事', hint: '角色的過去、重要事件、轉折點', type: 'textarea', placeholder: '角色的來歷與經歷…' },
    ],
  },
  /* ── Prompt ── */
  {
    id: 'tpl-prompt',
    type: 'prompt',
    title: '系統提示',
    description: '建立一個 AI 系統提示',
    fields: [
      { key: 'goal', label: '目標', hint: '這個提示要達成什麼目的？', type: 'textarea', placeholder: '例如：讓 AI 扮演一位溫柔的月之祭司…' },
      { key: 'context', label: '背景脈絡', hint: '提供必要的世界觀與上下文', type: 'textarea', placeholder: '描述角色所處的世界與情境…' },
      { key: 'constraints', label: '約束規則', hint: '列出明確的行為邊界與禁止事項', type: 'textList', placeholder: '新增一條約束', addLabel: '+ 約束', removeLabel: '移除' },
      { key: 'outputFormat', label: '輸出格式', hint: '指定回應的格式與風格', type: 'select', options: ['自由對話', '結構化段落', '簡短回覆', '詳細分析', '角色扮演'], },
    ],
  },
];

/** Serialize field values into a markdown content string for storage */
export function serializeTemplateFields(
  schema: TemplateSchema,
  values: Record<string, string | string[]>,
): string {
  const lines: string[] = [];
  for (const field of schema.fields) {
    const val = values[field.key];
    lines.push(`## ${field.label}`);
    lines.push('');
    if (Array.isArray(val)) {
      for (const item of val) lines.push(`- ${item}`);
    } else {
      lines.push(String(val || ''));
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** Build default values from a schema */
export function defaultTemplateValues(schema: TemplateSchema): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const field of schema.fields) {
    values[field.key] = field.type === 'textList' ? [] : '';
  }
  return values;
}
