import { useState } from 'preact/hooks';
import { approxLrv, oklabToHex, type OKLab } from '../color/convert';
import type { PaintInfo } from '../data/store';

export interface Panel {
  key: string;
  title: string;
  lab: OKLab;
  paint: PaintInfo | null;
  subtitle?: string;
}

function PanelLabel({ p }: { p: Panel }) {
  const hex = oklabToHex(p.lab);
  return (
    <div class="panel-label">
      <span class="panel-title">{p.title}</span>
      <span class="panel-name">{p.paint ? p.paint.name : hex.toUpperCase()}</span>
      <span class="panel-meta">
        {p.paint ? `${p.paint.brandName}${p.paint.code ? ' · ' + p.paint.code : ''}` : p.subtitle ?? 'custom color'}
      </span>
      <span class="panel-meta">
        {p.paint?.lrv != null ? `LRV ${p.paint.lrv} · ` : ''}approx. LRV {approxLrv(p.lab).toFixed(1)}
      </span>
    </div>
  );
}

export function Compare({ panels }: { panels: Panel[] }) {
  const [full, setFull] = useState<string | null>(null);
  const fullPanel = panels.find((p) => p.key === full);
  return (
    <>
      <div class="compare-side" style={{ '--cols': panels.length }}>
        {panels.map((p) => (
          <figure class="panel" key={p.key}>
            <button
              type="button"
              class="swatch"
              style={{ background: oklabToHex(p.lab) }}
              aria-label={`Show ${p.title.toLowerCase()} full screen`}
              onClick={() => setFull(p.key)}
            />
            <figcaption>
              <PanelLabel p={p} />
            </figcaption>
          </figure>
        ))}
      </div>
      {fullPanel && (
        <button
          type="button"
          class="fullscreen"
          style={{ background: oklabToHex(fullPanel.lab) }}
          aria-label="Close full-screen swatch"
          onClick={() => setFull(null)}
        >
          <span class="fullscreen-label">
            {fullPanel.title}: {fullPanel.paint ? fullPanel.paint.name : oklabToHex(fullPanel.lab).toUpperCase()} · tap to close
          </span>
        </button>
      )}
    </>
  );
}
