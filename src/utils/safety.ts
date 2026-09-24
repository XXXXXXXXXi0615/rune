/**
 * Safety utilities — runtime guards to prevent white screens.
 * All functions are no-ops in production (tree-shaken).
 */

const IS_DEV = import.meta.env.DEV;

/** Warn in dev when a required prop is undefined. */
export function assertProp(component: string, prop: string, value: unknown): void {
  if (IS_DEV && value === undefined) {
    console.warn(`[${component}] missing required prop: ${prop}`);
  }
}

/** Warn in dev when a route param is missing. */
export function assertParam(component: string, param: string, value: unknown): void {
  if (IS_DEV && (value === undefined || value === null)) {
    console.warn(`[${component}] missing route param: ${param}`);
  }
}

/** Safe JSON.parse — returns fallback on error. */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    if (IS_DEV) console.warn('[safeJsonParse] invalid JSON:', raw.slice(0, 80));
    return fallback;
  }
}

/** Safe localStorage.getItem — returns fallback on error. */
export function safeLocalGet(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Safe localStorage.setItem — silently fails. */
export function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    if (IS_DEV) console.warn('[safeLocalSet] failed for key:', key);
  }
}

/** Wrap a potentially-throwing async fn with try/catch. Logs in dev. */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  label: string,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (IS_DEV) console.error(`[safeAsync] ${label}:`, err);
    return fallback;
  }
}

/** Ensure an array index is within bounds. Returns fallback if not. */
export function safeIndex<T>(arr: T[], index: number, fallback: T): T {
  if (index < 0 || index >= arr.length) {
    if (IS_DEV) console.warn(`[safeIndex] out of bounds: ${index}/${arr.length}`);
    return fallback;
  }
  return arr[index];
}
