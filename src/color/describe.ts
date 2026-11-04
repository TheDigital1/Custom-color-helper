/**
 * Describe the difference between a named paint and the target color in words a paint
 * store can act on ("about 10% lighter, slightly warmer, a little grayer").
 */
import { approxLrv, oklabToLch, type OKLab } from './convert';
import { SLIDER_BY_ID } from './sliders';

/** OKLCH hue angles of common color names, in order around the wheel. */
export const HUE_NAMES: [number, string][] = [
  [8, 'pink'],
  [30, 'red'],
  [55, 'orange'],
  [95, 'yellow'],
  [135, 'green'],
  [195, 'teal'],
  [255, 'blue'],
  [305, 'violet'],
];

/** Name of the next hue reached when moving from `h` in direction `dir` (+1 or −1). */
export function hueToward(h: number, dir: 1 | -1): string {
  let best = HUE_NAMES[0][1];
  let bestAhead = Infinity;
  for (const [angle, name] of HUE_NAMES) {
    // Degrees travelled from h to this name's angle, going in direction dir.
    const ahead = ((((angle - h) * dir) % 360) + 360) % 360;
    if (ahead > 5 && ahead < bestAhead) {
      bestAhead = ahead;
      best = name;
    }
  }
  return best;
}

const degree = (x: number, small: number, large: number) => (x < small ? 'slightly' : x < large ? 'noticeably' : 'much');

export interface Adjustment {
  /** Short phrases, e.g. "about 12% lighter (LRV 70 → 78)". */
  phrases: string[];
  /** True when the difference is too small to describe. */
  same: boolean;
}

export function describeAdjustment(from: OKLab, to: OKLab): Adjustment {
  const phrases: string[] = [];
  const l0 = approxLrv(from);
  const l1 = approxLrv(to);
  const dl = l1 - l0;
  if (Math.abs(dl) >= 0.5) {
    const pct = Math.round((Math.abs(dl) / Math.max(l0, 1)) * 100);
    phrases.push(`about ${pct}% ${dl > 0 ? 'lighter' : 'darker'} (approx. LRV ${l0.toFixed(0)} → ${l1.toFixed(0)})`);
  }
  const warmth = SLIDER_BY_ID.warmth;
  const dw = warmth.get(to) - warmth.get(from);
  if (Math.abs(dw) >= 0.3) phrases.push(`${degree(Math.abs(dw), 1, 3)} ${dw > 0 ? 'warmer' : 'cooler'}`);

  const c0 = oklabToLch(from);
  const c1 = oklabToLch(to);
  const dc = (c1.c - c0.c) * 100;
  if (Math.abs(dc) >= 0.3) phrases.push(`${degree(Math.abs(dc), 1, 3)} ${dc > 0 ? 'cleaner / more saturated' : 'grayer / more muted'}`);

  if (c0.c > 0.02 && c1.c > 0.02) {
    let dh = c1.h - c0.h;
    dh = ((((dh + 180) % 360) + 360) % 360) - 180;
    if (Math.abs(dh) >= 3) phrases.push(`hue shifted ${degree(Math.abs(dh), 8, 20)} toward ${hueToward(c0.h, dh > 0 ? 1 : -1)}`);
  }
  return { phrases, same: phrases.length === 0 };
}
