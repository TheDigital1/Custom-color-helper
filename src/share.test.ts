import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, type SharedState } from './share';

describe('share URL', () => {
  it('round-trips the full state', () => {
    const s: SharedState = {
      paint: 'sw:SW 7008',
      current: [0.912345, 0.001234, 0.021],
      originalLab: [0.93, 0.0001, 0.02],
      locks: { lrv: 82.2, hue: 93.123456 },
      lighting: 'incandescent',
      adaptation: 0.35,
    };
    const d = decodeState('#' + encodeState(s))!;
    expect(d).toEqual(s);
  });

  it('defaults lighting and ignores junk', () => {
    const d = decodeState('#p=bm%3AOC-17&l=bogus:1,lrv:abc,warmth:2&light=disco')!;
    expect(d.paint).toBe('bm:OC-17');
    expect(d.locks).toEqual({ warmth: 2 });
    expect(d.lighting).toBe('d65');
    expect(d.current).toBeNull();
    expect(decodeState('#')).toBeNull();
  });
});
