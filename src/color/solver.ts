/**
 * The locking solver.
 *
 * When the user moves one slider to a target value, find the OKLab color that
 *   1. hits the moved slider's target,
 *   2. keeps every locked slider at its locked value,
 *   3. stays inside the sRGB gamut,
 *   4. otherwise changes as little as possible from the previous color (OKLab distance).
 *
 * This is a 3-variable penalty problem solved with Nelder–Mead. Locks and gamut get much
 * larger weights than the moved target, so when the constraints conflict the solver keeps
 * the locks and lands the moved slider at the nearest achievable value ("limited by locks").
 */
import { clampOklab, oklabToRgb, type OKLab } from './convert';
import { SLIDER_BY_ID, sliderDiff, type SliderId } from './sliders';

export type Locks = Partial<Record<SliderId, number>>;

export interface SolveResult {
  lab: OKLab;
  /** Value the moved slider actually reached. */
  achieved: number;
  /** True when locks/gamut prevented reaching the target. */
  limited: boolean;
}

const W_TARGET = 1e5;
const W_LOCK = 1e9;
const W_GAMUT = 1e9;

type Fn = (x: OKLab) => number;

/** Nelder–Mead minimizer for 3 variables. */
export function nelderMead(f: Fn, start: OKLab, step: number, maxIter = 500, tol = 1e-13): { x: OKLab; fx: number } {
  const n = 3;
  const pts: OKLab[] = [start.slice() as OKLab];
  for (let i = 0; i < n; i++) {
    const p = start.slice() as OKLab;
    p[i] += step;
    pts.push(p);
  }
  let vals = pts.map(f);
  const order = () => {
    const idx = [0, 1, 2, 3].sort((a, b) => vals[a] - vals[b]);
    const p2 = idx.map((i) => pts[i]);
    const v2 = idx.map((i) => vals[i]);
    for (let i = 0; i <= n; i++) {
      pts[i] = p2[i];
    }
    vals = v2;
  };
  const comb = (a: OKLab, b: OKLab, t: number): OKLab => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];

  for (let iter = 0; iter < maxIter; iter++) {
    order();
    const spread = Math.abs(vals[n] - vals[0]);
    let size = 0;
    for (let i = 1; i <= n; i++) {
      size = Math.max(size, Math.abs(pts[i][0] - pts[0][0]), Math.abs(pts[i][1] - pts[0][1]), Math.abs(pts[i][2] - pts[0][2]));
    }
    if (spread <= tol * (Math.abs(vals[0]) + 1e-30) || size < 1e-12) break;

    const c: OKLab = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += pts[i][k] / n;
    const worst = pts[n];
    const xr = comb(c, worst, -1);
    const fr = f(xr);
    if (fr < vals[0]) {
      const xe = comb(c, worst, -2);
      const fe = f(xe);
      if (fe < fr) {
        pts[n] = xe;
        vals[n] = fe;
      } else {
        pts[n] = xr;
        vals[n] = fr;
      }
    } else if (fr < vals[n - 1]) {
      pts[n] = xr;
      vals[n] = fr;
    } else {
      const outside = fr < vals[n];
      const xc = outside ? comb(c, xr, 0.5) : comb(c, worst, 0.5);
      const fc = f(xc);
      if (fc < (outside ? fr : vals[n])) {
        pts[n] = xc;
        vals[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          pts[i] = comb(pts[0], pts[i], 0.5);
          vals[i] = f(pts[i]);
        }
      }
    }
  }
  order();
  return { x: pts[0], fx: vals[0] };
}

function gamutPenalty(lab: OKLab): number {
  const rgb = oklabToRgb(lab);
  let p = 0;
  for (const c of rgb) {
    if (c < 0) p += c * c;
    else if (c > 1) p += (c - 1) * (c - 1);
  }
  // Keep L in a sane range too (outside it the cube-root inversion misbehaves).
  if (lab[0] < 0) p += lab[0] * lab[0];
  if (lab[0] > 1) p += (lab[0] - 1) ** 2;
  return p;
}

function normResidual(id: SliderId, lab: OKLab, target: number): number {
  const def = SLIDER_BY_ID[id];
  return sliderDiff(def, def.get(lab), target) / (def.max - def.min);
}

/** Minimize with restarts from several starting points; returns the best point. */
function minimize(f: Fn, starts: OKLab[]): OKLab {
  let best: { x: OKLab; fx: number } | null = null;
  for (const s of starts) {
    let r = nelderMead(f, s, 0.03);
    // Restarts with shrinking simplexes escape the premature collapse NM is prone to.
    for (const step of [0.01, 0.002, 3e-4, 5e-5]) {
      const r2 = nelderMead(f, r.x, step);
      const gain = r.fx - r2.fx;
      if (r2.fx <= r.fx) r = r2;
      // A restart that barely helps means we're at the minimum; skip the finer ones.
      if (gain <= 1e-9 * Math.max(r.fx, 1e-12)) break;
    }
    if (!best || r.fx < best.fx) best = r;
  }
  return best!.x;
}

/** Tolerance for "target reached", in slider units. */
export function targetTolerance(id: SliderId): number {
  const def = SLIDER_BY_ID[id];
  return Math.max(def.step / 2, (def.max - def.min) * 5e-4);
}

export function solve(prev: OKLab, moved: SliderId, target: number, locks: Locks): SolveResult {
  const def = SLIDER_BY_ID[moved];
  const t = def.angular ? ((target % 360) + 360) % 360 : Math.min(def.max, Math.max(def.min, target));
  const lockEntries = (Object.entries(locks) as [SliderId, number][]).filter(([id, v]) => id !== moved && v !== undefined);

  const objective = (wLock: number, withLocks: boolean): Fn => (x) => {
    const d0 = x[0] - prev[0];
    const d1 = x[1] - prev[1];
    const d2 = x[2] - prev[2];
    const rt = normResidual(moved, x, t);
    let s = d0 * d0 + d1 * d1 + d2 * d2 + W_TARGET * rt * rt + W_GAMUT * (wLock / W_LOCK) * gamutPenalty(x);
    if (withLocks) {
      for (const [id, v] of lockEntries) {
        const r = normResidual(id, x, v);
        s += wLock * r * r;
      }
    }
    return s;
  };
  const satisfied = (x: OKLab) =>
    gamutPenalty(x) < 1e-12 &&
    lockEntries.every(([id, v]) => Math.abs(sliderDiff(SLIDER_BY_ID[id], SLIDER_BY_ID[id].get(x), v)) < targetTolerance(id) / 5);

  // Start points: the previous color, and the best color ignoring locks.
  let x = minimize(objective(W_LOCK, false), [prev]);
  if (lockEntries.length) {
    let starts = [prev, x];
    // Exterior penalty continuation: if the locks or the gamut are still violated (the moved
    // target is pulling hard against them), stiffen those penalties and re-solve.
    for (let w = W_LOCK; w <= W_LOCK * 1e6; w *= 100) {
      x = minimize(objective(w, true), starts);
      if (satisfied(x)) break;
      starts = [x];
    }
  } else if (!satisfied(x)) {
    x = minimize(objective(W_LOCK * 1e4, false), [x]);
  }
  const lab = clampOklab(x);
  const achieved = def.get(lab);
  const limited = Math.abs(sliderDiff(def, achieved, t)) > targetTolerance(moved);
  return { lab, achieved, limited };
}
