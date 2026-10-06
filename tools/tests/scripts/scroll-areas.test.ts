import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * A scrolling area must be a positioning container (`relative`, or absolute/fixed/sticky). Otherwise hidden
 * screen-reader labels (`sr-only`, which are absolutely positioned) inside it are placed against the page instead,
 * escape the scroll area, and make the whole page scroll into empty space past the end (seen in the setup wizard's
 * Permissions step).
 */
describe('scroll areas', () => {
  it('every scrolling area is a positioning container', () => {
    const files = execFileSync('git', ['ls-files', '*.tsx'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(/["'`]([^"'`]*\boverflow-(?:auto|y-auto|x-auto|scroll|y-scroll|x-scroll)\b[^"'`]*)["'`]/g)) {
            if (!/(^|\s)(relative|absolute|fixed|sticky)(\s|$)/.test(m[1])) bad.push(`${f}:${i + 1}  ${m[1]}`);
          }
        });
    }
    expect(bad, 'add `relative` to these classes').toEqual([]);
  });
});
