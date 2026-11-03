# Raw data snapshots

`npm run build:data` reads the sources listed in `../sources.json` from this folder.

- **PaintDB** (CC BY 4.0): save the flat-file snapshot listed on <https://paintdb.com/about>
  here as `paintdb-colors.json` or `paintdb-colors.csv`. If neither file exists, the
  deploy workflow downloads it (`npm run build:data -- --download`).

Additional sources (for example a Rodda list) can be added to `../sources.json`; each
needs `id`, `name`, `url`, `license`, `files`, and optionally `defaultBrand` when the file
has no brand column. Earlier sources win when the same color appears in more than one,
and differing hex values are shown in the app.
