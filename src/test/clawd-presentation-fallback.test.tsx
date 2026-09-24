/**
 * CLAWD Presentation Fallback Regression Tests
 *
 * Verifies:
 *  1. Presentation asset load failure → onVisualState(false) called
 *  2. No visible ERROR text in DOM
 *  3. Error logged to console.debug (dev mode)
 *  4. State transitions reset imageFailed
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { LunarisPet } from '@/components/pet/LunarisPet';

// Mock the config to control asset sources
vi.mock('@/config/lunarisPetStates', () => ({
  LUNARIS_PET_STATES: {
    idle: {
      label: '待機',
      mood: 'calm',
      src: '/test/idle.gif',
      fallbackText: 'LUNARIS 正安靜陪著你',
      type: 'desktop',
    },
    error: {
      label: '錯誤',
      mood: 'concerned',
      src: '/test/error.gif',
      fallbackText: 'LUNARIS 遇到了一點問題',
      type: 'desktop',
    },
    happy: {
      label: '開心',
      mood: 'happy',
      src: '/test/happy.gif',
      fallbackText: 'LUNARIS 心情很好',
      type: 'desktop',
    },
  },
}));

const debugLogs: string[] = [];
const originalDebug = console.debug;

function renderInDiv(jsx: React.ReactElement) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  act(() => root.render(jsx));
  return { container: div, root, unmount: () => act(() => { root.unmount(); div.remove(); }) };
}

describe('LunarisPet fallback chain', () => {
  beforeEach(() => {
    debugLogs.length = 0;
    console.debug = (...args: unknown[]) => {
      debugLogs.push(args.map(String).join(' '));
      originalDebug(...args);
    };
  });

  afterEach(() => {
    console.debug = originalDebug;
  });

  it('1. renders img with correct src', () => {
    const { container, unmount } = renderInDiv(<LunarisPet state="idle" size="pet" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('/test/idle.gif');
    unmount();
  });

  it('2. calls onVisualState(false) on image load error', () => {
    const onVisualState = vi.fn();
    const { container, unmount } = renderInDiv(<LunarisPet state="idle" size="pet" onVisualState={onVisualState} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();

    act(() => { img!.dispatchEvent(new Event('error')); });

    expect(onVisualState).toHaveBeenCalledWith(false);
    unmount();
  });

  it('3. calls onVisualState(true) on successful image load', () => {
    const onVisualState = vi.fn();
    const { container, unmount } = renderInDiv(<LunarisPet state="idle" size="pet" onVisualState={onVisualState} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();

    act(() => { img!.dispatchEvent(new Event('load')); });

    expect(onVisualState).toHaveBeenCalledWith(true);
    unmount();
  });

  it('4. does NOT render visible ERROR text in content area', () => {
    const { container, unmount } = renderInDiv(<LunarisPet state="error" size="pet" />);
    const textContent = container.textContent || '';
    // The component should not contain "ERROR" or the fallback text as visible content
    expect(textContent).not.toContain('ERROR');
    // aria-label is not part of textContent
    unmount();
  });

  it('5. logs to console.debug in dev mode on image failure', () => {
    const { container, unmount } = renderInDiv(<LunarisPet state="error" size="pet" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();

    act(() => { img!.dispatchEvent(new Event('error')); });

    expect(debugLogs.some((log) => log.includes('[LunarisPet]'))).toBe(true);
    unmount();
  });

  it('6. transitions between states reset imageFailed', () => {
    const { container, unmount, root } = renderInDiv(<LunarisPet state="idle" size="pet" />);
    let img = container.querySelector('img');
    expect(img).toBeTruthy();

    act(() => { img!.dispatchEvent(new Event('error')); });

    // Rerender with different state
    act(() => { root.render(<LunarisPet state="happy" size="pet" />); });
    img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('/test/happy.gif');
    unmount();
  });

  it('7. unmount calls onVisualState(false)', () => {
    const onVisualState = vi.fn();
    const { unmount } = renderInDiv(<LunarisPet state="idle" size="pet" onVisualState={onVisualState} />);

    // Mount should have called with boolean(config.src) = true
    expect(onVisualState).toHaveBeenCalledWith(true);

    unmount();
    // Cleanup effect calls onVisualState(false)
    expect(onVisualState).toHaveBeenCalledWith(false);
  });

  it('8. no visible fallback SVG is rendered (returns null on failure)', () => {
    const { container, unmount } = renderInDiv(<LunarisPet state="idle" size="pet" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();

    act(() => { img!.dispatchEvent(new Event('error')); });

    // After error, the component returns null — no SVG fallback
    const svg = container.querySelector('svg');
    expect(svg).toBeNull();
    // No broken image UI either
    const allImgs = container.querySelectorAll('img');
    expect(allImgs.length).toBe(0);
    unmount();
  });
});
