import { useRef, useState } from 'preact/hooks';
import { deltaELabel } from '../color/ciede2000';
import type { Match, MatchResult } from '../color/match';
import { paintInfo, type PaintRef } from '../data/store';
import type { BrandSummary } from '../data/types';

interface Props {
  result: MatchResult | null;
  brands: BrandSummary[];
  enabled: string[];
  brandOnly: boolean;
  originalBrand: string | null;
  loading: boolean;
  pinned: PaintRef | null;
  onToggleBrand(id: string): void;
  onSetBrands(ids: string[]): void;
  onBrandOnly(v: boolean): void;
  onUseAsOriginal(ref: PaintRef): void;
  onPin(ref: PaintRef | null): void;
}

function MatchRow({ m, pinned, onUse, onPin }: { m: Match; pinned: boolean; onUse(): void; onPin(): void }) {
  const p = paintInfo(m);
  if (!p) return null;
  return (
    <li class="match-row" data-match={`${m.brand}:${m.index}`}>
      <span class="chip chip-lg" style={{ background: p.hex }} />
      <span class="match-text">
        <span class="hit-name">{p.name}</span>
        <span class="hit-meta">
          {p.brandName}
          {p.code ? ` · ${p.code}` : ''}
          {p.lrv != null ? ` · LRV ${p.lrv}` : ''}
        </span>
        <span class="match-de">
          ΔE {m.de.toFixed(1)} · <span class={`de-label de-${deltaELabel(m.de).replace(' ', '-')}`}>{deltaELabel(m.de)}</span>
        </span>
      </span>
      <span class="match-actions">
        <button type="button" class="small-btn" onClick={onUse} aria-label={`Use ${p.name} as the original`}>
          Use
        </button>
        <button type="button" class="small-btn" aria-pressed={pinned} onClick={onPin} aria-label={`Show ${p.name} in the third panel`}>
          Compare
        </button>
      </span>
    </li>
  );
}

export function MatchesSheet(props: Props) {
  const { result, brands, enabled, brandOnly, originalBrand, pinned } = props;
  const [expanded, setExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);

  const isPinned = (m: Match) => !!pinned && pinned.brand === m.brand && pinned.index === m.index;
  const best = result?.overall[0];
  const bestPaint = best ? paintInfo(best) : null;
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;
  const shownBrands = result ? Object.keys(result.byBrand).filter((id) => result.byBrand[id].length) : [];
  shownBrands.sort((a, b) => result!.byBrand[a][0].de - result!.byBrand[b][0].de);

  const row = (m: Match) => (
    <MatchRow
      key={`${m.brand}:${m.index}`}
      m={m}
      pinned={isPinned(m)}
      onUse={() => {
        props.onUseAsOriginal(m);
        setExpanded(false);
      }}
      onPin={() => props.onPin(isPinned(m) ? null : m)}
    />
  );

  return (
    <section class={`sheet${expanded ? ' expanded' : ''}`} aria-label="Closest matches">
      <button
        type="button"
        class="sheet-handle"
        aria-expanded={expanded}
        aria-controls="sheet-body"
        onClick={() => {
          if (!drag.current?.moved) setExpanded((e) => !e);
        }}
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dy = e.clientY - d.y;
          if (Math.abs(dy) > 24) {
            d.moved = true;
            setExpanded(dy < 0);
          }
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
      >
        <span class="grabber" aria-hidden="true" />
        <span class="sheet-summary">
          <span class="sheet-title">Closest matches</span>
          {bestPaint && best ? (
            <span class="sheet-best">
              <span class="chip" style={{ background: bestPaint.hex }} />
              <span>
                {bestPaint.name} ({bestPaint.brandName}) · ΔE {best.de.toFixed(1)}
              </span>
            </span>
          ) : (
            <span class="sheet-best">{props.loading ? 'Loading colors…' : 'No brands selected'}</span>
          )}
        </span>
        <span class="sheet-chevron" aria-hidden="true">
          {expanded ? '▾' : '▴'}
        </span>
      </button>

      <div class="sheet-body" id="sheet-body">
        <div class="sheet-tools">
          <button type="button" class="text-btn" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
            Brands ({brandOnly ? 1 : enabled.length}/{brands.length})
          </button>
          <label class="check">
            <input type="checkbox" checked={brandOnly} disabled={!originalBrand} onChange={(e) => props.onBrandOnly((e.currentTarget as HTMLInputElement).checked)} />
            {originalBrand ? `${brandName(originalBrand)} only` : 'Selected brand only'}
          </label>
          {result && <span class="sheet-ms">{result.ms.toFixed(0)} ms</span>}
        </div>
        {showFilters && (
          <fieldset class="brand-filter" disabled={brandOnly}>
            <legend>Search these brands</legend>
            <div class="brand-filter-actions">
              <button type="button" class="small-btn" onClick={() => props.onSetBrands(brands.map((b) => b.id))}>
                All
              </button>
              <button type="button" class="small-btn" onClick={() => props.onSetBrands([])}>
                None
              </button>
            </div>
            {brands.map((b) => (
              <label class="check" key={b.id}>
                <input type="checkbox" checked={enabled.includes(b.id)} onChange={() => props.onToggleBrand(b.id)} />
                {b.name} <span class="muted">({b.count.toLocaleString()})</span>
              </label>
            ))}
          </fieldset>
        )}
        {pinned && (
          <p class="pinned-note">
            Third panel shows a match you picked.{' '}
            <button type="button" class="link-btn" onClick={() => props.onPin(null)}>
              Show nearest instead
            </button>
          </p>
        )}
        {result && result.overall.length > 0 && (
          <>
            <h3>Best overall</h3>
            <ul class="match-list">{result.overall.slice(0, 3).map(row)}</ul>
            {shownBrands.map((id) => (
              <div key={id}>
                <h3>{brandName(id)}</h3>
                <ul class="match-list">{result.byBrand[id].map(row)}</ul>
              </div>
            ))}
          </>
        )}
        <p class="muted small">
          ΔE is CIEDE2000 under daylight (D65): under 1 indistinguishable, 1–2 very close, 2–3.5 subtle, 3.5–5 noticeable, over 5
          different.
        </p>
      </div>
    </section>
  );
}
