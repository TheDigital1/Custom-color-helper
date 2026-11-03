/** Shareable state in the URL hash: original paint, current OKLab, locks, lighting. */
import type { OKLab } from './color/convert';
import { LIGHTING_BY_ID, type LightingId } from './color/lighting';
import { SLIDER_BY_ID, type SliderId } from './color/sliders';
import type { Locks } from './color/solver';

export interface SharedState {
  /** paintKey of the original, e.g. "sw:SW 7008". */
  paint: string | null;
  current: OKLab | null;
  /** OKLab of the original, used when the paint can't be resolved (e.g. a custom start). */
  originalLab: OKLab | null;
  locks: Locks;
  lighting: LightingId;
  adaptation: number;
}

const num = (x: number) => String(Math.round(x * 1e6) / 1e6);
const parseLab = (s: string | null): OKLab | null => {
  if (!s) return null;
  const parts = s.split(',').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? (parts as OKLab) : null;
};

export function encodeState(s: SharedState): string {
  const p = new URLSearchParams();
  if (s.paint) p.set('p', s.paint);
  if (s.current) p.set('c', s.current.map(num).join(','));
  if (s.originalLab) p.set('o', s.originalLab.map(num).join(','));
  const locks = Object.entries(s.locks).filter(([, v]) => v !== undefined);
  if (locks.length) p.set('l', locks.map(([k, v]) => `${k}:${num(v!)}`).join(','));
  if (s.lighting !== 'd65') {
    p.set('light', s.lighting);
    p.set('a', String(Math.round(s.adaptation * 100)));
  }
  return p.toString();
}

export function decodeState(hash: string): SharedState | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('p') && !p.has('c')) return null;
  const locks: Locks = {};
  for (const part of (p.get('l') ?? '').split(',')) {
    const [k, v] = part.split(':');
    const n = Number(v);
    if (k in SLIDER_BY_ID && v !== undefined && Number.isFinite(n)) locks[k as SliderId] = n;
  }
  const light = p.get('light') as LightingId | null;
  const a = Number(p.get('a'));
  return {
    paint: p.get('p'),
    current: parseLab(p.get('c')),
    originalLab: parseLab(p.get('o')),
    locks,
    lighting: light && light in LIGHTING_BY_ID ? light : 'd65',
    adaptation: p.has('a') && Number.isFinite(a) ? Math.min(1, Math.max(0, a / 100)) : 0.6,
  };
}
