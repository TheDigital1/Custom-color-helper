import { approxLrv } from './color/convert';
import type { Favorite } from './favorites';

export interface Board {
  id: string;
  name: string;
  items: Favorite[];
}

function lrvText(f: Favorite) {
  return f.lrv != null ? `LRV ${f.lrv}` : `approx. LRV ${approxLrv(f.oklab).toFixed(1)}`;
}

/** Plain-text list: brand, name, code, LRV (one color per line). */
export function paletteText(board: Board): string {
  const lines = board.items.map((f) => {
    if (f.brandName) return `${f.brandName} — ${f.name}${f.code ? ` (${f.code})` : ''}, ${lrvText(f)}`;
    return `${f.name}${f.basedOn ? ` (tuned from ${f.basedOn})` : ''}, ${lrvText(f)}`;
  });
  return [`${board.name}`, ...lines.map((l) => `• ${l}`)].join('\n');
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function paletteCsv(board: Board): string {
  const header = ['palette', 'brand', 'name', 'code', 'hex', 'lrv', 'approx_lrv', 'note'];
  const rows = board.items.map((f) => [
    board.name,
    f.brandName ?? '',
    f.name,
    f.code ?? '',
    f.hex.toUpperCase(),
    f.lrv ?? '',
    approxLrv(f.oklab).toFixed(1),
    f.basedOn ? `tuned from ${f.basedOn}` : '',
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
