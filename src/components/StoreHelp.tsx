import { useState } from 'preact/hooks';
import { deltaELabel } from '../color/ciede2000';
import { describeAdjustment } from '../color/describe';
import { oklabToHex } from '../color/convert';
import { adjustmentBase, paintLabel, pct, storeNoteText, type StoreNoteInput } from '../storeNote';

interface Props {
  input: StoreNoteInput;
  notify(msg: string): void;
}

export function StoreHelp({ input, notify }: Props) {
  const [open, setOpen] = useState(false);
  const { nearest, formulas } = input;
  const base = adjustmentBase(input);
  const adj = base ? describeAdjustment(base.oklab, input.target) : null;
  const closeEnough = !!nearest && nearest.de < 1;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(storeNoteText(input));
      notify('Store note copied');
    } catch {
      notify('Could not copy: clipboard not available');
    }
  };

  return (
    <div class="store-help">
      <div class="store-head">
        <h3>Take it to the store</h3>
        <button type="button" class="small-btn" onClick={copy}>
          Copy note
        </button>
      </div>
      {closeEnough && nearest ? (
        <p class="store-line">
          <strong>Just buy {paintLabel(nearest.paint)}</strong>: the difference (ΔE {nearest.de.toFixed(1)}) won't be visible.
        </p>
      ) : (
        <>
          {nearest && (
            <p class="store-line">
              Closest stock paint: <strong>{paintLabel(nearest.paint)}</strong> (ΔE {nearest.de.toFixed(1)}, {deltaELabel(nearest.de)}).
            </p>
          )}
          {formulas.length > 0 && (
            <>
              <p class="store-line">Closer: ask for a stock paint mixed at a different strength:</p>
              <ul class="strength-list">
                {formulas.map((f) => (
                  <li key={`${f.paint.brand}:${f.paint.index}`} class="strength-row" data-strength={`${f.paint.brand}:${f.paint.index}@${pct(f.strength)}`}>
                    <span class="chip" style={{ background: f.paint.hex }} title="Stock color at 100%" />
                    <span class="strength-arrow" aria-hidden="true">
                      →
                    </span>
                    <span class="chip" style={{ background: oklabToHex(f.lab) }} title={`Estimated at ${pct(f.strength)}`} />
                    <span class="match-text">
                      <span class="hit-name">
                        {f.paint.name} at {pct(f.strength)}
                      </span>
                      <span class="hit-meta">
                        {f.paint.brandName}
                        {f.paint.code ? ` · ${f.paint.code}` : ''} · est. ΔE {f.de.toFixed(1)} ({deltaELabel(f.de)})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {base && adj && !adj.same && (
            <p class="store-line">
              {nearest || formulas.length ? 'Or ask' : 'Ask'} for <strong>{paintLabel(base)}</strong> adjusted: {adj.phrases.join('; ')}.
            </p>
          )}
          {formulas.length === 0 && !adj?.phrases.length && <p class="store-line muted">Pick a paint and adjust it to get store suggestions.</p>}
        </>
      )}
      <button type="button" class="link-btn small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide' : 'How this works'}
      </button>
      {open && (
        <div class="small muted store-about">
          <p>
            Stores can't reliably mix from a hex code: screens vary and a hex value says nothing about how the paint reflects
            light. What they can do is make a named color at a <strong>percentage strength</strong> (the same colorants, more or
            less of them; under 100% is lighter and softer, over 100% deeper) or nudge a formula in a direction you describe.
          </p>
          <p>
            Strength results are estimated with a simple pigment-mixing model and a white base, so treat them as a starting
            point. They work best for light and mid-tone colors; deep colors are made in different bases. Buy a sample, paint a
            large swatch, and ask the store to adjust from there.
          </p>
        </div>
      )}
    </div>
  );
}
