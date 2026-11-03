import type { DataIndex } from '../data/types';

export function Footer({ index }: { index: DataIndex | null }) {
  const sources = index?.sources ?? [];
  const missing = index ? Object.entries(index.expectedBrands).filter(([, present]) => !present).map(([id]) => id) : [];
  return (
    <footer class="footer">
      {index && (
        <details class="data-info">
          <summary>
            Data: {index.total.toLocaleString()} colors from {index.brands.length} brands
          </summary>
          <table class="brand-table">
            <thead>
              <tr>
                <th scope="col">Brand</th>
                <th scope="col" class="num">
                  Colors
                </th>
                {sources.length > 1 && <th scope="col">Sources</th>}
              </tr>
            </thead>
            <tbody>
              {index.brands.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td class="num">{b.count.toLocaleString()}</td>
                  {sources.length > 1 && <td>{b.sources.map((s) => sources.find((x) => x.id === s)?.name ?? s).join(', ')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {missing.includes('rodda') && <p>Rodda is not in the current data yet.</p>}
        </details>
      )}
      {sources.length ? (
        sources.map((s) => (
          <p key={s.id}>
            Color data from{' '}
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener">
                {s.name}
              </a>
            ) : (
              s.name
            )}
            ,{' '}
            {s.licenseUrl ? (
              <a href={s.licenseUrl} target="_blank" rel="noopener">
                {s.license}
              </a>
            ) : (
              s.license
            )}{' '}
            (snapshot {s.snapshot}).
          </p>
        ))
      ) : (
        <p>
          Color data from <a href="https://paintdb.com">PaintDB</a>,{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        </p>
      )}
      <p>
        Brand and color names are trademarks of their respective owners. This site is not affiliated with or endorsed
        by any paint manufacturer. On-screen colors are approximations: always sample a paint before buying.
      </p>
    </footer>
  );
}
