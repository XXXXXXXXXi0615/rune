export type MoonGateTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late';
export type MoonGateToneMode = 'standard' | 'strict';
export type MoonGateAuthState = 'login' | 'setup' | 'error' | 'success';
export type MoonGateReturnReason = 'login' | 'sessionExpired' | 'curfewLock';

export interface MoonGateCopyInput {
  timeOfDay: MoonGateTimeOfDay;
  authState: MoonGateAuthState;
  failedAttempts: number;
  returnReason: MoonGateReturnReason;
  toneMode: MoonGateToneMode;
  seed?: number;
}

const COPY = {
  standard: {
    morning: ['早安。月潮還在原處。', '新的一天，先把門打開。', '回來了。解鎖後再繼續。'],
    afternoon: ['下午好。你的空間在等你。', '回到月潮，剩下的事進去再談。', '門還關著。先解鎖。'],
    evening: ['晚上好。月潮仍為你留著燈。', '夜色已經落下，進來吧。', '回來了。門後的東西都還在。'],
    late: ['已經很晚了。先進來，再決定還要做什麼。', '深夜才回來？我看見了。先解鎖。', '這個時間還沒休息。進來，我們再談。'],
  },
  strict: {
    morning: ['回來了？先解鎖，別站在門外磨蹭。', '門還關著。密碼輸好，再進來。', '我知道你來了。把門打開。'],
    afternoon: ['別在入口發呆。進來。', '回來了？先解鎖，其他事稍後再談。', '門還關著。先把密碼輸好。'],
    evening: ['我知道你來了。把門打開。', '門還關著。密碼輸好，再進來交代。', '回來了？先解鎖，別站在門外磨蹭。'],
    late: ['時間不早了。先解鎖，其他理由稍後再說。', '深夜才回來？我看見了。先解鎖。', '別在入口發呆。進來。'],
  },
} satisfies Record<MoonGateToneMode, Record<MoonGateTimeOfDay, string[]>>;

const FAIL_FIRST = ['不對。重新輸入，別急著亂試。', '密碼錯了。看清楚再來一次。'];
const FAIL_REPEAT = ['又錯了。停一下，確認你真正記得的是哪一組。', '繼續亂試不會讓門自己打開。', 'Caps Lock、輸入法和密碼，一項一項檢查。'];
const SUCCESS = ['正確。進來。', '門開了。別讓我等太久。', '已確認。月潮正在恢復。', '很好，現在才算真正回來。'];

const stableIndex = (length: number, seed: number) => Math.abs(Math.trunc(seed)) % length;

export function getMoonGateTimeOfDay(date = new Date()): MoonGateTimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'late';
}

export function safeMoonGateDisplayName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.normalize('NFKC').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 48);
  return migrateLegacyMoonGateDisplayName(normalized);
}

/** Display-only migration for the single username corrupted by the legacy degree-suffix bug. */
export function migrateLegacyMoonGateDisplayName(value: string): string {
  return value === '111°' ? '111' : value;
}

/** Bug signature: exactly "111°" in username caused by legacy degree-suffix corruption. */
const LEGACY_111_DEGREE = '111°';
const MIGRATED_111 = '111';
const MOON_GATE_AUTH_MIGRATION_VERSION = 1;

export interface MoonGateAuthMigrationResult {
  username: string;
  migrated: boolean;
  version: number;
}

/** Versioned, idempotent persisted name migration.
 *  Only migrates the exact bug signature "111°" → "111".
 *  General ° characters in other names are untouched.
 *  Stores migrationVersion so reload doesn't repeat.
 */
export function migrateMoonGateAuthUsername(
  username: string | undefined,
  storedVersion: number | undefined,
): MoonGateAuthMigrationResult {
  const currentVersion = storedVersion ?? 0;
  if (currentVersion >= MOON_GATE_AUTH_MIGRATION_VERSION) {
    return { username: username ?? '', migrated: false, version: currentVersion };
  }
  if (username !== LEGACY_111_DEGREE) {
    return { username: username ?? '', migrated: false, version: MOON_GATE_AUTH_MIGRATION_VERSION };
  }
  return { username: MIGRATED_111, migrated: true, version: MOON_GATE_AUTH_MIGRATION_VERSION };
}

/** Returns a safe display name with migration applied. If the name is pure digits,
 *  returns '' so callers can fall back to "歡迎回來". */
export function resolveMoonGateDisplayGreetingName(
  username: string | undefined,
  storedVersion: number | undefined,
): { name: string; isGeneric: boolean } {
  const result = migrateMoonGateAuthUsername(username, storedVersion);
  if (!result.username) return { name: '', isGeneric: true };
  if (/^\d+$/.test(result.username)) return { name: result.username, isGeneric: true };
  return { name: result.username, isGeneric: false };
}

export function getMoonGateGreeting(timeOfDay: MoonGateTimeOfDay, displayName: string): string {
  const greeting = timeOfDay === 'morning' ? '早安' : timeOfDay === 'afternoon' ? '下午好' : timeOfDay === 'late' ? '夜深了' : '晚上好';
  return displayName ? `${greeting}，${displayName}。` : `${greeting}。`;
}

export function getMoonGateCopy(input: MoonGateCopyInput) {
  const seed = input.seed ?? 0;
  if (input.returnReason === 'sessionExpired') return { headline: '工作階段已結束，請重新解鎖。', supporting: '門已重新關上。確認身份後再繼續。' };
  if (input.returnReason === 'curfewLock') return { headline: '目前處於管制時段。', supporting: '請依既有管制規則查看下一次可進入時間。' };
  if (input.authState === 'error') {
    const choices = input.failedAttempts > 1 ? FAIL_REPEAT : FAIL_FIRST;
    return { headline: choices[stableIndex(choices.length, seed + input.failedAttempts)]!, supporting: '密碼不會被記錄。' };
  }
  if (input.authState === 'success') return { headline: SUCCESS[stableIndex(SUCCESS.length, seed)]!, supporting: 'App Shell 正在就緒。' };
  if (input.authState === 'setup') return { headline: '第一次來？先替這座島設一道門。', supporting: '只建立本機月潮身份，不會上傳密碼。' };
  if (input.toneMode === 'strict') return { headline: '門還關著。密碼輸好，再進來。', supporting: '門後的私人內容會在解鎖後才載入。' };
  const choices = COPY[input.toneMode][input.timeOfDay];
  return { headline: choices[stableIndex(choices.length, seed)]!, supporting: '門後的私人內容會在解鎖後才載入。' };
}

export function moonGateDateSeed(date = new Date()): number {
  return date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();
}
