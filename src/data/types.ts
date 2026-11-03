/** Shapes of the processed data emitted by scripts/build-data.ts and read by the app. */

export interface SourceInfo {
  id: string;
  name: string;
  url: string;
  license: string;
  licenseUrl?: string;
  /** Date the snapshot was taken or downloaded (YYYY-MM-DD). */
  snapshot: string;
}

export interface BrandSummary {
  id: string;
  name: string;
  count: number;
  /** File name relative to the data directory. */
  file: string;
  /** IDs of sources that contributed colors to this brand. */
  sources: string[];
}

export interface DataIndex {
  formatVersion: 1;
  generatedAt: string;
  sources: SourceInfo[];
  brands: BrandSummary[];
  total: number;
  /** Brand IDs the plan cares about and whether each is present in the data. */
  expectedBrands: Record<string, boolean>;
}

/** One brand's colors as parallel arrays (compact JSON). */
export interface BrandFile {
  id: string;
  name: string;
  count: number;
  names: string[];
  codes: string[];
  /** 6-digit lowercase hex without '#'. */
  hex: string[];
  /** Manufacturer-published LRV, or null when not published. */
  lrv: (number | null)[];
  /** CIELAB (D65), packed [L, a, b, L, a, b, ...]. */
  lab: number[];
  /** OKLab, packed. */
  oklab: number[];
  /** Relative luminance Y × 100 (computed "approx. LRV"). */
  y: number[];
  /** Index into DataIndex.sources for each color. */
  src: number[];
  /** Optional descriptive fields from the source ('' when missing). */
  family?: string[];
  undertone?: string[];
  /**
   * When the same color appears in more than one source with a different hex,
   * the other sources' values: color index → [{source index, hex}].
   */
  altHex?: Record<string, { src: number; hex: string }[]>;
}
