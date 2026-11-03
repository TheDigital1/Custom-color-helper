import { describe, expect, it } from 'vitest';
import { hexToOklab, inGamut, oklabToRgb, rgbToOklab, type OKLab } from './convert';
import { SLIDER_BY_ID, SLIDERS, sliderDiff, sliderValues, type SliderId } from './sliders';
import { solve, targetTolerance } from './solver';

const alabaster = hexToOklab('#EDEAE0')!;
const val = (id: SliderId, lab: OKLab) => SLIDER_BY_ID[id].get(lab);
const dist = (a: OKLab, b: OKLab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('sliders', () => {
  it('reads Alabaster as a warm, low-chroma off-white', () => {
    const v = sliderValues(alabaster);
    expect(v.lrv).toBeGreaterThan(79);
    expect(v.warmth).toBeGreaterThan(0);
    expect(v.chroma).toBeLessThan(3);
    expect(v.red).toBeCloseTo(237, 3);
    expect(v.green).toBeCloseTo(234, 3);
    expect(v.blue).toBeCloseTo(224, 3);
  });

  it('wraps hue differences', () => {
    expect(sliderDiff(SLIDER_BY_ID.hue, 359, 1)).toBeCloseTo(-2);
    expect(sliderDiff(SLIDER_BY_ID.hue, 1, 359)).toBeCloseTo(2);
  });
});

describe('locking solver', () => {
  it('lock LRV and change warmth → LRV unchanged within 0.1', () => {
    const lrv = val('lrv', alabaster);
    const w0 = val('warmth', alabaster);
    for (const target of [w0 + 3, w0 - 4, w0 + 8]) {
      const r = solve(alabaster, 'warmth', target, { lrv });
      expect(Math.abs(val('lrv', r.lab) - lrv)).toBeLessThan(0.1);
      expect(r.limited).toBe(false);
      expect(Math.abs(r.achieved - target)).toBeLessThan(targetTolerance('warmth'));
    }
  });

  it('lock hue and change chroma → hue unchanged', () => {
    const hue = val('hue', alabaster);
    for (const target of [0.5, 5, 9]) {
      const r = solve(alabaster, 'chroma', target, { hue });
      expect(Math.abs(sliderDiff(SLIDER_BY_ID.hue, val('hue', r.lab), hue))).toBeLessThan(0.5);
      expect(r.achieved).toBeCloseTo(target, 1);
    }
  });

  it('lock several sliders at once', () => {
    const v = sliderValues(alabaster);
    const r = solve(alabaster, 'warmth', v.warmth + 2, { lrv: v.lrv, hue: v.hue });
    expect(Math.abs(val('lrv', r.lab) - v.lrv)).toBeLessThan(0.1);
    expect(Math.abs(sliderDiff(SLIDER_BY_ID.hue, val('hue', r.lab), v.hue))).toBeLessThan(0.5);
    expect(r.achieved).toBeCloseTo(v.warmth + 2, 1);
  });

  it('moves as little as possible without locks', () => {
    const r = solve(alabaster, 'lightness', val('lightness', alabaster) - 5, {});
    // A pure lightness change is the minimal move: a and b stay put.
    expect(r.lab[1]).toBeCloseTo(alabaster[1], 4);
    expect(r.lab[2]).toBeCloseTo(alabaster[2], 4);
    expect(dist(r.lab, alabaster)).toBeCloseTo(0.05, 3);
  });

  it('infeasible: very high LRV locked, blue pushed to 20 → clamps the moved slider', () => {
    // With LRV locked near 95, blue cannot go below ~150 (red and green are already maxed out).
    const start = hexToOklab('#fbfaf5')!;
    const lrv = val('lrv', start);
    const r = solve(start, 'blue', 20, { lrv });
    expect(r.limited).toBe(true);
    expect(Math.abs(val('lrv', r.lab) - lrv)).toBeLessThan(0.1);
    // Blue went as low as it can while keeping the LRV, which is well above 20.
    expect(r.achieved).toBeGreaterThan(20);
    expect(r.achieved).toBeLessThan(val('blue', start));
    // Clamped to the nearest achievable value: no lower blue keeps this LRV in gamut.
    const lower = solve(start, 'blue', r.achieved - 3, { lrv });
    expect(lower.achieved).toBeGreaterThan(r.achieved - 3 + targetTolerance('blue'));
  });

  it('infeasible: all RGB channels locked means nothing can move', () => {
    const v = sliderValues(alabaster);
    const r = solve(alabaster, 'lrv', 50, { red: v.red, green: v.green, blue: v.blue });
    expect(r.limited).toBe(true);
    expect(r.achieved).toBeCloseTo(v.lrv, 0);
  });

  it('results are always in gamut', () => {
    const starts = ['#EDEAE0', '#1f2a44', '#c0392b', '#7a8b6f', '#ffffff', '#000000'].map((h) => hexToOklab(h)!);
    for (const start of starts) {
      for (const s of SLIDERS) {
        for (const frac of [0, 0.5, 1]) {
          const target = s.min + frac * (s.max - s.min);
          const r = solve(start, s.id, target, {});
          const rgb = oklabToRgb(r.lab);
          expect(inGamut(rgb, 1e-5), `${s.id}→${target}: ${rgb}`).toBe(true);
        }
      }
    }
  });

  it('hits RGB targets exactly when free', () => {
    const r = solve(alabaster, 'red', 200, {});
    expect(r.achieved).toBeCloseTo(200, 1);
    expect(r.limited).toBe(false);
  });

  it('is fast enough for live dragging', () => {
    // Simulate a drag: each step starts from the previous result, as the UI does.
    const lrv = val('lrv', alabaster);
    const w0 = val('warmth', alabaster);
    const run = () => {
      let lab = alabaster;
      const t0 = performance.now();
      for (let i = 1; i <= 60; i++) lab = solve(lab, 'warmth', w0 + i * 0.1, { lrv }).lab;
      return (performance.now() - t0) / 60;
    };
    run(); // warm up the JIT
    const per = run();
    // Typically ~1 ms on a laptop; the bound leaves room for slow CI runners.
    expect(per).toBeLessThan(8);
  });
});

describe('locking solver (randomized)', () => {
  it('keeps random locks and stays in gamut for random moves', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ids = SLIDERS.map((s) => s.id);
    for (let i = 0; i < 300; i++) {
      const start = rgbToOklab([0.1 + 0.85 * rnd(), 0.1 + 0.85 * rnd(), 0.1 + 0.85 * rnd()]);
      const moved = ids[Math.floor(rnd() * ids.length)];
      const locks: Partial<Record<SliderId, number>> = {};
      const nLocks = Math.floor(rnd() * 3);
      for (let k = 0; k < nLocks; k++) {
        const id = ids[Math.floor(rnd() * ids.length)];
        if (id !== moved) locks[id] = val(id, start);
      }
      const def = SLIDER_BY_ID[moved];
      const target = def.get(start) + (rnd() - 0.5) * (def.max - def.min) * 0.3;
      const r = solve(start, moved, target, locks);
      expect(inGamut(oklabToRgb(r.lab), 1e-5)).toBe(true);
      for (const [id, v] of Object.entries(locks) as [SliderId, number][]) {
        expect(Math.abs(sliderDiff(SLIDER_BY_ID[id], val(id, r.lab), v))).toBeLessThanOrEqual(targetTolerance(id));
      }
    }
  });
});
