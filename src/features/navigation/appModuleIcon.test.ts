import { describe, expect, it } from 'vitest';
import { getHomeLauncherModules } from './appModuleRegistry';
import { resolveAppModuleIconName } from './appModuleIcon';

describe('Rune Apps icon resolver', () => {
  it('gives every canonical launcher module a production icon', () => {
    expect(getHomeLauncherModules().map(module => [module.id, resolveAppModuleIconName(module.id)])).toEqual([
      ['music', 'music'],
      ['calendar', 'calendar'],
      ['stash', 'archiveBox'],
      ['quests', 'quest'],
      ['works', 'portfolio'],
      ['settings', 'settings'],
      ['inspiration', 'lightbulb'],
      ['lifeLedger', 'listChecks'],
      ['tidewatch', 'tidewatch'],
      ['moonlex', 'dictionary'],
    ]);
  });
});
