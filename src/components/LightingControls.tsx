import { LIGHTING, type LightingId } from '../color/lighting';

interface Props {
  preset: LightingId;
  adaptation: number;
  onPreset(id: LightingId): void;
  onAdaptation(v: number): void;
}

export function LightingControls({ preset, adaptation, onPreset, onAdaptation }: Props) {
  return (
    <div class="lighting">
      <label class="lighting-row">
        <span class="lighting-label">Lighting</span>
        <select value={preset} onChange={(e) => onPreset((e.currentTarget as HTMLSelectElement).value as LightingId)} aria-label="Lighting preset">
          {LIGHTING.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      {preset !== 'd65' && (
        <label class="lighting-row">
          <span class="lighting-label">
            Eye adapts <strong>{Math.round(adaptation * 100)}%</strong>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(adaptation * 100)}
            aria-label="How much your eye adapts to the light"
            onInput={(e) => onAdaptation(parseFloat((e.currentTarget as HTMLInputElement).value) / 100)}
          />
        </label>
      )}
      <details class="lighting-note">
        <summary>About this approximation</summary>
        <p>
          Swatches are shifted with a Bradford chromatic adaptation from daylight (D65) to the light's white point, partly
          undone by how much your eye adapts. Paint data has no spectral information, so this is only a rough guide: two
          paints that match in daylight can look different under other lights (metamerism), and that cannot be predicted
          here. Matches and ΔE values are always computed under daylight (D65).
        </p>
      </details>
    </div>
  );
}
