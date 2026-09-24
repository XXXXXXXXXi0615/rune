import {
  HOME_LAYOUT_VERSION,
  createDefaultHomeLayout,
  supportsHomeWidgetPreset,
  type HomeLayoutState,
  type HomeLayoutWidget,
  type HomeWidgetId,
  type HomeWidgetPreset,
} from './homeLayout';

/**
 * Phase 2B — Edit Home draft model.
 *
 * Edit Home clones the canonical layout into a local draft, mutates only the
 * draft, and commits through `useHomeWidgetLayoutStore.commitLayout` on Save.
 * Every function here is pure: edit mode, drag, presets, visibility and reset
 * never touch persistence, and Cancel discards the draft untouched.
 */

export function cloneHomeLayout(layout: HomeLayoutState): HomeLayoutState {
  return {
    version: HOME_LAYOUT_VERSION,
    widgets: layout.widgets.map((widget) => ({ ...widget })),
  };
}

/** Compares semantic layout only: order is the array index in both directions. */
export function isHomeLayoutDirty(canonical: HomeLayoutState, draft: HomeLayoutState): boolean {
  if (canonical.widgets.length !== draft.widgets.length) return true;
  return canonical.widgets.some((widget, index) => {
    const candidate = draft.widgets[index];
    return !candidate
      || candidate.id !== widget.id
      || candidate.visible !== widget.visible
      || candidate.preset !== widget.preset;
  });
}

export function visibleHomeWidgets(layout: HomeLayoutState): HomeLayoutWidget[] {
  return layout.widgets.filter((widget) => widget.visible);
}

export function canHideHomeWidget(layout: HomeLayoutState, id: HomeWidgetId): boolean {
  const widget = layout.widgets.find((candidate) => candidate.id === id);
  return Boolean(widget?.visible) && visibleHomeWidgets(layout).length > 1;
}

export function setDraftWidgetVisible(
  layout: HomeLayoutState,
  id: HomeWidgetId,
  visible: boolean,
): HomeLayoutState {
  const widget = layout.widgets.find((candidate) => candidate.id === id);
  if (!widget || widget.visible === visible) return layout;
  if (!visible && !canHideHomeWidget(layout, id)) return layout;
  return {
    ...layout,
    widgets: layout.widgets.map((candidate) => (candidate.id === id ? { ...candidate, visible } : candidate)),
  };
}

export function setDraftWidgetPreset(
  layout: HomeLayoutState,
  id: HomeWidgetId,
  preset: HomeWidgetPreset,
): HomeLayoutState {
  const widget = layout.widgets.find((candidate) => candidate.id === id);
  if (!widget || widget.preset === preset || !supportsHomeWidgetPreset(id, preset)) return layout;
  return {
    ...layout,
    widgets: layout.widgets.map((candidate) => (candidate.id === id ? { ...candidate, preset } : candidate)),
  };
}

/**
 * Reorders among rendered (visible) widgets: `targetVisibleIndex` is the final
 * position in the visible list. Hidden widgets keep their slots, so hiding a
 * widget never rewrites the orders the user can see.
 */
export function reorderVisibleDraftWidget(
  layout: HomeLayoutState,
  id: HomeWidgetId,
  targetVisibleIndex: number,
): HomeLayoutState {
  const visibleIds = visibleHomeWidgets(layout).map((widget) => widget.id);
  if (!visibleIds.includes(id)) return layout;
  const reduced = visibleIds.filter((candidate) => candidate !== id);
  const insertAt = Math.max(0, Math.min(targetVisibleIndex, reduced.length));
  const next = [...reduced.slice(0, insertAt), id, ...reduced.slice(insertAt)];
  if (next.every((candidate, index) => candidate === visibleIds[index])) return layout;

  const visibleSet = new Set(visibleIds);
  const byId = new Map(layout.widgets.map((widget) => [widget.id, widget] as const));
  let cursor = 0;
  const widgets = layout.widgets
    .map((widget) => (visibleSet.has(widget.id) ? byId.get(next[cursor++]) ?? widget : widget))
    .map((widget, order) => ({ ...widget, order }));
  return { ...layout, widgets };
}

export function moveVisibleDraftWidget(
  layout: HomeLayoutState,
  id: HomeWidgetId,
  direction: -1 | 1,
): HomeLayoutState {
  const visibleIds = visibleHomeWidgets(layout).map((widget) => widget.id);
  const index = visibleIds.indexOf(id);
  if (index < 0) return layout;
  const target = index + direction;
  if (target < 0 || target >= visibleIds.length) return layout;
  return reorderVisibleDraftWidget(layout, id, target);
}

export function resetDraftHomeLayout(): HomeLayoutState {
  return createDefaultHomeLayout();
}
