import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('escapes raw HTML and script tags', () => {
    const html = renderMarkdown('<script>alert(1)</script> & <b>bold</b>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('renders bold and italic', () => {
    expect(renderMarkdown('**粗體** 與 *斜體*')).toContain('<strong>粗體</strong>');
    expect(renderMarkdown('**粗體** 與 *斜體*')).toContain('<em>斜體</em>');
  });

  it('renders inline code', () => {
    expect(renderMarkdown('跑 `npm run build`')).toContain('<code>npm run build</code>');
  });

  it('renders links with safe url guard', () => {
    expect(renderMarkdown('[月潮](https://example.com)')).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">月潮</a>',
    );
    expect(renderMarkdown('[壞](javascript:alert(1))')).not.toContain('href="javascript:');
  });

  it('renders images with safe url guard', () => {
    expect(renderMarkdown('![圖](data:image/png;base64,AAAA)')).toContain(
      '<img src="data:image/png;base64,AAAA" alt="圖" loading="lazy" />',
    );
    expect(renderMarkdown('![圖](javascript:x)')).not.toContain('<img');
  });

  it('renders divider', () => {
    const html = renderMarkdown('上\n\n---\n\n下');
    expect(html).toContain('<hr />');
  });

  it('renders headings capped at h6', () => {
    expect(renderMarkdown('# 標題')).toContain('<h2>標題</h2>');
    expect(renderMarkdown('### 小標')).toContain('<h4>小標</h4>');
  });

  it('renders blockquote', () => {
    expect(renderMarkdown('> 月亮升起\n> 潮水退去')).toContain('<blockquote>');
    expect(renderMarkdown('> 月亮升起')).toContain('月亮升起');
  });

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- 散步\n- 寫字')).toContain('<ul><li>散步</li><li>寫字</li></ul>');
    expect(renderMarkdown('1. 第一\n2. 第二')).toContain('<ol><li>第一</li><li>第二</li></ol>');
  });

  it('merges soft line breaks inside a paragraph', () => {
    expect(renderMarkdown('第一行\n第二行')).toContain('<p>第一行<br />第二行</p>');
  });

  it('splits paragraphs on blank lines', () => {
    const html = renderMarkdown('一段\n\n二段');
    expect(html).toContain('<p>一段</p>');
    expect(html).toContain('<p>二段</p>');
  });

  it('handles empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   \n ')).toBe('');
  });

  it('keeps plain text intact', () => {
    const html = renderMarkdown('今天天氣很好');
    expect(html).toContain('<p>今天天氣很好</p>');
  });
});
