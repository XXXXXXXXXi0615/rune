import { describe, expect, it } from 'vitest'
import { DEFAULT_HEALTH_AI_SHARING, selectHealthContextSummary, validateHealthRecord, type HealthRecord } from './healthDomain'

const weight: HealthRecord = { id:'w1', occurredOn:'2026-07-20', type:'weight', value:{kind:'weight',kilograms:60}, source:'manual', createdAt:'2026-07-20T00:00:00Z', updatedAt:'2026-07-20T00:00:00Z' }

describe('MoonHealth domain', () => {
  it('defaults all five AI sharing permissions to off', () => {
    expect(Object.keys(DEFAULT_HEALTH_AI_SHARING)).toHaveLength(5)
    expect(Object.values(DEFAULT_HEALTH_AI_SHARING).every(value => value === false)).toBe(true)
  })
  it('rejects NaN, negative values, and impossible dates', () => {
    expect(validateHealthRecord({ occurredOn:'not-a-date', type:'weight', value:{kind:'weight',kilograms:60}, source:'manual' })).toMatch(/日期/)
    expect(validateHealthRecord({ occurredOn:'2026-07-20', type:'weight', value:{kind:'weight',kilograms:Number.NaN}, source:'manual' })).toMatch(/體重/)
    expect(validateHealthRecord({ occurredOn:'2026-07-20', type:'hydration', value:{kind:'hydration',milliliters:-1}, source:'manual' })).toMatch(/飲水/)
  })

  it('returns no AI context when every permission is off', () => {
    expect(selectHealthContextSummary([weight], [], DEFAULT_HEALTH_AI_SHARING)).toBeNull()
  })

  it('shares only explicitly authorized sections', () => {
    const summary = selectHealthContextSummary([weight], [], { ...DEFAULT_HEALTH_AI_SHARING, weight:true, bloodPressure:true })
    expect(summary?.availableSections).toEqual(['weight'])
    expect(summary?.missingSections).toEqual(['blood_pressure'])
    expect(summary?.recent.weight).toEqual({ kilograms:60, occurredOn:'2026-07-20' })
    expect(summary?.recent).not.toHaveProperty('diet')
  })

  it('emits only sleep when only sleep is authorized, then removes it immediately when revoked', () => {
    const sleep: HealthRecord = { id:'s1', occurredOn:'2026-07-20', type:'sleep', value:{kind:'sleep',sleptAt:'2026-07-19T23:00',wokeAt:'2026-07-20T07:00',durationMinutes:480,quality:4}, source:'manual', note:'private raw note', createdAt:'2026-07-20T00:00:00Z', updatedAt:'2026-07-20T00:00:00Z' }
    const allowed = selectHealthContextSummary([weight, sleep], [], { ...DEFAULT_HEALTH_AI_SHARING, sleepSummary:true })
    expect(allowed?.availableSections).toEqual(['sleep'])
    expect(allowed?.recent).toEqual({ sleep:{ averageMinutes:480, averageQuality:4, sampleCount:1 } })
    expect(JSON.stringify(allowed)).not.toContain('private raw note')
    expect(selectHealthContextSummary([weight, sleep], [], DEFAULT_HEALTH_AI_SHARING)).toBeNull()
  })

  it('never exposes raw symptom names or notes in structured context', () => {
    const symptom: HealthRecord = { id:'x1', occurredOn:'2026-07-20', type:'symptom', value:{kind:'symptom',name:'private symptom wording',severity:3}, source:'manual', note:'private note', createdAt:'2026-07-20T00:00:00Z', updatedAt:'2026-07-20T00:00:00Z' }
    const summary = selectHealthContextSummary([symptom], [], { ...DEFAULT_HEALTH_AI_SHARING, detailedSymptoms:true })
    expect(summary?.recent.symptoms).toEqual({ sampleCount:1, severityCounts:{ 3:1 } })
    expect(JSON.stringify(summary)).not.toContain('private')
  })
})
