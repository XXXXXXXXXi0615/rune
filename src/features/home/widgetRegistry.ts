import type { HomeFixedModule, HomeWidgetDefinition, HomeWidgetPlacement, HomeWidgetSize } from './types';
import { sizeToWH } from './types';

/**
 * Editable widget registry — ONLY these participate in grid packing,
 * drag handlers, size selectors and hide controls.
 *
 * Phase 1.5C: Added category, description, icon for Widget Gallery.
 */
export const HOME_WIDGET_REGISTRY: Record<string, HomeWidgetDefinition> = {
  'home-checkin': {
    id: 'home-checkin',
    title: '今日打卡',
    placementZone: 'grid',
    supportedSizes: ['small', 'wide'] as HomeWidgetSize[],
    defaultSize: 'wide' as HomeWidgetSize,
    defaultVisible: true,
    defaultW: 4, defaultH: 2,
    canHide: true,
    category: '今日照護',
    description: '記錄今天是否打卡',
    icon: 'checkin',
  },
  'home-today-task': {
    id: 'home-today-task',
    title: '今日任務',
    placementZone: 'grid',
    supportedSizes: ['small', 'wide'] as HomeWidgetSize[],
    defaultSize: 'wide' as HomeWidgetSize,
    defaultVisible: true,
    defaultW: 4, defaultH: 2,
    canHide: true,
    category: '計畫',
    description: '查看今天的主線任務',
    icon: 'task',
  },
  'home-anniversary': {
    id: 'home-anniversary',
    title: '倒數日',
    placementZone: 'grid',
    supportedSizes: ['small', 'wide'] as HomeWidgetSize[],
    defaultSize: 'small' as HomeWidgetSize,
    defaultVisible: false,
    defaultW: 2, defaultH: 2,
    canHide: true,
    category: '其他',
    description: '記錄重要日子的倒數',
    icon: 'anniversary',
  },
  'home-lunaris': {
    id: 'home-lunaris',
    title: '伴侶狀態',
    placementZone: 'grid',
    supportedSizes: ['small', 'medium'] as HomeWidgetSize[],
    defaultSize: 'medium' as HomeWidgetSize,
    defaultVisible: false,
    defaultW: 6, defaultH: 2,
    canHide: true,
    category: '系統',
    description: '查看 AI 伴侶連線狀態',
    icon: 'lunaris',
  },
  'home-period': {
    id: 'home-period',
    title: '生理週期',
    placementZone: 'grid',
    supportedSizes: ['small', 'medium'] as HomeWidgetSize[],
    defaultSize: 'small' as HomeWidgetSize,
    defaultVisible: true,
    defaultW: 2, defaultH: 2,
    canHide: true,
    category: '健康',
    description: '顯示生理週期與預測',
    icon: 'period',
  },
  'home-activity-heatmap': {
    id: 'home-activity-heatmap',
    title: '活動熱力圖',
    placementZone: 'grid',
    supportedSizes: ['medium', 'full'] as HomeWidgetSize[],
    defaultSize: 'medium' as HomeWidgetSize,
    defaultVisible: false,
    defaultW: 6, defaultH: 2,
    canHide: true,
    category: '系統',
    description: '查看近期的活動紀錄',
    icon: 'activity',
  },
  'home-hydration': {
    id: 'home-hydration',
    title: '今日飲水',
    placementZone: 'grid',
    supportedSizes: ['small', 'wide'] as HomeWidgetSize[],
    defaultSize: 'wide' as HomeWidgetSize,
    defaultVisible: false,
    defaultW: 4, defaultH: 2,
    canHide: true,
    category: '今日照護',
    description: '記錄今天喝了多少水',
    icon: 'hydration',
    quickActions: ['+100 ml', '+250 ml', '+500 ml'],
  },
  'home-moonlex': {
    id: 'home-moonlex',
    title: '練習單詞',
    placementZone: 'grid',
    supportedSizes: ['wide', 'medium'] as HomeWidgetSize[],
    defaultSize: 'medium' as HomeWidgetSize,
    defaultVisible: true,
    defaultW: 6, defaultH: 2,
    canHide: true,
    category: '學習',
    description: '直接練習 MoonLex 詞冊中的單詞',
    icon: 'moonlex',
    quickActions: ['翻牌', '記住了', '再看一次'],
  },
};

/**
 * Fixed home modules — rendered outside the editable grid.
 */
export const FIXED_HOME_MODULES: Record<string, HomeFixedModule> = {
  'home-clock': {
    id: 'home-clock',
    title: '時鐘',
    placementZone: 'fixed',
  },
  'home-welcome': { id: 'home-welcome', title: '歡迎膠囊', placementZone: 'fixed' },
  'home-editor': { id: 'home-editor', title: '編輯入口', placementZone: 'fixed' },
  'home-status': { id: 'home-status', title: '頂部狀態條', placementZone: 'fixed' },
};

export function getWidgetDefinition(id: string): HomeWidgetDefinition | undefined {
  return HOME_WIDGET_REGISTRY[id];
}

export function isEditableWidgetId(id: string): boolean {
  return id in HOME_WIDGET_REGISTRY;
}

/**
 * Phase 1.5C: Widget Gallery categories in display order.
 */
export const WIDGET_GALLERY_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: '今日照護', label: '今日照護' },
  { key: '健康', label: '健康' },
  { key: '計畫', label: '計畫' },
  { key: '學習', label: '學習' },
  { key: '系統', label: '系統' },
  { key: '其他', label: '其他' },
];

/** Make a placement object with coordinate defaults for a given breakpoint */
function makePlacement(widgetId: string, x: number, y: number, hidden: boolean): HomeWidgetPlacement {
  const def = getWidgetDefinition(widgetId)!;
  const wh = sizeToWH(def.defaultSize, 'desktop');
  return {
    widgetId: widgetId as HomeWidgetPlacement['widgetId'],
    size: def.defaultSize,
    x, y, w: wh.w, h: wh.h,
    hidden,
    order: 0,
  };
}

/** Generate default placements for each breakpoint */
function generateDefaults(): { desktop: HomeWidgetPlacement[]; tablet: HomeWidgetPlacement[]; mobile: HomeWidgetPlacement[] } {
  const desktop: HomeWidgetPlacement[] = [];
  const tablet: HomeWidgetPlacement[] = [];
  const mobile: HomeWidgetPlacement[] = [];

  const order = ['home-checkin', 'home-today-task', 'home-moonlex', 'home-period', 'home-hydration', 'home-anniversary', 'home-lunaris', 'home-activity-heatmap'];

  // Desktop 12-col defaults:
  // Row 0: checkin(x=0,w=4) anniversary(x=4,w=2) period(x=6,w=2) task(x=8,w=4)
  // Row 2: heatmap(x=0,w=12)
  // Row 4: lunaris(x=0,w=6) hydration(x=6,w=4)
  const desktopLayout: Record<string, { x: number; y: number }> = {
    'home-checkin': { x: 0, y: 0 },
    'home-today-task': { x: 4, y: 0 },
    'home-moonlex': { x: 0, y: 2 },
    'home-period': { x: 8, y: 0 },
    'home-hydration': { x: 6, y: 2 },
    'home-anniversary': { x: 10, y: 2 },
    'home-lunaris': { x: 0, y: 4 },
    'home-activity-heatmap': { x: 6, y: 4 },
  };

  for (const id of order) {
    const pos = desktopLayout[id];
    const def = getWidgetDefinition(id)!;
    const whDesktop = sizeToWH(def.defaultSize, 'desktop');
    desktop.push({
      widgetId: id as HomeWidgetPlacement['widgetId'],
      size: def.defaultSize,
      x: pos.x, y: pos.y,
      w: whDesktop.w, h: whDesktop.h,
      hidden: !def.defaultVisible,
      order: order.indexOf(id),
    });
  }

  // Tablet 8-col defaults: pack into smaller grid (auto layout)
  const tabletCols = 8;
  const tabletOccupancy: boolean[][] = [];

  function isFree(row: number, col: number, cSpan: number, rSpan: number): boolean {
    for (let r = row; r < row + rSpan; r++) {
      for (let c = col; c < col + cSpan; c++) {
        if (c >= tabletCols) return false;
        if (tabletOccupancy[r]?.[c]) return false;
      }
    }
    return true;
  }
  function mark(row: number, col: number, cSpan: number, rSpan: number) {
    for (let r = row; r < row + rSpan; r++) {
      if (!tabletOccupancy[r]) tabletOccupancy[r] = [];
      for (let c = col; c < col + cSpan; c++) {
        tabletOccupancy[r][c] = true;
      }
    }
  }

  for (const id of order) {
    const def = getWidgetDefinition(id)!;
    const wh = sizeToWH(def.defaultSize, 'tablet');
    let placed = false;
    for (let row = 0; !placed; row++) {
      for (let col = 0; col <= tabletCols - wh.w; col++) {
        if (isFree(row, col, wh.w, wh.h)) {
          mark(row, col, wh.w, wh.h);
          tablet.push({
            widgetId: id as HomeWidgetPlacement['widgetId'],
            size: def.defaultSize,
            x: col, y: row,
            w: wh.w, h: wh.h,
            hidden: !def.defaultVisible,
            order: order.indexOf(id),
          });
          placed = true;
          break;
        }
      }
    }
  }

  // Mobile 4-col defaults: vertical stack
  let mobileY = 0;
  for (const id of order) {
    const def = getWidgetDefinition(id)!;
    const wh = sizeToWH(def.defaultSize, 'mobile');
    mobile.push({
      widgetId: id as HomeWidgetPlacement['widgetId'],
      size: def.defaultSize,
      x: 0, y: mobileY,
      w: wh.w, h: wh.h,
      hidden: !def.defaultVisible,
      order: order.indexOf(id),
    });
    mobileY += wh.h;
  }

  return { desktop, tablet, mobile };
}

let _defaultsCache: ReturnType<typeof generateDefaults> | null = null;

export function getDefaultPlacements(): Record<'desktop' | 'tablet' | 'mobile', HomeWidgetPlacement[]> {
  if (!_defaultsCache) _defaultsCache = generateDefaults();
  return {
    desktop: _defaultsCache.desktop.map(p => ({ ...p })),
    tablet: _defaultsCache.tablet.map(p => ({ ...p })),
    mobile: _defaultsCache.mobile.map(p => ({ ...p })),
  };
}

export function validatePlacement(placement: HomeWidgetPlacement): boolean {
  const def = getWidgetDefinition(placement.widgetId);
  if (!def) return false;
  return def.supportedSizes.includes(placement.size);
}
