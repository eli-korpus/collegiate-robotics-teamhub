import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { isPlainData, restoreSerializedCache, serializeCache } from './persist';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function client() {
  const qc = new QueryClient();
  qc.setQueryData(['core', 'people'], new Map([[ME, { name: 'Sam', teams: new Set(['a']) }]]));
  qc.setQueryData(['calendar', 'events'], [{ id: 'e1', start: new Date('2026-10-13T15:00:00Z') }]);
  qc.setQueryData(['tasks', 'list'], [{ id: 1, title: 'Wire the arm' }]);
  return qc;
}

describe('remembering data between visits', () => {
  it('brings back the same data, including Map, Set and Date values', () => {
    const raw = serializeCache(client(), ME);
    const next = new QueryClient();
    expect(restoreSerializedCache(next, raw, ME)).toBe(true);
    const people = next.getQueryData<Map<string, { name: string; teams: Set<string> }>>(['core', 'people'])!;
    expect(people.get(ME)?.name).toBe('Sam');
    expect(people.get(ME)?.teams.has('a')).toBe(true);
    expect(next.getQueryData<{ start: Date }[]>(['calendar', 'events'])![0].start).toEqual(new Date('2026-10-13T15:00:00Z'));
    expect(next.getQueryData(['tasks', 'list'])).toEqual([{ id: 1, title: 'Wire the arm' }]);
    // Shown at once, but refreshed as soon as something uses it.
    expect(next.getQueryState(['tasks', 'list'])?.isInvalidated).toBe(true);
  });

  it('never shows one person the data another person loaded on the same browser', () => {
    const raw = serializeCache(client(), ME);
    const next = new QueryClient();
    expect(restoreSerializedCache(next, raw, OTHER)).toBe(false);
    expect(next.getQueryData(['tasks', 'list'])).toBeUndefined();
  });

  it('forgets data older than a day', () => {
    const raw = serializeCache(client(), ME, Date.now() - 25 * 60 * 60_000);
    expect(restoreSerializedCache(new QueryClient(), raw, ME)).toBe(false);
  });

  it('skips queries that opted out or hold things that are not plain data', () => {
    const qc = client();
    qc.setQueryDefaults(['core', 'signed'], { meta: { persist: false } });
    qc.setQueryData(['core', 'signed', 'avatars'], new Map([['a.png', 'https://example.org/a.png?token=1']]));
    qc.setQueryData(['calendar', 'overlays'], [{ id: 'o1', icon: createElement('svg') }]);
    const next = new QueryClient();
    restoreSerializedCache(next, serializeCache(qc, ME), ME);
    expect(next.getQueryData(['core', 'signed', 'avatars'])).toBeUndefined();
    expect(next.getQueryData(['calendar', 'overlays'])).toBeUndefined();
    expect(next.getQueryData(['tasks', 'list'])).toBeDefined();
  });

  it('only treats plain values as safe to save', () => {
    expect(isPlainData({ a: [1, 'x', null, { b: new Date() }] })).toBe(true);
    expect(isPlainData(createElement('div'))).toBe(false);
    expect(isPlainData({ f: () => 1 })).toBe(false);
    expect(isPlainData(new (class Thing {})())).toBe(false);
  });
});
