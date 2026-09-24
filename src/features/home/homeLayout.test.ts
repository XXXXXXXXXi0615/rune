import { describe, expect, it } from 'vitest';
import {
  HOME_LAYOUT_VERSION,
  HOME_WIDGET_DEFINITIONS,
  createDefaultHomeLayout,
  migrateHomeLayout,
  normalizeHomeLayout,
  supportsHomeWidgetPreset,
} from './homeLayout';
import { useHomeWidgetLayoutStore } from './useHomeWidgetLayoutStore';

describe('Home semantic layout', () => {
  it('exposes the Phase 2B semantic API and rejects invalid preset combinations', () => {
    useHomeWidgetLayoutStore.setState(createDefaultHomeLayout());
    const actions = useHomeWidgetLayoutStore.getState();
    actions.setWidgetPreset('moon-clock', 'island');
    expect(useHomeWidgetLayoutStore.getState().widgets[0].preset).toBe('large');
    actions.setWidgetPreset('moon-clock', 'medium');
    expect(useHomeWidgetLayoutStore.getState().widgets[0].preset).toBe('medium');
    actions.reorderWidget('pixel-world', 1);
    expect(useHomeWidgetLayoutStore.getState().widgets.map((widget) => widget.id)).toEqual([
      'moon-clock', 'pixel-world', 'daily-checkin', 'presence', 'music-now-playing', 'countdown',
    ]);
    actions.setWidgetVisible('presence', false);
    expect(useHomeWidgetLayoutStore.getState().widgets.find((widget) => widget.id === 'presence')?.visible).toBe(false);
    actions.resetHomeLayout();
    expect(useHomeWidgetLayoutStore.getState().widgets).toEqual(createDefaultHomeLayout().widgets);
  });

  it('defines the Phase 1 order and presets without geometry', () => {
    const state = createDefaultHomeLayout();
    expect(state).toEqual({
      version: HOME_LAYOUT_VERSION,
      widgets: [
        { id: 'moon-clock', order: 0, visible: true, preset: 'large' },
        { id: 'daily-checkin', order: 1, visible: true, preset: 'medium' },
        { id: 'presence', order: 2, visible: true, preset: 'medium' },
        { id: 'pixel-world', order: 3, visible: true, preset: 'large' },
        { id: 'music-now-playing', order: 4, visible: false, preset: 'island' },
        { id: 'countdown', order: 5, visible: true, preset: 'island' },
      ],
    });
    expect(JSON.stringify(state)).not.toMatch(/"(?:x|y|w|h|width|height)"/);
  });

  it('enforces supported presets and excludes orb for all initial widgets', () => {
    expect(HOME_WIDGET_DEFINITIONS['moon-clock'].supportedPresets).toEqual(['medium', 'large']);
    expect(HOME_WIDGET_DEFINITIONS['daily-checkin'].supportedPresets).toEqual(['island', 'medium']);
    expect(HOME_WIDGET_DEFINITIONS.presence.supportedPresets).toEqual(['island', 'medium']);
    expect(HOME_WIDGET_DEFINITIONS['pixel-world'].supportedPresets).toEqual(['medium', 'large']);
    expect(HOME_WIDGET_DEFINITIONS['music-now-playing'].supportedPresets).toEqual(['island', 'medium']);
    expect(HOME_WIDGET_DEFINITIONS.countdown.supportedPresets).toEqual(['island']);
    expect(Object.keys(HOME_WIDGET_DEFINITIONS).every((id) => !supportsHomeWidgetPreset(id as keyof typeof HOME_WIDGET_DEFINITIONS, 'orb'))).toBe(true);
  });

  it('migrates useful v6 semantics and discards arbitrary geometry and unknown widgets', () => {
    const migrated = migrateHomeLayout({
      version: 6,
      schemaVersion: 6,
      desktop: [
        { widgetId: 'home-lunaris', x: 9, y: 0, w: 3, h: 9, size: 'small', hidden: false, order: 6 },
        { widgetId: 'home-checkin', x: 0, y: 4, w: 12, h: 7, size: 'wide', hidden: true, order: 0 },
        { widgetId: 'home-moonlex', x: 2, y: 1, w: 99, h: 99, size: 'full', hidden: false, order: 1 },
      ],
    });
    expect(migrated.widgets.map((widget) => widget.id)).toEqual(['moon-clock', 'presence', 'daily-checkin', 'pixel-world', 'music-now-playing', 'countdown']);
    expect(migrated.widgets.find((widget) => widget.id === 'presence')).toMatchObject({ visible: true, preset: 'island' });
    expect(migrated.widgets.find((widget) => widget.id === 'daily-checkin')).toMatchObject({ visible: false, preset: 'medium' });
    expect(migrated.widgets.find((widget) => widget.id === 'music-now-playing')).toMatchObject({ visible: false, preset: 'island' });
    expect(JSON.stringify(migrated)).not.toMatch(/"(?:x|y|w|h|size|hidden)"/);
  });

  it('uses the legacy mobile Presence visibility and drops its placement fields', () => {
    const legacyPresence = JSON.stringify({ state: {
      desktop: { xRatio: 0.1, y: 88, anchor: 'left', hidden: false },
      mobile: { xRatio: 0.9, y: 42, anchor: 'right', hidden: true },
    } });
    const migrated = migrateHomeLayout(undefined, legacyPresence);
    expect(migrated.widgets.find((widget) => widget.id === 'presence')?.visible).toBe(false);
    expect(JSON.stringify(migrated)).not.toMatch(/xRatio|anchor|"y"/);
  });

  it('normalizes corrupt, duplicate and invalid preset data deterministically', () => {
    const normalized = normalizeHomeLayout({ version: 7, widgets: [
      { id: 'presence', order: 8, visible: false, preset: 'orb' },
      { id: 'presence', order: 9, visible: true, preset: 'medium' },
      { id: 'unknown', order: 0, visible: true, preset: 'large' },
    ] });
    expect(normalized.widgets).toHaveLength(6);
    expect(normalized.widgets.find((widget) => widget.id === 'presence')).toMatchObject({ visible: false, preset: 'medium' });
    expect(normalized.widgets.map((widget) => widget.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('is idempotent once the semantic version has been reached', () => {
    const once = migrateHomeLayout({ version: 6, desktop: [{ widgetId: 'home-checkin', x: 2, y: 1, size: 'small', hidden: false }] });
    expect(migrateHomeLayout(once)).toEqual(once);
  });
});
