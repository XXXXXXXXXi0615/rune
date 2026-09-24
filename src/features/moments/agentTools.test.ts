import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOMENTS_AGENT_PERMISSIONS,
  MOMENTS_AGENT_ACTIONS,
  MOMENTS_TOOL_DEFINITION,
  installMomentsAgentDevHarness,
} from './agentTools';

describe('Moments Agent capability contract', () => {
  it('defaults every independent permission off', () => {
    expect(DEFAULT_MOMENTS_AGENT_PERMISSIONS).toEqual({ momentsRead: false, momentsWrite: false, momentsInteract: false });
  });

  it('exposes seven operations without delete', () => {
    expect(MOMENTS_AGENT_ACTIONS).toEqual(['list', 'read', 'create', 'like', 'unlike', 'comment', 'reply']);
    expect(MOMENTS_AGENT_ACTIONS).not.toContain('delete');
    expect(MOMENTS_TOOL_DEFINITION.function.name).toBe('moments');
  });

  it('does not install the DEV harness in production mode', () => {
    delete window.__LUNARTIDE_MOMENTS_AGENT_TEST__;
    installMomentsAgentDevHarness(false);
    expect(window.__LUNARTIDE_MOMENTS_AGENT_TEST__).toBeUndefined();
  });
});
