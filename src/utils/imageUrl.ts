/**
 * Convert data URL → Blob for IndexedDB storage.
 * Avoids stuffing large base64 strings into localStorage.
 */
export function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const m = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!m) throw new Error('Invalid data URL');
  const mime = m[1];
  const byteChars = atob(m[2]);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), mime };
}
