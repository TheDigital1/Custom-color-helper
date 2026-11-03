import type { BrandFile, DataIndex } from './types';
import type { OKLab } from '../color/convert';

export interface LoadedBrand extends BrandFile {
  labF: Float32Array;
  oklabF: Float32Array;
  /** Lowercased "name code" for search. */
  searchText: string[];
}

/** A reference to one named paint. */
export interface PaintRef {
  brand: string;
  index: number;
}

export interface PaintInfo extends PaintRef {
  brandName: string;
  name: string;
  code: string;
  hex: string;
  lrv: number | null;
  approxLrv: number;
  oklab: OKLab;
  source: string;
  family: string;
  undertone: string;
  altHex: { source: string; hex: string }[];
}

const dataUrl = (name: string) => new URL(`data/${name}`, document.baseURI).toString();

let indexPromise: Promise<DataIndex> | null = null;
const brandPromises = new Map<string, Promise<LoadedBrand>>();
const loaded = new Map<string, LoadedBrand>();
let indexValue: DataIndex | null = null;

export function loadIndex(): Promise<DataIndex> {
  indexPromise ??= fetch(dataUrl('index.json'))
    .then((r) => {
      if (!r.ok) throw new Error(`Could not load color data (${r.status}).`);
      return r.json() as Promise<DataIndex>;
    })
    .then((idx) => (indexValue = idx));
  return indexPromise;
}

export function prepareBrand(file: BrandFile): LoadedBrand {
  return {
    ...file,
    labF: Float32Array.from(file.lab),
    oklabF: Float32Array.from(file.oklab),
    searchText: file.names.map((n, i) => `${n} ${file.codes[i]}`.toLowerCase()),
  };
}

export function loadBrand(id: string): Promise<LoadedBrand> {
  let p = brandPromises.get(id);
  if (!p) {
    p = loadIndex().then(async (idx) => {
      const summary = idx.brands.find((b) => b.id === id);
      if (!summary) throw new Error(`Unknown brand ${id}`);
      const r = await fetch(dataUrl(summary.file));
      if (!r.ok) throw new Error(`Could not load ${summary.name} (${r.status}).`);
      const brand = prepareBrand((await r.json()) as BrandFile);
      loaded.set(id, brand);
      return brand;
    });
    p.catch(() => brandPromises.delete(id));
    brandPromises.set(id, p);
  }
  return p;
}

export const loadedBrands = (): LoadedBrand[] => [...loaded.values()];
/** Number of data sources; per-color sources are only worth showing when there are several. */
export const sourceCount = () => indexValue?.sources.length ?? 1;
export const getLoadedBrand = (id: string) => loaded.get(id);

/** Register brand data directly (tests). */
export function registerBrand(b: LoadedBrand, index?: DataIndex) {
  loaded.set(b.id, b);
  brandPromises.set(b.id, Promise.resolve(b));
  if (index) {
    indexValue = index;
    indexPromise = Promise.resolve(index);
  }
}

export function paintInfo(ref: PaintRef): PaintInfo | null {
  const b = loaded.get(ref.brand);
  if (!b || ref.index < 0 || ref.index >= b.count) return null;
  const i = ref.index;
  const sources = indexValue?.sources ?? [];
  return {
    ...ref,
    brandName: b.name,
    name: b.names[i],
    code: b.codes[i],
    hex: '#' + b.hex[i],
    lrv: b.lrv[i],
    approxLrv: b.y[i],
    oklab: [b.oklabF[i * 3], b.oklabF[i * 3 + 1], b.oklabF[i * 3 + 2]],
    source: sources[b.src[i]]?.name ?? '',
    family: b.family?.[i] ?? '',
    undertone: b.undertone?.[i] ?? '',
    altHex: (b.altHex?.[i] ?? []).map((a) => ({ source: sources[a.src]?.name ?? '?', hex: '#' + a.hex })),
  };
}

/** Stable, URL-friendly ID for a paint: brand + code (or name). */
export function paintKey(ref: PaintRef): string {
  const b = loaded.get(ref.brand);
  if (!b) return `${ref.brand}:${ref.index}`;
  return `${ref.brand}:${b.codes[ref.index] || b.names[ref.index]}`;
}

/** Resolve a paintKey back to a ref. Loads the brand if needed. */
export async function resolvePaintKey(key: string): Promise<PaintRef | null> {
  const sep = key.indexOf(':');
  if (sep < 0) return null;
  const brandId = key.slice(0, sep);
  const ident = key.slice(sep + 1);
  try {
    const b = await loadBrand(brandId);
    let i = b.codes.indexOf(ident);
    if (i < 0) i = b.names.indexOf(ident);
    return i >= 0 ? { brand: brandId, index: i } : null;
  } catch {
    return null;
  }
}
