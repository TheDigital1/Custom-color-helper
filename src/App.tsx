import { useEffect, useState } from 'preact/hooks';
import { loadIndex } from './data/store';
import type { DataIndex } from './data/types';
import { Footer } from './components/Footer';

export function App() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, []);
  return (
    <main class="phase0">
      <h1>Paint Color Tuner</h1>
      {error && <p role="alert">{error}</p>}
      {index && (
        <>
          <p>
            {index.total.toLocaleString()} colors from {index.brands.length} brands.
          </p>
          <table class="brand-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Colors</th>
              </tr>
            </thead>
            <tbody>
              {index.brands.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Rodda: {index.expectedBrands.rodda ? 'included' : 'not in this dataset yet'}.
          </p>
        </>
      )}
      <Footer index={index} />
    </main>
  );
}
