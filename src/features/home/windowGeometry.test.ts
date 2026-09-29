import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW_WIDTH,
  MAX_WINDOW_WIDTH,
  MIN_WINDOW_MAX_HEIGHT,
  MIN_WINDOW_WIDTH,
  clampMaxHeight,
  clampWidth,
  defaultMaxHeightFor,
  maxWidthFor,
  parseGeometry,
  serializeGeometry,
} from './windowGeometry';

const DESKTOP = { width: 1440, height: 900 };

describe('windowGeometry — width bounds', () => {
  it('clamps to the 360px floor and the 720px ceiling', () => {
    expect(clampWidth(200, DESKTOP.width)).toBe(MIN_WINDOW_WIDTH);
    expect(clampWidth(480, DESKTOP.width)).toBe(480);
    expect(clampWidth(2000, DESKTOP.width)).toBe(MAX_WINDOW_WIDTH);
  });

  it('never exceeds the viewport minus the gutter', () => {
    expect(maxWidthFor(1024)).toBe(720);
    expect(maxWidthFor(700)).toBe(668);
    expect(maxWidthFor(370)).toBe(360);
    expect(clampWidth(700, 600)).toBe(568);
  });
});

describe('windowGeometry — height cap bounds', () => {
  it('mirrors the frozen 72dvh ceiling', () => {
    expect(defaultMaxHeightFor(900)).toBe(648);
    expect(defaultMaxHeightFor(768)).toBe(553);
  });

  it('clamps to the 300px floor, the 72dvh ceiling and the current y', () => {
    expect(clampMaxHeight(200, 900, 80)).toBe(MIN_WINDOW_MAX_HEIGHT);
    expect(clampMaxHeight(500, 900, 80)).toBe(500);
    expect(clampMaxHeight(2000, 900, 80)).toBe(648);
    expect(clampMaxHeight(2000, 900, 500)).toBe(388);
    // A window near the bottom edge can never keep a cap that would overflow.
    expect(clampMaxHeight(2000, 900, 860)).toBe(MIN_WINDOW_MAX_HEIGHT);
  });
});

describe('windowGeometry — persistence payload', () => {
  it('reads a legacy { x, y } payload with default size', () => {
    expect(parseGeometry('{"x":120,"y":80}', DESKTOP)).toEqual({
      x: 120,
      y: 80,
      width: DEFAULT_WINDOW_WIDTH,
      maxHeight: null,
    });
  });

  it('reads an extended payload and clamps out-of-range fields', () => {
    expect(parseGeometry('{"x":12,"y":80,"width":480,"maxHeight":400}', DESKTOP)).toEqual({
      x: 12,
      y: 80,
      width: 480,
      maxHeight: 400,
    });
    expect(parseGeometry('{"x":12,"y":80,"width":99999,"maxHeight":1}', DESKTOP)).toEqual({
      x: 12,
      y: 80,
      width: MAX_WINDOW_WIDTH,
      maxHeight: MIN_WINDOW_MAX_HEIGHT,
    });
  });

  it('ignores invalid size fields without losing position', () => {
    expect(parseGeometry('{"x":12,"y":80,"width":"wide","maxHeight":null}', DESKTOP)).toEqual({
      x: 12,
      y: 80,
      width: DEFAULT_WINDOW_WIDTH,
      maxHeight: null,
    });
  });

  it('rejects payloads without a finite x/y (falls back to default placement)', () => {
    expect(parseGeometry(null, DESKTOP)).toBeNull();
    expect(parseGeometry('not json', DESKTOP)).toBeNull();
    expect(parseGeometry('{"x":12}', DESKTOP)).toBeNull();
    expect(parseGeometry('{"x":null,"y":80}', DESKTOP)).toBeNull();
    expect(parseGeometry('{"x":12,"y":"80"}', DESKTOP)).toBeNull();
  });

  it('omits default size fields so untouched users keep the legacy payload', () => {
    expect(serializeGeometry({ x: 10, y: 20, width: DEFAULT_WINDOW_WIDTH, maxHeight: null })).toBe('{"x":10,"y":20}');
    expect(serializeGeometry({ x: 10, y: 20, width: 480, maxHeight: 400 })).toBe('{"x":10,"y":20,"width":480,"maxHeight":400}');
    expect(serializeGeometry({ x: 10, y: 20, width: 480, maxHeight: null })).toBe('{"x":10,"y":20,"width":480}');
  });

  it('round-trips a resized geometry', () => {
    const geometry = { x: 96, y: 64, width: 520, maxHeight: 420 };
    expect(parseGeometry(serializeGeometry(geometry), DESKTOP)).toEqual(geometry);
  });
});
