/**
 * Zustand persist 驗證測試 — v5.0.13
 *
 * 驗證：
 * 1. raw storage 包含 { state, version } wrapper
 * 2. merge 接收到 unwrapped persisted state（不含 state/version）
 * 3. profile survives reload（模擬 rehydrate）
 * 4. partial nested profile 不 erase defaults
 * 5. actions remain functions
 * 6. malformed data safely falls back
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/* ---------- helpers ---------- */

const STORAGE_KEY = '__vitest_persist_verify__';

function rawValue() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

/* ---------- minimal store for contract tests ---------- */

interface TestState {
  profile: { name: string; bio: string; avatarKey?: string };
  runtimeOnly: string;
}

interface TestActions {
  setName: (name: string) => void;
  setBio: (bio: string) => void;
}

type TestStore = TestState & TestActions;

function createTestStore() {
  return create<TestStore>()(
    persist(
      (set) => ({
        profile: { name: 'initial', bio: '', avatarKey: undefined },
        runtimeOnly: 'not-persisted',
        setName: (name) => set((s) => ({ profile: { ...s.profile, name } })),
        setBio: (bio) => set((s) => ({ profile: { ...s.profile, bio } })),
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ profile: state.profile }),
        version: 0,
      },
    ),
  );
}

/* ---------- tests ---------- */

describe('Zustand v5 persist contract', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('1. raw storage contains { state, version } wrapper', () => {
    const store = createTestStore();
    store.getState().setName('shuri');
    store.getState().setBio('月潮同步中');

    const raw = rawValue();
    expect(raw).not.toBeNull();
    expect(raw).toHaveProperty('state');
    expect(raw).toHaveProperty('version');
    expect(raw.version).toBe(0);
    expect(raw.state).toHaveProperty('profile');
    expect(raw.state.profile.name).toBe('shuri');
    expect(raw.state.profile.bio).toBe('月潮同步中');
    // 未 persist 的欄位不應出現在 raw state 中
    expect(raw.state).not.toHaveProperty('runtimeOnly');
  });

  it('2. merge receives unwrapped persisted state (no state/version keys)', () => {
    let capturedPersistedState: unknown = undefined;

    const store = create<TestStore>()(
      persist(
        (set) => ({
          profile: { name: 'initial', bio: '' },
          runtimeOnly: 'not-persisted',
          setName: (name) => set((s) => ({ profile: { ...s.profile, name } })),
          setBio: (bio) => set((s) => ({ profile: { ...s.profile, bio } })),
        }),
        {
          name: STORAGE_KEY,
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({ profile: state.profile }),
          version: 0,
          merge: (persistedState, currentState) => {
            capturedPersistedState = persistedState;
            return { ...currentState, ...(persistedState as Record<string, unknown>) } as TestStore;
          },
        },
      ),
    );

    // 先寫入資料模擬前次 persist
    store.getState().setName('shuri');
    store.getState().setBio('月潮同步中');

    // 建立第二個 store instance → 觸發 rehydrate → merge 被呼叫
    const store2 = create<TestStore>()(
      persist(
        (set) => ({
          profile: { name: 'initial2', bio: '' },
          runtimeOnly: 'not-persisted-2',
          setName: (name) => set((s) => ({ profile: { ...s.profile, name } })),
          setBio: (bio) => set((s) => ({ profile: { ...s.profile, bio } })),
        }),
        {
          name: STORAGE_KEY,
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({ profile: state.profile }),
          version: 0,
          merge: (persistedState, currentState) => {
            capturedPersistedState = persistedState;
            return { ...currentState, ...(persistedState as Record<string, unknown>) } as TestStore;
          },
        },
      ),
    );

    // merge 收到的應為 unwrapped state（不含 state/version key）
    expect(capturedPersistedState).not.toBeNull();
    const caps = capturedPersistedState as Record<string, unknown>;
    expect(caps).toHaveProperty('profile');
    expect(caps).not.toHaveProperty('state');
    expect(caps).not.toHaveProperty('version');
    expect((caps.profile as Record<string, unknown>).name).toBe('shuri');
    expect((caps.profile as Record<string, unknown>).bio).toBe('月潮同步中');

    // store2 有 rehydrate 但 profile 被正確合併（不是被 shallow merge 清空）
    // 注意：runtimeOnly 會被 persisted profile overwrite 蓋掉，
    // 但 merge 預設 { ...current, ...persisted } — persisted 只有 profile
    // 所以 runtimeOnly 保留 current 值
  });

  it('3. profile survives rehydrate (simulated reload)', () => {
    const store1 = createTestStore();
    store1.getState().setName('shuri');
    store1.getState().setBio('月潮同步中');

    // 模擬 reload：建立新 instance
    const store2 = createTestStore();
    // 等待 rehydrate（Zustand persist 是同步 localStorage，但 promise chain 需要等下）
    // 實際上 MemoryStorage 是同步的，所以 store2 建立後 state 已可用
    const state = store2.getState();
    expect(state.profile.name).toBe('shuri');
    expect(state.profile.bio).toBe('月潮同步中');
    // 未 persist 的 runtimeOnly 應回到初始值
    expect(state.runtimeOnly).toBe('not-persisted');
  });

  it('4. partial nested profile does not erase defaults', () => {
    // 寫入部分 profile（缺 avatarKey）
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { profile: { name: 'partial', bio: 'only-bio' } },
        version: 0,
      }),
    );

    const store = createTestStore();
    const state = store.getState();
    // defaults 中有 avatarKey: undefined，persisted 中沒有 avatarKey
    // { ...defaults.profile, ...persisted.profile } 不會 erase avatarKey
    // 但 persisted 沒有 avatarKey → 保留 default 的 undefined
    expect(state.profile.name).toBe('partial');
    expect(state.profile.bio).toBe('only-bio');
    // 未在 persisted 中的 runtimeOnly 回到 default
    expect(state.runtimeOnly).toBe('not-persisted');
    // avatarKey 不在 persisted 中 → 維持 default undefined
    expect(state.profile.avatarKey).toBeUndefined();
  });

  it('5. actions remain functions after rehydrate', () => {
    const store1 = createTestStore();
    store1.getState().setName('persisted-name');

    const store2 = createTestStore();
    expect(typeof store2.getState().setName).toBe('function');
    expect(typeof store2.getState().setBio).toBe('function');
    // 呼叫 action 應正常
    store2.getState().setBio('new-bio');
    expect(store2.getState().profile.bio).toBe('new-bio');
    expect(store2.getState().profile.name).toBe('persisted-name');
  });

  it('6. malformed persisted data safely falls back', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json-at-all');

    // 不應 crash
    const store = createTestStore();
    const state = store.getState();
    // fallback 到 default state
    expect(state.profile.name).toBe('initial');
    expect(state.profile.bio).toBe('');
    expect(state.runtimeOnly).toBe('not-persisted');
    expect(typeof state.setName).toBe('function');
  });

  it('7. version mismatch runs migrate', () => {
    let migratedState: unknown = undefined;
    let migratedVersion: number | undefined = undefined;

    const store = create<TestStore & { _migrated: boolean }>()(
      persist(
        (set) => ({
          profile: { name: 'v2-initial', bio: '' },
          runtimeOnly: 'not-persisted',
          _migrated: false,
          setName: (name) => set((s) => ({ profile: { ...s.profile, name } })),
          setBio: (bio) => set((s) => ({ profile: { ...s.profile, bio } })),
        }),
        {
          name: STORAGE_KEY,
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({ profile: state.profile }),
          version: 1,
          migrate: (persistedState, version) => {
            migratedState = persistedState;
            migratedVersion = version;
            return { ...(persistedState as Record<string, unknown>), _migrated: true } as TestStore & { _migrated: boolean };
          },
        },
      ),
    );

    // 先寫入 v0 格式
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { profile: { name: 'v0-data', bio: 'v0' } },
        version: 0,
      }),
    );

    // 建立新 store → 應觸發 migrate
    const store2 = create<TestStore & { _migrated: boolean }>()(
      persist(
        (set) => ({
          profile: { name: 'v2-initial', bio: '' },
          runtimeOnly: 'not-persisted',
          _migrated: false,
          setName: (name) => set((s) => ({ profile: { ...s.profile, name } })),
          setBio: (bio) => set((s) => ({ profile: { ...s.profile, bio } })),
        }),
        {
          name: STORAGE_KEY,
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({ profile: state.profile }),
          version: 1,
          migrate: (persistedState, version) => {
            migratedState = persistedState;
            migratedVersion = version;
            return { ...(persistedState as Record<string, unknown>), _migrated: true } as TestStore & { _migrated: boolean };
          },
        },
      ),
    );

    expect(migratedVersion).toBe(0);
    const ms = migratedState as Record<string, unknown>;
    expect(ms).toHaveProperty('profile');
    const migProfile = ms.profile as Record<string, unknown>;
    expect(migProfile.name).toBe('v0-data');

    // 等待 rehydrate
    const state = store2.getState();
    expect(state.profile.name).toBe('v0-data');
    expect(state._migrated).toBe(true);
  });

  it('8. old profile data remains intact (no corruption)', () => {
    const store1 = createTestStore();
    store1.getState().setName('old-name');
    store1.getState().setBio('old-bio');

    // 直接修改 raw storage（模擬其他 app state 變更）
    const raw = rawValue();
    raw.state.profile.name = 'new-name';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    const store2 = createTestStore();
    expect(store2.getState().profile.name).toBe('new-name');
    expect(store2.getState().profile.bio).toBe('old-bio');
  });
});
