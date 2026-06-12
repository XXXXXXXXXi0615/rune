import type { AppData } from '@/types';
import { normalizeStore } from '@/store/storage';

export const BACKUP_FORMAT = 'lunartide-backup';
export const BACKUP_VERSION = 2;

interface LunartideBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: AppData;
  sections: {
    todos: AppData['todos'];
    memories: AppData['memoryEntries'];
    locations: AppData['locations'];
    settings: {
      theme: AppData['theme'];
      accentColor: AppData['accentColor'];
      language: AppData['language'];
      profile: AppData['profile'];
      partner: AppData['partner'];
      petWidget: AppData['petWidget'];
      aiConnection: AppData['aiConnection'];
      aiPrompting: AppData['aiPrompting'];
    };
  };
  notes: {
    indexedDbAssetsIncluded: false;
  };
}

function extractState(value: unknown): Partial<AppData> {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup data');
  const record = value as Record<string, unknown>;
  if (record.format === BACKUP_FORMAT && record.data && typeof record.data === 'object') {
    return record.data as Partial<AppData>;
  }
  if (record.state && typeof record.state === 'object') {
    return record.state as Partial<AppData>;
  }
  return record as Partial<AppData>;
}

export function createLunartideBackup(value: unknown): LunartideBackup {
  const data = normalizeStore(extractState(value));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    sections: {
      todos: data.todos,
      memories: data.memoryEntries,
      locations: data.locations,
      settings: {
        theme: data.theme,
        accentColor: data.accentColor,
        language: data.language,
        profile: data.profile,
        partner: data.partner,
        petWidget: data.petWidget,
        aiConnection: data.aiConnection,
        aiPrompting: data.aiPrompting,
      },
    },
    notes: {
      indexedDbAssetsIncluded: false,
    },
  };
}

export function restoreLunartideBackup(value: unknown): AppData {
  return normalizeStore(extractState(value));
}

export function serializePersistedStore(data: AppData): string {
  return JSON.stringify({ state: data, version: 0 });
}
