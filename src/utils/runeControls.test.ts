import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { RuneButton, RuneIconButton, RuneSegmentedControl, RuneSlider, RuneSwitch } from '@/components/ui/rune/RuneControls';

describe('Rune tactile controls', () => {
  it('exposes loading and disabled semantics', () => {
    const html = renderToStaticMarkup(createElement(RuneButton, { loading: true }, '儲存'));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('rune-button__spinner');
  });

  it('keeps icon controls caller-labelled and switch state explicit', () => {
    expect(renderToStaticMarkup(createElement(RuneIconButton, { 'aria-label': '關閉' }, '×'))).toContain('aria-label="關閉"');
    expect(renderToStaticMarkup(createElement(RuneSwitch, { checked: true, label: '月光模式', onChange: () => undefined }))).toContain('aria-checked="true"');
  });

  it('uses tab semantics and labels sliders', () => {
    const tabs = renderToStaticMarkup(createElement(RuneSegmentedControl, { label: '檢視', value: 'a', onChange: () => undefined, items: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }] }));
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('aria-selected="true"');
    expect(renderToStaticMarkup(createElement(RuneSlider, { label: '強度', min: 0, max: 10 }))).toContain('aria-label="強度"');
  });
});
