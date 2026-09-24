import type { VocabularyEntry } from './types';

const SEED_TIME = Date.UTC(2026, 0, 1);

export const MOONLEX_SEED_ENTRIES: VocabularyEntry[] = [
  {
    id: 'moonlex-en-serendipity', language: 'en', term: 'serendipity', phonetic: '/ˌser.ənˈdɪp.ə.ti/',
    meanings: ['意外發現美好事物的幸運'], example: 'The quiet bookstore was a moment of serendipity.',
    exampleTranslation: '遇見那間安靜書店，是一次美好的偶然。', tags: ['感受'], difficulty: 4,
    mastery: 'learning', favorite: true, createdAt: SEED_TIME, updatedAt: SEED_TIME, source: { type: 'import' },
  },
  {
    id: 'moonlex-en-linger', language: 'en', term: 'linger', phonetic: '/ˈlɪŋ.ɡɚ/',
    meanings: ['逗留', '久久不散'], example: 'The scent of rain lingered after sunset.',
    exampleTranslation: '日落後，雨的氣味仍久久不散。', tags: ['動詞'], difficulty: 2,
    mastery: 'new', favorite: false, createdAt: SEED_TIME + 1, updatedAt: SEED_TIME + 1, source: { type: 'import' },
  },
  {
    id: 'moonlex-en-tender', language: 'en', term: 'tender', phonetic: '/ˈten.dɚ/',
    meanings: ['溫柔的', '柔軟的'], example: 'She gave the old letter a tender smile.',
    exampleTranslation: '她望著那封舊信，露出溫柔的微笑。', tags: ['形容詞'], difficulty: 2,
    mastery: 'familiar', favorite: true, createdAt: SEED_TIME + 2, updatedAt: SEED_TIME + 2, source: { type: 'import' },
  },
  {
    id: 'moonlex-en-resilient', language: 'en', term: 'resilient', phonetic: '/rɪˈzɪl.jənt/',
    meanings: ['有韌性的', '能迅速恢復的'], example: 'Small rituals help us stay resilient.',
    exampleTranslation: '微小的日常儀式讓我們保有韌性。', tags: ['成長'], difficulty: 3,
    mastery: 'new', favorite: false, createdAt: SEED_TIME + 3, updatedAt: SEED_TIME + 3, source: { type: 'import' },
  },
  {
    id: 'moonlex-ja-komorebi', language: 'ja', term: '木漏れ日', reading: 'こもれび',
    meanings: ['從樹葉縫隙灑落的陽光'], example: '木漏れ日の下で本を読む。',
    exampleTranslation: '在葉隙陽光下讀書。', tags: ['自然'], difficulty: 3,
    mastery: 'learning', favorite: true, createdAt: SEED_TIME + 4, updatedAt: SEED_TIME + 4, source: { type: 'import' },
  },
  {
    id: 'moonlex-ja-nagori', language: 'ja', term: '名残', reading: 'なごり',
    meanings: ['事物消逝後留下的餘韻'], example: '夏の名残を風に感じる。',
    exampleTranslation: '在風裡感受到夏日的餘韻。', tags: ['季節'], difficulty: 4,
    mastery: 'new', favorite: false, createdAt: SEED_TIME + 5, updatedAt: SEED_TIME + 5, source: { type: 'import' },
  },
  {
    id: 'moonlex-ja-yasuragi', language: 'ja', term: '安らぎ', reading: 'やすらぎ',
    meanings: ['平靜', '安心'], example: '静かな音楽に安らぎを感じた。',
    exampleTranslation: '從安靜的音樂中感到平靜。', tags: ['感受'], difficulty: 2,
    mastery: 'familiar', favorite: true, createdAt: SEED_TIME + 6, updatedAt: SEED_TIME + 6, source: { type: 'import' },
  },
  {
    id: 'moonlex-ja-tsumugu', language: 'ja', term: '紡ぐ', reading: 'つむぐ',
    meanings: ['紡織', '細心串連故事或話語'], example: '二人で小さな物語を紡ぐ。',
    exampleTranslation: '兩個人一起編織小小的故事。', tags: ['動詞'], difficulty: 3,
    mastery: 'new', favorite: false, createdAt: SEED_TIME + 7, updatedAt: SEED_TIME + 7, source: { type: 'import' },
  },
];
