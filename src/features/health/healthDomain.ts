import type { PeriodRecord } from '@/utils/periodStorage'

export type HealthRecordType = 'weight' | 'blood_pressure' | 'sleep' | 'hydration' | 'symptom' | 'mood' | 'temperature' | 'heart_rate'
export type HealthRecordSource = 'manual' | 'moondiet' | 'period' | 'imported'

export type HealthRecordValue =
  | { kind: 'weight'; kilograms: number }
  | { kind: 'blood_pressure'; systolic: number; diastolic: number; pulse?: number }
  | { kind: 'sleep'; sleptAt: string; wokeAt: string; durationMinutes: number; quality: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'hydration'; milliliters: number }
  | { kind: 'symptom'; name: string; severity: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'mood'; label: string }
  | { kind: 'temperature'; celsius: number }
  | { kind: 'heart_rate'; bpm: number }

export interface HealthRecord {
  id: string
  occurredOn: string
  occurredAt?: string
  type: HealthRecordType
  value: HealthRecordValue
  source: HealthRecordSource
  note?: string
  createdAt: string
  updatedAt: string
}

export interface HealthAiSharingSettings {
  sleepSummary: boolean
  menstrualCycle: boolean
  weight: boolean
  bloodPressure: boolean
  detailedSymptoms: boolean
}

export const DEFAULT_HEALTH_AI_SHARING: HealthAiSharingSettings = {
  sleepSummary: false, menstrualCycle: false,
  weight: false, bloodPressure: false, detailedSymptoms: false,
}

export interface HealthContextSummary {
  generatedAt: string
  availableSections: string[]
  missingSections: string[]
  recent: {
    weight?: { kilograms: number; occurredOn: string }
    bloodPressure?: { systolic: number; diastolic: number; pulse?: number; occurredOn: string }
    sleep?: { averageMinutes: number; averageQuality: number; sampleCount: number }
    cycle?: { lastStartDate: string; recordCount: number }
    symptoms?: { sampleCount: number; severityCounts: Partial<Record<1 | 2 | 3 | 4 | 5, number>> }
  }
}

const isoDay = /^\d{4}-\d{2}-\d{2}$/
export function isValidOccurredOn(value: string): boolean {
  if (!isoDay.test(value)) return false
  const d = new Date(`${value}T00:00:00`)
  return !Number.isNaN(d.getTime()) && value === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` && d.getTime() <= Date.now() + 86400000
}

export function validateHealthRecord(record: Omit<HealthRecord, 'id' | 'createdAt' | 'updatedAt'>): string | null {
  if (!isValidOccurredOn(record.occurredOn)) return '日期無效或不可晚於明日'
  const v = record.value
  const positive = (n: number) => Number.isFinite(n) && n > 0
  if (record.type !== v.kind) return '紀錄類型不一致'
  if (v.kind === 'weight' && (!positive(v.kilograms) || v.kilograms > 500)) return '請輸入合理的體重'
  if (v.kind === 'blood_pressure' && (!positive(v.systolic) || !positive(v.diastolic) || v.systolic > 300 || v.diastolic > 200 || (v.pulse != null && (!positive(v.pulse) || v.pulse > 300)))) return '請檢查血壓與脈搏數值'
  if (v.kind === 'hydration' && (!positive(v.milliliters) || v.milliliters > 20000)) return '請輸入合理的飲水量'
  if (v.kind === 'sleep' && (!isValidDateTime(v.sleptAt) || !isValidDateTime(v.wokeAt) || new Date(v.wokeAt) <= new Date(v.sleptAt) || !positive(v.durationMinutes) || v.durationMinutes > 1440)) return '請檢查睡眠時間'
  if (v.kind === 'symptom' && (!v.name.trim() || v.severity < 1 || v.severity > 5)) return '請填寫症狀與程度'
  return null
}

function isValidDateTime(value: string) { return !!value && !Number.isNaN(new Date(value).getTime()) }

export function selectHealthContextSummary(records: HealthRecord[], periods: PeriodRecord[], permissions: HealthAiSharingSettings): HealthContextSummary | null {
  const recent: HealthContextSummary['recent'] = {}
  const availableSections: string[] = []
  const missingSections: string[] = []
  const latest = <T extends HealthRecordValue['kind']>(kind: T) => records.filter(r => r.value.kind === kind).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))[0]
  if (permissions.weight) { const r = latest('weight'); if (r?.value.kind === 'weight') { recent.weight = { kilograms: r.value.kilograms, occurredOn: r.occurredOn }; availableSections.push('weight') } else missingSections.push('weight') }
  if (permissions.bloodPressure) { const r = latest('blood_pressure'); if (r?.value.kind === 'blood_pressure') { recent.bloodPressure = { ...r.value, occurredOn: r.occurredOn }; availableSections.push('blood_pressure') } else missingSections.push('blood_pressure') }
  if (permissions.sleepSummary) { const rs = records.filter(r => r.value.kind === 'sleep').slice(0, 14); if (rs.length) { recent.sleep = { averageMinutes: Math.round(rs.reduce((n, r) => n + (r.value.kind === 'sleep' ? r.value.durationMinutes : 0), 0) / rs.length), averageQuality: rs.reduce((n, r) => n + (r.value.kind === 'sleep' ? r.value.quality : 0), 0) / rs.length, sampleCount: rs.length }; availableSections.push('sleep') } else missingSections.push('sleep') }
  if (permissions.menstrualCycle) { if (periods.length) { recent.cycle = { lastStartDate: [...periods].sort((a,b) => b.startDate.localeCompare(a.startDate))[0].startDate, recordCount: periods.length }; availableSections.push('cycle') } else missingSections.push('cycle') }
  if (permissions.detailedSymptoms) { const rs = records.filter(r => r.value.kind === 'symptom'); if (rs.length) { const severityCounts: Partial<Record<1|2|3|4|5,number>> = {}; for (const r of rs) if (r.value.kind === 'symptom') severityCounts[r.value.severity] = (severityCounts[r.value.severity] || 0) + 1; recent.symptoms = { sampleCount: rs.length, severityCounts }; availableSections.push('symptoms') } else missingSections.push('symptoms') }
  if (!availableSections.length && !missingSections.length) return null
  return { generatedAt: new Date().toISOString(), availableSections, missingSections, recent }
}
