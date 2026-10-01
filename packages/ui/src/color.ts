/**
 * Small, dependency-free color math: hex <-> OKLCH, WCAG contrast and accent derivation (spec §9.3).
 * Used by the generator (Node), the wizard and the dashboard.
 */

export interface Oklch {
  l: number; // 0..1
  c: number; // 0..~0.4
  h: number; // degrees
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0001 && v <= 1.0001);

/** Converts OKLCH to hex, reducing chroma until the color fits in sRGB. */
export function oklchToHex(color: Oklch): string {
  let c = color.c;
  let lin = oklchToLinear({ ...color, c });
  while (!inGamut(lin) && c > 0) {
    c = Math.max(0, c - 0.005);
    lin = oklchToLinear({ ...color, c });
  }
  return rgbToHex(lin.map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as [number, number, number]);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Fixed neutral surfaces (must match styles.css). */
export const SURFACES = { light: '#FFFFFF', dark: '#1C1C1F' } as const;
const DARK_TEXT = '#111113';
const LIGHT_TEXT = '#FFFFFF';

export interface AccentSet {
  accent: string;
  hover: string;
  contrast: string;
  adjusted: boolean;
}

/**
 * Derives a WCAG-AA safe accent for a theme mode:
 * - accent vs surface ≥ 4.5:1 (it is also used for link text; ≥ 3:1 would satisfy UI components only)
 * - text on accent ≥ 4.5:1
 */
export function deriveAccent(hex: string, mode: 'light' | 'dark'): AccentSet {
  const base = hexToOklch(hex);
  const surface = SURFACES[mode];
  let color = { ...base };
  let adjusted = false;
  const ok = (h: string) => {
    const onAccent = Math.max(contrast(h, LIGHT_TEXT), contrast(h, DARK_TEXT));
    // 4.5:1 (not just 3:1) because the accent is also used for text links.
    return contrast(h, surface) >= 4.5 && onAccent >= 4.5;
  };
  let out = oklchToHex(color);
  for (let i = 0; i < 60 && !ok(out); i++) {
    color = { ...color, l: mode === 'light' ? color.l - 0.01 : color.l + 0.01 };
    out = oklchToHex(color);
    adjusted = true;
  }
  const text = contrast(out, LIGHT_TEXT) >= contrast(out, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
  const hover = oklchToHex({ ...color, l: mode === 'light' ? color.l - 0.06 : color.l + 0.06 });
  return { accent: out, hover, contrast: text, adjusted };
}

/** Picks a readable text color for an arbitrary background (team chips etc.). */
export function readableOn(bg: string): string {
  return contrast(bg, LIGHT_TEXT) >= contrast(bg, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/**
 * Suggests an accent from image pixel data (RGBA). Picks the most common saturated, mid-lightness hue bucket.
 * Used by the wizard's logo color extraction.
 */
export function dominantColor(data: Uint8ClampedArray | number[]): string | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.3 || max < 40 || min > 235) continue; // skip neutrals
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  if (!best) return null;
  return rgbToHex([best.r / best.n, best.g / best.n, best.b / best.n]);
}

export const PRESET_ACCENTS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Red', hex: '#E11D48' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Teal', hex: '#0D9488' },
  { name: 'Slate', hex: '#475569' },
] as const;
