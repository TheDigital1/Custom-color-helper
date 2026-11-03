import { useEffect, useState } from 'preact/hooks';
import { approxLrv, type OKLab } from '../color/convert';
import { sourceCount, type PaintInfo } from '../data/store';

export interface Panel {
  key: 'original' | 'modified' | 'third';
  title: string;
  lab: OKLab;
  /** Displayed color (may differ from lab under a lighting preset). */
  display: string;
  paint: PaintInfo | null;
  subtitle?: string;
  extra?: string;
}

export type CompareMode = 'side' | 'nested';

interface Props {
  panels: Panel[];
  mode: CompareMode;
  onMode(m: CompareMode): void;
  /** Which panel is the outer square in nested mode. */
  nestedOuter: 'original' | 'modified';
  onSwapNested(): void;
  /** Rendered under the swatches (e.g. lighting note). */
  note?: string;
}

function PanelLabel({ p }: { p: Panel }) {
  return (
    <div class="panel-label">
      <span class="panel-title">{p.title}</span>
      <span class="panel-name" title={p.paint?.name}>
        {p.paint ? p.paint.name : p.subtitle}
      </span>
      <span class="panel-meta">{p.paint ? `${p.paint.brandName}${p.paint.code ? ' · ' + p.paint.code : ''}` : 'custom color'}</span>
      <span class="panel-meta panel-lrv">
        {p.paint?.lrv != null ? `LRV ${p.paint.lrv} · ` : ''}approx. LRV {approxLrv(p.lab).toFixed(1)}
      </span>
      {p.paint && sourceCount() > 1 && <span class="panel-meta panel-source">Source: {p.paint.source}</span>}
      {p.paint?.altHex.map((a) => (
        <span class="panel-meta alt-hex" key={a.source} title="The same color has a different hex value in another data source">
          <span class="chip chip-xs" style={{ background: a.hex }} /> {a.source}: {a.hex.toUpperCase()} (vs {p.paint!.hex.toUpperCase()})
        </span>
      ))}
      {p.extra && <span class="panel-meta panel-extra">{p.extra}</span>}
    </div>
  );
}

type Full = { kind: 'single'; key: Panel['key'] } | { kind: 'nested' } | null;

export function Compare({ panels, mode, onMode, nestedOuter, onSwapNested, note }: Props) {
  const [full, setFull] = useState<Full>(null);
  const byKey = (k: Panel['key']) => panels.find((p) => p.key === k)!;
  const outer = byKey(nestedOuter);
  const inner = byKey(nestedOuter === 'original' ? 'modified' : 'original');

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  return (
    <>
      <div class="compare-toolbar">
        <div class="segmented" role="group" aria-label="Comparison view">
          <button type="button" aria-pressed={mode === 'side'} onClick={() => onMode('side')}>
            Side by side
          </button>
          <button type="button" aria-pressed={mode === 'nested'} onClick={() => onMode('nested')}>
            Nested
          </button>
        </div>
        <button
          type="button"
          class="text-btn"
          aria-label="Full screen"
          onClick={() => setFull(mode === 'nested' ? { kind: 'nested' } : { kind: 'single', key: 'modified' })}
        >
          ⤢ Full screen
        </button>
      </div>

      {mode === 'side' ? (
        <div class="compare-side" style={{ '--cols': panels.length }}>
          {panels.map((p) => (
            <figure class="panel" key={p.key} data-panel={p.key}>
              <button
                type="button"
                class="swatch"
                style={{ background: p.display }}
                aria-label={`Show ${p.title.toLowerCase()} full screen`}
                onClick={() => setFull({ kind: 'single', key: p.key })}
              />
              <figcaption>
                <PanelLabel p={p} />
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div class="compare-nested">
          <button
            type="button"
            class="nested-swatch"
            data-outer={outer.key}
            style={{ background: outer.display }}
            aria-label={`Swap: show ${inner.title.toLowerCase()} outside`}
            onClick={onSwapNested}
          >
            <span class="nested-inner" style={{ background: inner.display }} />
          </button>
          <div class="nested-labels">
            <PanelLabel p={{ ...outer, title: `${outer.title} (outside)` }} />
            <PanelLabel p={{ ...inner, title: `${inner.title} (inside)` }} />
            <p class="nested-tip">Tap the swatch to swap inside and outside.</p>
          </div>
        </div>
      )}
      {note && <p class="compare-note">{note}</p>}

      {full && (
        <button
          type="button"
          class="fullscreen"
          style={{ background: full.kind === 'nested' ? outer.display : byKey(full.key).display }}
          aria-label="Close full-screen swatch"
          onClick={() => setFull(null)}
        >
          {full.kind === 'nested' && <span class="fullscreen-inner" style={{ background: inner.display }} />}
          <span class="fullscreen-label">
            {full.kind === 'nested'
              ? `Outside: ${outer.paint?.name ?? outer.subtitle} · inside: ${inner.paint?.name ?? inner.subtitle}`
              : `${byKey(full.key).title}: ${byKey(full.key).paint?.name ?? byKey(full.key).subtitle}`}{' '}
            · tap to close
          </span>
        </button>
      )}
    </>
  );
}
