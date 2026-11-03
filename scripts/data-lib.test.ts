import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOutputs, normalizeBrand, normalizeRecords, parseCsv, parseInput, extractRecords } from './data-lib';

const src = (id: string) => ({ id, name: id, url: '', license: 'x', snapshot: '2026-01-01' });

describe('data build', () => {
  it('normalizes brand names to stable IDs', () => {
    expect(normalizeBrand('Sherwin-Williams').id).toBe('sw');
    expect(normalizeBrand('SHERWIN WILLIAMS').id).toBe('sw');
    expect(normalizeBrand('Benjamin Moore').id).toBe('bm');
    expect(normalizeBrand('Rodda Paint').id).toBe('rodda');
    expect(normalizeBrand('Farrow & Ball').id).toBe('fb');
    expect(normalizeBrand('Kelly-Moore Paints').id).toBe('km');
    expect(normalizeBrand('Some New Brand').id).toBe('some-new-brand');
  });

  it('parses CSV with quotes and CRLF', () => {
    const rows = parseCsv('﻿brand,name,hex\r\n"Behr","Say ""Hi"", World",#ABCDEF\r\nPPG,Plain,123456\r\n');
    expect(rows).toEqual([
      { brand: 'Behr', name: 'Say "Hi", World', hex: '#ABCDEF' },
      { brand: 'PPG', name: 'Plain', hex: '123456' },
    ]);
  });

  it('accepts several JSON shapes and field spellings', () => {
    expect(extractRecords({ colors: [{ a: 1 }] })).toHaveLength(1);
    const byBrand = extractRecords({ Behr: [{ name: 'X', hex: '#fff' }] });
    expect(byBrand[0]).toMatchObject({ brand: 'Behr', name: 'X' });
    const { rows } = normalizeRecords([
      { Manufacturer: 'PPG', 'Color Name': 'A', 'Color Code': 'P1', RGB: '10, 20, 30', LRV: '45.5' },
      { brand: 'PPG', name: 'B', r: 255, g: 0, b: 0 },
    ]);
    expect(rows[0]).toMatchObject({ brand: 'PPG', name: 'A', code: 'P1', hex: '0a141e', lrv: 45.5 });
    expect(rows[1].hex).toBe('ff0000');
    expect(rows[1].lrv).toBeNull();
  });

  it('drops bad hex, missing fields and duplicates', () => {
    const { rows, dropped } = normalizeRecords([
      { brand: 'Behr', name: 'Ok', hex: '#112233' },
      { brand: 'Behr', name: 'Ok', hex: '#112233' },
      { brand: 'Behr', name: 'Bad', hex: 'nothex' },
      { name: 'No brand', hex: '#000000' },
    ]);
    expect(rows).toHaveLength(1);
    expect(dropped).toEqual({ badHex: 1, missingField: 1, duplicate: 1 });
    // Codes that differ only by punctuation or spacing are different colors.
    const distinct = normalizeRecords([
      { brand: 'Kelly-Moore Paints', code: '7-1', name: 'A', hex: '#111111' },
      { brand: 'Kelly-Moore Paints', code: '71', name: 'B', hex: '#222222' },
      { brand: 'Dunn-Edwards', code: 'DEW 315', name: 'C', hex: '#333333' },
      { brand: 'Dunn-Edwards', code: 'DEW315', name: 'D', hex: '#444444' },
      { brand: 'Dunn-Edwards', code: 'dew315', name: 'D again', hex: '#444444' },
    ]);
    expect(distinct.rows).toHaveLength(4);
    expect(distinct.dropped.duplicate).toBe(1);
  });

  it('packs brands with precomputed Lab, OKLab and Y, and reports expected brands', () => {
    const { index, brands } = buildOutputs([
      {
        source: src('a'),
        rows: [
          { brand: 'Sherwin-Williams', name: 'Alabaster', code: 'SW 7008', hex: 'edeae0', lrv: 82, family: '', undertone: '' },
          { brand: 'Behr', name: 'Black', code: '', hex: '000000', lrv: null, family: '', undertone: '' },
        ],
      },
    ]);
    expect(index.total).toBe(2);
    expect(index.expectedBrands).toMatchObject({ sw: true, behr: true, rodda: false });
    const sw = brands.find((b) => b.id === 'sw')!;
    expect(sw.lab).toHaveLength(3);
    expect(sw.oklab).toHaveLength(3);
    expect(sw.lrv[0]).toBe(82);
    expect(sw.y[0]).toBeGreaterThan(79);
    expect(sw.y[0]).toBeLessThan(85);
  });

  it('merges sources by brand and records hex disagreements', () => {
    const row = (hex: string, lrv: number | null) => ({ brand: 'Rodda', name: 'Foo', code: 'R1', hex, lrv, family: '', undertone: '' });
    const { index, brands } = buildOutputs([
      { source: src('one'), rows: [row('aaaaaa', null)] },
      { source: src('two'), rows: [row('aaaaab', 50), { ...row('111111', null), code: 'R2', name: 'Bar' }] },
    ]);
    const rodda = brands[0];
    expect(rodda.count).toBe(2);
    expect(rodda.src).toEqual([0, 1]);
    expect(rodda.lrv[0]).toBe(50);
    expect(rodda.altHex).toEqual({ 0: [{ src: 1, hex: 'aaaaab' }] });
    expect(index.brands[0].sources).toEqual(['one', 'two']);
  });

  it('processes the test fixture', () => {
    const file = resolve(import.meta.dirname, '../tests/fixtures/paintdb-sample.json');
    const { rows, dropped } = parseInput(readFileSync(file, 'utf8'), file);
    expect(dropped.badHex).toBe(1);
    expect(dropped.duplicate).toBe(1);
    expect(rows.find((r) => r.name === 'Alabaster')).toMatchObject({ hex: 'edeae0', lrv: 82 });
  });
});
