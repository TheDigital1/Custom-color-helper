import { useEffect, useRef } from 'preact/hooks';
import { HUE_NAMES } from '../color/describe';
import { renderWheelRect } from './geometry';
import type { MapPoints } from './points';

export interface View {
  /** World point at the center of the screen. */
  x: number;
  y: number;
  /** Zoom as a multiple of "whole wheel fits on screen". */
  zoom: number;
}

interface Props {
  points: MapPoints | null;
  ids: Uint32Array;
  background: HTMLCanvasElement | null;
  /** World half-size the background image covers. */
  extent: number;
  /** Lightness of the slice (LRV), for sharp backgrounds when zoomed in. */
  lrv: number;
  view: View;
  onView(v: View): void;
  selected: number;
  onSelect(id: number): void;
  /** World position of the current color from the tuner, if any. */
  marker: [number, number] | null;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 600;
/** Show names once at most this many dots are on screen. */
const LABEL_MAX = 1200;

export function MapCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Latest props for the imperative draw/gesture code.
  const p = useRef(props);
  p.current = props;
  const view = useRef<View>(props.view);
  const frame = useRef(0);
  const size = useRef({ w: 1, h: 1, dpr: 1 });
  const widths = useRef(new Map<string, number>());
  /** Background re-rendered for the current viewport when zoomed in (the full-wheel image blurs). */
  const region = useRef<{ img: HTMLCanvasElement; xmin: number; ymax: number; ww: number; wh: number; lrv: number } | null>(null);
  const regionTimer = useRef(0);
  /** True while a finger, mouse button or scroll-wheel gesture is in progress. */
  const interacting = useRef(false);
  /** Snapshot of the last full frame, moved around during gestures in busy views. */
  const snap = useRef<{ img: HTMLCanvasElement; x: number; y: number; s: number; key: unknown[] } | null>(null);
  const lastVisible = useRef(0);
  /** Above this many dots on screen, gestures move a snapshot instead of redrawing. */
  const FAST_ABOVE = 2500;

  const fit = () => Math.min(size.current.w, size.current.h) * 0.4;
  const scale = () => fit() * view.current.zoom;

  const draw = () => {
    frame.current = 0;
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const { w, h, dpr } = size.current;
    const { points, ids, background, extent, selected, marker } = p.current;
    const v = view.current;
    const s = scale();
    const cx = w / 2;
    const cy = h / 2;
    const X = (x: number) => cx + (x - v.x) * s;
    const Y = (y: number) => cy - (y - v.y) * s;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const key = [points, ids, background, selected, marker, p.current.lrv, w, h, dark];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Fast path during gestures in busy views: move/scale the last full frame.
    const sn = snap.current;
    if (interacting.current && lastVisible.current > FAST_ABOVE && sn && sn.key.every((k, i) => k === key[i])) {
      if (background) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(background, X(-extent), Y(extent), 2 * extent * s, 2 * extent * s);
      }
      const k = s / sn.s;
      // Where the snapshot's top-left corner (world point) lands now.
      const ox = X(sn.x - cx / sn.s);
      const oy = Y(sn.y + cy / sn.s);
      ctx.drawImage(sn.img, ox, oy, w * k, h * k);
      return;
    }

    if (background) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(background, X(-extent), Y(extent), 2 * extent * s, 2 * extent * s);
    }
    const rg = region.current;
    if (rg && v.zoom >= 2.5 && rg.lrv === p.current.lrv) ctx.drawImage(rg.img, X(rg.xmin), Y(rg.ymax), rg.ww * s, rg.wh * s);
    if (v.zoom >= 2.5 && (!rg || rg.lrv !== p.current.lrv || Math.abs(rg.ww * s - w * 1.5) > 2 || X(rg.xmin) > 0 || Y(rg.ymax) > 0 || X(rg.xmin + rg.ww) < w || Y(rg.ymax - rg.wh) < h)) {
      clearTimeout(regionTimer.current);
      if (!interacting.current) regionTimer.current = window.setTimeout(renderRegion, 120);
    }
    // Wheel outline, gray center and hue names around the rim.
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), s, 0, Math.PI * 2);
    ctx.stroke();
    if (v.zoom < 4) {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const [deg, name] of HUE_NAMES) {
        const a = (deg * Math.PI) / 180;
        ctx.fillText(name, X(Math.cos(a) * 1.1), Y(Math.sin(a) * 1.1));
      }
    }

    let visible = 0;
    let labels = 0;
    if (points) {
      const r = Math.min(9, Math.max(1.6, s * 0.0035));
      const pad = 0.02 + 40 / s;
      const x0 = v.x - cx / s - pad;
      const x1 = v.x + cx / s + pad;
      const y0 = v.y - cy / s - pad;
      const y1 = v.y + cy / s + pad;
      const onScreen: number[] = [];
      for (let k = 0; k < ids.length; k++) {
        const id = ids[k];
        const x = points.x[id];
        const y = points.y[id];
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        onScreen.push(id);
      }
      visible = onScreen.length;
      const outline = r >= 3;
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
      for (const id of onScreen) {
        const sx = X(points.x[id]);
        const sy = Y(points.y[id]);
        ctx.fillStyle = points.color[id];
        if (!outline) {
          ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      if (visible <= LABEL_MAX) {
        // Greedy label placement: skip any label that would overlap one already drawn.
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const grid = new Map<number, [number, number, number, number][]>();
        // Paints stacked at (almost) the same spot get a "+N" on their label.
        const cell = Math.max(2, r * 0.8);
        const stacks = new Map<number, number>();
        const key = (id: number) => Math.round(X(points.x[id]) / cell) * 100003 + Math.round(Y(points.y[id]) / cell);
        for (const id of onScreen) stacks.set(key(id), (stacks.get(key(id)) ?? 0) + 1);
        const order = selected >= 0 && onScreen.includes(selected) ? [selected, ...onScreen.filter((i) => i !== selected)] : onScreen;
        for (const id of order) {
          const more = (stacks.get(key(id)) ?? 1) - 1;
          const text = more > 0 ? `${points.label[id]} +${more}` : points.label[id];
          let tw = widths.current.get(text);
          if (tw === undefined) {
            tw = ctx.measureText(text).width;
            widths.current.set(text, tw);
          }
          const lx = X(points.x[id]) + r + (id === selected ? 11 : 4);
          const ly = Y(points.y[id]);
          const box: [number, number, number, number] = [lx - 3, ly - 9, lx + tw + 3, ly + 9];
          if (box[2] < 0 || box[0] > w || box[3] < 0 || box[1] > h) continue;
          // Overlap test against labels in the grid cells this box touches.
          const gx0 = Math.floor(box[0] / 64);
          const gx1 = Math.floor(box[2] / 64);
          const gy0 = Math.floor(box[1] / 32);
          const gy1 = Math.floor(box[3] / 32);
          let hit = false;
          for (let gx = gx0; gx <= gx1 && !hit; gx++) {
            for (let gy = gy0; gy <= gy1 && !hit; gy++) {
              for (const b of grid.get(gx * 4096 + gy) ?? []) {
                if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) {
                  hit = true;
                  break;
                }
              }
            }
          }
          if (hit) continue;
          for (let gx = gx0; gx <= gx1; gx++) {
            for (let gy = gy0; gy <= gy1; gy++) {
              const k = gx * 4096 + gy;
              const list = grid.get(k);
              if (list) list.push(box);
              else grid.set(k, [box]);
            }
          }
          ctx.fillStyle = dark ? 'rgba(20,20,24,0.78)' : 'rgba(255,255,255,0.82)';
          ctx.beginPath();
          ctx.roundRect(box[0], box[1], box[2] - box[0], box[3] - box[1], 5);
          ctx.fill();
          ctx.fillStyle = dark ? '#ececf0' : '#1b1b1f';
          ctx.fillText(text, lx, ly);
          labels++;
        }
      }

      if (selected >= 0) {
        const sx = X(points.x[selected]);
        const sy = Y(points.y[selected]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = dark ? '#ffffff' : '#111111';
        ctx.beginPath();
        ctx.arc(sx, sy, r + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (marker) {
      const mx = X(marker[0]);
      const my = Y(marker[1]);
      ctx.lineWidth = 2.5;
      for (const [col, rad] of [
        ['#ffffff', 11],
        ['#000000', 8],
      ] as const) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.arc(mx, my, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Exposed for tests and debugging.
    c.dataset.visible = String(visible);
    c.dataset.labels = String(labels);
    lastVisible.current = visible;
    if (visible > FAST_ABOVE) {
      let img = snap.current?.img;
      if (!img || img.width !== c.width || img.height !== c.height) {
        img = document.createElement('canvas');
        img.width = c.width;
        img.height = c.height;
      }
      const ic = img.getContext('2d')!;
      ic.clearRect(0, 0, img.width, img.height);
      ic.drawImage(c, 0, 0);
      snap.current = { img, x: v.x, y: v.y, s, key };
    }
  };

  const endInteraction = () => {
    interacting.current = false;
    schedule();
  };

  /** Render the background for 1.5× the visible area at half resolution. */
  const renderRegion = () => {
    const { w, h } = size.current;
    const v = view.current;
    const s = scale();
    if (v.zoom < 2.5) return;
    const ww = (w * 1.5) / s;
    const wh = (h * 1.5) / s;
    const pw = Math.ceil(w * 0.6);
    const ph = Math.ceil(h * 0.6);
    const xmin = v.x - ww / 2;
    const ymax = v.y + wh / 2;
    const lrv = p.current.lrv;
    const img = document.createElement('canvas');
    img.width = pw;
    img.height = ph;
    img.getContext('2d')!.putImageData(new ImageData(renderWheelRect(pw, ph, xmin, ymax, ww / pw, lrv), pw, ph), 0, 0);
    region.current = { img, xmin, ymax, ww, wh, lrv };
    schedule();
  };

  const schedule = () => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  };

  const setView = (v: View, notify = true) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom));
    const lim = 1.3;
    view.current = { x: Math.max(-lim, Math.min(lim, v.x)), y: Math.max(-lim, Math.min(lim, v.y)), zoom };
    schedule();
    if (notify) p.current.onView(view.current);
  };

  const zoomAt = (px: number, py: number, factor: number) => {
    const v = view.current;
    const s0 = scale();
    const { w, h } = size.current;
    const wx = v.x + (px - w / 2) / s0;
    const wy = v.y - (py - h / 2) / s0;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
    const s1 = fit() * zoom;
    setView({ zoom, x: wx - (px - w / 2) / s1, y: wy + (py - h / 2) / s1 });
  };

  // Follow view changes made by the page (search, zoom buttons).
  useEffect(() => {
    const a = view.current;
    const b = props.view;
    if (a.x !== b.x || a.y !== b.y || a.zoom !== b.zoom) setView(b, false);
  }, [props.view]);

  useEffect(schedule, [props.points, props.ids, props.background, props.selected, props.marker, props.lrv]);

  // Size the canvas to its box at device resolution.
  useEffect(() => {
    const c = canvas.current!;
    const ro = new ResizeObserver(() => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      size.current = { w: r.width, h: r.height, dpr };
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      draw();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // Gestures: one finger/mouse pans, two fingers pinch-zoom, wheel zooms, tap selects,
  // double-tap zooms in.
  useEffect(() => {
    const c = canvas.current!;
    const pts = new Map<number, { x: number; y: number }>();
    let tap: { x: number; y: number; t: number } | null = null;
    let lastTap: { x: number; y: number; t: number } | null = null;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    let wheelTimer = 0;
    const down = (e: PointerEvent) => {
      interacting.current = true;
      c.setPointerCapture(e.pointerId);
      const q = local(e);
      pts.set(e.pointerId, q);
      tap = pts.size === 1 ? { ...q, t: performance.now() } : null;
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const q = local(e);
      if (tap && Math.hypot(q.x - tap.x, q.y - tap.y) > 8) tap = null;
      if (pts.size === 1) {
        const s = scale();
        const v = view.current;
        pts.set(e.pointerId, q);
        setView({ ...v, x: v.x - (q.x - prev.x) / s, y: v.y + (q.y - prev.y) / s });
      } else if (pts.size === 2) {
        const other = [...pts.entries()].find(([id]) => id !== e.pointerId)![1];
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(q.x - other.x, q.y - other.y);
        const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
        const m1 = { x: (q.x + other.x) / 2, y: (q.y + other.y) / 2 };
        pts.set(e.pointerId, q);
        // Pan with the midpoint, then zoom around it.
        const s = scale();
        const v = view.current;
        setView({ ...v, x: v.x - (m1.x - m0.x) / s, y: v.y + (m1.y - m0.y) / s }, false);
        if (d0 > 0) zoomAt(m1.x, m1.y, d1 / d0);
      }
    };
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0) endInteraction();
      if (e.type !== 'pointerup' || !tap) return;
      const q = local(e);
      const now = performance.now();
      if (now - tap.t < 400) {
        if (lastTap && now - lastTap.t < 320 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 30) {
          zoomAt(q.x, q.y, 2.5);
          lastTap = null;
        } else {
          select(q.x, q.y);
          lastTap = { ...q, t: now };
        }
      }
      tap = null;
    };
    const select = (sx: number, sy: number) => {
      const { points, ids } = p.current;
      if (!points) return;
      const s = scale();
      const v = view.current;
      const { w, h } = size.current;
      let best = -1;
      let bestD = 22 * 22;
      for (let k = 0; k < ids.length; k++) {
        const id = ids[k];
        const dx = w / 2 + (points.x[id] - v.x) * s - sx;
        const dy = h / 2 - (points.y[id] - v.y) * s - sy;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
      p.current.onSelect(best);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      interacting.current = true;
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(endInteraction, 160);
      const q = local(e);
      zoomAt(q.x, q.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
    };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', wheel, { passive: false });
    return () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
      c.removeEventListener('wheel', wheel);
    };
  }, []);

  return <canvas ref={canvas} class="map-canvas" aria-label="Color map: drag to move, pinch or scroll to zoom, tap a dot for details" role="img" />;
}
