import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { approxLrv, oklabToHex, type OKLab } from '../color/convert';
import { loadBrand, loadIndex, loadedBrands, paintInfo, paintKey, resolvePaintKey } from '../data/store';
import { loadJSON, saveJSON } from '../storage';
import { Search } from '../components/Search';
import { TouchSafeRange } from '../components/TouchSafeRange';
import type { CompareSlot } from '../components/CompareTwo';
import { renderWheel, toWorld, type Slice } from './geometry';
import { MapCanvas, MAX_ZOOM, MIN_ZOOM, type View } from './MapCanvas';
import { buildPoints, findPoint, sliceIds, type MapPoints } from './points';

const BG_SIZE = 720;
const EXTENT = 1.04;
const BANDS = [
  { v: 2, label: '±2' },
  { v: 5, label: '±5' },
  { v: 10, label: '±10' },
  { v: Infinity, label: 'All' },
];

interface HashState {
  view: View | null;
  slice: Slice | null;
  marker: OKLab | null;
  sel: string | null;
}

function readHash(): HashState {
  const p = new URLSearchParams(location.hash.slice(1));
  const nums = (k: string) => (p.get(k) ?? '').split(',').map(Number);
  const c = nums('c');
  const v = nums('v');
  const lrv = Number(p.get('lrv'));
  const band = p.get('band');
  return {
    marker: c.length === 3 && c.every(Number.isFinite) ? (c as OKLab) : null,
    view: v.length === 3 && v.every(Number.isFinite) ? { x: v[0], y: v[1], zoom: v[2] } : null,
    slice: p.has('lrv') && Number.isFinite(lrv) ? { lrv, band: band === 'all' ? Infinity : Number(band) || 5 } : null,
    sel: p.get('sel'),
  };
}

export function MapApp() {
  const initial = useMemo(readHash, []);
  const [points, setPoints] = useState<MapPoints | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [slice, setSlice] = useState<Slice>(
    initial.slice ?? { lrv: initial.marker ? Math.round(approxLrv(initial.marker)) : 75, band: 5 },
  );
  const [selected, setSelected] = useState(-1);
  const [view, setView] = useState<View>(() => {
    if (initial.view) return initial.view;
    if (initial.marker) {
      const [x, y] = toWorld(initial.marker);
      return { x, y, zoom: 12 };
    }
    return { x: 0, y: 0, zoom: 1 };
  });
  const liveView = useRef(view);
  const [bg, setBg] = useState<HTMLCanvasElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Load every brand enabled in the tuner's brand filter.
  useEffect(() => {
    loadIndex()
      .then(async (idx) => {
        const saved = loadJSON<string[] | null>('pct.brands', null);
        const ids = idx.brands.map((b) => b.id).filter((id) => !saved || saved.includes(id));
        await Promise.all(ids.map(loadBrand));
        setDataVersion((v) => v + 1);
        const pts = buildPoints(loadedBrands());
        setPoints(pts);
        // Opened from the tuner: zoom in until roughly 250 paints of this slice are on screen,
        // so names show without losing the neighborhood.
        if (initial.marker && !initial.view) {
          const [mx, my] = toWorld(initial.marker);
          const sl = sliceIds(pts, slice);
          const aspect = innerHeight / innerWidth;
          let zoom = 1;
          for (const z of [60, 40, 25, 16, 10, 6, 4, 2.5, 1.5, 1]) {
            // Half-width of the screen in world units at this zoom (fit radius is 0.4 × the short side).
            const hw = 1 / (0.8 * z);
            let n = 0;
            for (const id of sl) if (Math.abs(pts.x[id] - mx) < hw && Math.abs(pts.y[id] - my) < hw * aspect) n++;
            if (n > 250) break;
            zoom = z;
          }
          goTo(mx, my, zoom);
        }
        if (initial.sel) {
          const ref = await resolvePaintKey(initial.sel);
          if (ref) setSelected(findPoint(buildPointsCache(), ref.brand, ref.index));
        }
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  // findPoint needs the points we just built; keep a handle without waiting for a render.
  const pointsRef = useRef<MapPoints | null>(null);
  pointsRef.current = points;
  const buildPointsCache = () => pointsRef.current ?? buildPoints(loadedBrands());

  const ids = useMemo(() => (points ? sliceIds(points, slice) : new Uint32Array()), [points, slice.lrv, slice.band]);

  // Repaint the wheel background for the slice's lightness (debounced while sliding).
  useEffect(() => {
    const t = setTimeout(() => {
      const c = document.createElement('canvas');
      c.width = c.height = BG_SIZE;
      const img = new ImageData(renderWheel(BG_SIZE, slice.lrv, EXTENT), BG_SIZE, BG_SIZE);
      c.getContext('2d')!.putImageData(img, 0, 0);
      setBg(c);
    }, 60);
    return () => clearTimeout(t);
  }, [slice.lrv]);

  // Keep the URL shareable.
  const writeHash = () => {
    const v = liveView.current;
    const p = new URLSearchParams(location.hash.slice(1));
    p.set('v', [v.x, v.y, v.zoom].map((n) => Math.round(n * 1e5) / 1e5).join(','));
    p.set('lrv', String(slice.lrv));
    p.set('band', Number.isFinite(slice.band) ? String(slice.band) : 'all');
    if (points && selected >= 0) p.set('sel', paintKey({ brand: points.brand[selected], index: points.index[selected] }));
    else p.delete('sel');
    history.replaceState(null, '', '#' + p.toString().replace(/%2C/g, ','));
  };
  const hashTimer = useRef(0);
  const queueHash = () => {
    clearTimeout(hashTimer.current);
    hashTimer.current = window.setTimeout(writeHash, 300);
  };
  useEffect(queueHash, [slice, selected, points]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Other paints in the slice at (practically) the same spot as the selected one.
  const stackMates = useMemo(() => {
    if (!points || selected < 0) return [];
    const out: number[] = [];
    for (const id of ids) {
      if (id !== selected && Math.abs(points.x[id] - points.x[selected]) < 0.0015 && Math.abs(points.y[id] - points.y[selected]) < 0.0015) out.push(id);
    }
    return out.slice(0, 12);
  }, [points, ids, selected]);

  const info = points && selected >= 0 ? paintInfo({ brand: points.brand[selected], index: points.index[selected] }) : null;
  const marker = useMemo(() => (initial.marker ? toWorld(initial.marker) : null), []);

  const goTo = (x: number, y: number, zoom: number) => {
    const v = { x, y, zoom };
    liveView.current = v;
    setView(v);
    queueHash();
  };
  const zoomBy = (f: number) => {
    const v = liveView.current;
    goTo(v.x, v.y, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * f)));
  };

  const backToTuner = (e: Event) => {
    // Return to the tuner as it was (its state lives in its own URL) when we came from it.
    if (document.referrer && new URL(document.referrer).pathname === new URL('./', location.href).pathname && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  };

  return (
    <div class="map-page">
      <MapCanvas
        points={points}
        ids={ids}
        background={bg}
        extent={EXTENT}
        lrv={slice.lrv}
        view={view}
        onView={(v) => {
          liveView.current = v;
          queueHash();
        }}
        selected={selected}
        onSelect={setSelected}
        marker={marker}
      />

      <header class="map-top">
        <a class="text-btn" href="./" onClick={backToTuner}>
          ← Tuner
        </a>
        <Search
          dataVersion={dataVersion}
          label="Find a paint on the map"
          placeholder="Find a paint"
          listId="map-search-results"
          onPick={(ref) => {
            const p = paintInfo(ref);
            if (!p || !points) return;
            const id = findPoint(points, ref.brand, ref.index);
            setSlice((s) => ({ ...s, lrv: Math.round(approxLrv(p.oklab)) }));
            setSelected(id);
            const [x, y] = toWorld(p.oklab);
            goTo(x, y, Math.max(liveView.current.zoom, 40));
          }}
        />
      </header>

      <div class="map-zoom">
        <button type="button" class="icon-btn map-btn" aria-label="Zoom in" onClick={() => zoomBy(2)}>
          +
        </button>
        <button type="button" class="icon-btn map-btn" aria-label="Zoom out" onClick={() => zoomBy(0.5)}>
          −
        </button>
        <button type="button" class="icon-btn map-btn" aria-label="Show the whole wheel" onClick={() => goTo(0, 0, 1)}>
          ⤢
        </button>
      </div>

      <section class="map-bottom" aria-label="Map controls">
        {error && <p role="alert">{error}</p>}
        {info && (
          <div class="map-card" data-selected={paintKey(info)}>
            <span class="chip chip-lg" style={{ background: info.hex }} />
            <span class="match-text">
              <span class="hit-name">{info.name}</span>
              <span class="hit-meta">
                {info.brandName}
                {info.code ? ` · ${info.code}` : ''} · {info.lrv != null ? `LRV ${info.lrv}` : `approx. LRV ${info.approxLrv.toFixed(0)}`} ·{' '}
                {info.hex.toUpperCase()}
              </span>
              <span class="map-card-actions">
                <a class="small-btn" href={`./#p=${encodeURIComponent(paintKey(info))}`}>
                  Open in tuner
                </a>
                <button
                  type="button"
                  class="small-btn"
                  onClick={() => {
                    const slots = loadJSON<Record<'a' | 'b', CompareSlot | null>>('pct.compareTwo', { a: null, b: null });
                    const slot: CompareSlot = {
                      name: info.name,
                      meta: `${info.brandName}${info.code ? ' · ' + info.code : ''}`,
                      oklab: info.oklab,
                      lrv: info.lrv,
                      paint: paintKey(info),
                    };
                    saveJSON('pct.compareTwo', slots.a ? { a: slots.a, b: slot } : { a: slot, b: slots.b });
                    setToast(`${info.name} added to Compare two colors (as ${slots.a ? 'B' : 'A'})`);
                  }}
                >
                  Add to compare
                </button>
              </span>
              {stackMates.length > 0 && (
                <span class="map-stack">
                  <span class="muted small">Also here (lighter or darker):</span>
                  {stackMates.map((id) => (
                    <button key={id} type="button" class="map-stack-item" onClick={() => setSelected(id)}>
                      <span class="chip chip-xs" style={{ background: points!.color[id] }} />
                      {points!.label[id]}
                    </button>
                  ))}
                </span>
              )}
            </span>
            <button type="button" class="icon-btn" aria-label="Close" onClick={() => setSelected(-1)}>
              ✕
            </button>
          </div>
        )}
        <div class="map-slice">
          <label class="map-slice-label" for="map-lrv">
            Lightness <strong>{Number.isFinite(slice.band) ? `LRV ${Math.max(0, slice.lrv - slice.band)}–${Math.min(100, slice.lrv + slice.band)}` : 'all'}</strong>
            <span class="muted"> · {points ? `${ids.length.toLocaleString()} paints` : 'loading…'}</span>
          </label>
          <div class="map-slice-row">
            <TouchSafeRange
              id="map-lrv"
              min={0}
              max={100}
              step={1}
              value={slice.lrv}
              disabled={!Number.isFinite(slice.band)}
              ariaLabel="Lightness slice (LRV)"
              style={{ '--track': `linear-gradient(to right, #000, ${oklabToHex([Math.cbrt(0.5), 0, 0])}, #fff)` }}
              onValue={(v) => setSlice((s) => ({ ...s, lrv: v }))}
            />
            <div class="segmented" role="group" aria-label="Lightness slice width">
              {BANDS.map((b) => (
                <button key={b.label} type="button" aria-pressed={slice.band === b.v} onClick={() => setSlice((s) => ({ ...s, band: b.v }))}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
