import { describe, expect, it } from 'vitest';
import { greeting } from './time';

const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h, 15);

describe('greeting', () => {
  it('stays the same through one part of the day', () => {
    expect(greeting(at(2026, 10, 2, 13))).toBe(greeting(at(2026, 10, 2, 17)));
    expect(greeting(at(2026, 10, 2, 6))).toBe(greeting(at(2026, 10, 2, 11)));
  });

  it('fits the time of day', () => {
    for (let day = 1; day <= 60; day++) {
      expect(greeting(at(2026, 1, day, 2))).toMatch(/late|Still|Night/);
      expect(greeting(at(2026, 1, day, 9))).not.toMatch(/afternoon|evening|late/i);
      expect(greeting(at(2026, 1, day, 14))).not.toMatch(/morning|evening|late/i);
    }
  });

  it('varies from day to day', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => greeting(at(2026, 3, i + 1, 14))));
    expect(seen.size).toBeGreaterThan(3);
  });

  it('only uses weekday greetings on that weekday', () => {
    for (let day = 1; day <= 90; day++) {
      const d = at(2026, 1, day, 10);
      if (greeting(d) === 'Happy Friday') expect(d.getDay()).toBe(5);
    }
  });
});
