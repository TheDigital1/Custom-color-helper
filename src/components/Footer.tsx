import type { DataIndex } from '../data/types';

export function Footer({ index }: { index: DataIndex | null }) {
  const sources = index?.sources ?? [];
  return (
    <footer class="footer">
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
