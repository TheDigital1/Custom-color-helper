/**
 * Core color conversions used in hot paths (solver, matching, rendering).
 *
 * These are small, allocation-light versions of the conversions culori provides.
 * The unit tests check every function here against culori so the two never drift.
 *
 * Conventions:
 *  - "rgb" means gamma-encoded sRGB with channels in 0..1 (may be out of range before clamping).
 *  - "linear" means linear-light sRGB, channels in 0..1.
 *  - OKLab L is 0..1. CIELAB is relative to D65 (culori's "lab65"), L is 0..100.
 */

export type Vec3 = [number, number, number];
export type OKLab = Vec3;

export const D65_WHITE: Vec3 = [0.3127 / 0.329, 1, (1 - 0.3127 - 0.329) / 0.329];

export function srgbToLinear(c: number): number {
  const a = Math.abs(c);
  const v = a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4);
  return c < 0 ? -v : v;
}

export function linearToSrgb(c: number): number {
  const a = Math.abs(c);
  const v = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055;
  return c < 0 ? -v : v;
}

export function rgbToLinear(rgb: Vec3): Vec3 {
  return [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
}

export function linearToRgb(lin: Vec3): Vec3 {
  return [linearToSrgb(lin[0]), linearToSrgb(lin[1]), linearToSrgb(lin[2])];
}

export function linearToOklab([r, g, b]: Vec3): OKLab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear([L, a, b]: OKLab): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export const rgbToOklab = (rgb: Vec3): OKLab => linearToOklab(rgbToLinear(rgb));
export const oklabToRgb = (lab: OKLab): Vec3 => linearToRgb(oklabToLinear(lab));

/** Relative luminance Y (0..1) of a linear sRGB color. */
export function luminance([r, g, b]: Vec3): number {
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
}

export function linearToXyz([r, g, b]: Vec3): Vec3 {
  return [
    0.4123908 * r + 0.35758434 * g + 0.18048079 * b,
    0.21263901 * r + 0.71516868 * g + 0.07219232 * b,
    0.01933082 * r + 0.11919478 * g + 0.95053215 * b,
  ];
}

export function xyzToLinear([x, y, z]: Vec3): Vec3 {
  return [
    3.24096994 * x - 1.53738318 * y - 0.49861076 * z,
    -0.96924364 * x + 1.8759675 * y + 0.04155506 * z,
    0.05563008 * x - 0.20397696 * y + 1.05697151 * z,
  ];
}

const LAB_E = 216 / 24389;
const LAB_K = 24389 / 27;

/** XYZ (D65, Y in 0..1) → CIELAB relative to D65. */
export function xyzToLab([x, y, z]: Vec3): Vec3 {
  const f = (t: number) => (t > LAB_E ? Math.cbrt(t) : (LAB_K * t + 16) / 116);
  const fx = f(x / D65_WHITE[0]);
  const fy = f(y / D65_WHITE[1]);
  const fz = f(z / D65_WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToLab(rgb: Vec3): Vec3 {
  return xyzToLab(linearToXyz(rgbToLinear(rgb)));
}

export function oklabToLab(lab: OKLab): Vec3 {
  return xyzToLab(linearToXyz(oklabToLinear(lab)));
}

export interface LCh {
  l: number;
  c: number;
  /** Hue in degrees, 0..360. */
  h: number;
}

export function oklabToLch([L, a, b]: OKLab): LCh {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

export function lchToOklab({ l, c, h }: LCh): OKLab {
  const r = (h * Math.PI) / 180;
  return [l, c * Math.cos(r), c * Math.sin(r)];
}

export function parseHex(hex: string): Vec3 | null {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function rgbToHex(rgb: Vec3): string {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(clamp01(c) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

export const oklabToHex = (lab: OKLab) => rgbToHex(oklabToRgb(lab));

export function hexToOklab(hex: string): OKLab | null {
  const rgb = parseHex(hex);
  return rgb ? rgbToOklab(rgb) : null;
}

/** How far outside the sRGB cube a gamma-encoded color is (0 when inside). */
export function gamutViolation(rgb: Vec3): number {
  let v = 0;
  for (const c of rgb) {
    if (c < 0) v += -c;
    else if (c > 1) v += c - 1;
  }
  return v;
}

export function inGamut(rgb: Vec3, eps = 1e-6): boolean {
  return rgb.every((c) => c >= -eps && c <= 1 + eps);
}

/** Clamp an OKLab color into sRGB by clamping its RGB channels. */
export function clampOklab(lab: OKLab): OKLab {
  const rgb = oklabToRgb(lab);
  if (inGamut(rgb, 0)) return lab;
  return rgbToOklab([clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])]);
}

/** Approximate LRV (Y × 100) of an OKLab color. */
export function approxLrv(lab: OKLab): number {
  return luminance(oklabToLinear(lab)) * 100;
}

/** WCAG 2.x contrast ratio between two colors given as OKLab. */
export function contrastRatio(a: OKLab, b: OKLab): number {
  const ya = luminance(oklabToLinear(clampOklab(a)));
  const yb = luminance(oklabToLinear(clampOklab(b)));
  const [hi, lo] = ya > yb ? [ya, yb] : [yb, ya];
  return (hi + 0.05) / (lo + 0.05);
}
