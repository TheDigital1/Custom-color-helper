import { describe, expect, it } from 'vitest';
import { hexToOklab, lchToOklab, oklabToLch } from '../color/convert';
import { fromWorld, lrvToL, lToLrv, renderWheel, sliceRange, toWorld } from './geometry';

describe('color map geometry', () => {
  it('places colors by hue angle and chroma, and inverts', () => {
    for (const hex of ['#EDEAE0', '#c0392b', '#2e86de', '#27ae60', '#808080']) {
      const lab = hexToOklab(hex)!;
      const [x, y] = toWorld(lab);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(1);
      const { h, c } = fromWorld(x, y);
      const lch = oklabToLch(lab);
      expect(c).toBeCloseTo(lch.c, 6);
      if (lch.c > 1e-4) expect(h).toBeCloseTo(lch.h, 4);
    }
    // Neutrals get extra room: chroma 0.02 sits ~25% of the way out, not 6%.
    const [nx] = toWorld(lchToOklab({ l: 0.9, c: 0.02, h: 0 }));
    expect(nx).toBeGreaterThan(0.2);
    expect(toWorld([0.5, 0, 0])).toEqual([0, 0]);
  });

  it('converts LRV slices to OKLab lightness ranges', () => {
    expect(lToLrv(lrvToL(82))).toBeCloseTo(82, 9);
    const [lo, hi] = sliceRange({ lrv: 80, band: 5 });
    expect(lToLrv(lo)).toBeCloseTo(75, 6);
    expect(lToLrv(hi)).toBeCloseTo(85, 6);
    expect(sliceRange({ lrv: 50, band: Infinity })).toEqual([-Infinity, Infinity]);
  });

  it('paints the wheel: gray in the middle, nothing outside the disk or the screen gamut', () => {
    const size = 64;
    const px = renderWheel(size, 50);
    const at = (x: number, y: number) => Array.from(px.slice((y * size + x) * 4, (y * size + x) * 4 + 4));
    const mid = at(32, 32);
    expect(mid[3]).toBe(255);
    expect(Math.abs(mid[0] - mid[2])).toBeLessThan(12);
    expect(at(0, 0)[3]).toBe(0);
    // Very vivid colors can't be shown at LRV 50 for every hue: some of the rim is empty.
    const rim = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * 2 * Math.PI;
      return at(Math.round(32 + Math.cos(a) * 30), Math.round(32 - Math.sin(a) * 30))[3];
    });
    expect(rim.some((a) => a === 0)).toBe(true);
  });
});
