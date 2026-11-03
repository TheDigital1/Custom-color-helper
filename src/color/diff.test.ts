import { describe, expect, it } from 'vitest';
import { hexToOklab } from './convert';
import { diffRows, formatDiff } from './diff';

describe('two-color differences', () => {
  it('gives B − A for every slider', () => {
    const a = hexToOklab('#EDEAE0')!;
    const b = hexToOklab('#E2DED4')!;
    const rows = diffRows(a, b);
    const by = Object.fromEntries(rows.map((r) => [r.def.id, r]));
    expect(rows).toHaveLength(12);
    expect(by.lrv.diff).toBeCloseTo(by.lrv.b - by.lrv.a, 9);
    expect(by.lrv.diff!).toBeLessThan(0);
    expect(by.red.diff).toBeCloseTo(0xe2 - 0xed, 4);
    expect(by.blue.diff).toBeCloseTo(0xd4 - 0xe0, 4);
    // Swapping flips every sign.
    const back = Object.fromEntries(diffRows(b, a).map((r) => [r.def.id, r]));
    for (const r of rows) expect(back[r.def.id].diff! + r.diff!).toBeCloseTo(0, 6);
  });

  it('wraps hue differences and skips hue for grays', () => {
    const red = { hue: diffRows(hexToOklab('#d03a5a')!, hexToOklab('#d0405a')!) };
    const h = red.hue.find((r) => r.def.id === 'hue')!;
    expect(Math.abs(h.diff!)).toBeLessThan(20);
    const gray = diffRows(hexToOklab('#808080')!, hexToOklab('#c0a080')!).find((r) => r.def.id === 'hue')!;
    expect(gray.diff).toBeNull();
  });

  it('formats signed differences', () => {
    expect(formatDiff(1.234, 1)).toBe('+1.2');
    expect(formatDiff(-3, 0)).toBe('−3');
    expect(formatDiff(0.04, 1)).toBe('0.0');
    expect(formatDiff(-0.04, 1)).toBe('0.0');
    expect(formatDiff(-0.4, 0)).toBe('0');
  });
});
