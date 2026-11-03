import { useCallback, useEffect, useMemo, useReducer, useState } from 'preact/hooks';
import { hexToOklab, oklabToHex, oklabToLab, type OKLab } from './color/convert';
import { deltaELabel } from './color/ciede2000';
import { findMatches, type MatchResult } from './color/match';
import { SLIDERS, sliderValues, type SliderGroup, type SliderId } from './color/sliders';
import { solve } from './color/solver';
import { sliderTrack } from './color/tracks';
import { loadBrand, loadIndex, loadedBrands, paintInfo, type PaintRef } from './data/store';
import type { DataIndex } from './data/types';
import { initialState, reducer } from './state';
import { Compare, type CompareMode, type Panel } from './components/Compare';
import { Footer } from './components/Footer';
import { Search } from './components/Search';
import { RedoIcon, ResetIcon, SliderRow, UndoIcon } from './components/SliderRow';

const FALLBACK: OKLab = hexToOklab('#EDEAE0')!;

const GROUPS: { id: SliderGroup; title: string }[] = [
  { id: 'main', title: 'Adjust' },
  { id: 'undertone', title: 'Undertone pulls' },
  { id: 'rgb', title: 'RGB' },
];

/** Default starting paint: SW Alabaster when available, else the first color. */
function defaultPaint(): PaintRef | null {
  const sw = loadedBrands().find((b) => b.id === 'sw');
  const i = sw ? sw.names.findIndex((n) => n.toLowerCase() === 'alabaster') : -1;
  if (sw && i >= 0) return { brand: 'sw', index: i };
  const first = loadedBrands()[0];
  return first && first.count ? { brand: first.id, index: 0 } : null;
}

export function App() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [state, dispatch] = useReducer(reducer, FALLBACK, initialState);
  const [compareMode, setCompareMode] = useState<CompareMode>('side');
  const [nestedOuter, setNestedOuter] = useState<'original' | 'modified'>('original');
  const [matches, setMatches] = useState<MatchResult | null>(null);

  // Nearest-paint search, debounced while dragging.
  useEffect(() => {
    const t = setTimeout(() => {
      const brands = loadedBrands();
      if (brands.length) setMatches(findMatches(brands, oklabToLab(state.current), { perBrand: 3, overall: 5 }));
    }, 50);
    return () => clearTimeout(t);
  }, [state.current, dataVersion]);

  // Load the index, then every brand.
  useEffect(() => {
    loadIndex()
      .then(async (idx) => {
        setIndex(idx);
        await Promise.all(idx.brands.map((b) => loadBrand(b.id).then(() => setDataVersion((v) => v + 1))));
        const ref = defaultPaint();
        if (ref) dispatch({ type: 'selectPaint', ref, lab: paintInfo(ref)!.oklab });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const pickPaint = useCallback((ref: PaintRef) => {
    const p = paintInfo(ref);
    if (p) dispatch({ type: 'selectPaint', ref, lab: p.oklab });
  }, []);

  const values = useMemo(() => sliderValues(state.current), [state.current]);
  const originalValues = useMemo(() => sliderValues(state.originalLab), [state.originalLab]);

  const move = (id: SliderId, target: number, discrete = false) => {
    const r = solve(state.current, id, target, state.locks);
    dispatch({ type: 'edit', id, lab: r.lab, limited: r.limited, now: performance.now(), discrete });
  };

  // Hide the "limited by locks" hint after a moment.
  useEffect(() => {
    if (!state.limited) return;
    const t = setTimeout(() => dispatch({ type: 'clearLimited' }), 2500);
    return () => clearTimeout(t);
  }, [state.limited, state.current]);

  // Keyboard undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'z') {
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
        e.preventDefault();
      } else if (e.key.toLowerCase() === 'y') {
        dispatch({ type: 'redo' });
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const original = state.original ? paintInfo(state.original) : null;
  const nearest = matches?.overall[0];
  const nearestPaint = nearest ? paintInfo(nearest) : null;
  const panels: Panel[] = [
    { key: 'original', title: 'Original', lab: state.originalLab, display: oklabToHex(state.originalLab), paint: original },
    { key: 'modified', title: 'Modified', lab: state.current, display: oklabToHex(state.current), paint: null, subtitle: oklabToHex(state.current).toUpperCase() },
  ];
  if (nearestPaint && nearest) {
    panels.push({
      key: 'third',
      title: 'Nearest paint',
      lab: nearestPaint.oklab,
      display: nearestPaint.hex,
      paint: nearestPaint,
      extra: `ΔE ${nearest.de.toFixed(1)} · ${deltaELabel(nearest.de)}`,
    });
  }

  return (
    <div class="app">
      <header class="topbar">
        <Search dataVersion={dataVersion} onPick={pickPaint} />
        <div class="topbar-actions">
          <button type="button" class="icon-btn" aria-label="Undo" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}>
            <UndoIcon />
          </button>
          <button type="button" class="icon-btn" aria-label="Redo" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}>
            <RedoIcon />
          </button>
        </div>
      </header>

      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}

      <div class="layout">
        <section class="compare" aria-label="Color comparison">
          <Compare
            panels={panels}
            mode={compareMode}
            onMode={setCompareMode}
            nestedOuter={nestedOuter}
            onSwapNested={() => setNestedOuter((o) => (o === 'original' ? 'modified' : 'original'))}
          />
        </section>

        <section class="controls" aria-label="Adjustments">
          <div class="controls-bar">
            <span class="controls-note">Lock a slider to hold its value while you move others.</span>
            <button type="button" class="text-btn" onClick={() => dispatch({ type: 'resetAll' })}>
              <ResetIcon /> Reset all
            </button>
          </div>
          {GROUPS.map((g) => (
            <div class="slider-group" key={g.id}>
              <h2>{g.title}</h2>
              {SLIDERS.filter((s) => s.group === g.id).map((def) => {
                const locked = state.locks[def.id] !== undefined;
                return (
                  <SliderRow
                    key={def.id}
                    def={def}
                    value={locked ? state.locks[def.id]! : values[def.id]}
                    locked={locked}
                    limited={state.limited === def.id}
                    originalValue={originalValues[def.id]}
                    track={sliderTrack(def.id, state.current)}
                    onMove={(t, discrete) => move(def.id, t, discrete)}
                    onToggleLock={() => dispatch({ type: 'toggleLock', id: def.id, value: values[def.id] })}
                    onReset={() => move(def.id, originalValues[def.id], true)}
                  />
                );
              })}
            </div>
          ))}
        </section>
      </div>
      <Footer index={index} />
    </div>
  );
}
