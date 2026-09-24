const TEST_STRING = 'BESbswy0123456789月潮如詩溫柔地記錄每一個當下';

const SAMPLE_SIZE = '16px';

const FONT_CHECK_CACHE = new Map<string, boolean>();

export function isFontAvailable(family: string): boolean {
  if (FONT_CHECK_CACHE.has(family)) return FONT_CHECK_CACHE.get(family)!;

  if (!document.fonts || typeof document.fonts.check !== 'function') {
    FONT_CHECK_CACHE.set(family, false);
    return false;
  }

  try {
    const available = document.fonts.check(`${SAMPLE_SIZE} "${family}"`, TEST_STRING);
    FONT_CHECK_CACHE.set(family, available);
    return available;
  } catch {
    FONT_CHECK_CACHE.set(family, false);
    return false;
  }
}

export async function waitForFontLoad(family: string, timeoutMs = 3000): Promise<boolean> {
  if (!document.fonts || typeof document.fonts.load !== 'function') {
    return isFontAvailable(family);
  }

  try {
    const resolved = await Promise.race([
      document.fonts.load(`${SAMPLE_SIZE} "${family}"`, TEST_STRING),
      new Promise<undefined>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    const available = !!(resolved && resolved.length > 0);
    FONT_CHECK_CACHE.set(family, available);
    return available;
  } catch {
    return isFontAvailable(family);
  }
}

export function isSystemFont(family: string): boolean {
  const SYSTEM_LIST = [
    'PingFang TC',
    'PingFang SC',
    'PingFang HK',
    'Microsoft JhengHei',
    'Microsoft YaHei',
    'Hiragino Sans',
    'Hiragino Kaku Gothic ProN',
    'Apple SD Gothic Neo',
    'Malgun Gothic',
    'Noto Sans CJK TC',
    'Noto Serif CJK TC',
  ];
  return SYSTEM_LIST.includes(family) && isFontAvailable(family);
}

export function clearFontCheckCache(): void {
  FONT_CHECK_CACHE.clear();
}
