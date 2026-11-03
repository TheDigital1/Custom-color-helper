/** Nearest-paint search: brute-force CIEDE2000 over packed CIELAB arrays. */
import { ciede2000 } from './ciede2000';
import type { Vec3 } from './convert';

export interface MatchSource {
  id: string;
  count: number;
  /** Packed CIELAB (D65). */
  labF: Float32Array;
}

export interface Match {
  brand: string;
  index: number;
  de: number;
}

export interface MatchResult {
  /** Best matches across all searched brands, closest first. */
  overall: Match[];
  /** Best matches per brand, closest first. */
  byBrand: Record<string, Match[]>;
  /** Milliseconds the search took. */
  ms: number;
}

/** Insert into a small sorted top-k list. */
function insert(list: Match[], m: Match, k: number) {
  if (list.length === k && m.de >= list[k - 1].de) return;
  let i = list.length;
  if (i === k) i--;
  while (i > 0 && list[i - 1].de > m.de) {
    list[i] = list[i - 1];
    i--;
  }
  list[i] = m;
}

export function findMatches(
  brands: MatchSource[],
  lab: Vec3,
  opts: { perBrand?: number; overall?: number; exclude?: { brand: string; index: number } | null } = {},
): MatchResult {
  const t0 = performance.now();
  const perBrand = opts.perBrand ?? 3;
  const overallK = opts.overall ?? 5;
  const [L, a, b] = lab;
  const overall: Match[] = [];
  const byBrand: Record<string, Match[]> = {};
  for (const br of brands) {
    const list: Match[] = [];
    const arr = br.labF;
    const skip = opts.exclude && opts.exclude.brand === br.id ? opts.exclude.index : -1;
    // Worst ΔE kept so far for this brand; anything with a lightness gap larger than ~2× that
    // cannot win, which skips most of the expensive CIEDE2000 evaluations.
    for (let i = 0; i < br.count; i++) {
      if (i === skip) continue;
      const j = i * 3;
      const Li = arr[j];
      if (list.length === perBrand && overall.length === overallK) {
        const bound = Math.max(list[perBrand - 1].de, overall[overallK - 1].de);
        // |ΔL'| / S_L ≤ ΔE00 and S_L ≤ 1.8 for L in [0,100], so |ΔL| > 1.8·bound can be skipped.
        if (Math.abs(Li - L) > 1.8 * bound) continue;
      }
      const de = ciede2000(L, a, b, Li, arr[j + 1], arr[j + 2]);
      const m = { brand: br.id, index: i, de };
      insert(list, m, perBrand);
      insert(overall, m, overallK);
    }
    byBrand[br.id] = list;
  }
  return { overall, byBrand, ms: performance.now() - t0 };
}
