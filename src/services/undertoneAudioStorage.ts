export interface StoredUndertoneAudio {
  id: string;
  blob: Blob;
  mimeType?: string;
  fileName?: string;
  createdAt: number;
}

export interface UndertoneAudioStorageAdapter {
  saveAudioBlob(input: Omit<StoredUndertoneAudio, 'createdAt'>): Promise<string>;
  getAudioBlob(id: string): Promise<StoredUndertoneAudio | null>;
  deleteAudioBlob(id: string): Promise<void>;
}

const NOT_IMPLEMENTED = 'Undertone audio persistence is not implemented yet.';

export const undertoneAudioStorage: UndertoneAudioStorageAdapter = {
  async saveAudioBlob() {
    throw new Error(NOT_IMPLEMENTED);
  },
  async getAudioBlob() {
    throw new Error(NOT_IMPLEMENTED);
  },
  async deleteAudioBlob() {
    throw new Error(NOT_IMPLEMENTED);
  },
};

export function saveAudioBlob(input: Omit<StoredUndertoneAudio, 'createdAt'>): Promise<string> {
  return undertoneAudioStorage.saveAudioBlob(input);
}

export function getAudioBlob(id: string): Promise<StoredUndertoneAudio | null> {
  return undertoneAudioStorage.getAudioBlob(id);
}

export function deleteAudioBlob(id: string): Promise<void> {
  return undertoneAudioStorage.deleteAudioBlob(id);
}
