import type { HolidayProvenance } from '../types';

/**
 * Provenance is intentionally separate from occurrence records. The CN State
 * Council notice is the authority for 2026 official leave and makeup-workday
 * dates; the one cultural observance is explicitly not represented as a public
 * holiday.
 */
export const HOLIDAY_PROVENANCE: readonly HolidayProvenance[] = [
  {
    sourceId: 'cn-2026-state-council',
    region: 'CN',
    year: 2026,
    issuer: '国务院办公厅',
    title: '国务院办公厅关于2026年部分节假日安排的通知（国办发明电〔2025〕7号）',
    officialUrl: 'https://www.gov.cn/gongbao/2025/issue_12406/material/gwygb202532.pdf',
    publishedAt: '2025-11-04',
    coverage: '2026 元旦、春节、清明节、劳动节、端午节、中秋节、国庆节的放假调休与补班日期；其中具节名者也提供传统节庆 occurrence。',
    retrievedAt: '2026-09-22',
  },
  {
    sourceId: 'cn-fixed-cultural-observances-v1',
    region: 'CN',
    year: 2026,
    issuer: 'Rune Calendar',
    title: 'CN fixed cultural observances v1',
    officialUrl: 'https://www.gov.cn/',
    coverage: '產品目錄中的固定公曆文化觀察日；不表示法定假日、調休或放假安排。',
    retrievedAt: '2026-09-22',
  },
];

export const HOLIDAY_PROVENANCE_BY_ID = new Map(
  HOLIDAY_PROVENANCE.map((source) => [source.sourceId, source] as const),
);
