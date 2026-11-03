/**
 * Slider definitions. Every slider is a pure function of the working color (OKLab);
 * the solver moves the color so that sliders hit their targets.
 */
import { approxLrv, oklabToRgb, type OKLab } from './convert';

export type SliderId =
  | 'lrv'
  | 'lightness'
  | 'warmth'
  | 'hue'
  | 'chroma'
  | 'red'
  | 'green'
  | 'blue'
  | 'pullGreen'
  | 'pullPink'
  | 'pullYellow'
  | 'pullBlue';

export type SliderGroup = 'main' | 'rgb' | 'undertone';

export interface SliderDef {
  id: SliderId;
  label: string;
  /** Short explanation shown under the label. */
  hint: string;
  group: SliderGroup;
  min: number;
  max: number;
  step: number;
  /** Amount the − / + buttons move the slider. */
  nudge: number;
  decimals: number;
  /** Hue wraps around at 360. */
  angular?: boolean;
  get(lab: OKLab): number;
}

/** Projection of OKLab (a, b) onto a unit vector at the given OKLCH hue, ×100. */
function projection(hueDeg: number) {
  const r = (hueDeg * Math.PI) / 180;
  const ux = Math.cos(r);
  const uy = Math.sin(r);
  return (lab: OKLab) => (lab[1] * ux + lab[2] * uy) * 100;
}

/** Warm direction: orange-yellow, OKLCH hue ≈ 70°. */
export const WARM_HUE = 70;
/** Undertone pull directions (OKLCH hue angles of typical undertones). */
export const UNDERTONE_HUES = { pullGreen: 145, pullPink: 0, pullYellow: 100, pullBlue: 250 } as const;

const hueOf = (lab: OKLab) => {
  let h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  if (h < 0) h += 360;
  return h;
};

const rgbChannel = (k: 0 | 1 | 2) => (lab: OKLab) => oklabToRgb(lab)[k] * 255;

export const SLIDERS: SliderDef[] = [
  { id: 'lrv', label: 'LRV', hint: 'approx. light reflectance (Y × 100)', group: 'main', min: 0, max: 100, step: 0.1, nudge: 1, decimals: 1, get: approxLrv },
  { id: 'lightness', label: 'Lightness', hint: 'perceptual lightness (OKLCH L)', group: 'main', min: 0, max: 100, step: 0.1, nudge: 1, decimals: 1, get: (l) => l[0] * 100 },
  { id: 'warmth', label: 'Warmth', hint: 'cool ← → warm', group: 'main', min: -30, max: 30, step: 0.1, nudge: 0.5, decimals: 1, get: projection(WARM_HUE) },
  { id: 'hue', label: 'Hue', hint: 'OKLCH hue angle', group: 'main', min: 0, max: 360, step: 0.5, nudge: 2, decimals: 1, angular: true, get: hueOf },
  { id: 'chroma', label: 'Chroma', hint: 'muddy ← → clean', group: 'main', min: 0, max: 37, step: 0.1, nudge: 0.5, decimals: 1, get: (l) => Math.hypot(l[1], l[2]) * 100 },
  { id: 'red', label: 'Red', hint: 'sRGB channel', group: 'rgb', min: 0, max: 255, step: 1, nudge: 1, decimals: 0, get: rgbChannel(0) },
  { id: 'green', label: 'Green', hint: 'sRGB channel', group: 'rgb', min: 0, max: 255, step: 1, nudge: 1, decimals: 0, get: rgbChannel(1) },
  { id: 'blue', label: 'Blue', hint: 'sRGB channel', group: 'rgb', min: 0, max: 255, step: 1, nudge: 1, decimals: 0, get: rgbChannel(2) },
  { id: 'pullGreen', label: 'Green pull', hint: 'toward a green undertone', group: 'undertone', min: -30, max: 30, step: 0.1, nudge: 0.25, decimals: 1, get: projection(UNDERTONE_HUES.pullGreen) },
  { id: 'pullPink', label: 'Pink/red pull', hint: 'toward a pink/red undertone', group: 'undertone', min: -30, max: 30, step: 0.1, nudge: 0.25, decimals: 1, get: projection(UNDERTONE_HUES.pullPink) },
  { id: 'pullYellow', label: 'Yellow pull', hint: 'toward a yellow undertone', group: 'undertone', min: -30, max: 30, step: 0.1, nudge: 0.25, decimals: 1, get: projection(UNDERTONE_HUES.pullYellow) },
  { id: 'pullBlue', label: 'Blue pull', hint: 'toward a blue undertone', group: 'undertone', min: -30, max: 30, step: 0.1, nudge: 0.25, decimals: 1, get: projection(UNDERTONE_HUES.pullBlue) },
];

export const SLIDER_BY_ID = Object.fromEntries(SLIDERS.map((s) => [s.id, s])) as Record<SliderId, SliderDef>;

/** Signed difference value − target, wrapping for angular sliders. */
export function sliderDiff(def: SliderDef, value: number, target: number): number {
  let d = value - target;
  if (def.angular) {
    d = ((((d + 180) % 360) + 360) % 360) - 180;
  }
  return d;
}

export function sliderValues(lab: OKLab): Record<SliderId, number> {
  const out = {} as Record<SliderId, number>;
  for (const s of SLIDERS) out[s.id] = s.get(lab);
  return out;
}
