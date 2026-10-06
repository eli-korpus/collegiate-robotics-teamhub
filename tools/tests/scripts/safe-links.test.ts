import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Links people type (tool links, vendor pages, sponsor sites…) must go through safeHref(), or a saved
 * "javascript:" link would run code for whoever clicks it. Fixed addresses written in the code are fine.
 */
describe('links', () => {
  it('every href built from data goes through safeHref()', () => {
    const files = execFileSync('git', ['ls-files', 'dashboard/src/*.tsx', 'packages/*.tsx', 'tabs/*.tsx'], { encoding: 'utf8' }).split('\n').filter((f) => f && !f.includes('.test.'));
    // Fixed addresses: written in the code (https://…, in-app paths) or TeamHub's own constants and FTCScout page helpers.
    const fixed = /^(`(https:\/\/|mailto:|\$\{import\.meta\.env\.BASE_URL|\$\{base\}|\/)|'https:\/\/|"https:\/\/|safeHref\(|TEAMHUB_CREDIT\.url$|ftcscout(Event|Team)Url\()/;
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(/\bhref=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) if (!fixed.test(m[1].trim())) bad.push(`${f}:${i + 1}  href={${m[1]}}`);
        });
    }
    expect(bad, 'wrap these in safeHref() (or use a fixed https:// address)').toEqual([]);
  });
});
