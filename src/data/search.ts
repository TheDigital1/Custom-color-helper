import type { LoadedBrand, PaintRef } from './store';

export interface SearchHit extends PaintRef {
  score: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Is `q` a subsequence of `s`? Returns a gap penalty (lower is better) or -1. */
function subsequence(q: string, s: string): number {
  let j = 0;
  let gaps = 0;
  let last = -1;
  for (let i = 0; i < s.length && j < q.length; i++) {
    if (s[i] === q[j]) {
      if (last >= 0) gaps += i - last - 1;
      last = i;
      j++;
    }
  }
  return j === q.length ? gaps : -1;
}

/**
 * Fuzzy search by name or code across brands. Every query token must match (as a substring,
 * or failing that as a subsequence); prefix and whole-word matches rank higher.
 */
export function searchPaints(brands: LoadedBrand[], query: string, limit = 40): SearchHit[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const compactQ = q.replace(/ /g, '');
  const hits: SearchHit[] = [];
  for (const b of brands) {
    const brandName = b.name.toLowerCase();
    for (let i = 0; i < b.count; i++) {
      const text = b.searchText[i];
      let score = 0;
      let ok = true;
      for (const t of tokens) {
        const pos = text.indexOf(t);
        if (pos >= 0) {
          score += 10;
          if (pos === 0) score += 6;
          else if (text[pos - 1] === ' ') score += 4;
        } else if (brandName.includes(t)) {
          score += 3;
        } else {
          const compactText = text.replace(/[^a-z0-9]/g, '');
          if (compactText.includes(t)) score += 7;
          else {
            const gaps = subsequence(t, text);
            if (gaps < 0 || gaps > t.length * 2) {
              ok = false;
              break;
            }
            score += 4 - Math.min(3, gaps / 2);
          }
        }
      }
      if (!ok) continue;
      const name = b.names[i].toLowerCase();
      if (norm(name) === q) score += 20;
      const code = norm(b.codes[i]).replace(/ /g, '');
      if (code && code === compactQ) score += 25;
      score -= name.length / 50;
      hits.push({ brand: b.id, index: i, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
