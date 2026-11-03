import { describe, expect, it } from 'vitest';
import { initialState, reducer } from './state';
import type { OKLab } from './color/convert';

const A: OKLab = [0.9, 0, 0.02];
const B: OKLab = [0.8, 0, 0.02];
const C: OKLab = [0.7, 0, 0.02];

describe('editor state', () => {
  it('coalesces a drag into one undo step, but not button presses', () => {
    let s = initialState(A);
    s = reducer(s, { type: 'edit', id: 'lrv', lab: B, limited: false, now: 0 });
    s = reducer(s, { type: 'edit', id: 'lrv', lab: C, limited: false, now: 100 });
    expect(s.past).toHaveLength(1);
    s = reducer(s, { type: 'edit', id: 'lrv', lab: B, limited: false, now: 200, discrete: true });
    expect(s.past).toHaveLength(2);
    s = reducer(s, { type: 'undo' });
    expect(s.current).toEqual(C);
    s = reducer(s, { type: 'undo' });
    expect(s.current).toEqual(A);
    s = reducer(s, { type: 'redo' });
    expect(s.current).toEqual(C);
  });

  it('locks hold a value; reset all restores the original and clears locks', () => {
    let s = initialState(A);
    s = reducer(s, { type: 'toggleLock', id: 'lrv', value: 80 });
    expect(s.locks.lrv).toBe(80);
    s = reducer(s, { type: 'edit', id: 'warmth', lab: B, limited: true, now: 0 });
    expect(s.limited).toBe('warmth');
    s = reducer(s, { type: 'resetAll' });
    expect(s.current).toEqual(A);
    expect(s.locks).toEqual({});
    s = reducer(s, { type: 'toggleLock', id: 'hue', value: 10 });
    s = reducer(s, { type: 'toggleLock', id: 'hue', value: 10 });
    expect(s.locks.hue).toBeUndefined();
  });

  it('selecting a paint makes it the new original', () => {
    let s = initialState(A);
    s = reducer(s, { type: 'selectPaint', ref: { brand: 'sw', index: 3 }, lab: B });
    expect(s.original).toEqual({ brand: 'sw', index: 3 });
    expect(s.current).toEqual(B);
    expect(s.originalLab).toEqual(B);
  });
});
