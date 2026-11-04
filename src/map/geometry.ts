/**
 * Color-wheel layout for the color map.
 *
 * World coordinates are a unit disk: angle = OKLCH hue (0° to the right, counter-clockwise,
 * y up), radius = sqrt(chroma / CHROMA_MAX). The square root gives the crowded low-chroma
 * neutrals (most paints) much more room near the center.
 *
 * Lightness is the third dimension; the map shows one slice of it at a time.
 */
import { clamp01, linearToSrgb, lchToOklab, oklabToLinear, type OKLab } from '../color/convert';

export const CHROMA_MAX = 0.33;

export function toWorld(lab: OKLab): [number, number] {
  const c = Math.hypot(lab[1], lab[2]);
  if (c === 0) return [0, 0];
  const r = Math.sqrt(Math.min(c, CHROMA_MAX) / CHROMA_MAX);
  return [(lab[1] / c) * r, (lab[2] / c) * r];
}

/** Inverse: world point → OKLCH hue (degrees) and chroma. */
export function fromWorld(x: number, y: number): { h: number; c: number } {
  const r = Math.hypot(x, y);
  let h = (Math.atan2(y, x) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { h, c: r * r * CHROMA_MAX };
}

/** OKLab L of a neutral gray with the given LRV (Y × 100). Used for the lightness slice. */
export const lrvToL = (lrv: number) => Math.cbrt(Math.max(0, Math.min(100, lrv)) / 100);
export const lToLrv = (L: number) => L ** 3 * 100;

export interface Slice {
  /** Center of the slice, as LRV. */
  lrv: number;
  /** Half-width in LRV units; Infinity shows every lightness. */
  band: number;
}

/** OKLab L range a slice covers. */
export function sliceRange(s: Slice): [number, number] {
  if (!Number.isFinite(s.band)) return [-Infinity, Infinity];
  return [lrvToL(s.lrv - s.band), lrvToL(s.lrv + s.band)];
}

/**
 * Paint part of the wheel's background into an RGBA buffer: each pixel shows the color at
 * that hue and chroma for the slice's lightness. Colors a screen can't show, and anything
 * outside the disk, are left transparent.
 *
 * (xmin, ymax) is the world point at the top-left pixel; `step` is world units per pixel.
 */
export function renderWheelRect(pw: number, ph: number, xmin: number, ymax: number, step: number, lrv: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(pw * ph * 4);
  const L = lrvToL(lrv);
  for (let py = 0; py < ph; py++) {
    const y = ymax - (py + 0.5) * step;
    for (let px = 0; px < pw; px++) {
      const x = xmin + (px + 0.5) * step;
      if (x * x + y * y > 1) continue;
      const { h, c } = fromWorld(x, y);
      const lin = oklabToLinear(lchToOklab({ l: L, c, h }));
      if (lin[0] < -1e-4 || lin[1] < -1e-4 || lin[2] < -1e-4 || lin[0] > 1.0001 || lin[1] > 1.0001 || lin[2] > 1.0001) continue;
      const i = (py * pw + px) * 4;
      out[i] = Math.round(linearToSrgb(clamp01(lin[0])) * 255);
      out[i + 1] = Math.round(linearToSrgb(clamp01(lin[1])) * 255);
      out[i + 2] = Math.round(linearToSrgb(clamp01(lin[2])) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

/** The whole wheel as a square image covering [-extent, extent]. */
export function renderWheel(size: number, lrv: number, extent = 1.04): Uint8ClampedArray<ArrayBuffer> {
  return renderWheelRect(size, size, -extent, extent, (2 * extent) / size, lrv);
}
