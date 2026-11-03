import { describe, expect, it } from 'vitest';
import { hexToOklab } from './color/convert';
import { atStrength } from './color/strength';
import type { PaintInfo } from './data/store';
import { storeNoteText } from './storeNote';

const paint = (name: string, hex: string, code = ''): PaintInfo => ({
  brand: 'sw',
  index: 0,
  brandName: 'Sherwin-Williams',
  name,
  code,
  hex,
  lrv: null,
  approxLrv: 0,
  oklab: hexToOklab(hex)!,
  source: 'PaintDB',
  family: '',
  undertone: '',
  altHex: [],
});

describe('store note', () => {
  it('lists the closest paint, strength formulas and the adjustment from the original', () => {
    const original = paint('Alabaster', '#EDEAE0', 'SW 7008');
    const sage = paint('Sage', '#8C9A7E', 'SW 1');
    const target = atStrength(sage.oklab, 0.6);
    const text = storeNoteText({
      target,
      original,
      nearest: { paint: sage, de: 6.2 },
      formulas: [{ paint: sage, strength: 0.6, de: 0.1, lab: target }],
    });
    const lines = text.split('\n');
    expect(lines[0]).toMatch(/^Color I'm looking for: #[0-9A-F]{6} \(approx\. LRV \d+\)$/);
    expect(lines[1]).toBe('Closest stock paint: Sherwin-Williams Sage (SW 1), ΔE 6.2 (different)');
    expect(lines[2]).toBe('Or: Sherwin-Williams Sage (SW 1) at 60% strength (estimated ΔE 0.1)');
    expect(lines[3]).toMatch(/^Compared with Sherwin-Williams Alabaster \(SW 7008\), I'd like it: about \d+% darker/);
    expect(lines[4]).toMatch(/physical sample/);
  });
});
