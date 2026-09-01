const STORAGE_KEY = 'lunartide_period_records_v1';
/** Schema version for symptom tags migration (Phase 3.2) */
const CURRENT_SCHEMA_VERSION = 1;

export type PeriodMood = 'calm' | 'gentle' | 'radiant' | 'turbulent' | 'stormy';

export interface PeriodRecord {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  symptoms: string[];
  notes: string;
  createdAt: number;
  /** Tide diary mood — added in v2 migration */
  mood?: PeriodMood;
  /** Tide level label — added in v2 migration */
  tideLevel?: string;
  /** Flow level — added in Phase 1 */
  flowLevel?: string;
  /** Phase 3.2: raw free-text symptom input */
  symptomRawText?: string;
  /** Phase 3.2: parsed symptom tags from raw text */
  symptomTags?: string[];
  /** Phase 3.2: schema version tracking */
  _schemaVersion?: number;
}

export const PERIOD_MOODS: { key: PeriodMood; label: string; subtitle: string; color: string; bg: string }[] = [
  { key: 'calm',       label: '平穩', subtitle: '如靜海', color: '#5db8a6', bg: '#e8f5f1' },
  { key: 'gentle',     label: '輕柔', subtitle: '如花開', color: '#e8a5a0', bg: '#fdf0ee' },
  { key: 'radiant',    label: '明亮', subtitle: '如日照', color: '#e8c55a', bg: '#fdf8e8' },
  { key: 'turbulent',  label: '暗湧', subtitle: '如暗流', color: '#a28fb8', bg: '#f3eff7' },
  { key: 'stormy',     label: '風暴', subtitle: '如暴風', color: '#c64545', bg: '#fdf0f0' },
];

export const TIDE_LEVELS = ['漲潮', '滿潮', '平潮', '退潮', '低潮'];

export const FLOW_LEVELS = ['無', '點滴', '輕', '中', '重'];

export const SYMPTOM_OPTIONS = [
  '腹痛', '頭痛', '疲勞', '情緒低落',
  '腰痛', '胸悶', '噁心', '食慾改變',
  '失眠', '水腫', '皮膚問題', '其他',
];

function generateId(): string {
  return `period_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPeriodRecords(): PeriodRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const records = JSON.parse(raw) as PeriodRecord[];
      // Phase 3.2 migration: add symptomTags from old symptoms array
      return migrateSymptomTags(records);
    }
  } catch { /* ignore */ }
  return [];
}

/** Phase 3.2: Migrate old symptoms[] to symptomTags[].
 *  Idempotent — won't duplicate or overwrite existing symptomTags. */
function migrateSymptomTags(records: PeriodRecord[]): PeriodRecord[] {
  let changed = false;
  const migrated = records.map((r) => {
    if (r._schemaVersion !== undefined && r._schemaVersion >= CURRENT_SCHEMA_VERSION) return r;
    const next = { ...r, _schemaVersion: CURRENT_SCHEMA_VERSION };
    // Copy old symptoms array to symptomTags if not already populated
    if (!next.symptomTags || next.symptomTags.length === 0) {
      if (r.symptoms.length > 0) {
        // Deduplicate and normalize
        const tags = [...new Set(r.symptoms.map(s => s.trim()).filter(Boolean))];
        if (tags.length > 0) {
          next.symptomTags = tags;
          changed = true;
        }
      }
    }
    if (next.symptomRawText === undefined) {
      // If there are tags but no raw text, leave raw text empty
      // (don't fabricate text from tags)
      next.symptomRawText = '';
    }
    return next;
  });
  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }
  return migrated;
}

export function savePeriodRecord(record: PeriodRecord): void {
  const records = loadPeriodRecords();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function deletePeriodRecord(id: string): void {
  const records = loadPeriodRecords().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function createPeriodRecord(
  startDate: string,
  endDate: string,
  symptoms: string[],
  notes: string,
  mood?: PeriodMood,
  tideLevel?: string,
  flowLevel?: string,
  opts?: { symptomRawText?: string; symptomTags?: string[] },
): PeriodRecord {
  return {
    id: generateId(),
    startDate,
    endDate,
    symptoms,
    notes,
    mood,
    tideLevel,
    flowLevel,
    symptomRawText: opts?.symptomRawText ?? '',
    symptomTags: opts?.symptomTags ?? [],
    _schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: Date.now(),
  };
}

export interface PeriodUndoEntry {
  id: string;
  beforeSnapshot: string;
  afterSnapshotHash: string;
  createdAt: number;
  expiresAt: number;
}
