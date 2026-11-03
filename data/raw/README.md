# Raw data snapshots

`npm run build:data` reads the sources listed in `../sources.json` from this folder.

- **PaintDB** (CC BY 4.0): `paintdb-colors.csv`, the flat-file snapshot listed on
  <https://paintdb.com/about>, downloaded 2026-11-03 (50,762 colors, 25 brands; no Rodda).
  To update it, replace the file and change `snapshot` in `../sources.json`.

Additional sources (for example a Rodda list) can be added to `../sources.json`; each
needs `id`, `name`, `url`, `license`, `files`, and optionally `defaultBrand` when the file
has no brand column. Earlier sources win when the same color appears in more than one,
and differing hex values are shown in the app.
