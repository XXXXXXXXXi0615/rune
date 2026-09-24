export function sha256(content: string | Uint8Array): string;
export function normalizeAssetId(fileName: string): string;
export function inspectSvg(source: string, fileName?: string): { fileName: string; safe: boolean; failures: string[] };
