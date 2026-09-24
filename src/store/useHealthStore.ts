import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_HEALTH_AI_SHARING, validateHealthRecord, type HealthAiSharingSettings, type HealthRecord } from '@/features/health/healthDomain'

interface HealthState {
  records: HealthRecord[]
  weightUnit: 'kg' | 'lb'
  aiSharing: HealthAiSharingSettings
  addRecord: (record: Omit<HealthRecord, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateRecord: (id: string, patch: Omit<HealthRecord, 'id' | 'createdAt' | 'updatedAt'>) => void
  deleteRecord: (id: string) => void
  setWeightUnit: (unit: 'kg' | 'lb') => void
  setAiSharing: (key: keyof HealthAiSharingSettings, enabled: boolean) => void
}

export const useHealthStore = create<HealthState>()(persist((set) => ({
  records: [], weightUnit: 'kg', aiSharing: DEFAULT_HEALTH_AI_SHARING,
  addRecord: record => { const error = validateHealthRecord(record); if (error) throw new Error(error); const id = crypto.randomUUID(); const now = new Date().toISOString(); set(s => ({ records: [{ ...record, id, createdAt: now, updatedAt: now }, ...s.records] })); return id },
  updateRecord: (id, patch) => { const error = validateHealthRecord(patch); if (error) throw new Error(error); set(s => ({ records: s.records.map(r => r.id === id ? { ...patch, id, createdAt: r.createdAt, updatedAt: new Date().toISOString() } : r) })) },
  deleteRecord: id => set(s => ({ records: s.records.filter(r => r.id !== id) })),
  setWeightUnit: weightUnit => set({ weightUnit }),
  setAiSharing: (key, enabled) => set(s => ({ aiSharing: { ...s.aiSharing, [key]: enabled } })),
}), { name: 'lunartide-health-v1', partialize: s => ({ records: s.records, weightUnit: s.weightUnit, aiSharing: s.aiSharing }) }))
