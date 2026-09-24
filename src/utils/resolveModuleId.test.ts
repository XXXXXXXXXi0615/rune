import { describe, it, expect } from 'vitest';
import { resolveUsageModule } from '@/types/usage';

const resolveModuleId = resolveUsageModule;

describe('resolveModuleId', () => {
  it('maps / to home', () => {
    expect(resolveModuleId('/')).toBe('home');
  });

  it('maps /home and descendants to home', () => {
    expect(resolveModuleId('/home')).toBe('home');
    expect(resolveModuleId('/home/today')).toBe('home');
  });

  it('maps /chat to chat', () => {
    expect(resolveModuleId('/chat')).toBe('chat');
  });

  it('maps /chat/:id to chat', () => {
    expect(resolveModuleId('/chat/abc123')).toBe('chat');
  });

  it('maps /journal to journal', () => {
    expect(resolveModuleId('/journal')).toBe('journal');
  });

  it('maps /journal/fragments to journal', () => {
    expect(resolveModuleId('/journal/fragments')).toBe('journal');
  });

  it('maps /diary/private to journal', () => {
    expect(resolveModuleId('/diary/private')).toBe('journal');
  });

  it('maps /music to music', () => {
    expect(resolveModuleId('/music')).toBe('music');
  });

  it('maps /music/listen/1 to music', () => {
    expect(resolveModuleId('/music/listen/1')).toBe('music');
  });

  it('maps /calendar to calendar', () => {
    expect(resolveModuleId('/calendar')).toBe('calendar');
  });

  it('maps /calendar/countdowns to calendar', () => {
    expect(resolveModuleId('/calendar/countdowns')).toBe('calendar');
  });

  it('maps /moonread to moonread', () => {
    expect(resolveModuleId('/moonread')).toBe('moonread');
  });

  it('maps /moonread/book/1 to moonread', () => {
    expect(resolveModuleId('/moonread/book/1')).toBe('moonread');
  });

  it('maps /quests to quests', () => {
    expect(resolveModuleId('/quests')).toBe('quests');
  });

  it('maps /todo to quests', () => {
    expect(resolveModuleId('/todo')).toBe('quests');
  });

  it('maps /todos to quests', () => {
    expect(resolveModuleId('/todos')).toBe('quests');
  });

  it('maps /settings to settings', () => {
    expect(resolveModuleId('/settings')).toBe('settings');
  });

  it('maps /settings/ai to settings', () => {
    expect(resolveModuleId('/settings/ai')).toBe('settings');
  });

  it('maps retired /diet to other', () => {
    // MoonDiet is retired: /diet redirects to /calendar and no longer owns a module id.
    expect(resolveModuleId('/diet')).toBe('other');
  });

  it('maps /health to health', () => {
    expect(resolveModuleId('/health')).toBe('health');
  });

  it('maps /focus to focus', () => {
    expect(resolveModuleId('/focus')).toBe('focus');
  });

  it('maps retired /ledger to other', () => {
    // Phase D: the Tide Ledger (/ledger) is retired — Moon Dew lives in the Home 報備
    // window and Exchange is the standalone /exchange utility, so the route no longer
    // owns a module id (same treatment as retired /diet).
    expect(resolveModuleId('/ledger')).toBe('other');
  });

  it('maps /usage to settings', () => {
    expect(resolveModuleId('/usage')).toBe('settings');
  });

  it('maps /call to call', () => {
    expect(resolveModuleId('/call')).toBe('call');
  });

  it('maps /gacha to gacha', () => {
    expect(resolveModuleId('/gacha')).toBe('gacha');
  });

  it('maps unknown path to other', () => {
    expect(resolveModuleId('/unknown-route')).toBe('other');
  });
});
