import type { OKLab } from './color/convert';
import type { SliderId } from './color/sliders';
import type { Locks } from './color/solver';
import type { PaintRef } from './data/store';

/** The part of the state that undo/redo restores. */
export interface Snapshot {
  original: PaintRef | null;
  originalLab: OKLab;
  current: OKLab;
  locks: Locks;
}

export interface EditorState extends Snapshot {
  /** Slider whose last move was clamped by locks/gamut, for the "limited by locks" hint. */
  limited: SliderId | null;
  past: Snapshot[];
  future: Snapshot[];
  /** Coalesces a drag (many edits of one slider) into a single undo step. */
  lastEdit: { id: SliderId; at: number } | null;
}

export type Action =
  | { type: 'selectPaint'; ref: PaintRef; lab: OKLab; keepCurrent?: boolean }
  | { type: 'edit'; id: SliderId; lab: OKLab; limited: boolean; now: number; discrete?: boolean }
  | { type: 'setColor'; lab: OKLab }
  | { type: 'toggleLock'; id: SliderId; value: number }
  | { type: 'resetAll' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'restore'; snapshot: Snapshot }
  | { type: 'clearLimited' };

const HISTORY_LIMIT = 200;
const COALESCE_MS = 1200;

export function initialState(lab: OKLab): EditorState {
  return { original: null, originalLab: lab, current: lab, locks: {}, limited: null, past: [], future: [], lastEdit: null };
}

const snap = (s: EditorState): Snapshot => ({ original: s.original, originalLab: s.originalLab, current: s.current, locks: s.locks });

function pushed(s: EditorState): EditorState {
  const past = s.past.length >= HISTORY_LIMIT ? s.past.slice(1) : s.past.slice();
  past.push(snap(s));
  return { ...s, past, future: [], lastEdit: null };
}

export function reducer(s: EditorState, a: Action): EditorState {
  switch (a.type) {
    case 'selectPaint': {
      const n = pushed(s);
      return { ...n, original: a.ref, originalLab: a.lab, current: a.keepCurrent ? s.current : a.lab, limited: null, locks: a.keepCurrent ? s.locks : {} };
    }
    case 'edit': {
      const coalesce = !a.discrete && s.lastEdit && s.lastEdit.id === a.id && a.now - s.lastEdit.at < COALESCE_MS;
      const n = coalesce ? s : pushed(s);
      return { ...n, current: a.lab, limited: a.limited ? a.id : null, lastEdit: a.discrete ? null : { id: a.id, at: a.now } };
    }
    case 'setColor':
      return { ...pushed(s), current: a.lab, limited: null };
    case 'toggleLock': {
      const locks = { ...s.locks };
      if (locks[a.id] === undefined) locks[a.id] = a.value;
      else delete locks[a.id];
      return { ...s, locks, lastEdit: null };
    }
    case 'resetAll':
      return { ...pushed(s), current: s.originalLab, limited: null, locks: {} };
    case 'undo': {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { ...s, ...prev, past: s.past.slice(0, -1), future: [snap(s), ...s.future], limited: null, lastEdit: null };
    }
    case 'redo': {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { ...s, ...next, past: [...s.past, snap(s)], future: rest, limited: null, lastEdit: null };
    }
    case 'restore':
      return { ...s, ...a.snapshot, past: [], future: [], limited: null, lastEdit: null };
    case 'clearLimited':
      return { ...s, limited: null };
  }
}
