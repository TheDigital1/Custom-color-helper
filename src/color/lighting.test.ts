import { describe, expect, it } from 'vitest';
import { hexToOklab, parseHex } from './convert';
import { bradford, daylightXy, LIGHTING_BY_ID, makeRenderer, planckianXy, presetWhite } from './lighting';

describe('lighting', () => {
  it('white points match known chromaticities', () => {
    // Illuminant A (2856 K blackbody): x 0.4476, y 0.4074.
    const [ax, ay] = planckianXy(2856);
    // The Kim et al. spline is accurate to ~1e-3.
    expect(Math.abs(ax - 0.4476)).toBeLessThan(1e-3);
    expect(Math.abs(ay - 0.4074)).toBeLessThan(1e-3);
    // D65 is on the daylight locus at ~6504 K.
    const [dx, dy] = daylightXy(6504);
    expect(dx).toBeCloseTo(0.3127, 3);
    expect(dy).toBeCloseTo(0.329, 3);
    // D50 at ~5003 K.
    const [d5x, d5y] = daylightXy(5003);
    expect(d5x).toBeCloseTo(0.3457, 3);
    expect(d5y).toBeCloseTo(0.3585, 3);
  });

  it('Bradford maps the source white to the destination white and is identity for equal whites', () => {
    const from = presetWhite(LIGHTING_BY_ID.d65);
    const to = presetWhite(LIGHTING_BY_ID.incandescent);
    const w = bradford(from, from, to);
    for (let i = 0; i < 3; i++) expect(w[i]).toBeCloseTo(to[i], 6);
    const x: [number, number, number] = [0.3, 0.4, 0.2];
    const same = bradford(x, from, from);
    for (let i = 0; i < 3; i++) expect(same[i]).toBeCloseTo(x[i], 6);
  });

  it('daylight and full adaptation leave colors unchanged', () => {
    const lab = hexToOklab('#EDEAE0')!;
    expect(makeRenderer({ preset: LIGHTING_BY_ID.d65, adaptation: 0 })(lab)).toBe('#edeae0');
    expect(makeRenderer({ preset: LIGHTING_BY_ID.incandescent, adaptation: 1 })(lab)).toBe('#edeae0');
  });

  it('warm light shifts colors warmer, cool light cooler, consistently for every color', () => {
    const warm = makeRenderer({ preset: LIGHTING_BY_ID.incandescent, adaptation: 0.3 });
    const cool = makeRenderer({ preset: LIGHTING_BY_ID.north, adaptation: 0.3 });
    for (const hex of ['#EDEAE0', '#808080', '#5b7c99', '#c96f4a']) {
      const [r, , b] = parseHex(hex)!;
      const [wr, , wb] = parseHex(warm(hexToOklab(hex)!))!;
      const [cr, , cb] = parseHex(cool(hexToOklab(hex)!))!;
      expect(wr - wb).toBeGreaterThan(r - b);
      expect(cr - cb).toBeLessThan(r - b);
    }
  });

  it('less adaptation means a stronger cast', () => {
    const lab = hexToOklab('#ffffff')!;
    const cast = (k: number) => {
      const [r, , b] = parseHex(makeRenderer({ preset: LIGHTING_BY_ID.incandescent, adaptation: k })(lab))!;
      return r - b;
    };
    expect(cast(0)).toBeGreaterThan(cast(0.5));
    expect(cast(0.5)).toBeGreaterThan(cast(0.9));
  });
});
