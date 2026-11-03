import { describe, expect, it } from 'vitest';
import { approxLrv, hexToOklab, oklabToLch, type OKLab } from './convert';
import { atStrength, findStrengthFormulas, type StrengthSource } from './strength';
import { describeAdjustment, hueToward } from './describe';

const pack = (id: string, colors: OKLab[]): StrengthSource => ({ id, count: colors.length, oklabF: Float32Array.from(colors.flat()) });

describe('percentage strength', () => {
  const sage = hexToOklab('#8c9a7e')!;

  it('100% is the paint itself; lower is lighter, higher is darker; hue is roughly kept', () => {
    const same = atStrength(sage, 1);
    for (let i = 0; i < 3; i++) expect(same[i]).toBeCloseTo(sage[i], 5);
    const l = approxLrv(sage);
    expect(approxLrv(atStrength(sage, 0.5))).toBeGreaterThan(l + 5);
    expect(approxLrv(atStrength(sage, 1.5))).toBeLessThan(l - 3);
    const h = oklabToLch(sage).h;
    expect(Math.abs(oklabToLch(atStrength(sage, 0.5)).h - h)).toBeLessThan(15);
    // Zero strength is the white base itself (LRV ≈ 90).
    expect(approxLrv(atStrength(sage, 0))).toBeCloseTo(90, 0);
  });

  it('recovers the paint and strength used to make a target', () => {
    const others = ['#d9cbb5', '#5b6f85', '#c47c5a', '#b9c2a3', '#7d8f6b', '#e3dccb'].map((h) => hexToOklab(h)!);
    const brands = [pack('a', others), pack('b', [hexToOklab('#a3443c')!, sage, hexToOklab('#2f3b4c')!])];
    const target = atStrength(sage, 0.6);
    const res = findStrengthFormulas(brands, target);
    expect(res[0]).toMatchObject({ brand: 'b', index: 1, strength: 0.6 });
    expect(res[0].de).toBeLessThan(0.3);
  });

  it('never suggests 100% and skips targets lighter than the base', () => {
    const brands = [pack('a', [sage, hexToOklab('#d9cbb5')!])];
    for (const r of findStrengthFormulas(brands, sage)) {
      expect(r.strength).not.toBe(1);
      expect(r.strength).toBeGreaterThanOrEqual(0.25);
      expect(r.strength).toBeLessThanOrEqual(1.5);
    }
    expect(findStrengthFormulas(brands, hexToOklab('#ffffff')!)).toEqual([]);
  });

  it('is fast on a large dataset', () => {
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const brands = Array.from({ length: 10 }, (_, b) =>
      pack(`b${b}`, Array.from({ length: 5000 }, () => [0.3 + 0.65 * rnd(), (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.2] as OKLab)),
    );
    findStrengthFormulas(brands, sage); // fills the K/S cache, as the first search in the app does
    const t0 = performance.now();
    findStrengthFormulas(brands, atStrength(sage, 0.7));
    expect(performance.now() - t0).toBeLessThan(40);
  });
});

describe('store adjustment description', () => {
  it('describes lighter, warmer and grayer changes', () => {
    const from = hexToOklab('#b9b2a3')!;
    const lighter = describeAdjustment(from, atStrength(from, 0.7));
    expect(lighter.phrases[0]).toMatch(/^about \d+% lighter \(approx\. LRV \d+ → \d+\)$/);
    const warmer = describeAdjustment(hexToOklab('#d8d8d8')!, hexToOklab('#e0d6c8')!);
    expect(warmer.phrases.join('; ')).toMatch(/warmer/);
    const grayer = describeAdjustment(hexToOklab('#c47c5a')!, hexToOklab('#b08670')!);
    expect(grayer.phrases.join('; ')).toMatch(/grayer/);
    expect(describeAdjustment(from, from).same).toBe(true);
  });

  it('names the hue a shift is heading toward', () => {
    expect(hueToward(100, 1)).toBe('green');
    expect(hueToward(100, -1)).toBe('orange');
    expect(hueToward(350, 1)).toBe('pink');
    expect(hueToward(20, -1)).toBe('pink');
  });
});
