import { savePetImage } from '@/store/petImages';
import { compressImageFile, compressedImageName } from '@/utils/imageCompression';
import type { AvatarImageMeta } from '@/types';

export const AGENT_AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp';
export const AGENT_AVATAR_ALLOWED_TYPES = ['image/png', 'image/webp', 'image/jpeg'];
export const AGENT_AVATAR_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const AGENT_AVATAR_MAX_STORED_BYTES = 1024 * 1024;

export class AgentAvatarError extends Error {}

/** Canonical validation, normalization and IndexedDB write path for Agent avatars. */
export async function storeAgentAvatar(file: File): Promise<AvatarImageMeta> {
  if (!AGENT_AVATAR_ALLOWED_TYPES.includes(file.type)) {
    throw new AgentAvatarError('請選擇 PNG / JPG / WebP 圖片');
  }
  if (file.size > AGENT_AVATAR_MAX_SOURCE_BYTES) {
    throw new AgentAvatarError('圖片太大，請選擇 5 MB 以下的圖片');
  }

  let blob: Blob;
  try {
    blob = await compressImageFile(file, {
      maxWidth: 512,
      maxHeight: 512,
      outputType: 'image/webp',
      quality: 0.85,
    });
  } catch {
    throw new AgentAvatarError('圖片處理失敗');
  }
  if (blob.size > AGENT_AVATAR_MAX_STORED_BYTES) {
    throw new AgentAvatarError('圖片仍過大');
  }

  const type = blob.type || 'image/webp';
  const key = `avatar-agent-${crypto.randomUUID()}`;
  await savePetImage(key, blob);
  return {
    storage: 'indexeddb',
    key,
    name: compressedImageName(file.name, type),
    type,
    size: blob.size,
    updatedAt: Date.now(),
  };
}
