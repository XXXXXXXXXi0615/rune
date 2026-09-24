// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuneAnimatedNumber, RuneInlineDelete, RuneSectionRail } from '@/components/ui/rune/RuneMicroInteractions';

describe('Rune micro-interactions', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('formats increases, decreases, separators, prefix/suffix and rapid updates stably', () => {
    act(() => root.render(<RuneAnimatedNumber value={1200.5} decimals={1} prefix="$" suffix=" km" />));
    expect(host.textContent).toContain('$1,200.5 km');
    act(() => root.render(<RuneAnimatedNumber value={7} decimals={2} separator="" prefix="$" suffix=" km" />));
    act(() => root.render(<RuneAnimatedNumber value={84} decimals={2} separator="" prefix="$" suffix=" km" />));
    act(() => root.render(<RuneAnimatedNumber value={3} decimals={2} separator="" prefix="$" suffix=" km" />));
    expect(host.querySelector('.sr-only')?.textContent).toBe('$3.00 km');
    expect(host.querySelector('.rune-animated-number')?.getAttribute('data-rune-value')).toBe('3');
  });

  it('opens, cancels with pointer and Escape, and confirms only once', async () => {
    const confirm = vi.fn(async () => {});
    const cancel = vi.fn();
    act(() => root.render(<RuneInlineDelete onConfirm={confirm} onCancel={cancel} />));
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="刪除"]')!.click());
    expect(host.querySelector('[data-state="confirm"]')).not.toBeNull();
    act(() => host.querySelector<HTMLButtonElement>('.rune-inline-delete__cancel')!.click());
    expect(cancel).toHaveBeenCalledTimes(1);
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="刪除"]')!.click());
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(cancel).toHaveBeenCalledTimes(2);
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="刪除"]')!.click());
    const accept = host.querySelector<HTMLButtonElement>('.rune-inline-delete__accept')!;
    await act(async () => { accept.click(); accept.click(); });
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('uses canonical rail items for pointer and keyboard navigation', () => {
    const select = vi.fn();
    const sections = [{ id: 'rules', label: '規則' }, { id: 'reviews', label: '審核紀錄' }] as const;
    act(() => root.render(<RuneSectionRail sections={sections} activeId="rules" onSelect={select} />));
    const buttons = host.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-current')).toBe('location');
    act(() => buttons[1].click());
    expect(select).toHaveBeenCalledWith('reviews');
    act(() => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(select).toHaveBeenLastCalledWith('reviews');
  });
});
