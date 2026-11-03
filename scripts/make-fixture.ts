/**
 * Generates tests/fixtures/paintdb-sample.json: a small, clearly synthetic dataset in a
 * PaintDB-like shape for unit and e2e tests. Apart from SW Alabaster (#EDEAE0, LRV 82, from
 * the project plan) the colors are generated, not real paints.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lchToOklab, oklabToRgb, rgbToHex, inGamut, luminance, oklabToLinear } from '../src/color/convert';

const brands = ['Sherwin-Williams', 'Benjamin Moore', 'Behr', 'PPG'];
const rows: Record<string, unknown>[] = [
  { brand: 'Sherwin-Williams', name: 'Alabaster', code: 'SW 7008', hex: '#EDEAE0', lrv: 82, undertone: 'yellow' },
];
let n = 0;
brands.forEach((brand, bi) => {
  for (let i = 0; i < 300; i++) {
    const l = 0.35 + ((i * 37 + bi * 11) % 61) / 100;
    const c = (((i * 13 + bi * 7) % 23) / 23) * 0.12;
    const h = (i * 47 + bi * 90) % 360;
    const lab = lchToOklab({ l, c, h });
    const rgb = oklabToRgb(lab);
    if (!inGamut(rgb)) continue;
    n++;
    const lrv = Math.round(luminance(oklabToLinear(lab)) * 1000) / 10;
    rows.push({ brand, name: `Fixture ${brand.split(/[ -]/)[0]} ${String(i).padStart(3, '0')}`, code: `FX-${bi}${String(i).padStart(3, '0')}`, hex: rgbToHex(rgb).toUpperCase(), lrv: i % 5 === 0 ? null : lrv });
  }
});
// Rows the build must reject: a duplicate and a bad hex.
rows.push({ brand: 'Sherwin-Williams', name: 'Alabaster', code: 'SW 7008', hex: '#EDEAE0', lrv: 82 });
rows.push({ brand: 'Behr', name: 'Broken Hex', code: 'FX-BAD', hex: '#XYZ123' });
writeFileSync(resolve(import.meta.dirname, '../tests/fixtures/paintdb-sample.json'), JSON.stringify(rows, null, 0));
console.log(`Wrote ${rows.length} fixture rows (${n} generated)`);
