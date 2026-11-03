/** Slider-by-slider differences between two colors (B − A). */
import { oklabToLch, type OKLab } from './convert';
import { SLIDERS, sliderDiff, type SliderDef } from './sliders';

export interface DiffRow {
  def: SliderDef;
  a: number;
  b: number;
  /** B − A (wrapped to −180..180 for hue); null when not meaningful (hue of a near-gray). */
  diff: number | null;
}

/** Below this OKLCH chroma a color is essentially gray and its hue angle is noise. */
const HUE_MIN_CHROMA = 0.01;

export function diffRows(a: OKLab, b: OKLab): DiffRow[] {
  const grayish = oklabToLch(a).c < HUE_MIN_CHROMA || oklabToLch(b).c < HUE_MIN_CHROMA;
  return SLIDERS.map((def) => {
    const va = def.get(a);
    const vb = def.get(b);
    const diff = def.angular ? (grayish ? null : sliderDiff(def, vb, va)) : vb - va;
    return { def, a: va, b: vb, diff };
  });
}

/** "+1.2", "−3", "0": signed, with a real minus sign, rounded to the slider's decimals. */
export function formatDiff(d: number, decimals: number): string {
  const r = Number(d.toFixed(decimals));
  if (r === 0) return (0).toFixed(decimals);
  return (r > 0 ? '+' : '−') + Math.abs(r).toFixed(decimals);
}
