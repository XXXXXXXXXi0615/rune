export interface InstallerPaths { codexHome: string; hooksFile: string; installDir: string; tokenFile: string; adapterFile: string; protocolFile: string }
export const MANAGED_MARKER: string;
export const HOOK_EVENTS: string[];
export function pathsFor(home?: string): InstallerPaths;
export function readHooks(hooksFile: string): any;
export function buildInstalledHooks(existing: any, nodePath: string, adapterFile: string): any;
export function buildUninstalledHooks(existing: any): any;
export function detectInstall(hooks: any, adapterFile: string): { installed: boolean; installedEvents: string[]; missingEvents: string[] };
export function detectTrust(hooks: any, configText?: string): { trusted: boolean; untrustedEvents: string[] };
export function writeHooksWithBackup(hooksFile: string, next: any): string | null;
export function installRuntime(paths: InstallerPaths, sourceDir: string, token?: string): void;
