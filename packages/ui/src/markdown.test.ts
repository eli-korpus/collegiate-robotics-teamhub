import { describe, expect, it } from 'vitest';
import { markdownExcerpt, renderMarkdown } from './markdown';

describe('markdown subset', () => {
  it('escapes HTML before formatting', () => {
    const out = renderMarkdown('<img src=x onerror=alert(1)> **bold**');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(out).toContain('<strong>bold</strong>');
  });
  it('only links http(s) URLs', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href="javascript');
    expect(renderMarkdown('[x](https://a.dev)')).toContain('href="https://a.dev"');
  });
  it('renders lists and headings', () => {
    expect(renderMarkdown('## Hi\n- a\n- b')).toBe('<h3>Hi</h3><ul><li>a</li><li>b</li></ul>');
  });
  it('makes excerpts', () => {
    expect(markdownExcerpt('# Title\n**Bold** [link](https://x.y)')).toBe('Title Bold link');
  });
});
