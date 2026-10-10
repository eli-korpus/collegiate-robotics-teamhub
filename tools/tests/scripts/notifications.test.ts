import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Every kind of notification the database sends has wording in the bell (else it reads "… updated something"). */
describe('notification wording', () => {
  it('each notification type in the SQL has text in its tab or in the core list', () => {
    const sql = execFileSync('git', ['ls-files', 'database/*.sql', 'tabs/*.sql'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const types = new Set<string>();
    // The type is the literal just before the ref ('tasks.assigned', 'tasks:task:' || …).
    for (const f of sql) for (const m of readFileSync(f, 'utf8').matchAll(/'([a-z-]+\.[a-z_]+)',\s*(?:new\.ref\b|'[a-z-]+:)/g)) types.add(m[1]);
    const core = readFileSync('dashboard/src/core/shell/Notifications.tsx', 'utf8');
    const missing = [...types].filter((t) => {
      if (core.includes(`'${t}':`)) return false;
      const tab = t.split('.')[0];
      try {
        return !readFileSync(`tabs/${tab}/client.tsx`, 'utf8').includes(`'${t}':`);
      } catch {
        return true;
      }
    });
    expect(types.size).toBeGreaterThan(5);
    expect(missing).toEqual([]);
  });
});
