import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadPeriodRecords,
  savePeriodRecord,
  deletePeriodRecord,
  createPeriodRecord,
  FLOW_LEVELS,
  type PeriodRecord,
} from './periodStorage';
import { getFlowLevelLabel, FALLBACK_LABEL } from '@/features/period/periodLabels';

function seedStorage(records: PeriodRecord[]) {
  localStorage.setItem('lunartide_period_records_v1', JSON.stringify(records));
}

function clearStorage() {
  localStorage.removeItem('lunartide_period_records_v1');
}

describe('flowLevel backward compatibility', () => {
  beforeEach(() => {
    clearStorage();
  });

  it('1. old record without flowLevel still loads', () => {
    const oldRecord = {
      id: 'period_old_1',
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      symptoms: ['腹痛'],
      notes: 'old record',
      createdAt: 1700000000000,
      mood: 'calm',
      tideLevel: '平潮',
    };
    seedStorage([oldRecord as PeriodRecord]);
    const records = loadPeriodRecords();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('period_old_1');
    expect(records[0].flowLevel).toBeUndefined();
  });

  it('2. missing flowLevel does not display as error value', () => {
    const label = getFlowLevelLabel(undefined);
    expect(label).toBe(FALLBACK_LABEL);
    expect(label).not.toBe('undefined');
    expect(label).not.toBe('null');

    const labelNull = getFlowLevelLabel(null);
    expect(labelNull).toBe(FALLBACK_LABEL);

    const labelEmpty = getFlowLevelLabel('');
    expect(labelEmpty).toBe(FALLBACK_LABEL);
  });

  it('3. saved flowLevel round-trips correctly', () => {
    const rec = createPeriodRecord('2026-07-10', '2026-07-14', [], '', 'calm', '平潮', '中');
    savePeriodRecord(rec);

    const loaded = loadPeriodRecords();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].flowLevel).toBe('中');
    expect(loaded[0].mood).toBe('calm');
    expect(loaded[0].tideLevel).toBe('平潮');
    expect(loaded[0].startDate).toBe('2026-07-10');
    expect(loaded[0].endDate).toBe('2026-07-14');
  });

  it('4. all valid flowLevel values display correctly', () => {
    for (const fl of FLOW_LEVELS) {
      expect(getFlowLevelLabel(fl)).toBe(fl);
    }
  });

  it('5. unknown flowLevel uses safe fallback', () => {
    expect(getFlowLevelLabel('unknown_value')).toBe(FALLBACK_LABEL);
    expect(getFlowLevelLabel('random')).toBe(FALLBACK_LABEL);
  });

  it('6. FLOW_LEVELS contains all five expected values', () => {
    expect(FLOW_LEVELS).toEqual(['無', '點滴', '輕', '中', '重']);
  });

  it('7. editing old record preserves other fields', () => {
    const oldRecord: PeriodRecord = {
      id: 'period_old_2',
      startDate: '2026-07-15',
      endDate: '2026-07-19',
      symptoms: ['頭痛', '疲勞'],
      notes: 'original notes',
      createdAt: 1700000000100,
      mood: 'turbulent',
      tideLevel: '滿潮',
    };
    seedStorage([oldRecord]);

    const loaded = loadPeriodRecords();
    expect(loaded).toHaveLength(1);
    const rec = loaded[0];

    // Simulate edit: add flowLevel, change notes, keep rest
    const edited = { ...rec, notes: 'updated notes', flowLevel: '重' };
    savePeriodRecord(edited);

    const reloaded = loadPeriodRecords();
    expect(reloaded).toHaveLength(1);
    const r = reloaded[0];
    expect(r.flowLevel).toBe('重');
    expect(r.notes).toBe('updated notes');
    expect(r.mood).toBe('turbulent');
    expect(r.tideLevel).toBe('滿潮');
    expect(r.symptoms).toEqual(['頭痛', '疲勞']);
    expect(r.startDate).toBe('2026-07-15');
    expect(r.endDate).toBe('2026-07-19');
  });

  it('8. round-trip: save then load preserves all new fields', () => {
    const rec = createPeriodRecord(
      '2026-08-01',
      '2026-08-06',
      ['腹痛', '腰痛'],
      'test notes',
      'stormy',
      '退潮',
      '輕',
    );
    savePeriodRecord(rec);

    const all = loadPeriodRecords();
    expect(all).toHaveLength(1);
    const r = all[0];
    expect(r.flowLevel).toBe('輕');
    expect(r.mood).toBe('stormy');
    expect(r.tideLevel).toBe('退潮');
    expect(r.symptoms).toEqual(['腹痛', '腰痛']);
    expect(r.notes).toBe('test notes');
  });

  it('9. does not batch-overwrite old records', () => {
    const oldRecord: PeriodRecord = {
      id: 'period_old_3',
      startDate: '2026-06-20',
      endDate: '2026-06-24',
      symptoms: [],
      notes: '',
      createdAt: 1690000000000,
    };
    const newRecord = createPeriodRecord('2026-08-10', '2026-08-14', [], '', undefined, undefined, '點滴');
    seedStorage([oldRecord]);

    savePeriodRecord(newRecord);

    const all = loadPeriodRecords();
    expect(all).toHaveLength(2);
    const old = all.find(r => r.id === 'period_old_3');
    const neu = all.find(r => r.id === newRecord.id);
    expect(old).toBeDefined();
    expect(old!.flowLevel).toBeUndefined();
    expect(old!.startDate).toBe('2026-06-20');
    expect(neu!.flowLevel).toBe('點滴');
  });
});
