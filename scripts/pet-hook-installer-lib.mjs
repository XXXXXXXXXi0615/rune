import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const MANAGED_MARKER = '.codex/lunartide-pet-bridge/codex-pet-hook.mjs';
export const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'SessionEnd', 'Stop'];

export function pathsFor(home = os.homedir()) {
  const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
  const installDir = path.join(codexHome, 'lunartide-pet-bridge');
  return { codexHome, hooksFile: path.join(codexHome, 'hooks.json'), installDir, tokenFile: path.join(installDir, 'token'), adapterFile: path.join(installDir, 'codex-pet-hook.mjs'), protocolFile: path.join(installDir, 'pet-agent-protocol.mjs') };
}

export function readHooks(hooksFile) {
  if (!fs.existsSync(hooksFile)) return { hooks: {} };
  const parsed = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !parsed.hooks || typeof parsed.hooks !== 'object') throw new Error('Codex hooks.json 格式無效');
  return parsed;
}

function isManaged(group) {
  return Array.isArray(group?.hooks) && group.hooks.some((hook) => typeof hook?.command === 'string' && hook.command.includes(MANAGED_MARKER));
}

export function buildInstalledHooks(existing, nodePath, adapterFile) {
  const next = structuredClone(existing);
  next.hooks ||= {};
  const command = `"${nodePath}" "${adapterFile}"`;
  for (const event of HOOK_EVENTS) {
    const preserved = Array.isArray(next.hooks[event]) ? next.hooks[event].filter((group) => !isManaged(group)) : [];
    next.hooks[event] = [...preserved, { hooks: [{ type: 'command', command, timeout: 5 }] }];
  }
  return next;
}

export function buildUninstalledHooks(existing) {
  const next = structuredClone(existing);
  for (const [event, groups] of Object.entries(next.hooks || {})) {
    if (!Array.isArray(groups)) continue;
    const preserved = groups.filter((group) => !isManaged(group));
    if (preserved.length) next.hooks[event] = preserved; else delete next.hooks[event];
  }
  return next;
}

export function detectInstall(hooks, adapterFile) {
  const installedEvents = HOOK_EVENTS.filter((event) => Array.isArray(hooks.hooks?.[event]) && hooks.hooks[event].some(isManaged));
  return { installed: installedEvents.length === HOOK_EVENTS.length && fs.existsSync(adapterFile), installedEvents, missingEvents: HOOK_EVENTS.filter((event) => !installedEvents.includes(event)) };
}

export function detectTrust(hooks, configText = '') {
  const untrustedEvents = [];
  for (const event of HOOK_EVENTS) {
    const groups = Array.isArray(hooks.hooks?.[event]) ? hooks.hooks[event] : [];
    const index = groups.findIndex(isManaged);
    const snake = event.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    if (index >= 0 && !configText.includes(`hooks.json:${snake}:${index}:0`)) untrustedEvents.push(event);
  }
  return { trusted: untrustedEvents.length === 0, untrustedEvents };
}

export function writeHooksWithBackup(hooksFile, next) {
  fs.mkdirSync(path.dirname(hooksFile), { recursive: true });
  let backupFile = null;
  if (fs.existsSync(hooksFile)) {
    backupFile = `${hooksFile}.lunartide-backup-${new Date().toISOString().replaceAll(':', '-')}`;
    fs.copyFileSync(hooksFile, backupFile);
  }
  const temporary = `${hooksFile}.lunartide-tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, hooksFile);
  return backupFile;
}

export function installRuntime(paths, sourceDir, token) {
  fs.mkdirSync(paths.installDir, { recursive: true, mode: 0o700 });
  fs.copyFileSync(path.join(sourceDir, 'codex-pet-hook.mjs'), paths.adapterFile);
  fs.copyFileSync(path.join(sourceDir, 'pet-agent-protocol.mjs'), paths.protocolFile);
  fs.writeFileSync(paths.tokenFile, `${token || crypto.randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  fs.chmodSync(paths.tokenFile, 0o600);
}
