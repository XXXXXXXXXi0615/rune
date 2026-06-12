/**
 * 月映窗 — HTML Preview storage
 * Key: lunartide_html_previews_v1
 */

export interface HtmlPreview {
  id: string;
  title: string;
  html: string;
  createdAt: number;
  updatedAt: number;
}

const LS_KEY = 'lunartide_html_previews_v1';

export function loadPreviews(): HtmlPreview[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function savePreviews(previews: HtmlPreview[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(previews)); } catch {}
}

export function addPreview(preview: HtmlPreview): HtmlPreview[] {
  const list = loadPreviews();
  list.unshift(preview);
  savePreviews(list);
  return list;
}

export function updatePreview(id: string, patch: Partial<Pick<HtmlPreview, 'title' | 'html'>>): HtmlPreview[] {
  const list = loadPreviews();
  const item = list.find((p) => p.id === id);
  if (item) {
    Object.assign(item, patch, { updatedAt: Date.now() });
    savePreviews(list);
  }
  return list;
}

export function deletePreview(id: string): HtmlPreview[] {
  const list = loadPreviews().filter((p) => p.id !== id);
  savePreviews(list);
  return list;
}
