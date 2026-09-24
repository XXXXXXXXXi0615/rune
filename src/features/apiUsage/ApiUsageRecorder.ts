export const API_USAGE_STORAGE_KEY = 'lunartide-api-usage-v1';
/** Legacy localStorage records are migration input only; this module never writes them. */
export function readLegacyApiUsageRecords(): unknown[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(API_USAGE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
