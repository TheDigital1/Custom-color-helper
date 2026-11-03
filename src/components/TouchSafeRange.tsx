import { useRef, useState } from 'preact/hooks';

interface Props {
  id?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  ariaLabel?: string;
  style?: Record<string, string>;
  onValue(v: number): void;
}

/** Movement (px) before a touch counts as a drag or a scroll. */
export const SLOP = 10;
/** Horizontal movement must beat vertical by this factor to count as a slider drag. */
const H_BIAS = 1.3;
/** Must match the thumb width in styles.css. */
const THUMB = 30;

type Gesture =
  | { kind: 'pending'; id: number; x: number; y: number; startValue: number }
  | { kind: 'drag'; id: number; x: number; startValue: number; touch: boolean }
  | { kind: 'scroll'; id: number };

/**
 * A range slider that doesn't move when you're scrolling past it on a phone.
 *
 * The native <input type="range"> stays for keyboard and screen-reader use, but pointer input
 * is handled by the wrapper:
 * - Touch/pen: nothing happens until the finger has moved SLOP px. Mostly vertical → it's a
 *   scroll and the slider is ignored (the browser scrolls; touch-action: pan-y). Mostly
 *   horizontal → drag, relative to where the finger started (no jump to the finger), so
 *   grabbing anywhere on the row works and small adjustments are easy. A plain tap does nothing.
 * - Mouse: click to jump, drag to adjust, as usual.
 */
export function TouchSafeRange({ id, min, max, step, value, disabled, ariaLabel, style, onValue }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);

  const snap = (v: number) => {
    const s = Math.round((v - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(s.toFixed(6))));
  };
  const trackWidth = () => Math.max(1, (wrap.current?.getBoundingClientRect().width ?? 1) - THUMB);
  const valueAtX = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return min + ((clientX - r.left - THUMB / 2) / trackWidth()) * (max - min);
  };

  const end = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
  };

  return (
    <div
      ref={wrap}
      class={`tsr${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      onPointerDown={(e) => {
        if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (e.pointerType === 'mouse') {
          e.preventDefault();
          wrap.current!.setPointerCapture(e.pointerId);
          (wrap.current!.querySelector('input') as HTMLInputElement).focus();
          gesture.current = { kind: 'drag', id: e.pointerId, x: e.clientX, startValue: value, touch: false };
          setDragging(true);
          onValue(snap(valueAtX(e.clientX)));
        } else {
          gesture.current = { kind: 'pending', id: e.pointerId, x: e.clientX, y: e.clientY, startValue: value };
        }
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g || g.id !== e.pointerId || g.kind === 'scroll') return;
        if (g.kind === 'pending') {
          const dx = e.clientX - g.x;
          const dy = e.clientY - g.y;
          if (Math.hypot(dx, dy) < SLOP) return;
          if (Math.abs(dx) > Math.abs(dy) * H_BIAS) {
            // Horizontal: start dragging from here, so the slop isn't lost or added.
            wrap.current!.setPointerCapture(e.pointerId);
            gesture.current = { kind: 'drag', id: e.pointerId, x: e.clientX, startValue: value, touch: true };
            setDragging(true);
          } else {
            gesture.current = { kind: 'scroll', id: e.pointerId };
          }
          return;
        }
        if (g.touch) onValue(snap(g.startValue + ((e.clientX - g.x) / trackWidth()) * (max - min)));
        else onValue(snap(valueAtX(e.clientX)));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      style={style}
    >
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        onInput={(e) => onValue(parseFloat((e.currentTarget as HTMLInputElement).value))}
      />
    </div>
  );
}
