import { saveAsset } from './assets';
import { STORAGE_KEY } from './storage';

const MIGRATION_KEY = 'lunartide-asset-migration-v1';

interface OldImageMessage {
  type: 'image';
  content: string; // data URL
  thumbnail?: string;
  caption?: string;
  [key: string]: unknown;
}

interface OldFileMessage {
  type: 'file';
  content: string; // data URL
  fileName: string;
  fileSize: number;
  mimeType: string;
  [key: string]: unknown;
}

type OldMessage = OldImageMessage | OldFileMessage;

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function needsMigration(msg: unknown): msg is OldMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== 'image' && m.type !== 'file') return false;
  // Has assetId → already migrated
  if (typeof m.assetId === 'string') return false;
  // Has content that's a data URL → needs migration
  return typeof m.content === 'string' && m.content.startsWith('data:');
}

export async function runAssetMigration(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_KEY, '1');
    return;
  }

  let state: { state?: { messages?: unknown[] } };
  try {
    state = JSON.parse(raw);
  } catch {
    localStorage.setItem(MIGRATION_KEY, '1');
    return;
  }

  const messages = state?.state?.messages;
  if (!Array.isArray(messages)) {
    localStorage.setItem(MIGRATION_KEY, '1');
    return;
  }

  let changed = false;

  for (const msg of messages) {
    if (!needsMigration(msg)) continue;

    try {
      const blob = dataUrlToBlob(msg.content);
      let fileType: string;
      if (msg.type === 'file') {
        fileType = (msg as OldFileMessage).mimeType || blob.type || 'application/octet-stream';
      } else {
        fileType = blob.type || 'image/png';
      }

      const assetId = await saveAsset(blob, fileType);

      // Mutate in place: replace content with assetId
      delete (msg as Record<string, unknown>).content;
      if (msg.type === 'file') {
        delete (msg as Record<string, unknown>).mimeType;
        (msg as Record<string, unknown>).fileType = fileType;
      }
      if (msg.type === 'image' && !(msg as Record<string, unknown>).fileType) {
        (msg as Record<string, unknown>).fileType = fileType;
      }
      (msg as Record<string, unknown>).assetId = assetId;
      (msg as Record<string, unknown>).createdAt = new Date().toISOString();
      changed = true;
    } catch {
      // Skip messages that fail to migrate
    }
  }

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  localStorage.setItem(MIGRATION_KEY, '1');
}
