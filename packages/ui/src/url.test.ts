import { describe, expect, it } from 'vitest';
import { safeHref } from './url';

describe('safeHref', () => {
  it('keeps web, email, phone and in-app links', () => {
    expect(safeHref('https://gm0.org')).toBe('https://gm0.org');
    expect(safeHref(' http://a.dev/x ')).toBe('http://a.dev/x');
    expect(safeHref('mailto:coach@example.com')).toBe('mailto:coach@example.com');
    expect(safeHref('tel:+15550100')).toBe('tel:+15550100');
    expect(safeHref('/tasks/1')).toBe('/tasks/1');
  });
  it('adds https to a bare address', () => {
    expect(safeHref('example.com/page')).toBe('https://example.com/page');
  });
  it('never returns a link that runs code', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', '//evil.example/x', 'file:///etc/passwd']) {
      const out = safeHref(bad);
      expect(out === undefined || out.startsWith('https://'), bad).toBe(true);
      expect(out ?? '').not.toMatch(/^(javascript|data|vbscript|file):/i);
    }
    expect(safeHref('java\tscript:alert(1)')).toMatch(/^https:\/\//);
    expect(safeHref('')).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
  });
});
