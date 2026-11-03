/**
 * Percentage-strength formulas.
 *
 * Paint stores can mix any named color at a reduced (or increased) strength: the same
 * colorants in the same base, but e.g. 75% of the amount. Lower strength is lighter and
 * softer; higher strength is deeper.
 *
 * Model (single-constant Kubelka–Munk, per linear-RGB channel as a stand-in for spectra):
 * K/S of a paint is roughly the base's K/S plus colorant concentration × colorant K/S, so
 *   KS(p) = KS_base + p · (KS_paint − KS_base).
 * It's an approximation (real paints have spectra and deep colors use different bases),
 * so results are a starting point to bring to the store, not a formula.
 */
import { ciede2000 } from './ciede2000';
import { linearToOklab, oklabToLab, oklabToLinear, type OKLab, type Vec3 } from './convert';

/** Linear reflectance of a typical white (pastel) tint base, LRV ≈ 90. */
export const BASE_REFLECTANCE = 0.9;
export const MIN_STRENGTH = 0.25;
/** Stores rarely go above 150%; deep colors need a different base instead. */
export const MAX_STRENGTH = 1.5;
/** Stores take whole percentages; we suggest 5% steps. */
export const STRENGTH_STEP = 0.05;

const R_MIN = 1e-4;
const ks = (r: number) => {
  const R = Math.min(Math.max(r, R_MIN), 1);
  return ((1 - R) * (1 - R)) / (2 * R);
};
/** Inverse of ks(): reflectance from K/S. */
const reflectance = (k: number) => {
  const K = Math.max(k, 0);
  return 1 + K - Math.sqrt(K * K + 2 * K);
};
const KS_BASE = ks(BASE_REFLECTANCE);

export function paintKs(lab: OKLab): Vec3 {
  const lin = oklabToLinear(lab);
  return [ks(lin[0]), ks(lin[1]), ks(lin[2])];
}

/** The color of `lab` mixed at strength p (1 = as sold). */
export function atStrength(lab: OKLab, p: number): OKLab {
  const k = paintKs(lab);
  const lin = k.map((c) => reflectance(KS_BASE + p * (c - KS_BASE))) as Vec3;
  return linearToOklab(lin);
}

export interface StrengthSource {
  id: string;
  count: number;
  oklabF: Float32Array;
  /** Cached K/S − KS_base per color (filled on first use). */
  ksF?: Float32Array;
}

export interface StrengthFormula {
  brand: string;
  index: number;
  /** Strength as a fraction (0.75 = 75%), rounded to STRENGTH_STEP. */
  strength: number;
  /** Predicted color at that strength. */
  lab: OKLab;
  /** CIEDE2000 between the predicted color and the target. */
  de: number;
}

function ksArray(b: StrengthSource): Float32Array {
  if (!b.ksF) {
    const out = new Float32Array(b.count * 3);
    for (let i = 0; i < b.count; i++) {
      const k = paintKs([b.oklabF[i * 3], b.oklabF[i * 3 + 1], b.oklabF[i * 3 + 2]]);
      out[i * 3] = k[0] - KS_BASE;
      out[i * 3 + 1] = k[1] - KS_BASE;
      out[i * 3 + 2] = k[2] - KS_BASE;
    }
    b.ksF = out;
  }
  return b.ksF;
}

const roundStrength = (p: number) => Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, Math.round(p / STRENGTH_STEP) * STRENGTH_STEP));

/**
 * Find named paints that, mixed at some strength other than 100%, come closest to the target.
 * Stage 1 ranks every paint by how parallel its colorant K/S is to the target's (cheap, closed
 * form); stage 2 checks the best candidates with CIEDE2000 at store-friendly 5% steps.
 */
export function findStrengthFormulas(
  brands: StrengthSource[],
  target: OKLab,
  opts: { limit?: number; candidates?: number; maxDe?: number } = {},
): StrengthFormula[] {
  const limit = opts.limit ?? 3;
  const nCand = opts.candidates ?? 40;
  const tk = paintKs(target);
  const t0 = tk[0] - KS_BASE;
  const t1 = tk[1] - KS_BASE;
  const t2 = tk[2] - KS_BASE;
  const tNorm = Math.hypot(t0, t1, t2);
  // A target as light as the base (or lighter) can't be made by changing colorant strength.
  if (tNorm < 1e-4 || t0 < -1e-3 || t1 < -1e-3 || t2 < -1e-3) return [];

  type Cand = { brand: string; index: number; p: number; resid: number };
  const cands: Cand[] = [];
  let worst = Infinity;
  for (const b of brands) {
    const d = ksArray(b);
    for (let i = 0; i < b.count; i++) {
      const d0 = d[i * 3];
      const d1 = d[i * 3 + 1];
      const d2 = d[i * 3 + 2];
      const dd = d0 * d0 + d1 * d1 + d2 * d2;
      if (dd < 1e-8) continue;
      const p = (d0 * t0 + d1 * t1 + d2 * t2) / dd;
      if (p < MIN_STRENGTH - STRENGTH_STEP || p > MAX_STRENGTH + STRENGTH_STEP) continue;
      // Score at the store-rounded strengths next to p (never 100%): strong colorants are very
      // sensitive to a 5% step, so ranking by the unrounded p would favor useless candidates.
      let r = Infinity;
      let pBest = p;
      const lo = Math.floor(p / STRENGTH_STEP) * STRENGTH_STEP;
      for (const q of [lo, lo + STRENGTH_STEP]) {
        const pr = roundStrength(q);
        if (Math.abs(pr - 1) < STRENGTH_STEP / 2) continue;
        const rr = Math.hypot(t0 - pr * d0, t1 - pr * d1, t2 - pr * d2) / tNorm;
        if (rr < r) {
          r = rr;
          pBest = pr;
        }
      }
      if (r === Infinity) continue;
      if (cands.length >= nCand && r >= worst) continue;
      cands.push({ brand: b.id, index: i, p: pBest, resid: r });
      if (cands.length > nCand * 2) {
        cands.sort((a, c) => a.resid - c.resid);
        cands.length = nCand;
        worst = cands[nCand - 1].resid;
      }
    }
  }
  cands.sort((a, c) => a.resid - c.resid);
  cands.length = Math.min(cands.length, nCand);

  const tl = oklabToLab(target);
  const byId = new Map(brands.map((b) => [b.id, b]));
  const results: StrengthFormula[] = [];
  for (const c of cands) {
    const b = byId.get(c.brand)!;
    const paint: OKLab = [b.oklabF[c.index * 3], b.oklabF[c.index * 3 + 1], b.oklabF[c.index * 3 + 2]];
    // Check the rounded strength and its neighbors; keep the best.
    let best: StrengthFormula | null = null;
    const center = roundStrength(c.p);
    for (const p of [center - STRENGTH_STEP, center, center + STRENGTH_STEP]) {
      const pr = roundStrength(p);
      if (Math.abs(pr - 1) < STRENGTH_STEP / 2) continue;
      const lab = atStrength(paint, pr);
      const l = oklabToLab(lab);
      const de = ciede2000(tl[0], tl[1], tl[2], l[0], l[1], l[2]);
      if (!best || de < best.de) best = { brand: c.brand, index: c.index, strength: Math.round(pr * 100) / 100, lab, de };
    }
    if (best) results.push(best);
  }
  results.sort((a, c) => a.de - c.de);
  // One suggestion per paint, and at most two per brand so other brands get a look in.
  const perBrand = new Map<string, number>();
  const out: StrengthFormula[] = [];
  for (const r of results) {
    if (r.de > (opts.maxDe ?? 3)) break;
    const n = perBrand.get(r.brand) ?? 0;
    if (n >= 2) continue;
    perBrand.set(r.brand, n + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
