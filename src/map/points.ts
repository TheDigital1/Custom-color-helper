/** Flattened paint positions for the map, built once from the loaded brands. */
import type { LoadedBrand } from '../data/store';
import { sliceRange, toWorld, type Slice } from './geometry';

export interface MapPoints {
  count: number;
  x: Float32Array;
  y: Float32Array;
  /** OKLab L, for lightness slicing. */
  L: Float32Array;
  brand: string[];
  index: Uint32Array;
  /** CSS color of each dot. */
  color: string[];
  label: string[];
}

export function buildPoints(brands: LoadedBrand[]): MapPoints {
  const count = brands.reduce((n, b) => n + b.count, 0);
  const p: MapPoints = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    L: new Float32Array(count),
    brand: new Array(count),
    index: new Uint32Array(count),
    color: new Array(count),
    label: new Array(count),
  };
  let k = 0;
  for (const b of brands) {
    for (let i = 0; i < b.count; i++, k++) {
      const lab: [number, number, number] = [b.oklabF[i * 3], b.oklabF[i * 3 + 1], b.oklabF[i * 3 + 2]];
      const [x, y] = toWorld(lab);
      p.x[k] = x;
      p.y[k] = y;
      p.L[k] = lab[0];
      p.brand[k] = b.id;
      p.index[k] = i;
      p.color[k] = '#' + b.hex[i];
      p.label[k] = b.names[i];
    }
  }
  return p;
}

/** Point ids inside a lightness slice. */
export function sliceIds(p: MapPoints, s: Slice): Uint32Array {
  const [lo, hi] = sliceRange(s);
  const out: number[] = [];
  for (let i = 0; i < p.count; i++) if (p.L[i] >= lo && p.L[i] <= hi) out.push(i);
  return Uint32Array.from(out);
}

export function findPoint(p: MapPoints, brand: string, index: number): number {
  for (let i = 0; i < p.count; i++) if (p.index[i] === index && p.brand[i] === brand) return i;
  return -1;
}
