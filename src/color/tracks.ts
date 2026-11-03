/** CSS gradients for slider tracks: what moving each slider roughly does to the current color. */
import { lchToOklab, oklabToHex, oklabToLch, oklabToRgb, rgbToHex, type OKLab } from './convert';
import { SLIDER_BY_ID, UNDERTONE_HUES, WARM_HUE, type SliderId } from './sliders';

const STOPS = 7;

function gradient(colors: string[]): string {
  return `linear-gradient(to right, ${colors.join(', ')})`;
}

function along(lab: OKLab, hueDeg: number, def: { min: number; max: number }, current: number): string {
  const r = (hueDeg * Math.PI) / 180;
  const out: string[] = [];
  for (let i = 0; i < STOPS; i++) {
    const v = def.min + ((def.max - def.min) * i) / (STOPS - 1);
    const d = (v - current) / 100;
    out.push(oklabToHex([lab[0], lab[1] + d * Math.cos(r), lab[2] + d * Math.sin(r)]));
  }
  return gradient(out);
}

export function sliderTrack(id: SliderId, lab: OKLab): string {
  const def = SLIDER_BY_ID[id];
  const lch = oklabToLch(lab);
  const out: string[] = [];
  const steps = (f: (t: number) => string) => {
    for (let i = 0; i < STOPS; i++) out.push(f(i / (STOPS - 1)));
    return gradient(out);
  };
  switch (id) {
    case 'lrv':
      // LRV is roughly lightness cubed; sample L so the stops land near even LRV steps.
      return steps((t) => oklabToHex(lchToOklab({ ...lch, l: Math.cbrt(Math.max(t, 1e-4)) * 0.999 })));
    case 'lightness':
      return steps((t) => oklabToHex(lchToOklab({ ...lch, l: t })));
    case 'hue':
      return steps((t) => oklabToHex(lchToOklab({ l: lch.l, c: Math.max(lch.c, 0.06), h: t * 360 })));
    case 'chroma':
      return steps((t) => oklabToHex(lchToOklab({ ...lch, c: t * 0.37 })));
    case 'red':
    case 'green':
    case 'blue': {
      const k = id === 'red' ? 0 : id === 'green' ? 1 : 2;
      const rgb = oklabToRgb(lab);
      return steps((t) => {
        const c = rgb.slice() as [number, number, number];
        c[k] = t;
        return rgbToHex(c);
      });
    }
    case 'warmth':
      return along(lab, WARM_HUE, def, def.get(lab));
    default:
      return along(lab, UNDERTONE_HUES[id], def, def.get(lab));
  }
}
