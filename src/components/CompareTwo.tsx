import { useEffect, useState } from 'preact/hooks';
import { ciede2000, deltaELabel } from '../color/ciede2000';
import { oklabToHex, oklabToLab, type OKLab } from '../color/convert';
import { describeAdjustment } from '../color/describe';
import { diffRows, formatDiff } from '../color/diff';
import { sliderDiff } from '../color/sliders';
import { paintInfo, paintKey, type PaintInfo, type PaintRef } from '../data/store';
import { loadJSON, saveJSON } from '../storage';
import { Search } from './Search';

/** One side of the comparison: a named paint or a custom color, stored self-contained. */
export interface CompareSlot {
  name: string;
  /** Brand · code for paints, hex for custom colors. */
  meta: string;
  oklab: OKLab;
  /** Manufacturer LRV when it's a named paint that publishes one. */
  lrv: number | null;
  paint?: string;
}

interface Props {
  dataVersion: number;
  render(lab: OKLab): string;
  current: OKLab;
  original: PaintInfo | null;
  /** Make a compared paint the main tool's original. */
  onUseAsOriginal(key: string): void;
}

const fromPaint = (p: PaintInfo): CompareSlot => ({
  name: p.name,
  meta: `${p.brandName}${p.code ? ' · ' + p.code : ''}`,
  oklab: p.oklab,
  lrv: p.lrv,
  paint: paintKey(p),
});

const custom = (lab: OKLab, name: string): CompareSlot => ({ name, meta: oklabToHex(lab).toUpperCase(), oklab: lab, lrv: null });

type Side = 'a' | 'b';

export function CompareTwo({ dataVersion, render, current, original, onUseAsOriginal }: Props) {
  const [slots, setSlots] = useState<Record<Side, CompareSlot | null>>(() => loadJSON('pct.compareTwo', { a: null, b: null }));
  useEffect(() => saveJSON('pct.compareTwo', slots), [slots]);
  const set = (side: Side, slot: CompareSlot) => setSlots((s) => ({ ...s, [side]: slot }));

  const { a, b } = slots;
  const rows = a && b ? diffRows(a.oklab, b.oklab) : [];
  let de = 0;
  if (a && b) {
    const la = oklabToLab(a.oklab);
    const lb = oklabToLab(b.oklab);
    de = ciede2000(la[0], la[1], la[2], lb[0], lb[1], lb[2]);
  }
  const summary = a && b ? describeAdjustment(a.oklab, b.oklab) : null;

  const slotView = (side: Side) => {
    const s = slots[side];
    const label = side === 'a' ? 'A' : 'B';
    return (
      <div class="ct-slot" data-slot={side}>
        <div class="ct-slot-head">
          <span class="ct-letter">{label}</span>
          {s ? (
            <span class="ct-name">
              <span class="hit-name">{s.name}</span>
              <span class="hit-meta">
                {s.meta}
                {s.lrv != null ? ` · LRV ${s.lrv}` : ''}
              </span>
            </span>
          ) : (
            <span class="ct-name muted">Search for a paint</span>
          )}
        </div>
        <Search
          dataVersion={dataVersion}
          label={`Search paint for color ${label}`}
          placeholder={`Color ${label}: name or code`}
          listId={`ct-results-${side}`}
          onPick={(ref: PaintRef) => {
            const p = paintInfo(ref);
            if (p) set(side, fromPaint(p));
          }}
        />
        <div class="ct-quick">
          <button type="button" class="small-btn" disabled={!original} onClick={() => original && set(side, fromPaint(original))}>
            Use original
          </button>
          <button type="button" class="small-btn" onClick={() => set(side, custom(current, 'Modified color'))}>
            Use modified
          </button>
          {s?.paint && (
            <button type="button" class="small-btn" onClick={() => onUseAsOriginal(s.paint!)}>
              Edit this
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div class="compare-two">
      <p class="muted small ct-intro">Compare any two paints side by side and see how far apart they are on each slider.</p>
      <div class="ct-slots">
        {slotView('a')}
        {slotView('b')}
      </div>

      {a && b ? (
        <>
          <div class="ct-strip" role="img" aria-label={`${a.name} next to ${b.name}`}>
            <span style={{ background: render(a.oklab) }}>
              <b>A</b>
            </span>
            <span style={{ background: render(b.oklab) }}>
              <b>B</b>
            </span>
          </div>
          <div class="ct-verdict">
            <span class="ct-de">
              ΔE {de.toFixed(1)} · <strong>{deltaELabel(de)}</strong>
            </span>
            <button type="button" class="small-btn" onClick={() => setSlots({ a: b, b: a })} aria-label="Swap A and B">
              ⇄ Swap
            </button>
          </div>
          <p class="ct-summary">
            {summary && !summary.same ? (
              <>
                <strong>B vs. A:</strong> {summary.phrases.join('; ')}.
              </>
            ) : (
              'These two are practically the same color.'
            )}
          </p>
          <table class="ct-table">
            <thead>
              <tr>
                <th scope="col">Slider</th>
                <th scope="col" class="num">
                  A
                </th>
                <th scope="col" class="num">
                  B
                </th>
                <th scope="col" class="num">
                  B − A
                </th>
              </tr>
            </thead>
            <tbody>
              {a.lrv != null && b.lrv != null && (
                <tr data-row="publishedLrv">
                  <th scope="row">Published LRV</th>
                  <td class="num">{a.lrv}</td>
                  <td class="num">{b.lrv}</td>
                  <td class={`num diff ${b.lrv > a.lrv ? 'pos' : b.lrv < a.lrv ? 'neg' : ''}`}>
                    {formatDiff(b.lrv - a.lrv, Number.isInteger(a.lrv) && Number.isInteger(b.lrv) ? 0 : 1)}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                // Difference of the displayed (rounded) values, so the columns always add up.
                const dec = r.def.decimals;
                const ra = Number(r.a.toFixed(dec));
                const rb = Number(r.b.toFixed(dec));
                const shown = r.diff === null ? null : r.def.angular ? sliderDiff(r.def, rb, ra) : rb - ra;
                const d = shown === null ? '–' : formatDiff(shown, dec);
                const sign = d.startsWith('+') ? 'pos' : d.startsWith('−') ? 'neg' : '';
                return (
                  <tr key={r.def.id} data-row={r.def.id}>
                    <th scope="row">{r.def.id === 'lrv' ? 'LRV (approx.)' : r.def.label}</th>
                    <td class="num">{r.a.toFixed(r.def.decimals)}</td>
                    <td class="num">{r.b.toFixed(r.def.decimals)}</td>
                    <td class={`num diff ${sign}`}>{d}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p class="muted small">
            Hue is shown as “–” when either color is close to gray (its hue angle is meaningless). Approx. LRV is computed from the
            on-screen color; published LRV comes from the manufacturer.
          </p>
        </>
      ) : (
        <p class="muted small">Pick a color for both A and B to see how they differ.</p>
      )}
    </div>
  );
}
