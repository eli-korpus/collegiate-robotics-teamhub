import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Tailwind only generates classes it finds in its @source folders: a wrong path silently drops styles. */
describe('stylesheet sources', () => {
  const files = execFileSync('git', ['ls-files', '*.css'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of files) {
    const sources = [...readFileSync(f, 'utf8').matchAll(/@source\s+'([^']+)'/g)].map((m) => m[1]);
    if (!sources.length) continue;
    it(`${f} points at folders that exist inside the repository`, () => {
      for (const s of sources) {
        const p = resolve(dirname(f), s);
        expect(existsSync(p), `${s} -> ${p}`).toBe(true);
        expect(p.startsWith(process.cwd()), `${s} is outside the repository`).toBe(true);
      }
    });
  }
  it('the dashboard scans every tab', () => {
    const css = readFileSync(join('dashboard', 'src', 'app.css'), 'utf8');
    expect(css).toContain("@source '../../tabs'");
  });
});
