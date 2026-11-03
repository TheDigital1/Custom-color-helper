/**
 * Pure helpers for the data build: parsing, validation, brand normalization, merging
 * and packing. Kept separate from the CLI so they can be unit tested.
 */
import { hexToOklab, oklabToLab, approxLrv, parseHex, rgbToHex } from '../src/color/convert';
import type { BrandFile, BrandSummary, DataIndex, SourceInfo } from '../src/data/types';

export interface PaintRow {
  brand: string;
  name: string;
  code: string;
  hex: string; // lowercase, 6 digits, no '#'
  lrv: number | null;
  family: string;
  undertone: string;
}

/** Brand display names and stable IDs. Keys are normalized (lowercase, alphanumerics only). */
const BRAND_ALIASES: Record<string, { id: string; name: string }> = {
  sherwinwilliams: { id: 'sw', name: 'Sherwin-Williams' },
  sw: { id: 'sw', name: 'Sherwin-Williams' },
  benjaminmoore: { id: 'bm', name: 'Benjamin Moore' },
  bm: { id: 'bm', name: 'Benjamin Moore' },
  rodda: { id: 'rodda', name: 'Rodda' },
  roddapaint: { id: 'rodda', name: 'Rodda' },
  roddapaints: { id: 'rodda', name: 'Rodda' },
  behr: { id: 'behr', name: 'Behr' },
  ppg: { id: 'ppg', name: 'PPG' },
  ppgpaints: { id: 'ppg', name: 'PPG' },
  valspar: { id: 'valspar', name: 'Valspar' },
  glidden: { id: 'glidden', name: 'Glidden' },
  dunnedwards: { id: 'de', name: 'Dunn-Edwards' },
  farrowball: { id: 'fb', name: 'Farrow & Ball' },
  farrowandball: { id: 'fb', name: 'Farrow & Ball' },
  kellymoore: { id: 'km', name: 'Kelly-Moore' },
  kellymoorepaints: { id: 'km', name: 'Kelly-Moore' },
  prattlambert: { id: 'pl', name: 'Pratt & Lambert' },
  prattandlambert: { id: 'pl', name: 'Pratt & Lambert' },
  dutchboy: { id: 'dutchboy', name: 'Dutch Boy' },
  clarkkensington: { id: 'ck', name: 'Clark+Kensington' },
  millerpaint: { id: 'miller', name: 'Miller Paint' },
  miller: { id: 'miller', name: 'Miller Paint' },
  hgtvhomebysherwinwilliams: { id: 'hgtv', name: 'HGTV Home by Sherwin-Williams' },
  colorhouse: { id: 'colorhouse', name: 'Color House' },
  backdrop: { id: 'backdrop', name: 'Backdrop' },
  clare: { id: 'clare', name: 'Clare' },
  vista: { id: 'vista', name: 'Vista Paint' },
  vistapaint: { id: 'vista', name: 'Vista Paint' },
  cloverdale: { id: 'cloverdale', name: 'Cloverdale' },
  cloverdalepaint: { id: 'cloverdale', name: 'Cloverdale' },
  generalpaint: { id: 'general', name: 'General Paint' },
  dulux: { id: 'dulux', name: 'Dulux' },
  littlegreene: { id: 'lg', name: 'Little Greene' },
};

/** Brands the plan explicitly cares about; reported as present/missing. */
export const EXPECTED_BRANDS = ['sw', 'bm', 'rodda', 'behr', 'ppg'];

const normKey = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

export function normalizeBrand(raw: string): { id: string; name: string } {
  const k = normKey(raw);
  const alias = BRAND_ALIASES[k] ?? BRAND_ALIASES[k.replace(/and/g, '')];
  if (alias) return alias;
  const id = raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return { id: id || 'unknown', name: raw.trim() };
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). Returns objects keyed by header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.replace(/^﻿/, '').trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Pull an array of records out of whatever JSON shape the snapshot uses. */
export function extractRecords(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    for (const key of ['colors', 'colours', 'data', 'paints', 'items', 'results']) {
      if (Array.isArray(obj[key])) return extractRecords(obj[key]);
    }
    // { "Brand Name": [ ...colors ] }
    const out: Record<string, unknown>[] = [];
    for (const [brand, list] of Object.entries(obj)) {
      if (Array.isArray(list)) {
        for (const r of list) if (r && typeof r === 'object') out.push({ brand, ...(r as object) });
      }
    }
    return out;
  }
  return [];
}

const FIELD_KEYS = {
  brand: ['brand', 'brandname', 'manufacturer', 'maker', 'company', 'vendor'],
  name: ['name', 'colorname', 'colourname', 'title', 'paintname'],
  code: ['code', 'colorcode', 'colourcode', 'colornumber', 'colournumber', 'number', 'sku', 'productcode'],
  hex: ['hex', 'hexcode', 'hexvalue', 'colorhex', 'colourhex', 'html', 'hexcolor'],
  rgb: ['rgb', 'rgbvalue'],
  r: ['r', 'red'],
  g: ['g', 'green'],
  b: ['b', 'blue'],
  lrv: ['lrv', 'lightreflectancevalue', 'lightreflectance'],
  family: ['family', 'colorfamily', 'colourfamily', 'huefamily'],
  undertone: ['undertone', 'undertones'],
} as const;

function pick(rec: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) if (k in rec && rec[k] !== null && rec[k] !== '') return rec[k];
  return undefined;
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

function toHex(rec: Record<string, unknown>): string | null {
  const h = pick(rec, FIELD_KEYS.hex);
  if (h !== undefined) {
    const rgb = parseHex(str(h));
    return rgb ? rgbToHex(rgb).slice(1) : null;
  }
  let parts: number[] | null = null;
  const rgbField = pick(rec, FIELD_KEYS.rgb);
  if (Array.isArray(rgbField)) parts = rgbField.map(Number);
  else if (rgbField && typeof rgbField === 'object') {
    const o = rgbField as Record<string, unknown>;
    parts = [Number(o.r ?? o.red), Number(o.g ?? o.green), Number(o.b ?? o.blue)];
  } else if (typeof rgbField === 'string') parts = (rgbField.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  else {
    const r = pick(rec, FIELD_KEYS.r);
    const g = pick(rec, FIELD_KEYS.g);
    const b = pick(rec, FIELD_KEYS.b);
    if (r !== undefined && g !== undefined && b !== undefined) parts = [Number(r), Number(g), Number(b)];
  }
  if (!parts || parts.length !== 3 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return null;
  return rgbToHex([parts[0] / 255, parts[1] / 255, parts[2] / 255]).slice(1);
}

export interface NormalizeResult {
  rows: PaintRow[];
  dropped: { badHex: number; missingField: number; duplicate: number };
}

/** Validate raw records and convert them to PaintRows, dropping bad hex and duplicates. */
export function normalizeRecords(records: Record<string, unknown>[], defaultBrand?: string): NormalizeResult {
  const dropped = { badHex: 0, missingField: 0, duplicate: 0 };
  const seen = new Set<string>();
  const rows: PaintRow[] = [];
  for (const raw of records) {
    const rec: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) rec[normKey(k)] = v;
    const brand = str(pick(rec, FIELD_KEYS.brand)) || defaultBrand || '';
    const name = str(pick(rec, FIELD_KEYS.name));
    const code = str(pick(rec, FIELD_KEYS.code));
    if (!brand || (!name && !code)) {
      dropped.missingField++;
      continue;
    }
    const hex = toHex(rec);
    if (!hex) {
      dropped.badHex++;
      continue;
    }
    const key = rowKey(brand, name, code);
    if (seen.has(key)) {
      dropped.duplicate++;
      continue;
    }
    seen.add(key);
    const lrvRaw = pick(rec, FIELD_KEYS.lrv);
    const lrvNum = lrvRaw === undefined ? NaN : parseFloat(String(lrvRaw));
    rows.push({
      brand,
      name: name || code,
      code,
      hex,
      lrv: Number.isFinite(lrvNum) && lrvNum >= 0 && lrvNum <= 100 ? lrvNum : null,
      family: str(pick(rec, FIELD_KEYS.family)),
      undertone: str(pick(rec, FIELD_KEYS.undertone)),
    });
  }
  return { rows, dropped };
}

/** Identity of a color within a brand: code when present, otherwise name. */
export function rowKey(brand: string, name: string, code: string): string {
  // Codes are compared case-insensitively but keep punctuation and spaces: "7-1" and "71"
  // (or "DEW 315" and "DEW315") are different colors in real data.
  const exact = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${normalizeBrand(brand).id}|${code ? 'c:' + exact(code) : 'n:' + exact(name)}`;
}

export function parseInput(text: string, fileName: string, defaultBrand?: string): NormalizeResult {
  const records = /\.csv$/i.test(fileName) ? parseCsv(text) : extractRecords(JSON.parse(text));
  return normalizeRecords(records, defaultBrand);
}

const round = (x: number, d: number) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

export interface BuildOutput {
  index: DataIndex;
  brands: BrandFile[];
}

/**
 * Merge rows from several sources (earlier sources win) and pack them per brand.
 * When a later source has the same color with a different hex, it is recorded in altHex.
 */
export function buildOutputs(
  inputs: { source: SourceInfo; rows: PaintRow[] }[],
  generatedAt = new Date().toISOString(),
): BuildOutput {
  type Entry = PaintRow & { src: number; alt: { src: number; hex: string }[] };
  const byBrand = new Map<string, { name: string; entries: Entry[]; keys: Map<string, Entry>; sources: Set<string> }>();

  inputs.forEach(({ source, rows }, srcIndex) => {
    for (const row of rows) {
      const brand = normalizeBrand(row.brand);
      let b = byBrand.get(brand.id);
      if (!b) {
        b = { name: brand.name, entries: [], keys: new Map(), sources: new Set() };
        byBrand.set(brand.id, b);
      }
      const key = rowKey(row.brand, row.name, row.code);
      const existing = b.keys.get(key);
      if (existing) {
        if (existing.hex !== row.hex && !existing.alt.some((a) => a.src === srcIndex)) {
          existing.alt.push({ src: srcIndex, hex: row.hex });
        }
        if (existing.lrv === null && row.lrv !== null) existing.lrv = row.lrv;
        continue;
      }
      const entry: Entry = { ...row, src: srcIndex, alt: [] };
      b.keys.set(key, entry);
      b.entries.push(entry);
      b.sources.add(source.id);
    }
  });

  const brands: BrandFile[] = [];
  const summaries: BrandSummary[] = [];
  const ids = [...byBrand.keys()].sort((a, b) => byBrand.get(a)!.name.localeCompare(byBrand.get(b)!.name));
  for (const id of ids) {
    const b = byBrand.get(id)!;
    const entries = b.entries;
    const file: BrandFile = {
      id,
      name: b.name,
      count: entries.length,
      names: [],
      codes: [],
      hex: [],
      lrv: [],
      lab: [],
      oklab: [],
      y: [],
      src: [],
    };
    const family: string[] = [];
    const undertone: string[] = [];
    const altHex: NonNullable<BrandFile['altHex']> = {};
    entries.forEach((e, i) => {
      const ok = hexToOklab(e.hex)!;
      const lab = oklabToLab(ok);
      file.names.push(e.name);
      file.codes.push(e.code);
      file.hex.push(e.hex);
      file.lrv.push(e.lrv);
      file.lab.push(round(lab[0], 2), round(lab[1], 2), round(lab[2], 2));
      file.oklab.push(round(ok[0], 5), round(ok[1], 5), round(ok[2], 5));
      file.y.push(round(approxLrv(ok), 2));
      file.src.push(e.src);
      family.push(e.family);
      undertone.push(e.undertone);
      if (e.alt.length) altHex[i] = e.alt;
    });
    if (family.some(Boolean)) file.family = family;
    if (undertone.some(Boolean)) file.undertone = undertone;
    if (Object.keys(altHex).length) file.altHex = altHex;
    brands.push(file);
    summaries.push({ id, name: b.name, count: entries.length, file: `brand-${id}.json`, sources: [...b.sources] });
  }

  const expectedBrands = Object.fromEntries(EXPECTED_BRANDS.map((id) => [id, byBrand.has(id)]));
  return {
    index: {
      formatVersion: 1,
      generatedAt,
      sources: inputs.map((i) => i.source),
      brands: summaries,
      total: summaries.reduce((n, s) => n + s.count, 0),
      expectedBrands,
    },
    brands,
  };
}
