/**
 * Build-time data preprocessing.
 *
 *   npm run build:data                      # read data/sources.json, use files in data/raw/
 *   npm run build:data -- --download        # download missing snapshots (used in CI)
 *   npm run build:data -- --input f.json --out dir   # single file (used for test fixtures)
 *
 * Emits <out>/index.json plus one brand-<id>.json per brand. See src/data/types.ts.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildOutputs, parseInput, type PaintRow } from './data-lib';
import type { SourceInfo } from '../src/data/types';

interface SourceConfig {
  id: string;
  name: string;
  url: string;
  license: string;
  licenseUrl?: string;
  files: string[];
  download?: string;
  required?: boolean;
  /** For single-brand files (e.g. a hand-entered Rodda CSV) with no brand column. */
  defaultBrand?: string;
  snapshot?: string;
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, opt('--out') ?? 'public/data');
const download = flag('--download') || process.env.DATA_DOWNLOAD === '1';

const today = () => new Date().toISOString().slice(0, 10);

async function fetchTo(url: string, dest: string) {
  console.log(`Downloading ${url} …`);
  const res = await fetch(url, { headers: { 'User-Agent': 'custom-color-helper-data-build' } });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text);
  return text;
}

async function loadSource(cfg: SourceConfig): Promise<{ source: SourceInfo; rows: PaintRow[] } | null> {
  let file = cfg.files.map((f) => resolve(root, f)).find((f) => existsSync(f));
  let snapshot = cfg.snapshot;
  let text: string;
  if (file) {
    text = readFileSync(file, 'utf8');
    snapshot ??= statSync(file).mtime.toISOString().slice(0, 10);
  } else if (download && cfg.download) {
    file = resolve(root, cfg.files[0]);
    text = await fetchTo(cfg.download, file);
    snapshot ??= today();
  } else {
    const msg =
      `No data file for source "${cfg.id}". Expected one of:\n  ${cfg.files.join('\n  ')}\n` +
      (cfg.download ? `Run with --download to fetch ${cfg.download}.` : '');
    if (cfg.required) throw new Error(msg);
    console.warn(msg);
    return null;
  }
  const { rows, dropped } = parseInput(text, file, cfg.defaultBrand);
  console.log(
    `${cfg.name}: ${rows.length} colors (dropped ${dropped.badHex} bad hex, ${dropped.missingField} missing fields, ${dropped.duplicate} duplicates)`,
  );
  if (!rows.length) throw new Error(`Source "${cfg.id}" produced no usable rows — check the file format.`);
  return {
    source: { id: cfg.id, name: cfg.name, url: cfg.url, license: cfg.license, licenseUrl: cfg.licenseUrl, snapshot },
    rows,
  };
}

async function main() {
  let configs: SourceConfig[];
  const input = opt('--input');
  if (input) {
    configs = [
      {
        id: opt('--source-id') ?? 'fixture',
        name: opt('--source-name') ?? 'Test fixture',
        url: '',
        license: 'test data',
        files: [input],
        required: true,
        snapshot: today(),
      },
    ];
  } else {
    configs = JSON.parse(readFileSync(resolve(root, opt('--sources') ?? 'data/sources.json'), 'utf8'));
  }

  const loaded = (await Promise.all(configs.map(loadSource))).filter((x) => x !== null);
  const { index, brands } = buildOutputs(loaded);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  let raw = 0;
  let gz = 0;
  const write = (name: string, data: unknown) => {
    const text = JSON.stringify(data);
    writeFileSync(join(outDir, name), text);
    raw += text.length;
    gz += gzipSync(text).length;
  };
  write('index.json', index);
  for (const b of brands) write(`brand-${b.id}.json`, b);

  console.log(`\nWrote ${brands.length} brands, ${index.total} colors to ${outDir}`);
  console.log(`Size: ${(raw / 1e6).toFixed(2)} MB raw, ${(gz / 1e6).toFixed(2)} MB gzipped`);
  for (const b of index.brands) console.log(`  ${b.id.padEnd(12)} ${String(b.count).padStart(6)}  ${b.name}`);
  console.log('\nExpected brands:');
  for (const [id, present] of Object.entries(index.expectedBrands)) {
    console.log(`  ${id.padEnd(8)} ${present ? 'present' : 'MISSING'}`);
  }
  if (gz > 2e6) console.warn('WARNING: gzipped data exceeds the 2 MB target.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
