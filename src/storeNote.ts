import { approxLrv, oklabToHex, type OKLab } from './color/convert';
import { deltaELabel } from './color/ciede2000';
import { describeAdjustment } from './color/describe';
import type { PaintInfo } from './data/store';

export interface StoreNoteInput {
  target: OKLab;
  /** The paint the user started from (may be null for a custom start). */
  original: PaintInfo | null;
  nearest: { paint: PaintInfo; de: number } | null;
  formulas: { paint: PaintInfo; strength: number; de: number; lab: OKLab }[];
}

export const paintLabel = (p: PaintInfo) => `${p.brandName} ${p.name}${p.code ? ` (${p.code})` : ''}`;
export const pct = (s: number) => `${Math.round(s * 100)}%`;

/** Which paint to describe the adjustment from: the original, unless it's unrelated. */
export function adjustmentBase(input: StoreNoteInput): PaintInfo | null {
  return input.original ?? input.nearest?.paint ?? null;
}

/** Plain-text note to show or send to a paint store. */
export function storeNoteText(input: StoreNoteInput): string {
  const lines: string[] = [];
  lines.push(`Color I'm looking for: ${oklabToHex(input.target).toUpperCase()} (approx. LRV ${approxLrv(input.target).toFixed(0)})`);
  if (input.nearest) {
    lines.push(`Closest stock paint: ${paintLabel(input.nearest.paint)}, ΔE ${input.nearest.de.toFixed(1)} (${deltaELabel(input.nearest.de)})`);
  }
  for (const f of input.formulas) {
    lines.push(`Or: ${paintLabel(f.paint)} at ${pct(f.strength)} strength (estimated ΔE ${f.de.toFixed(1)})`);
  }
  const base = adjustmentBase(input);
  if (base) {
    const adj = describeAdjustment(base.oklab, input.target);
    if (!adj.same) lines.push(`Compared with ${paintLabel(base)}, I'd like it: ${adj.phrases.join('; ')}.`);
  }
  lines.push('(On-screen estimates from Paint Color Tuner. Please check against a physical sample.)');
  return lines.join('\n');
}
