/**
 * Approximate how a paint looks under different light.
 *
 * Paint data is just sRGB hex (no spectral reflectance), so this treats each color as if
 * it were lit by the preset's white point: XYZ is transformed with a Bradford chromatic
 * adaptation from D65 to the light's white, partially undone by an "eye adaptation" amount.
 * It is a rough visual aid, not a physical simulation; metamerism cannot be predicted.
 */
import { clamp01, linearToRgb, linearToXyz, oklabToLinear, rgbToHex, xyzToLinear, type OKLab, type Vec3 } from './convert';

export type LightingId = 'd65' | 'north' | 'south' | 'incandescent' | 'led3000' | 'led4000';

export interface LightingPreset {
  id: LightingId;
  label: string;
  cct: number | null;
  /** Use the CIE daylight locus (true) or the Planckian (blackbody) locus. */
  daylight: boolean;
}

export const LIGHTING: LightingPreset[] = [
  { id: 'd65', label: 'Daylight (D65 reference)', cct: null, daylight: true },
  { id: 'north', label: 'North light (cool, ~7500K)', cct: 7500, daylight: true },
  { id: 'south', label: 'South light (warm, ~5000K)', cct: 5000, daylight: true },
  { id: 'incandescent', label: 'Incandescent 2700K', cct: 2700, daylight: false },
  { id: 'led3000', label: 'LED 3000K (warm white)', cct: 3000, daylight: false },
  { id: 'led4000', label: 'LED 4000K (neutral white)', cct: 4000, daylight: false },
];

export const LIGHTING_BY_ID = Object.fromEntries(LIGHTING.map((l) => [l.id, l])) as Record<LightingId, LightingPreset>;

/** Chromaticity of a blackbody (Kim et al. cubic spline approximation, 1667–25000 K). */
export function planckianXy(T: number): [number, number] {
  const t = 1e3 / T;
  const x =
    T <= 4000
      ? -0.2661239 * t ** 3 - 0.234358 * t ** 2 + 0.8776956 * t + 0.17991
      : -3.0258469 * t ** 3 + 2.1070379 * t ** 2 + 0.2226347 * t + 0.24039;
  let y: number;
  if (T <= 2222) y = -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683;
  else if (T <= 4000) y = -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867;
  else y = 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

/** Chromaticity on the CIE daylight locus (4000–25000 K). */
export function daylightXy(T: number): [number, number] {
  const x =
    T <= 7000
      ? -4.607e9 / T ** 3 + 2.9678e6 / T ** 2 + 0.09911e3 / T + 0.244063
      : -2.0064e9 / T ** 3 + 1.9018e6 / T ** 2 + 0.24748e3 / T + 0.23704;
  const y = -3 * x * x + 2.87 * x - 0.275;
  return [x, y];
}

export const D65_XY: [number, number] = [0.3127, 0.329];

const xyToXyz = ([x, y]: [number, number]): Vec3 => [x / y, 1, (1 - x - y) / y];

export function presetWhite(p: LightingPreset): Vec3 {
  if (p.cct === null) return xyToXyz(D65_XY);
  return xyToXyz(p.daylight ? daylightXy(p.cct) : planckianXy(p.cct));
}

const BRADFORD = [
  [0.8951, 0.2664, -0.1614],
  [-0.7502, 1.7135, 0.0367],
  [0.0389, -0.0685, 1.0296],
];
const BRADFORD_INV = [
  [0.9869929, -0.1470543, 0.1599627],
  [0.4323053, 0.5183603, 0.0492912],
  [-0.0085287, 0.0400428, 0.9684867],
];

const mul = (m: number[][], v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

/** Bradford chromatic adaptation of XYZ from one white point to another. */
export function bradford(xyz: Vec3, from: Vec3, to: Vec3): Vec3 {
  const s = mul(BRADFORD, from);
  const d = mul(BRADFORD, to);
  const c = mul(BRADFORD, xyz);
  return mul(BRADFORD_INV, [(c[0] * d[0]) / s[0], (c[1] * d[1]) / s[1], (c[2] * d[2]) / s[2]]);
}

export interface LightingView {
  preset: LightingPreset;
  /** 0 = eye does not adapt (full color cast), 1 = fully adapted (looks like daylight). */
  adaptation: number;
}

/**
 * Build a renderer for one lighting view. All swatches go through the same transform and the
 * same brightness normalization, so they shift consistently.
 */
export function makeRenderer(view: LightingView): (lab: OKLab) => string {
  const D65 = xyToXyz(D65_XY);
  if (view.preset.cct === null || view.adaptation >= 1) {
    return (lab) => rgbToHex(linearToRgb(oklabToLinear(lab)));
  }
  const W = presetWhite(view.preset);
  const k = Math.min(1, Math.max(0, view.adaptation));
  // Perceived white: partway between the light's white and D65, by how much the eye adapts.
  const seen: Vec3 = [W[0] + (D65[0] - W[0]) * k, 1, W[2] + (D65[2] - W[2]) * k];
  // Scale so a perfect white still fits on screen (no channel above 1).
  const whiteLin = xyzToLinear(bradford(D65, D65, seen));
  const scale = 1 / Math.max(...whiteLin, 1);
  return (lab) => {
    const xyz = bradford(linearToXyz(oklabToLinear(lab)), D65, seen);
    const lin = xyzToLinear(xyz).map((c) => clamp01(c * scale)) as Vec3;
    return rgbToHex(linearToRgb(lin));
  };
}
