import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { searchPaints } from '../data/search';
import { loadedBrands, paintInfo, type PaintRef } from '../data/store';
import { SearchIcon } from './SliderRow';

interface Props {
  /** Bumped when more brands finish loading, so results refresh. */
  dataVersion: number;
  onPick(ref: PaintRef): void;
  /** Accessible name; must be unique on the page. */
  label?: string;
  placeholder?: string;
  /** Unique id for the results list. */
  listId?: string;
}

export function Search({ dataVersion, onPick, label = 'Search paint colors by name or code', placeholder = 'Search paint name or code', listId = 'search-results' }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => searchPaints(loadedBrands(), q, 40), [q, dataVersion]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const pick = (ref: PaintRef) => {
    onPick(ref);
    setOpen(false);
    setQ('');
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div class="search" ref={boxRef}>
      <label class="search-field">
        <SearchIcon />
        <input
          type="search"
          placeholder={placeholder}
          aria-label={label}
          value={q}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          autocomplete="off"
          enterKeyHint="search"
          onInput={(e) => {
            setQ((e.currentTarget as HTMLInputElement).value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              setActive((a) => Math.min(a + 1, hits.length - 1));
              e.preventDefault();
            } else if (e.key === 'ArrowUp') {
              setActive((a) => Math.max(a - 1, 0));
              e.preventDefault();
            } else if (e.key === 'Enter' && hits[active]) pick(hits[active]);
            else if (e.key === 'Escape') setOpen(false);
          }}
        />
      </label>
      {open && q.trim() && (
        <ul id={listId} class="search-results" role="listbox">
          {hits.length === 0 && <li class="search-empty">No matching colors in the loaded brands.</li>}
          {hits.map((h, i) => {
            const p = paintInfo(h)!;
            return (
              <li key={`${h.brand}:${h.index}`} role="option" aria-selected={i === active}>
                <button type="button" class={`search-hit${i === active ? ' active' : ''}`} onClick={() => pick(h)}>
                  <span class="chip" style={{ background: p.hex }} />
                  <span class="hit-text">
                    <span class="hit-name">{p.name}</span>
                    <span class="hit-meta">
                      {p.brandName}
                      {p.code ? ` · ${p.code}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
