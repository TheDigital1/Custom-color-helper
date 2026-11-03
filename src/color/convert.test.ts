import { describe, expect, it } from 'vitest';
import { converter, differenceCiede2000 } from 'culori';
import {
  approxLrv,
  contrastRatio,
  hexToOklab,
  lchToOklab,
  oklabToHex,
  oklabToLab,
  oklabToLch,
  oklabToRgb,
  parseHex,
  rgbToHex,
  rgbToLab,
  rgbToOklab,
  type Vec3,
} from './convert';
import { ciede2000, deltaELabel } from './ciede2000';

const toOklab = converter('oklab');
const toLab65 = converter('lab65');

function rand(seed: number) {
  // Small deterministic PRNG (mulberry32) so test failures are reproducible.
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('conversions', () => {
  it('parses and formats hex', () => {
    expect(parseHex('#EDEAE0')).toEqual([237 / 255, 234 / 255, 224 / 255]);
    expect(parseHex('fff')).toEqual([1, 1, 1]);
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('zzzzzz')).toBeNull();
    expect(rgbToHex([1, 0.5, 0])).toBe('#ff8000');
    expect(rgbToHex([1.2, -0.1, 0])).toBe('#ff0000');
  });

  it('matches culori for sRGB → OKLab and CIELAB(D65)', () => {
    const r = rand(1);
    for (let i = 0; i < 500; i++) {
      const rgb: Vec3 = [r(), r(), r()];
      const ours = rgbToOklab(rgb);
      const ref = toOklab({ mode: 'rgb', r: rgb[0], g: rgb[1], b: rgb[2] });
      expect(ours[0]).toBeCloseTo(ref.l, 5);
      expect(ours[1]).toBeCloseTo(ref.a, 5);
      expect(ours[2]).toBeCloseTo(ref.b, 5);
      const lab = rgbToLab(rgb);
      const refLab = toLab65({ mode: 'rgb', r: rgb[0], g: rgb[1], b: rgb[2] });
      expect(lab[0]).toBeCloseTo(refLab.l, 3);
      expect(lab[1]).toBeCloseTo(refLab.a, 3);
      expect(lab[2]).toBeCloseTo(refLab.b, 3);
    }
  });

  it('round-trips sRGB ↔ OKLab', () => {
    const r = rand(2);
    for (let i = 0; i < 500; i++) {
      const rgb: Vec3 = [r(), r(), r()];
      const back = oklabToRgb(rgbToOklab(rgb));
      for (let k = 0; k < 3; k++) expect(back[k]).toBeCloseTo(rgb[k], 5);
      const lch = oklabToLch(rgbToOklab(rgb));
      const lab2 = lchToOklab(lch);
      const lab = rgbToOklab(rgb);
      for (let k = 0; k < 3; k++) expect(lab2[k]).toBeCloseTo(lab[k], 9);
    }
  });

  it('SW Alabaster #EDEAE0 has approx. LRV close to its published 82', () => {
    const lab = hexToOklab('#EDEAE0')!;
    expect(oklabToHex(lab)).toBe('#edeae0');
    const lrv = approxLrv(lab);
    expect(lrv).toBeGreaterThan(79);
    expect(lrv).toBeLessThan(85);
    const cielab = oklabToLab(lab);
    expect(cielab[0]).toBeCloseTo(92.7, 0);
    // Warm off-white: slightly positive b*, near-zero a*.
    expect(cielab[2]).toBeGreaterThan(2);
    expect(Math.abs(cielab[1])).toBeLessThan(2);
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio(hexToOklab('#000')!, hexToOklab('#fff')!)).toBeCloseTo(21, 1);
    expect(contrastRatio(hexToOklab('#777')!, hexToOklab('#777')!)).toBeCloseTo(1, 5);
  });
});

// Sharma, Wu & Dalal (2005) CIEDE2000 test data: [L1, a1, b1, L2, a2, b2, ΔE00].
const SHARMA: number[][] = [
  [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
  [50, 3.1571, -77.2803, 50, 0, -82.7485, 2.8615],
  [50, 2.8361, -74.02, 50, 0, -82.7485, 3.4412],
  [50, -1.3802, -84.2814, 50, 0, -82.7485, 1.0],
  [50, -1.1848, -84.8006, 50, 0, -82.7485, 1.0],
  [50, -0.9009, -85.5211, 50, 0, -82.7485, 1.0],
  [50, 0, 0, 50, -1, 2, 2.3669],
  [50, -1, 2, 50, 0, 0, 2.3669],
  [50, 2.49, -0.001, 50, -2.49, 0.0009, 7.1792],
  [50, 2.49, -0.001, 50, -2.49, 0.001, 7.1792],
  [50, 2.49, -0.001, 50, -2.49, 0.0011, 7.2195],
  [50, 2.49, -0.001, 50, -2.49, 0.0012, 7.2195],
  [50, -0.001, 2.49, 50, 0.0009, -2.49, 4.8045],
  [50, -0.001, 2.49, 50, 0.001, -2.49, 4.8045],
  [50, -0.001, 2.49, 50, 0.0011, -2.49, 4.7461],
  [50, 2.5, 0, 50, 0, -2.5, 4.3065],
  [50, 2.5, 0, 73, 25, -18, 27.1492],
  [50, 2.5, 0, 61, -5, 29, 22.8977],
  [50, 2.5, 0, 56, -27, -3, 31.903],
  [50, 2.5, 0, 58, 24, 15, 19.4535],
  [50, 2.5, 0, 50, 3.1736, 0.5854, 1.0],
  [50, 2.5, 0, 50, 3.2972, 0, 1.0],
  [50, 2.5, 0, 50, 1.8634, 0.5757, 1.0],
  [50, 2.5, 0, 50, 3.2592, 0.335, 1.0],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.263],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.248, -4.962, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
  [36.4612, 47.858, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
  [90.8027, -2.0831, 1.441, 91.1528, -1.6435, 0.0447, 1.4441],
  [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
  [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
  [2.0776, 0.0795, -1.135, 0.9033, -0.0636, -0.5514, 0.9082],
];

describe('CIEDE2000', () => {
  it.each(SHARMA.map((row, i) => [i + 1, row] as const))('Sharma pair %i', (_i, row) => {
    const [L1, a1, b1, L2, a2, b2, expected] = row;
    expect(ciede2000(L1, a1, b1, L2, a2, b2)).toBeCloseTo(expected, 4);
    // Symmetric.
    expect(ciede2000(L2, a2, b2, L1, a1, b1)).toBeCloseTo(expected, 4);
  });

  it('agrees with culori on random pairs', () => {
    const de = differenceCiede2000();
    const r = rand(3);
    for (let i = 0; i < 300; i++) {
      const p = [r() * 100, r() * 160 - 80, r() * 160 - 80, r() * 100, r() * 160 - 80, r() * 160 - 80];
      const ref = de(
        { mode: 'lab65', l: p[0], a: p[1], b: p[2] },
        { mode: 'lab65', l: p[3], a: p[4], b: p[5] },
      );
      expect(ciede2000(p[0], p[1], p[2], p[3], p[4], p[5])).toBeCloseTo(ref, 6);
    }
  });

  it('labels differences in plain English', () => {
    expect(deltaELabel(0.5)).toBe('indistinguishable');
    expect(deltaELabel(1.5)).toBe('very close');
    expect(deltaELabel(3)).toBe('subtle');
    expect(deltaELabel(4.2)).toBe('noticeable');
    expect(deltaELabel(7)).toBe('different');
  });
});
