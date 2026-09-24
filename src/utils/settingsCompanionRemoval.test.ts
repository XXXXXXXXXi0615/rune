import { describe, expect, it } from 'vitest';
import { SETTINGS_GROUPS, resolveLegacySettingsRoute, searchSettingsRows } from '@/features/settings/settingsRegistry';
import { useAppStore } from '@/store/useAppStore';
import { useMusicStore } from '@/store/musicStore';
import { SYSTEM_AGENT_NAME } from '@/store/agentIdentity';

describe('Settings companion status removal contract', () => {
  it('keeps retired companion-status out while exposing the canonical display panel', () => {
    const rows = SETTINGS_GROUPS.flatMap((group) => group.rows);
    expect(rows.some((row) => row.key === 'companion-status' || row.route?.includes('/lunaris/companion'))).toBe(false);
    expect(rows).toContainEqual(expect.objectContaining({ key: 'companion', route: '/settings/companion', title: '桌寵' }));
    expect(searchSettingsRows('陪伴狀態')).toEqual([]);
    expect(searchSettingsRows('LUNARIS 狀態、連線與設定')).toEqual([]);
    expect(searchSettingsRows('管理顯示')).toContainEqual(expect.objectContaining({ route: '/settings/companion' }));
  });

  it('replace-resolves both removed status routes to settings', () => {
    expect(resolveLegacySettingsRoute('/settings/lunaris/companion')).toBe('/settings');
    expect(resolveLegacySettingsRoute('/settings/lunaris/status')).toBe('/settings');
  });

  it('removes identity editing and keeps real agent permissions in chat settings', () => {
    const chat = SETTINGS_GROUPS.find((group) => group.key === 'chat');
    expect(chat?.rows.some((row) => row.key === 'lunaris-settings' || (row.title || '').includes('LUNARIS'))).toBe(false);

    expect(SETTINGS_GROUPS.find((group) => group.key === 'agent')).toBeUndefined();
    expect(chat?.rows).toContainEqual(expect.objectContaining({ key: 'agent-capabilities', route: '/settings/privacy/agent-capabilities' }));
    expect(SETTINGS_GROUPS.find((group) => group.key === 'privacy')).toBeUndefined();
    expect(SETTINGS_GROUPS.some((group) => group.key === 'lunaris')).toBe(false);
  });

  it('retires legacy identity routes to Home without auto-opening the editor', () => {
    expect(resolveLegacySettingsRoute('/settings/agent')).toBe('/');
    expect(resolveLegacySettingsRoute('/settings/lunaris')).toBe('/');
    expect(resolveLegacySettingsRoute('/settings/lunaris/persona')).toBe('/');
  });

  it('preserves shared memory, world-book, activity, provider, subscription and persona data selectors', () => {
    const state = useAppStore.getState();
    expect(state).toHaveProperty('memoryEntries');
    expect(state.aiPrompting).toHaveProperty('worldBookEntries');
    expect(state).toHaveProperty('agentTools');
    expect(state).toHaveProperty('activityLogs');
    expect(state).toHaveProperty('focusSessionLog');
    expect(state).toHaveProperty('providers');
    expect(state).toHaveProperty('subscriptions');
    expect(state.partner).toHaveProperty('personalityNote');
    expect(state.partner).toHaveProperty('displayName');
    expect(state.partner.name).toBe(SYSTEM_AGENT_NAME);
    expect(useMusicStore.getState()).toHaveProperty('recentlyPlayed');
  });
});
