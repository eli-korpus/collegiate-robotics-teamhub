import { describe, expect, it } from 'vitest';
import { contrast, deriveAccent, hexToOklch, oklchToHex, SURFACES } from './color';

describe('color', () => {
  it('round-trips hex through OKLCH', () => {
    for (const hex of ['#3B82F6', '#E11D48', '#16A34A', '#000000', '#FFFFFF', '#FACC15']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });
  it('derives AA-compliant accents for light and dark', () => {
    for (const hex of ['#FACC15', '#3B82F6', '#22D3EE', '#111111', '#FFFFFF', '#E11D48']) {
      for (const mode of ['light', 'dark'] as const) {
        const a = deriveAccent(hex, mode);
        expect(contrast(a.accent, SURFACES[mode])).toBeGreaterThanOrEqual(3);
        expect(contrast(a.accent, a.contrast)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('flags adjustment for a low-contrast yellow', () => {
    expect(deriveAccent('#FACC15', 'light').adjusted).toBe(true);
  });
});
