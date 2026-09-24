import { beforeEach, describe, expect, it } from 'vitest';
import { commitHomeLayout, createDefaultHomeLayout, type HomeLayoutState } from './homeLayout';
import {
  canHideHomeWidget,
  cloneHomeLayout,
  isHomeLayoutDirty,
  moveVisibleDraftWidget,
  reorderVisibleDraftWidget,
  resetDraftHomeLayout,
  setDraftWidgetPreset,
  setDraftWidgetVisible,
  visibleHomeWidgets,
} from './homeEditDraft';
import { useHomeWidgetLayoutStore } from './useHomeWidgetLayoutStore';

const ids = (layout: HomeLayoutState) => layout.widgets.map((widget) => widget.id);

describe('Edit Home draft model', () => {
  beforeEach(() => {
    useHomeWidgetLayoutStore.setState(createDefaultHomeLayout());
  });

  it('clones the canonical layout into an independent draft', () => {
    const canonical = createDefaultHomeLayout();
    const draft = cloneHomeLayout(canonical);
    expect(draft).not.toBe(canonical);
    expect(draft.widgets).not.toBe(canonical.widgets);
    expect(draft.widgets[0]).not.toBe(canonical.widgets[0]);
    expect(draft).toEqual(canonical);

    draft.widgets[0].preset = 'medium';
    draft.widgets[1].visible = false;
    expect(canonical.widgets[0].preset).toBe('large');
    expect(canonical.widgets[1].visible).toBe(true);
  });

  it('reports dirty only for semantic differences', () => {
    const canonical = createDefaultHomeLayout();
    expect(isHomeLayoutDirty(canonical, cloneHomeLayout(canonical))).toBe(false);
    expect(isHomeLayoutDirty(canonical, reorderVisibleDraftWidget(canonical, 'pixel-world', 0))).toBe(true);
    expect(isHomeLayoutDirty(canonical, setDraftWidgetPreset(canonical, 'moon-clock', 'medium'))).toBe(true);
    expect(isHomeLayoutDirty(canonical, setDraftWidgetVisible(canonical, 'presence', false))).toBe(true);
    expect(isHomeLayoutDirty(canonical, { ...canonical, widgets: canonical.widgets.slice(0, 3) })).toBe(true);
  });

  it('reorders visible widgets and re-indexes order without touching hidden slots', () => {
    const hidden = setDraftWidgetVisible(createDefaultHomeLayout(), 'daily-checkin', false);
    const moved = reorderVisibleDraftWidget(hidden, 'pixel-world', 0);
    expect(ids(moved)).toEqual(['pixel-world', 'daily-checkin', 'moon-clock', 'presence', 'music-now-playing', 'countdown']);
    expect(visibleHomeWidgets(moved).map((widget) => widget.id)).toEqual(['pixel-world', 'moon-clock', 'presence', 'countdown']);
    expect(moved.widgets.map((widget) => widget.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(moved.widgets.find((widget) => widget.id === 'daily-checkin')?.visible).toBe(false);

    const back = reorderVisibleDraftWidget(moved, 'pixel-world', 2);
    expect(ids(back)).toEqual(['moon-clock', 'daily-checkin', 'presence', 'pixel-world', 'music-now-playing', 'countdown']);
  });

  it('treats invalid reorders as no-ops', () => {
    const canonical = createDefaultHomeLayout();
    expect(reorderVisibleDraftWidget(canonical, 'moon-clock', 0)).toBe(canonical);
    expect(reorderVisibleDraftWidget(canonical, 'daily-checkin', 1)).toBe(canonical);
    expect(moveVisibleDraftWidget(canonical, 'moon-clock', -1)).toBe(canonical);
    expect(moveVisibleDraftWidget(canonical, 'pixel-world', 1)).not.toBe(canonical);
    expect(moveVisibleDraftWidget(canonical, 'countdown', 1)).toBe(canonical);
    expect(moveVisibleDraftWidget(canonical, 'not-a-widget' as never, 1)).toBe(canonical);
    expect(ids(reorderVisibleDraftWidget(canonical, 'pixel-world', 99))).toEqual([
      'moon-clock', 'daily-checkin', 'presence', 'countdown', 'music-now-playing', 'pixel-world',
    ]);
    expect(ids(reorderVisibleDraftWidget(canonical, 'pixel-world', -5))).toEqual([
      'pixel-world', 'moon-clock', 'daily-checkin', 'presence', 'music-now-playing', 'countdown',
    ]);
  });

  it('accepts only widget-supported presets and rejects the rest', () => {
    const canonical = createDefaultHomeLayout();
    expect(setDraftWidgetPreset(canonical, 'moon-clock', 'medium').widgets[0].preset).toBe('medium');
    expect(setDraftWidgetPreset(canonical, 'daily-checkin', 'island').widgets[1].preset).toBe('island');
    expect(setDraftWidgetPreset(canonical, 'presence', 'island').widgets[2].preset).toBe('island');
    expect(setDraftWidgetPreset(canonical, 'pixel-world', 'medium').widgets[3].preset).toBe('medium');
    expect(setDraftWidgetPreset(canonical, 'music-now-playing', 'medium').widgets[4].preset).toBe('medium');
    expect(setDraftWidgetPreset(canonical, 'countdown', 'island')).toBe(canonical);

    expect(setDraftWidgetPreset(canonical, 'moon-clock', 'island')).toBe(canonical);
    expect(setDraftWidgetPreset(canonical, 'moon-clock', 'orb')).toBe(canonical);
    expect(setDraftWidgetPreset(canonical, 'daily-checkin', 'large')).toBe(canonical);
    expect(setDraftWidgetPreset(canonical, 'presence', 'large')).toBe(canonical);
    expect(setDraftWidgetPreset(canonical, 'pixel-world', 'island')).toBe(canonical);
    expect(setDraftWidgetPreset(canonical, 'music-now-playing', 'large')).toBe(canonical);
  });

  it('hides and restores widgets but never allows an empty Home', () => {
    let draft = createDefaultHomeLayout();
    for (const id of ['daily-checkin', 'presence', 'pixel-world', 'countdown'] as const) {
      draft = setDraftWidgetVisible(draft, id, false);
    }
    expect(visibleHomeWidgets(draft).map((widget) => widget.id)).toEqual(['moon-clock']);
    expect(canHideHomeWidget(draft, 'moon-clock')).toBe(false);
    expect(setDraftWidgetVisible(draft, 'moon-clock', false)).toBe(draft);

    const restored = setDraftWidgetVisible(draft, 'pixel-world', true);
    expect(restored.widgets.find((widget) => widget.id === 'pixel-world')?.visible).toBe(true);
    expect(setDraftWidgetVisible(restored, 'pixel-world', true)).toBe(restored);
  });

  it('resets the draft to canonical defaults', () => {
    const mutated = setDraftWidgetPreset(
      reorderVisibleDraftWidget(setDraftWidgetVisible(createDefaultHomeLayout(), 'presence', false), 'pixel-world', 0),
      'moon-clock',
      'medium',
    );
    expect(isHomeLayoutDirty(createDefaultHomeLayout(), mutated)).toBe(true);
    const reset = resetDraftHomeLayout();
    expect(reset).toEqual(createDefaultHomeLayout());
    expect(isHomeLayoutDirty(createDefaultHomeLayout(), reset)).toBe(false);
  });

  it('keeps a full edit session out of persistence until commit', () => {
    const before = useHomeWidgetLayoutStore.getState().widgets;
    const beforeSnapshot = JSON.parse(JSON.stringify(before)) as unknown;

    let draft = cloneHomeLayout(createDefaultHomeLayout());
    draft = reorderVisibleDraftWidget(draft, 'pixel-world', 0);
    draft = setDraftWidgetPreset(draft, 'moon-clock', 'medium');
    draft = setDraftWidgetVisible(draft, 'presence', false);
    draft = resetDraftHomeLayout();
    draft = moveVisibleDraftWidget(draft, 'daily-checkin', 1);

    expect(useHomeWidgetLayoutStore.getState().widgets).toBe(before);
    expect(JSON.parse(JSON.stringify(useHomeWidgetLayoutStore.getState().widgets))).toEqual(beforeSnapshot);

    useHomeWidgetLayoutStore.getState().commitLayout(draft);
    expect(ids(useHomeWidgetLayoutStore.getState())).toEqual(['moon-clock', 'presence', 'daily-checkin', 'pixel-world', 'music-now-playing', 'countdown']);
  });

  it('validates the committed draft before writing state', () => {
    useHomeWidgetLayoutStore.getState().commitLayout({
      version: 7,
      widgets: [{ id: 'moon-clock', order: 0, visible: false, preset: 'orb' }],
    } as unknown as HomeLayoutState);
    const committed = useHomeWidgetLayoutStore.getState();
    expect(committed.widgets).toHaveLength(6);
    expect(committed.widgets[0]).toMatchObject({ id: 'moon-clock', preset: 'large', visible: false });
    expect(committed.widgets.map((widget) => widget.order)).toEqual([0, 1, 2, 3, 4, 5]);

    const allHidden = {
      version: 7,
      widgets: createDefaultHomeLayout().widgets.map((widget) => ({ ...widget, visible: false })),
    };
    const guarded = commitHomeLayout(allHidden);
    expect(guarded.widgets.filter((widget) => widget.visible)).toHaveLength(1);
    expect(guarded.widgets[0]).toMatchObject({ id: 'moon-clock', visible: true });
  });
});
