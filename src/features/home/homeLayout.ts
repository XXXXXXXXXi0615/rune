export const HOME_LAYOUT_VERSION = 7;

export type HomeWidgetId = 'moon-clock' | 'daily-checkin' | 'presence' | 'pixel-world' | 'music-now-playing' | 'countdown';
export type HomeWidgetPreset = 'island' | 'small' | 'medium' | 'large' | 'orb';

export interface HomeLayoutWidget {
  id: HomeWidgetId;
  order: number;
  visible: boolean;
  preset: HomeWidgetPreset;
}

export interface HomeLayoutState {
  version: typeof HOME_LAYOUT_VERSION;
  widgets: HomeLayoutWidget[];
}

export const HOME_WIDGET_DEFINITIONS: Readonly<Record<HomeWidgetId, {
  defaultPreset: HomeWidgetPreset;
  defaultVisible: boolean;
  supportedPresets: readonly HomeWidgetPreset[];
}>> = {
  'moon-clock': { defaultPreset: 'large', defaultVisible: true, supportedPresets: ['medium', 'large'] },
  'daily-checkin': { defaultPreset: 'medium', defaultVisible: true, supportedPresets: ['island', 'medium'] },
  presence: { defaultPreset: 'medium', defaultVisible: true, supportedPresets: ['island', 'medium'] },
  'pixel-world': { defaultPreset: 'large', defaultVisible: true, supportedPresets: ['medium', 'large'] },
  'music-now-playing': { defaultPreset: 'island', defaultVisible: false, supportedPresets: ['island', 'medium'] },
  // Calendar C2 — the countdown widget renders the events the user pinned to
  // Home (`CountdownEvent.pinnedToHome`). It is registered visible but hides
  // itself while nothing is pinned, so it never shows an empty dashboard card.
  countdown: { defaultPreset: 'island', defaultVisible: true, supportedPresets: ['island'] },
};

export const HOME_WIDGET_IDS = Object.freeze(Object.keys(HOME_WIDGET_DEFINITIONS) as HomeWidgetId[]);

export function supportsHomeWidgetPreset(id: HomeWidgetId, preset: HomeWidgetPreset): boolean {
  return HOME_WIDGET_DEFINITIONS[id].supportedPresets.includes(preset);
}

/** Semantic reorder: the widget ends up at `targetIndex` and orders are re-indexed. */
export function reorderHomeWidgets(
  widgets: HomeLayoutWidget[],
  id: HomeWidgetId,
  targetIndex: number,
): HomeLayoutWidget[] {
  const currentIndex = widgets.findIndex((widget) => widget.id === id);
  if (currentIndex < 0) return widgets;
  const next = widgets.slice();
  const [item] = next.splice(currentIndex, 1);
  next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, item);
  return next.map((widget, order) => ({ ...widget, order }));
}

export function createDefaultHomeLayout(): HomeLayoutState {
  return {
    version: HOME_LAYOUT_VERSION,
    widgets: HOME_WIDGET_IDS.map((id, order) => ({
      id,
      order,
      visible: HOME_WIDGET_DEFINITIONS[id].defaultVisible,
      preset: HOME_WIDGET_DEFINITIONS[id].defaultPreset,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isWidgetId(value: unknown): value is HomeWidgetId {
  return typeof value === 'string' && HOME_WIDGET_IDS.includes(value as HomeWidgetId);
}

function isPreset(value: unknown): value is HomeWidgetPreset {
  return typeof value === 'string' && ['island', 'small', 'medium', 'large', 'orb'].includes(value);
}

export function normalizeHomeLayout(value: unknown): HomeLayoutState {
  if (!isRecord(value) || !Array.isArray(value.widgets)) return createDefaultHomeLayout();
  const defaults = createDefaultHomeLayout();
  const seen = new Set<HomeWidgetId>();
  const valid = value.widgets
    .filter(isRecord)
    .sort((a, b) => Number(a.order) - Number(b.order))
    .flatMap((candidate) => {
      if (!isWidgetId(candidate.id) || seen.has(candidate.id)) return [];
      seen.add(candidate.id);
      const fallback = HOME_WIDGET_DEFINITIONS[candidate.id].defaultPreset;
      const preset = isPreset(candidate.preset) && supportsHomeWidgetPreset(candidate.id, candidate.preset)
        ? candidate.preset
        : fallback;
      return [{ id: candidate.id, order: 0, visible: candidate.visible !== false, preset }];
    });
  for (const widget of defaults.widgets) if (!seen.has(widget.id)) valid.push(widget);
  const ordered = valid.map((widget, order) => ({ ...widget, order }));
  // Phase 2B: Home is never empty. A layout whose every widget is hidden keeps
  // the first widget visible instead of rendering an empty Home.
  if (ordered.some((widget) => widget.visible)) return { version: HOME_LAYOUT_VERSION, widgets: ordered };
  return {
    version: HOME_LAYOUT_VERSION,
    widgets: ordered.map((widget, order) => (order === 0 ? { ...widget, visible: true } : widget)),
  };
}

/**
 * Canonical batch write seam (Phase 2B). Edit Home accumulates changes in a
 * draft; only this function turns a draft into committed layout state, and
 * normalization is the validation step. No second layout store exists.
 */
export function commitHomeLayout(draft: unknown): HomeLayoutState {
  return normalizeHomeLayout(draft);
}

type LegacyPlacement = Record<string, unknown>;

function legacyPreset(id: HomeWidgetId, size: unknown): HomeWidgetPreset {
  if (id === 'daily-checkin' || id === 'presence') return size === 'small' ? 'island' : 'medium';
  return HOME_WIDGET_DEFINITIONS[id].defaultPreset;
}

function readLegacyPresenceHidden(raw: unknown): boolean | undefined {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return undefined; }
  }
  if (!isRecord(value)) return undefined;
  const state = isRecord(value.state) ? value.state : value;
  const mobile = isRecord(state.mobile) ? state.mobile : undefined;
  return typeof mobile?.hidden === 'boolean' ? mobile.hidden : undefined;
}

export function migrateHomeLayout(value: unknown, legacyPresence?: unknown): HomeLayoutState {
  if (isRecord(value) && Number(value.version) >= HOME_LAYOUT_VERSION && Array.isArray(value.widgets)) {
    return normalizeHomeLayout(value);
  }
  if (!isRecord(value)) {
    const defaults = createDefaultHomeLayout();
    const hidden = readLegacyPresenceHidden(legacyPresence);
    if (hidden === undefined) return defaults;
    return { ...defaults, widgets: defaults.widgets.map((widget) => widget.id === 'presence' ? { ...widget, visible: !hidden } : widget) };
  }

  const source = Array.isArray(value.desktop) ? value.desktop.filter(isRecord) : [];
  const mapped = source.flatMap((placement: LegacyPlacement) => {
    const id: HomeWidgetId | null = placement.widgetId === 'home-checkin'
      ? 'daily-checkin'
      : placement.widgetId === 'home-lunaris'
        ? 'presence'
        : null;
    if (!id) return [];
    const x = Number.isFinite(Number(placement.x)) ? Number(placement.x) : 0;
    const y = Number.isFinite(Number(placement.y)) ? Number(placement.y) : Number(placement.order) || 0;
    return [{
      id,
      x,
      y,
      // The old home-lunaris card is not the Phase 1 Presence surface. Its
      // hidden flag cannot safely suppress Presence; only the dedicated
      // legacy Presence store carries that semantic.
      visible: id === 'presence' ? true : placement.hidden !== true,
      preset: legacyPreset(id, placement.size),
    }];
  }).sort((a, b) => a.y - b.y || a.x - b.x);

  const defaults = createDefaultHomeLayout();
  const migrated = new Map<HomeWidgetId, Partial<HomeLayoutWidget>>();
  for (const widget of mapped) if (!migrated.has(widget.id)) migrated.set(widget.id, widget);
  const legacyHidden = readLegacyPresenceHidden(legacyPresence);
  if (legacyHidden !== undefined) migrated.set('presence', { ...migrated.get('presence'), visible: !legacyHidden });

  const semantic = defaults.widgets.map((widget) => ({ ...widget, ...migrated.get(widget.id) }));
  const mappedOrder: HomeWidgetId[] = mapped.map((widget) => widget.id);
  semantic.sort((a, b) => {
    const aIndex = mappedOrder.indexOf(a.id);
    const bIndex = mappedOrder.indexOf(b.id);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    return a.order - b.order;
  });
  return normalizeHomeLayout({
    version: HOME_LAYOUT_VERSION,
    widgets: semantic.map((widget, order) => ({ ...widget, order })),
  });
}
