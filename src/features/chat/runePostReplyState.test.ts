import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunePostReplyStateCard } from '@/components/chat/RunePostReplyStateCard';
import { companionMoodLabel, createRunePostReplySnapshot } from './runePostReplyState';

describe('Rune post-reply presentation', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  function renderCard(messageId: string, statusText: string, onDismiss = vi.fn()) {
    const snapshot = createRunePostReplySnapshot(messageId, { mood: 'annoyed', statusText }, 100);
    act(() => root.render(createElement(RunePostReplyStateCard, { snapshot, onDismiss })));
    return onDismiss;
  }

  it('maps canonical moods without changing their values', () => {
    expect(companionMoodLabel('idle')).toBe('平靜');
    expect(companionMoodLabel('curious')).toBe('有點好奇');
    expect(companionMoodLabel('happy')).toBe('心情不錯');
    expect(companionMoodLabel('focused')).toBe('很專注');
    expect(companionMoodLabel('concerned')).toBe('有點在意');
    expect(companionMoodLabel('sleepy')).toBe('有點累');
    expect(companionMoodLabel('annoyed')).toBe('有點不耐煩');
    expect(companionMoodLabel('protective')).toBe('想護著你');
    expect(companionMoodLabel('quiet')).toBe('安靜陪著你');
  });

  it('omits an empty status line and never renders numeric companion fields', () => {
    renderCard('m-1', '   ');
    expect(host.textContent).toBe('RRune · 有點不耐煩小聲話');
    expect(host.textContent).not.toMatch(/affection|annoyance|energy|focus|\d+%/i);
  });

  it('dismisses after the visible and exit intervals', () => {
    const onDismiss = renderCard('m-1', '先別急。');
    act(() => vi.advanceTimersByTime(5_999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(221));
    expect(host.querySelector('.is-leaving')).not.toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('collapses immediately on manual activation', () => {
    const onDismiss = renderCard('m-1', '先別急。');
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('replaces the rendered snapshot and restarts its lifecycle', () => {
    const onDismiss = renderCard('m-1', '第一句');
    act(() => vi.advanceTimersByTime(5_000));
    const replacement = createRunePostReplySnapshot('m-2', { mood: 'happy', statusText: '第二句' }, 200);
    act(() => root.render(createElement(RunePostReplyStateCard, { snapshot: replacement, onDismiss })));
    expect(host.textContent).toContain('Rune · 心情不錯');
    expect(host.textContent).toContain('第二句');
    act(() => vi.advanceTimersByTime(1_300));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
