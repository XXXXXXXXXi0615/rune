import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInstalledHooks, buildUninstalledHooks, detectInstall, detectTrust, installRuntime, pathsFor, readHooks, writeHooksWithBackup } from './pet-hook-installer-lib.mjs';

const command = process.argv[2] || 'detect';
const dryRun = process.argv.includes('--dry-run');
const paths = pathsFor();
if (!fs.existsSync(paths.codexHome)) { console.error(`找不到 Codex home：${paths.codexHome}`); process.exitCode = 2; }
else {
  const existing = readHooks(paths.hooksFile);
  const detected = detectInstall(existing, paths.adapterFile);
  const configText = fs.existsSync(path.join(paths.codexHome, 'config.toml')) ? fs.readFileSync(path.join(paths.codexHome, 'config.toml'), 'utf8') : '';
  if (command === 'detect') console.log(JSON.stringify({ ...detected, ...detectTrust(existing, configText), hooksFile: paths.hooksFile, tokenStored: fs.existsSync(paths.tokenFile) }, null, 2));
  else if (command === 'install' || command === 'repair') {
    const next = buildInstalledHooks(existing, process.execPath, paths.adapterFile);
    console.log(JSON.stringify({ action: command, dryRun, hooksFile: paths.hooksFile, addOrRepair: detected.missingEvents, preserveExisting: true }, null, 2));
    if (!dryRun) {
      installRuntime(paths, path.dirname(fileURLToPath(import.meta.url)), process.env.LUNARTIDE_PET_PAIRING_TOKEN);
      const backupFile = writeHooksWithBackup(paths.hooksFile, next);
      console.log(`已安裝；備份：${backupFile || '新建設定，無舊檔'}`);
    }
  } else if (command === 'uninstall') {
    const next = buildUninstalledHooks(existing);
    console.log(JSON.stringify({ action: command, dryRun, hooksFile: paths.hooksFile, removeManagedOnly: true }, null, 2));
    if (!dryRun) {
      const backupFile = writeHooksWithBackup(paths.hooksFile, next);
      fs.rmSync(paths.installDir, { recursive: true, force: true });
      console.log(`已解除安裝；備份：${backupFile || '無'}`);
    }
  } else { console.error('用法：pet-hook-installer.mjs detect|install|repair|uninstall [--dry-run]'); process.exitCode = 2; }
}
