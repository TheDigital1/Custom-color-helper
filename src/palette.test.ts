import { describe, expect, it } from 'vitest';
import { approxLrv, hexToOklab } from './color/convert';
import { paletteCsv, paletteText, type Board } from './palette';

const board: Board = {
  id: 'b1',
  name: 'Living room',
  items: [
    { id: 'p:sw:SW 7008', name: 'Alabaster', hex: '#edeae0', oklab: hexToOklab('#edeae0')!, paint: 'sw:SW 7008', brandName: 'Sherwin-Williams', code: 'SW 7008', lrv: 82 },
    { id: 'c:1', name: 'Custom #EFEADD', hex: '#efeadd', oklab: hexToOklab('#efeadd')!, basedOn: 'Sherwin-Williams Alabaster (SW 7008)' },
  ],
};

describe('palette export', () => {
  it('formats a text list with brand, name, code and LRV', () => {
    expect(paletteText(board)).toBe(
      'Living room\n• Sherwin-Williams — Alabaster (SW 7008), LRV 82\n• Custom #EFEADD (tuned from Sherwin-Williams Alabaster (SW 7008)), approx. LRV ' + approxLrv(hexToOklab('#efeadd')!).toFixed(1),
    );
  });

  it('exports CSV with quoting', () => {
    const csv = paletteCsv(board).trim().split('\n');
    expect(csv[0]).toBe('palette,brand,name,code,hex,lrv,approx_lrv,note');
    expect(csv[1]).toBe('Living room,Sherwin-Williams,Alabaster,SW 7008,#EDEAE0,82,82.2,');
    expect(csv[2]).toContain(',tuned from Sherwin-Williams Alabaster (SW 7008)');
    const quoted = paletteCsv({ ...board, name: 'Den, "cozy"' });
    expect(quoted.split('\n')[1].startsWith('"Den, ""cozy""",')).toBe(true);
  });
});
