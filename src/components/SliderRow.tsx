import { TouchSafeRange } from './TouchSafeRange';
import type { SliderDef } from '../color/sliders';

interface Props {
  def: SliderDef;
  value: number;
  locked: boolean;
  limited: boolean;
  /** Value of this slider for the original paint (reset target). */
  originalValue: number;
  /** Gradient preview along the slider track. */
  track?: string;
  /** `discrete` is true for button presses (each one is its own undo step). */
  onMove(target: number, discrete?: boolean): void;
  onToggleLock(): void;
  onReset(): void;
}

const fmt = (def: SliderDef, v: number) => v.toFixed(def.decimals);

export function SliderRow({ def, value, locked, limited, originalValue, track, onMove, onToggleLock, onReset }: Props) {
  const changed = Math.abs(value - originalValue) >= def.step / 2 && !(def.angular && Math.abs(Math.abs(value - originalValue) - 360) < def.step);
  const nudge = (dir: number) => {
    let t = value + dir * def.nudge;
    if (def.angular) t = ((t % 360) + 360) % 360;
    onMove(t, true);
  };
  return (
    <div class={`slider-row${locked ? ' is-locked' : ''}${limited ? ' is-limited' : ''}`} data-slider={def.id}>
      <div class="slider-head">
        <label class="slider-label" for={`s-${def.id}`}>
          {def.label}
          <span class="slider-hint">{def.hint}</span>
        </label>
        <output class="slider-value" for={`s-${def.id}`} aria-live="off">
          {fmt(def, value)}
        </output>
        <button
          type="button"
          class={`icon-btn lock-btn${locked ? ' on' : ''}`}
          aria-pressed={locked}
          aria-label={`${locked ? 'Unlock' : 'Lock'} ${def.label}`}
          title={locked ? 'Locked: holds its value' : 'Lock this value'}
          onClick={onToggleLock}
        >
          {locked ? <LockIcon /> : <UnlockIcon />}
        </button>
        <button
          type="button"
          class="icon-btn"
          aria-label={`Reset ${def.label} to original`}
          title="Reset to original"
          disabled={!changed || locked}
          onClick={onReset}
        >
          <ResetIcon />
        </button>
      </div>
      <div class="slider-body">
        <button type="button" class="icon-btn nudge" aria-label={`Decrease ${def.label}`} disabled={locked} onClick={() => nudge(-1)}>
          −
        </button>
        <TouchSafeRange
          id={`s-${def.id}`}
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          disabled={locked}
          style={track ? { '--track': track } : undefined}
          onValue={(v) => onMove(v)}
        />
        <button type="button" class="icon-btn nudge" aria-label={`Increase ${def.label}`} disabled={locked} onClick={() => nudge(1)}>
          +
        </button>
      </div>
      {limited && (
        <p class="limited-hint" role="status">
          Limited by locks
        </p>
      )}
    </div>
  );
}

const svg = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' } as const;

export const LockIcon = () => (
  <svg {...svg}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
export const UnlockIcon = () => (
  <svg {...svg}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.5-2" />
  </svg>
);
export const ResetIcon = () => (
  <svg {...svg}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);
export const UndoIcon = () => (
  <svg {...svg}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);
export const RedoIcon = () => (
  <svg {...svg}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
);
export const ShareIcon = () => (
  <svg {...svg}>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="m16 6-4-4-4 4" />
    <path d="M12 2v13" />
  </svg>
);
export const SearchIcon = () => (
  <svg {...svg}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
