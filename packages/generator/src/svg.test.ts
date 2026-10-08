import { describe, expect, it } from 'vitest';
import { cleanSvg, svgLooksActive } from './svg';

describe('SVG logos', () => {
  it('keeps the drawing', () => {
    const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="10" height="10"/><use href="#g"/></svg>';
    expect(cleanSvg(logo)).toBe(logo);
  });

  it('removes anything that could run code', () => {
    const bad = [
      '<svg><script>alert(1)</script><rect/></svg>',
      '<svg onload="alert(1)"><rect/></svg>',
      "<svg><rect onclick='x()' /></svg>",
      '<svg><a href="javascript:alert(1)"><rect/></a></svg>',
      '<svg><a xlink:href="https://evil.example"><rect/></a></svg>',
      '<svg><a href=javascript:alert(1)><rect/></a></svg>',
      '<svg><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>',
      '<svg><set attributeName="href" to="javascript:alert(1)"/></svg>',
      '<!DOCTYPE svg [<!ENTITY x "y">]><svg><SCRIPT type="text/javascript">x()</SCRIPT></svg>',
    ];
    for (const b of bad) {
      const out = cleanSvg(b);
      expect(svgLooksActive(out), out).toBe(false);
      expect(out).not.toMatch(/evil|alert|script|DOCTYPE/i);
    }
  });

  it('spots active content (the wizard refuses a logo that still has some after cleaning)', () => {
    expect(svgLooksActive('<svg><script>x()</script></svg>')).toBe(true);
    expect(svgLooksActive('<svg><a href="javascript:x()"/></svg>')).toBe(true);
    expect(svgLooksActive('<svg onload="x()"/>')).toBe(true);
  });
});
