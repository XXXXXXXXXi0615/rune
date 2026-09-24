/** Phase 1.5C — Lunartide Desktop workspace types */

export type HomeWidgetSize = 'small' | 'wide' | 'medium' | 'large' | 'full';

export type LayoutMode = 'auto' | 'free';

export type HomeWidgetCategory = '今日照護' | '健康' | '計畫' | '學習' | '系統' | '其他';

/** Editable widget ids — only these participate in grid packing / drag / resize / hide */
export type HomeWidgetId =
  | 'home-checkin'
  | 'home-today-task'
  | 'home-anniversary'
  | 'home-lunaris'
  | 'home-period'
  | 'home-activity-heatmap'
  | 'home-hydration'
  | 'home-moonlex';

/** Fixed home modules — rendered outside the editable grid (not packable, not draggable) */
export type HomeFixedModuleId = 'home-clock' | 'home-welcome' | 'home-editor' | 'home-status';

export type HomePlacementZone = 'fixed' | 'grid';

export interface HomeWidgetDefinition {
  id: HomeWidgetId;
  title: string;
  placementZone: HomePlacementZone;
  supportedSizes: HomeWidgetSize[];
  defaultSize: HomeWidgetSize;
  defaultVisible: boolean;
  /** Default grid width in cells for freeform canvas */
  defaultW: number;
  /** Default grid height in cells for freeform canvas */
  defaultH: number;
  canHide: boolean;
  /** Phase 1.5C: Widget Gallery metadata */
  category: HomeWidgetCategory;
  description: string;
  icon: string;
  quickActions?: string[];
}

export interface HomeFixedModule {
  id: HomeFixedModuleId;
  title: string;
  placementZone: 'fixed';
}

/**
 * Phase 1.5C — Coordinate-based placement.
 *
 * Each widget is positioned by (x, y) = grid cell origin and sized by
 * (w, h) = cell span.
 */
export interface HomeWidgetPlacement {
  widgetId: HomeWidgetId;
  size: HomeWidgetSize;
  /** Grid column origin (0-based) */
  x: number;
  /** Grid row origin (0-based) */
  y: number;
  /** Column span in grid cells */
  w: number;
  /** Row span in grid cells */
  h: number;
  hidden: boolean;
  /** If true, widget cannot be moved or resized */
  locked?: boolean;
  /** Legacy — only used for migration, not the active placement key */
  order: number;
}

/**
 * Phase 1.5C — Workspace state with layout mode.
 *
 * schemaVersion 6:
 *   - MoonLex widget is added through registry normalization without resetting user layouts
 *   - per-breakpoint layouts remain independent
 */
export interface HomeWidgetLayoutState {
  desktop: HomeWidgetPlacement[];
  tablet: HomeWidgetPlacement[];
  mobile: HomeWidgetPlacement[];
  version: number;
  schemaVersion: number;
  layoutMode: LayoutMode;
  userEdited: boolean;
  updatedAt: string;
}

/** Grid column count per breakpoint — Phase 1.5 upgraded from 6/4/2 */
export const GRID_COLS: Record<string, number> = { desktop: 12, tablet: 8, mobile: 4 };

/** Grid row height (px) — used by CSS grid-auto-rows */
export const GRID_ROW_HEIGHT_PX = 86;

/** Standard size → (w, h) cell span geometry contract */
export function sizeToWH(size: HomeWidgetSize, bp: string): { w: number; h: number } {
  const cols = GRID_COLS[bp] ?? 12;
  switch (size) {
    case 'small':  return { w: Math.min(2, cols), h: 2 };
    case 'wide':   return { w: Math.min(4, cols), h: 2 };
    case 'medium': return { w: Math.min(6, cols), h: 2 };
    case 'large':  return { w: Math.min(6, cols), h: 2 };
    case 'full':   return { w: cols, h: 2 };
  }
}

/** Column span per size — kept for backward compat with pack algorithm */
export function gridSpan(size: HomeWidgetSize, bp: string): number {
  const cols = GRID_COLS[bp] ?? 12;
  switch (size) {
    case 'small': return Math.min(2, cols);
    case 'wide': return Math.min(4, cols);
    case 'medium': return Math.min(6, cols);
    case 'large': return Math.min(6, cols);
    case 'full': return cols;
  }
}

/** Grid row span: always 2 in freeform */
export function gridRowSpan(_size: HomeWidgetSize): number {
  return 2;
}
