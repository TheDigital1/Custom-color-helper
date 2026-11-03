import { describe, expect, it } from 'vitest';
import { ciede2000 } from './ciede2000';
import { findMatches, type MatchSource } from './match';
import { rgbToLab, type Vec3 } from './convert';

function makeBrands(nBrands: number, perBrand: number, seed = 11): MatchSource[] {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: nBrands }, (_, bi) => {
    const labF = new Float32Array(perBrand * 3);
    for (let i = 0; i < perBrand; i++) labF.set(rgbToLab([rnd(), rnd(), rnd()]), i * 3);
    return { id: `b${bi}`, count: perBrand, labF };
  });
}

function bruteForce(brands: MatchSource[], lab: Vec3, k: number) {
  const all = brands.flatMap((b) =>
    Array.from({ length: b.count }, (_, i) => ({
      brand: b.id,
      index: i,
      de: ciede2000(lab[0], lab[1], lab[2], b.labF[i * 3], b.labF[i * 3 + 1], b.labF[i * 3 + 2]),
    })),
  );
  return all.sort((x, y) => x.de - y.de).slice(0, k);
}

describe('match search', () => {
  it('finds the same nearest colors as a naive full sort (the lightness skip is safe)', () => {
    const brands = makeBrands(4, 2000);
    for (const rgb of [[0.93, 0.92, 0.88], [0.2, 0.3, 0.5], [0.6, 0.1, 0.1], [0.5, 0.5, 0.5]] as Vec3[]) {
      const lab = rgbToLab(rgb);
      const res = findMatches(brands, lab, { perBrand: 3, overall: 5 });
      expect(res.overall.map((m) => [m.brand, m.index])).toEqual(bruteForce(brands, lab, 5).map((m) => [m.brand, m.index]));
      for (const b of brands) {
        expect(res.byBrand[b.id].map((m) => m.index)).toEqual(bruteForce([b], lab, 3).map((m) => m.index));
      }
    }
  });

  it('returns an exact match with ΔE 0 and can exclude it', () => {
    const brands = makeBrands(2, 500);
    const lab: Vec3 = [brands[1].labF[30], brands[1].labF[31], brands[1].labF[32]];
    expect(findMatches(brands, lab).overall[0]).toMatchObject({ brand: 'b1', index: 10, de: 0 });
    const ex = findMatches(brands, lab, { exclude: { brand: 'b1', index: 10 } });
    expect(ex.overall[0].index === 10 && ex.overall[0].brand === 'b1').toBe(false);
  });

  it('searches 40,000 colors well under 100 ms', () => {
    const brands = makeBrands(10, 4000);
    findMatches(brands, rgbToLab([0.5, 0.5, 0.5])); // warm up the JIT
    let worst = 0;
    for (const rgb of [[0.93, 0.92, 0.88], [0.1, 0.1, 0.1], [0.5, 0.6, 0.4]] as Vec3[]) {
      worst = Math.max(worst, findMatches(brands, rgbToLab(rgb)).ms);
    }
    // Desktop CI is several times faster than a mid-range phone; keep a wide margin.
    expect(worst).toBeLessThan(25);
  });
});
